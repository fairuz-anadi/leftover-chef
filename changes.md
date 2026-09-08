# Leftover Chef - Vision Service Implementation & Changes Log

This document records the additions, configuration updates, and verification results made to integrate the fine-tuned vision sidecar (`best.pt`) into the Leftover Chef application.

---

## 1. Overview of Changes

In accordance with the project design (refer to `docs/PROJECT-DOSSIER.md` Section 6), the vision sidecar was enhanced to use the custom fine-tuned YOLOv8n model (`best.pt`) as the primary inference engine while keeping all existing core application directories (`app/`, `client/`, `routes/`, `database/`, etc.) strictly intact.

### Summary Table

| Component | Path | Action | Description |
| :--- | :--- | :--- | :--- |
| **Model Weights** | `vision/weights/best.pt` | **Added** | Copied fine-tuned YOLOv8n weights (~5.96 MB) from `Downloads` into repository. |
| **Backend Configuration** | `vision/detector.py` | **Modified** | Configured `finetuned` (`best.pt`) as primary backend; updated label resolution and class counting. |
| **Class Vocabulary** | `vision/vocabulary.json` | **Modified** | Added `finetuned_map` to map all 30 model classes to canonical Laravel ingredients. |
| **Python Environment** | `vision/.venv/` | **Created** | Created isolated virtual environment with `ultralytics`, `torch`, `fastapi`, `uvicorn`, `pillow`. |
| **Documentation** | `changes.md` | **Created** | Comprehensive English log of all implementation details and verification results. |

---

## 2. Detailed Technical Changes

### 2.1 Model Weights Integration (`vision/weights/best.pt`)
- **Source**: `C:\Users\Hp\Downloads\best.pt`
- **Destination**: `c:\Users\Hp\Desktop\leftover-chef\vision\weights\best.pt`
- **Model Architecture**: Ultralytics YOLOv8n (detect task), trained on 30 specific food/ingredient classes:
  1. `apple`
  2. `banana`
  3. `beef`
  4. `blueberries`
  5. `bread`
  6. `butter`
  7. `carrot`
  8. `cheese`
  9. `chicken`
  10. `chicken_breast`
  11. `chocolate`
  12. `corn`
  13. `eggs`
  14. `flour`
  15. `goat_cheese`
  16. `green_beans`
  17. `ground_beef`
  18. `ham`
  19. `heavy_cream`
  20. `lime`
  21. `milk`
  22. `mushrooms`
  23. `onion`
  24. `potato`
  25. `shrimp`
  26. `spinach`
  27. `strawberries`
  28. `sugar`
  29. `sweet_potato`
  30. `tomato`

### 2.2 Detector Service Enhancements (`vision/detector.py`)
1. **Backend Priority**:
   Configured the `BACKENDS` fallback hierarchy so the fine-tuned model loads first, falling back to open-vocabulary YOLO-World and COCO if weights are missing:
   ```python
   BACKENDS = [
       ("finetuned", os.environ.get("LC_FT_WEIGHTS", "best.pt")),
       ("world",     os.environ.get("LC_WORLD_WEIGHTS", "yolov8s-worldv2.pt")),
       ("coco",      os.environ.get("LC_COCO_WEIGHTS", "yolov8n.pt")),
   ]
   ```
2. **Safe Weight Resolution**:
   Added a file existence guard in `_load_one()` for the `finetuned` backend. If `best.pt` is missing, it raises `FileNotFoundError` gracefully, enabling automatic fallback to YOLO-World rather than crashing.
3. **Multi-Stage Ingredient Normalization**:
   Enhanced `_to_ingredient(label)` to resolve predictions seamlessly:
   - Matches against `finetuned_map` first.
   - Matches direct `prompt_to_ingredient` mappings.
   - Normalizes underscores to spaces (e.g., `chicken_breast` -> `chicken breast`, `ground_beef` -> `ground beef`).
   - Falls back to `coco_map` for COCO predictions.
   - Falls back to capitalized ingredient names for custom fine-tuned labels.
4. **Dynamic Health Reporting**:
   Updated `describe()` so that when a fine-tuned model is active, the reported `class_count` accurately reflects the model's classes (30) rather than the default open-vocabulary prompt list count.

### 2.3 Vocabulary Mapping (`vision/vocabulary.json`)
Added the `finetuned_map` dictionary matching the 30 classes of `best.pt` to the canonical database ingredient names defined in `database/seeders/IngredientSeeder.php` and resolved by `App\Http\Services\DetectionMapper`:
- `apple` -> `Apple`
- `banana` -> `Banana`
- `beef` -> `Beef Mince`
- `blueberries` -> `Blueberries`
- `bread` -> `Bread`
- `butter` -> `Butter`
- `carrot` -> `Carrot`
- `cheese` -> `Cheddar Cheese`
- `chicken` -> `Chicken Breast`
- `chicken_breast` -> `Chicken Breast`
- `chocolate` -> `Chocolate`
- `corn` -> `Sweetcorn`
- `eggs` -> `Egg`
- `flour` -> `Flour`
- `goat_cheese` -> `Cheddar Cheese`
- `green_beans` -> `Green Beans`
- `ground_beef` -> `Beef Mince`
- `ham` -> `Bacon`
- `heavy_cream` -> `Cream`
- `lime` -> `Lime`
- `milk` -> `Milk`
- `mushrooms` -> `Mushroom`
- `onion` -> `Onion`
- `potato` -> `Potato`
- `shrimp` -> `Prawns`
- `spinach` -> `Spinach`
- `strawberries` -> `Strawberries`
- `sugar` -> `Sugar`
- `sweet_potato` -> `Sweet Potato`
- `tomato` -> `Tomato`

### 2.4 Vision Virtual Environment (`vision/.venv`)
- Initialized virtual environment using Python 3.13 (`python -m venv vision/.venv --system-site-packages`).
- Installed all required packages:
  - `ultralytics` (YOLO inference runtime)
  - `torch` & `torchvision` (PyTorch CPU / CUDA tensor backend)
  - `fastapi` & `uvicorn` (ASGI HTTP server)
  - `python-multipart` (Multipart form parser for image uploads)
  - `pillow` (Image processing)

---

## 3. Verification & Testing

### 3.1 Model Loading Test
Loaded `Detector()` in Python and verified:
- **Ready**: `True`
- **Backend**: `finetuned`
- **Weights file**: `best.pt`
- **Class count**: `30`
- **Error**: `None`

### 3.2 Live Photo Inference Test
Ran an inference against the sample photo `client/src/assets/demo-photos/1-kitchen-counter.jpg`:
- **Processing Time**: ~313 ms
- **Detections**:
  - `potato` (confidence: 0.90) -> mapped to `Potato`
  - `chicken` (confidence: 0.65) -> mapped to `Chicken Breast`
  - `spinach` (confidence: 0.23) -> mapped to `Spinach`
  - `flour` (confidence: 0.23) -> mapped to `Flour`

### 3.3 HTTP API Verification
Tested FastAPI endpoints with a test client:
- **`GET /health`**:
  ```json
  {
    "service": "leftover-chef-vision",
    "status": "ok",
    "detector": {
      "ready": true,
      "backend": "finetuned",
      "weights": "best.pt",
      "class_count": 30,
      "error": null
    }
  }
  ```
- **`POST /detect`**:
  - Returned HTTP `200 OK` with structured detections, bounding box coordinates, confidence scores, and canonical ingredient names.

---

## 4. How to Run the Vision Service

### Option A: Via the Project Demo Script
Run the automated multi-service startup script from PowerShell:
```powershell
.\scripts\start-demo.ps1
```
This automatically spins up the vision sidecar on `http://127.0.0.1:8001`, the Laravel API on `http://127.0.0.1:8000`, and the Vite client on `http://localhost:5173`.

### Option B: Standalone Vision Service
To run the vision sidecar independently:
```powershell
cd vision
.\.venv\Scripts\python.exe app.py
```
The sidecar will start on `http://127.0.0.1:8001`.
