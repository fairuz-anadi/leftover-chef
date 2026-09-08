"""
Model loading and inference for the Leftover Chef fridge detector.

Two backends, tried in order:

  world  - YOLO-World (open vocabulary). The class list comes from
           vocabulary.json, so the detector looks for "carton of milk" and
           "green chilli pepper" without anyone fine-tuning anything.
  coco   - plain YOLOv8n on the 80 COCO classes. Only five of them are
           actually food, so this is the "the laptop could not load the
           world weights" fallback, not the plan.

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

log = logging.getLogger("leftover-chef.detector")

HERE = Path(__file__).resolve().parent
WEIGHTS_DIR = Path(os.environ.get("LC_WEIGHTS_DIR", HERE / "weights"))
VOCAB_PATH = Path(os.environ.get("LC_VOCAB", HERE / "vocabulary.json"))

# Ordered by preference. First one that loads wins.
BACKENDS = [
    ("finetuned", os.environ.get("LC_FT_WEIGHTS", "best.pt")),
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
            try:
                self._load_one(backend, weights)
                log.info("detector ready: backend=%s weights=%s", backend, weights)
                return
            except Exception as exc:
                failures.append(f"{backend}({weights}): {exc}")
                log.warning("backend %s failed to load: %s", backend, exc)

        self.error = "no detector backend could be loaded - " + "; ".join(failures)
        log.error(self.error)

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
            model = YOLO(path)

        self.model = model
        self.backend = backend
        self.weights = os.path.basename(path)
        self.error = None

    @property
    def ready(self) -> bool:
        return self.model is not None

    # -- inference -----------------------------------------------------

    def detect(self, image, confidence: float = 0.12, image_size: int = 640):
        """Run the model over a PIL image. Returns (detections, elapsed_ms)."""
        if not self.ready:
            raise RuntimeError(self.error or "detector is not loaded")

        started = time.perf_counter()
        results = self.model.predict(
            image,
            conf=confidence,
            imgsz=image_size,
            verbose=False,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000

        detections: list[Detection] = []

        for result in results:
            names = result.names or {}
            boxes = getattr(result, "boxes", None)

            if boxes is None:
                continue

            for box in boxes:
                label = str(names.get(int(box.cls[0]), "")).strip()
                ingredient = self._to_ingredient(label)

                if ingredient is None:
                    continue

                detections.append(
                    Detection(
                        label=label,
                        ingredient=ingredient,
                        confidence=round(float(box.conf[0]), 4),
                        box=[round(float(v), 1) for v in box.xyxy[0].tolist()],
                    )
                )

        return detections, round(elapsed_ms, 1)

    def _to_ingredient(self, label: str) -> str | None:
        """Detector label to canonical ingredient name, or None to drop it."""
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

        # 3. Normalized without underscores
        spaced = clean.replace("_", " ")
        if spaced in self.vocabulary["prompt_to_ingredient"]:
            return self.vocabulary["prompt_to_ingredient"][spaced]

        # 4. COCO labels only reach here on the fallback backend. Anything mapped
        # to null (bowl, fork, refrigerator) is furniture, not food.
        if clean in self.vocabulary.get("coco_map", {}):
            return self.vocabulary["coco_map"][clean]

        # 5. Default fallback for fine-tuned models: clean spaced title case
        if self.backend == "finetuned":
            return spaced.title()

        return None

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
