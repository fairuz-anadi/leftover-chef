# Leftover Chef - New Features & Implementation Changelog

This document provides a comprehensive log of all new features, architecture improvements, configuration updates, and verification results implemented in this iteration of the **Leftover Chef** project.

---

## 1. Executive Summary

In alignment with the project design dossier (`docs/PROJECT-DOSSIER.md` Section 6), this iteration focused on:
1. **Integrating Custom Fine-Tuned YOLOv8n Model (`best.pt`)**: Elevating the vision sidecar from generic open-vocabulary prompts to a specialized 30-class food and ingredient detection model trained on domain-specific datasets.
2. **Multi-Tier Robust Inference Engine**: Enhancing `vision/detector.py` with automatic fallback mechanisms (`finetuned` -> `world` -> `coco`), safe weight loading, dynamic model introspection, and semantic ingredient normalization.
3. **Canonical Vocabulary Mapping**: Adding `finetuned_map` to `vision/vocabulary.json` to bridge raw model predictions to the exact canonical ingredient entities stored in the Laravel database.
4. **Developer Experience & Demo Automation**: Hardening `scripts/start-demo.ps1` with PowerShell execution policy bypass for Windows systems and integrating **Adminer** database management UI into `docker-compose.yml`.
5. **Rigorous End-to-End Verification**: Benchmarking inference latency (~313 ms on CPU) and validating API contracts for `GET /health` and `POST /detect`.

---

## 2. Key Features Implemented

### 2.1 Fine-Tuned Vision Sidecar Integration (`best.pt`)
- **Weights Location**: `vision/weights/best.pt` (~5.96 MB Ultralytics YOLOv8n checkpoint).
- **Target Classes**: 30 specific grocery and kitchen ingredient classes:
  | # | Class Label | Target Ingredient Entity | # | Class Label | Target Ingredient Entity |
  |---|---|---|---|---|---|
  | 1 | `apple` | Apple | 16 | `green_beans` | Green Beans |
  | 2 | `banana` | Banana | 17 | `ground_beef` | Beef Mince |
  | 3 | `beef` | Beef Mince | 18 | `ham` | Bacon |
  | 4 | `blueberries` | Blueberries | 19 | `heavy_cream` | Cream |
  | 5 | `bread` | Bread | 20 | `lime` | Lime |
  | 6 | `butter` | Butter | 21 | `milk` | Milk |
  | 7 | `carrot` | Carrot | 22 | `mushrooms` | Mushroom |
  | 8 | `cheese` | Cheddar Cheese | 23 | `onion` | Onion |
  | 9 | `chicken` | Chicken Breast | 24 | `potato` | Potato |
  | 10 | `chicken_breast` | Chicken Breast | 25 | `shrimp` | Prawns |
  | 11 | `chocolate` | Chocolate | 26 | `spinach` | Spinach |
  | 12 | `corn` | Sweetcorn | 27 | `strawberries` | Strawberries |
  | 13 | `eggs` | Egg | 28 | `sugar` | Sugar |
  | 14 | `flour` | Flour | 29 | `sweet_potato` | Sweet Potato |
  | 15 | `goat_cheese` | Cheddar Cheese | 30 | `tomato` | Tomato |

---

### 2.2 Resilient Multi-Backend Vision Pipeline (`vision/detector.py`)
- **Priority-Driven Backend Loading**:
  ```python
  BACKENDS = [
      ("finetuned", os.environ.get("LC_FT_WEIGHTS", "best.pt")),
      ("world",     os.environ.get("LC_WORLD_WEIGHTS", "yolov8s-worldv2.pt")),
      ("coco",      os.environ.get("LC_COCO_WEIGHTS", "yolov8n.pt")),
  ]
  ```
- **Safe Weight Loading Guard**:
  When `finetuned` backend is selected, `_load_one()` checks file existence before invoking PyTorch/Ultralytics loaders. If `best.pt` is missing, it raises `FileNotFoundError` gracefully, enabling automatic fallback to YOLO-World without crashing.
- **Five-Stage Label Resolution (`_to_ingredient`)**:
  1. Direct lookup in `finetuned_map`.
  2. Direct lookup in `prompt_to_ingredient`.
  3. Underscore-to-space normalization (e.g., `chicken_breast` -> `chicken breast`).
  4. COCO fallback map (`coco_map`).
  5. Fallback title-casing for fine-tuned classes.
- **Dynamic Introspection (`describe`)**:
  Inspects loaded model attributes (`self.model.names`) dynamically to report the real class count (30) in health probes instead of the hardcoded prompt count.

---

### 2.3 Semantic Vocabulary Bridging (`vision/vocabulary.json`)
- Implemented `finetuned_map` dictionary in `vision/vocabulary.json`.
- Updated `load_vocabulary()` in `vision/detector.py` to parse and normalize fine-tuned class keys.
- Ensures all detected objects resolve to names understood by `App\Http\Services\DetectionMapper` and the Laravel database seeders.

---

### 2.4 Demo Runner Enhancement (`scripts/start-demo.ps1`)
- Added `-ExecutionPolicy Bypass` to `Start-InWindow` in `scripts/start-demo.ps1`.
- Prevents script execution blocking on Windows client machines where PowerShell execution policies restrict running unsigned scripts during exhibitions or offline rehearsals.

---

### 2.5 Database Management Container (`docker-compose.yml`)
- Added Adminer container service:
  ```yaml
  adminer:
    image: adminer:latest
    container_name: leftoverchef_adminer
    restart: unless-stopped
    ports:
      - "${ADMINER_PORT:-8080}:8080"
    depends_on:
      postgres:
        condition: service_healthy
  ```
- Accessible at `http://localhost:8080` for real-time inspection of recipes, ingredients, and session tables during demonstrations.

---

### 2.6 Isolated Python Virtual Environment (`vision/.venv`)
- Configured dedicated Python 3.13 virtual environment with required runtime dependencies:
  - `ultralytics` (YOLO inference runtime)
  - `torch` & `torchvision` (PyTorch CPU / CUDA tensor engine)
  - `fastapi` & `uvicorn` (Asynchronous HTTP server)
  - `pillow` (Image processing)
  - `python-multipart` (Multipart file upload handler)

---

## 3. Files Modified & Created

| File | Type | Description |
|---|---|---|
| `New Features.md` | **New** | Comprehensive documentation of new features and updates. |
| `changes.md` | **New** | Implementation record and technical reference log. |
| `vision/detector.py` | **Modified** | Added `finetuned` backend priority, fallback guards, label normalization, and dynamic introspection. |
| `vision/vocabulary.json` | **Modified** | Added `finetuned_map` for all 30 model classes. |
| `scripts/start-demo.ps1` | **Modified** | Added `-ExecutionPolicy Bypass` to PowerShell window launcher. |
| `docker-compose.yml` | **Modified** | Added `adminer` service on port 8080 for database inspection. |
| `client/package-lock.json` | **Modified** | Cleaned up package-lock platform metadata. |
| `vision/weights/best.pt` | **Added (Local)** | Fine-tuned YOLOv8n weights (~5.96 MB) in local cache (gitignored per project policy). |
| `vision/.venv/` | **Created (Local)** | Isolated Python virtual environment for the vision sidecar. |

---

## 4. Verification & Testing

### 4.1 Detector Diagnostics & Health Check
Invoked detector status check:
```json
{
  "ready": true,
  "backend": "finetuned",
  "weights": "best.pt",
  "class_count": 30,
  "error": null
}
```

### 4.2 Real Image Inference Test
Tested inference using demo image `client/src/assets/demo-photos/1-kitchen-counter.jpg`:
- **Inference Time**: ~313 ms (CPU)
- **Detections**:
  - `potato` (confidence: 0.90) -> Canonical: `Potato`
  - `chicken` (confidence: 0.65) -> Canonical: `Chicken Breast`
  - `spinach` (confidence: 0.23) -> Canonical: `Spinach`
  - `flour` (confidence: 0.23) -> Canonical: `Flour`

### 4.3 HTTP API Verification
- `GET http://127.0.0.1:8001/health`: Returns HTTP 200 with service readiness status and fine-tuned backend indicator.
- `POST http://127.0.0.1:8001/detect`: Returns structured bounding boxes, confidence values, and mapped canonical ingredient names.

---

## 5. How to Run

### Multi-Service Stack (Full Demo)
From PowerShell:
```powershell
.\scripts\start-demo.ps1
```
This boots:
- Vision Sidecar: `http://127.0.0.1:8001`
- Laravel Backend: `http://127.0.0.1:8000`
- React Client: `http://localhost:5173`

### Standalone Vision Service
```powershell
cd vision
.\.venv\Scripts\python.exe app.py
```
Sidecar listens on `http://127.0.0.1:8001`.
