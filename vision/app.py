"""
Leftover Chef vision sidecar.

A tiny FastAPI service that turns a fridge photo into a list of ingredients.
It binds to localhost only and never calls out to the network at request time,
because the exhibition hall has no internet and the demo has to run anyway.

  GET  /health   what loaded, which backend, how many classes
  POST /detect   multipart image -> detections with boxes and confidence

Laravel proxies to this through App\\Http\\Services\\VisionClient; the browser
never talks to it directly.
"""

from __future__ import annotations

import io
import logging
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps

from detector import Detector, dedupe

logging.basicConfig(
    level=os.environ.get("LC_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
)
log = logging.getLogger("leftover-chef.api")

MAX_UPLOAD_BYTES = int(os.environ.get("LC_MAX_UPLOAD_BYTES", 12 * 1024 * 1024))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}

app = FastAPI(title="Leftover Chef Vision", version="1.0.0")

# Laravel is the only real client, but allowing the Vite dev origin keeps the
# service pokeable from the browser console while building.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

detector = Detector()


@app.on_event("startup")
def warm_up() -> None:
    """
    Load the weights before the first request rather than during it.

    A cold YOLO load is several seconds. Paying that while a judge watches the
    spinner is exactly the demo failure this service exists to avoid.
    """
    detector.load()

    if not detector.ready:
        log.error("startup finished WITHOUT a usable detector: %s", detector.error)
        return

    # One throwaway inference so the first real photo is not also the first
    # time torch allocates its kernels.
    try:
        detector.detect(Image.new("RGB", (640, 640), (128, 128, 128)))
        log.info("warm-up inference done")
    except Exception as exc:  # pragma: no cover - warm-up is best effort
        log.warning("warm-up inference failed (serving anyway): %s", exc)


@app.get("/health")
def health() -> dict:
    return {
        "service": "leftover-chef-vision",
        "status": "ok" if detector.ready else "degraded",
        "detector": detector.describe(),
    }


@app.post("/detect")
async def detect(
    image: UploadFile = File(...),
    confidence: float = Form(0.12),
    image_size: int = Form(640),
) -> dict:
    if not detector.ready:
        raise HTTPException(
            status_code=503,
            detail=detector.error or "detector is not loaded",
        )

    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"unsupported image type: {image.content_type}",
        )

    payload = await image.read()

    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="image is too large")

    try:
        # EXIF transpose matters: a phone photo held sideways detects far worse
        # than the same photo rotated upright.
        frame = ImageOps.exif_transpose(Image.open(io.BytesIO(payload))).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"could not read image: {exc}") from exc

    confidence = min(max(confidence, 0.01), 0.95)
    image_size = 640 if image_size not in (320, 480, 640, 800, 960) else image_size

    try:
        detections, elapsed_ms = detector.detect(frame, confidence=confidence, image_size=image_size)
    except Exception as exc:
        log.exception("inference failed")
        raise HTTPException(status_code=500, detail=f"inference failed: {exc}") from exc

    detections = dedupe(detections)
    detections.sort(key=lambda d: d.confidence, reverse=True)

    log.info(
        "detect: %s -> %d detections in %.0f ms (backend=%s)",
        image.filename,
        len(detections),
        elapsed_ms,
        detector.backend,
    )

    return {
        "detections": [d.to_dict() for d in detections],
        "image": {"width": frame.width, "height": frame.height},
        "meta": {
            "backend": detector.backend,
            "weights": detector.weights,
            "confidence_floor": confidence,
            "image_size": image_size,
            "elapsed_ms": elapsed_ms,
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("LC_HOST", "127.0.0.1"),
        port=int(os.environ.get("LC_PORT", 8001)),
        log_level=os.environ.get("LC_LOG_LEVEL", "info").lower(),
    )
