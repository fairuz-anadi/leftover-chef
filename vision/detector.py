"""
Model loading and inference for the FridgeMama fridge detector.

Two backends, tried in order:

  world  - YOLO-World (open vocabulary). The class list comes from
           vocabulary.json, so the detector looks for "carton of milk" and
           "green chilli pepper" without anyone fine-tuning anything.
  coco   - plain YOLOv8n on the 80 COCO classes. Only five of them are
           actually food, so this is the "the laptop could not load the
           world weights" fallback, not the plan.

  finetuned - a checkpoint trained on a real fridge dataset, if one has been
           dropped into vision/weights. Tried first when present. Its class
           names pass straight through to Laravel, where the alias table
           resolves them, so it needs no changes here beyond the file itself.

Whichever loads, Detector.detect() returns the same shape, and every
detection carries the canonical ingredient name the Laravel side expects.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

log = logging.getLogger("fridgemama.detector")

HERE = Path(__file__).resolve().parent
WEIGHTS_DIR = Path(os.environ.get("LC_WEIGHTS_DIR", HERE / "weights"))
VOCAB_PATH = Path(os.environ.get("LC_VOCAB", HERE / "vocabulary.json"))

# Ordered by preference. First one that loads wins.
BACKENDS = [
    # A fine-tuned checkpoint wins when one is present. Drop best.pt or
    # fridge-finetuned.pt into vision/weights and it is picked up on the next
    # restart; nothing else in the stack changes, because the response shape is identical.
    (
        "finetuned",
        os.environ.get(
            "LC_FT_WEIGHTS",
            "best.pt" if (WEIGHTS_DIR / "best.pt").exists() else "fridge-finetuned.pt",
        ),
    ),
    ("world", os.environ.get("LC_WORLD_WEIGHTS", "yolov8s-worldv2.pt")),
    ("coco", os.environ.get("LC_COCO_WEIGHTS", "yolov8n.pt")),
]


@dataclass
class Detection:
    label: str           # what the detector was asked to look for
    ingredient: str      # canonical name for the ingredients table
    confidence: float
    box: list[float]     # [x1, y1, x2, y2] in pixels

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class VocabularyError(RuntimeError):
    pass


def load_vocabulary(path: Path = VOCAB_PATH) -> dict[str, Any]:
    if not path.exists():
        raise VocabularyError(f"vocabulary file missing: {path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    classes = raw.get("classes") or []

    if not classes:
        raise VocabularyError(f"vocabulary file has no classes: {path}")

    # Two prompts can share an ingredient (egg / carton of eggs), so the prompt
    # list keeps duplicates out while the map keeps both routes open.
    prompts: list[str] = []
    prompt_to_ingredient: dict[str, str] = {}

    for entry in classes:
        prompt = str(entry["prompt"]).strip()
        ingredient = str(entry["ingredient"]).strip()

        if not prompt or not ingredient:
            continue

        if prompt not in prompt_to_ingredient:
            prompts.append(prompt)

        prompt_to_ingredient[prompt] = ingredient

    finetuned_map = {
        str(k).strip().lower(): v
        for k, v in (raw.get("finetuned_map") or {}).items()
    }

    coco_map = {
        str(k).strip().lower(): v
        for k, v in (raw.get("coco_map") or {}).items()
    }

    return {
        "prompts": prompts,
        "prompt_to_ingredient": prompt_to_ingredient,
        "finetuned_map": finetuned_map,
        "coco_map": coco_map,
    }


def _pin_clip_cache() -> None:
    """
    Keep the CLIP text encoder inside this repo.

    YOLO-World turns the prompt list into embeddings with CLIP, and ultralytics
    downloads that 350 MB checkpoint into whatever global weights directory its
    settings.json happens to point at - a path outside this project, shared
    with every other ultralytics install on the machine. If that directory is
    cleaned up, the detector silently needs the internet again, which at the
    venue means it simply does not start.

    Repointing the module-level constant keeps the download beside our own
    weights without writing to the user's global ultralytics settings.
    """
    try:
        from ultralytics.nn import text_model

        text_model.WEIGHTS_DIR = WEIGHTS_DIR
    except Exception as exc:  # pragma: no cover - upstream layout changed
        log.warning("could not pin the CLIP cache to %s: %s", WEIGHTS_DIR, exc)


class Detector:
    """Wraps whichever ultralytics model we managed to load."""

    def __init__(self) -> None:
        self.backend: str | None = None
        self.weights: str | None = None
        self.model = None
        self.error: str | None = None
        self.vocabulary = load_vocabulary()
        self.clip_model = None
        self.clip_prep = None
        self.clip_text_features = None
        self.clip_labels: list[str] = []

    # -- loading -------------------------------------------------------

    def load(self) -> None:
        try:
            import ultralytics  # noqa: F401
        except Exception as exc:  # pragma: no cover - environment issue
            self.error = f"ultralytics is not installed in this environment ({exc})"
            log.error(self.error)
            return

        WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
        forced = os.environ.get("LC_BACKEND")
        backends = [b for b in BACKENDS if not forced or b[0] == forced]
        failures: list[str] = []

        for backend, weights in backends:
            # The fine-tuned slot is empty until somebody drops a file in.
            # Absence is the normal case, not an error worth logging loudly.
            if backend == "finetuned" and not (WEIGHTS_DIR / weights).exists():
                log.info("no fine-tuned checkpoint at %s, trying the next backend", weights)
                continue

            try:
                self._load_one(backend, weights)
                log.info("detector ready: backend=%s weights=%s", backend, weights)
                if self.backend == "world":
                    self._init_clip_verifier()
                return
            except Exception as exc:
                failures.append(f"{backend}({weights}): {exc}")
                log.warning("backend %s failed to load: %s", backend, exc)

        self.error = "no detector backend could be loaded - " + "; ".join(failures)
        log.error(self.error)

    def _init_clip_verifier(self) -> None:
        try:
            import clip
            import torch

            device = "cpu"
            self.clip_model, self.clip_prep = clip.load(
                "ViT-B/32",
                device=device,
                download_root=str(WEIGHTS_DIR / "clip"),
            )
            self.clip_model.eval()

            ingredient_prompts = {
                "Tomato": ["a ripe red tomato", "a fresh round tomato", "a red tomato fruit", "a tomato"],
                "Okra": ["ladies finger vegetable", "ladyfinger vegetable", "fresh okra pod", "bhindi vegetable", "okra"],
                "Green Chilli": ["green chilli pepper", "fresh green chili", "slender green chilli", "hot green chilli"],
                "Bell Pepper": ["sweet bell pepper", "green capsicum", "yellow bell pepper", "red bell pepper"],
                "Apple": ["red apple fruit", "green apple fruit"],
                "Orange": ["orange citrus fruit", "mandarin orange"],
                "Lemon": ["yellow lemon fruit"],
                "Lime": ["green lime fruit"],
                "Cucumber": ["green cucumber vegetable"],
                "Courgette": ["zucchini squash", "green courgette"],
                "Aubergine": ["eggplant aubergine"],
                "Onion": ["fresh onion", "red onion bulb", "yellow onion"],
                "Garlic": ["garlic bulb", "garlic cloves"],
                "Potato": ["brown potato", "raw potato"],
                "Carrot": ["orange carrot vegetable"],
                "Egg": ["chicken egg", "carton of eggs"],
                "Milk": ["carton of milk", "bottle of milk"],
                "Butter": ["block of butter"],
                "Yoghurt": ["tub of yoghurt"],
                "Cheddar Cheese": ["block of cheese"],
                "Chicken Breast": ["raw chicken meat"],
                "White Fish": ["raw fish fillet"],
                "Bread": ["loaf of bread", "sliced bread"],
                "Rice": ["bag of rice", "rice grain packet"],
                "Pasta": ["packet of pasta"],
                "Noodles": ["instant noodles"],
                "Chopped Tomatoes": ["tin of chopped tomatoes", "canned tomatoes"],
                "Black Beans": ["tin of black beans", "can of beans"],
                "Vegetable Oil": ["bottle of cooking oil"],
                "Soy Sauce": ["bottle of soy sauce"],
                "Honey": ["jar of honey"],
                "Peas": ["green peas"],
                "Sweetcorn": ["corn on the cob", "sweetcorn"]
            }

            self.clip_labels = []
            all_prompts = []
            for ing, p_list in ingredient_prompts.items():
                for p in p_list:
                    self.clip_labels.append(ing)
                    all_prompts.append(f"a photo of {p}")

            tokens = clip.tokenize(all_prompts).to(device)
            with torch.no_grad():
                feat = self.clip_model.encode_text(tokens)
                self.clip_text_features = feat / feat.norm(dim=-1, keepdim=True)
            log.info("CLIP verification initialized with %d categories", len(ingredient_prompts))
        except Exception as exc:
            log.warning("CLIP verifier could not be initialized (%s), using pure YOLO", exc)
            self.clip_model = None

    def _load_one(self, backend: str, weights: str) -> None:
        from ultralytics import YOLO, YOLOWorld

        # ultralytics resolves a bare filename against the cwd, so anchor it in
        # weights/ - the first run downloads once into the repo and every later
        # run (venue WiFi off) reads the same file.
        path = weights if os.path.isabs(weights) else str(WEIGHTS_DIR / weights)

        # For fine-tuned weights, skip if local file does not exist so fallback chain works
        if backend == "finetuned" and not os.path.exists(path):
            raise FileNotFoundError(f"fine-tuned weights not found: {path}")

        if backend == "world":
            _pin_clip_cache()
            model = YOLOWorld(path)
            model.set_classes(self.vocabulary["prompts"])
        else:
            # Both "coco" and "finetuned" are ordinary detectors carrying their
            # own class list. Calling set_classes on a fine-tuned model would
            # throw away the thing it was trained to do.
            model = YOLO(path)

        self.model = model
        self.backend = backend
        self.weights = os.path.basename(path)
        self.error = None

    @property
    def ready(self) -> bool:
        return self.model is not None

    # -- inference -----------------------------------------------------

    def detect(self, image, confidence: float = 0.10, image_size: int = 800):
        """Run the model over a PIL image. Returns (detections, elapsed_ms)."""
        if not self.ready:
            raise RuntimeError(self.error or "detector is not loaded")

        started = time.perf_counter()
        # Propose candidate boxes with low threshold so real-world items are not missed
        yolo_thresh = min(confidence, 0.03) if self.clip_model is not None else confidence
        results = self.model.predict(
            image,
            conf=yolo_thresh,
            imgsz=image_size,
            verbose=False,
        )

        W, H = image.size
        proposals: list[tuple[list[float], float, str]] = []

        for result in results:
            names = result.names or {}
            boxes = getattr(result, "boxes", None)

            if boxes is None:
                continue

            for box in boxes:
                xyxy = [round(float(v), 1) for v in box.xyxy[0].tolist()]
                bw = xyxy[2] - xyxy[0]
                bh = xyxy[3] - xyxy[1]
                # Filter out giant container boxes (e.g. big bowls, table, fridge shell) and tiny noise
                if bw * bh > 0.55 * W * H or bw < 20 or bh < 20:
                    continue

                label = str(names.get(int(box.cls[0]), "")).strip()
                proposals.append((xyxy, float(box.conf[0]), label))

        detections: list[Detection] = []

        if self.clip_model is not None and proposals:
            import torch
            crops = []
            valid_proposals = []
            for xyxy, yconf, ylabel in proposals:
                try:
                    crop = image.crop((int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])))
                    crops.append(self.clip_prep(crop))
                    valid_proposals.append((xyxy, yconf, ylabel))
                except Exception:
                    continue

            if crops:
                batch = torch.stack(crops)
                with torch.no_grad():
                    img_feats = self.clip_model.encode_image(batch)
                    img_feats /= img_feats.norm(dim=-1, keepdim=True)
                    sims = (100.0 * img_feats @ self.clip_text_features.T).softmax(dim=-1)

                for (xyxy, yconf, ylabel), sim in zip(valid_proposals, sims):
                    scores: dict[str, float] = {}
                    for ing, s in zip(self.clip_labels, sim):
                        scores[ing] = scores.get(ing, 0.0) + s.item()

                    top_ing = max(scores, key=scores.get)
                    top_score = scores[top_ing]

                    # If CLIP is confident on this crop, trust the fine-grained verifier
                    if top_score >= 0.22:
                        final_ingredient = top_ing
                        final_label = top_ing.lower()
                        final_conf = round(0.4 * yconf + 0.6 * top_score, 4)
                    else:
                        final_ingredient = self._to_ingredient(ylabel)
                        final_label = ylabel
                        final_conf = round(yconf, 4)

                    if final_ingredient and final_conf >= confidence:
                        detections.append(
                            Detection(
                                label=final_label,
                                ingredient=final_ingredient,
                                confidence=final_conf,
                                box=xyxy,
                            )
                        )
        else:
            for xyxy, yconf, ylabel in proposals:
                ingredient = self._to_ingredient(ylabel)
                if ingredient and yconf >= confidence:
                    detections.append(
                        Detection(
                            label=ylabel,
                            ingredient=ingredient,
                            confidence=round(yconf, 4),
                            box=xyxy,
                        )
                    )

        detections = dedupe(detections, iou_threshold=0.50)
        elapsed_ms = (time.perf_counter() - started) * 1000
        return detections, round(elapsed_ms, 1)

    def _to_ingredient(self, label: str) -> str | None:
        """
        Detector label to a name the ingredients table can resolve.

        The order matters. A prompt we asked for maps through the vocabulary; a
        COCO label maps through coco_map, where furniture is deliberately null.
        Anything else is passed through rather than dropped.

        That last rule is the important one. A fine-tuned model brings its own
        class list — strawberries, heavy_cream, ground_beef — none of which are
        prompts here. Dropping them in the sidecar would lose them before
        Laravel ever saw them, where the alias table resolves exactly this kind
        of name. Underscores become spaces because that is the difference
        between "sweet_potato" and a slug the lookup understands.

        Anything the ingredients table genuinely does not know still surfaces:
        DetectionMapper reports it under `unmatched` and the UI shows it, so a
        gap in the vocabulary is visible instead of silent.
        """
        if not label:
            return None

        clean = label.strip().lower()

        # 1. Fine-tuned model explicit mapping
        finetuned_map = self.vocabulary.get("finetuned_map", {})
        if clean in finetuned_map:
            return finetuned_map[clean]

        # 2. Direct match from vocabulary classes
        direct = self.vocabulary["prompt_to_ingredient"].get(label)
        if direct:
            return direct

        cleaned = label.replace("_", " ").replace("-", " ").strip().lower()
        if cleaned in self.vocabulary["prompt_to_ingredient"]:
            return self.vocabulary["prompt_to_ingredient"][cleaned]

        # COCO furniture — bowl, fork, refrigerator — is mapped to null on
        # purpose and is the one case where dropping is correct.
        if cleaned in self.vocabulary["coco_map"]:
            return self.vocabulary["coco_map"][cleaned]

        return cleaned or None

    def describe(self) -> dict[str, Any]:
        class_count = (
            len(self.model.names)
            if (self.model and hasattr(self.model, "names") and self.model.names)
            else len(self.vocabulary["prompts"])
        )
        return {
            "ready": self.ready,
            "backend": self.backend,
            "weights": self.weights,
            "class_count": class_count,
            "error": self.error,
        }


def dedupe(detections: list[Detection], iou_threshold: float = 0.6) -> list[Detection]:
    """
    Collapse overlapping boxes that resolve to the same ingredient.

    Open-vocabulary models happily fire "tomato" and "red tomato" on the same
    pixels; the cook does not want that ingredient listed twice. Boxes for the
    same ingredient that barely overlap are kept - four separate tomatoes on a
    shelf are four boxes, and the count is worth showing.
    """
    kept: list[Detection] = []

    for candidate in sorted(detections, key=lambda d: d.confidence, reverse=True):
        overlaps = any(
            other.ingredient == candidate.ingredient
            and _iou(other.box, candidate.box) >= iou_threshold
            for other in kept
        )

        if not overlaps:
            kept.append(candidate)

    return kept


def _iou(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)

    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    intersection = iw * ih

    if intersection <= 0:
        return 0.0

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - intersection

    return intersection / union if union > 0 else 0.0
