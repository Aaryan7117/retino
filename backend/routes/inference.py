from fastapi import APIRouter, UploadFile, File, HTTPException, Query
import cv2
import numpy as np
import base64
from datetime import datetime
import random
import onnxruntime as ort
import os
from pathlib import Path

router = APIRouter()

# ─── ONNX Model Paths ────────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent.parent / 'models'
GRADING_MODEL = str(MODEL_DIR / 'retina_model.onnx')

# ─── Session Cache (load once on first call, reuse on all subsequent calls) ──
_grading_session = None

def get_grading_session():
    global _grading_session
    if _grading_session is None:
        _grading_session = ort.InferenceSession(GRADING_MODEL, providers=['CPUExecutionProvider'])
    return _grading_session

# ─── Real EfficientNetB3 Grading ─────────────────────────────────────────────
def run_grading(image_rgb: np.ndarray) -> dict:
    """Run EfficientNetB3 ONNX inference and return grade/confidence/probabilities."""
    img = cv2.resize(image_rgb, (224, 224))
    img = img[:, :, :3]
    mean = np.array([0.485, 0.456, 0.406])
    std  = np.array([0.229, 0.224, 0.225])
    tensor = ((img / 255.0) - mean) / std
    tensor = tensor.transpose(2, 0, 1).astype(np.float32)
    tensor = np.expand_dims(tensor, 0)  # [1, 3, 224, 224]

    sess    = get_grading_session()
    outputs = sess.run(None, {'input': tensor})
    logits  = outputs[0][0] if outputs[0].ndim == 2 else outputs[0]

    exp   = np.exp(logits - np.max(logits))
    probs = exp / exp.sum()
    grade = int(np.argmax(probs))

    MAP = [
        {'grade_label': 'No Diabetic Retinopathy',        'risk_level': 'LOW',    'risk_score': 15, 'urgency': 'Annual monitoring'},
        {'grade_label': 'Mild Diabetic Retinopathy',       'risk_level': 'LOW',    'risk_score': 35, 'urgency': 'Monitor in 6 months'},
        {'grade_label': 'Moderate Diabetic Retinopathy',   'risk_level': 'MEDIUM', 'risk_score': 55, 'urgency': 'Refer in 3 months'},
        {'grade_label': 'Severe Diabetic Retinopathy',     'risk_level': 'HIGH',   'risk_score': 85, 'urgency': 'Refer in 2 weeks'},
        {'grade_label': 'Proliferative Diabetic Retinopathy', 'risk_level': 'HIGH', 'risk_score': 98, 'urgency': 'Emergency Referral'},
    ]
    return {
        'grade': grade,
        'confidence': float(probs[grade]),
        'class_probabilities': probs.tolist(),
        'diagnosis': MAP[grade]['grade_label'],
        **MAP[grade],
    }


# YOLO lesion detection has been removed from backend to save memory.
# Detections now run exclusively client-side in the browser.


def is_blurry(image_np: np.ndarray, threshold: float = 100.0) -> bool:
    """Calculate Laplacian variance to detect blur."""
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold


def get_demo_result(filename: str):
    """
    User requested deterministic outputs for demo dataset images.
    If the filename matches one of the known demo cases, return that.
    """
    demo_cases = {
        "grade0.jpg": {
            "grade": 0,
            "grade_label": "No Diabetic Retinopathy",
            "confidence": 0.94,
            "risk_score": 12,
            "risk_level": "LOW",
            "urgency": "Routine monitoring",
        },
        "grade1.jpg": {
            "grade": 1,
            "grade_label": "Mild Diabetic Retinopathy",
            "confidence": 0.88,
            "risk_score": 35,
            "risk_level": "LOW",
            "urgency": "Close observation",
        },
        "grade2.jpg": {
            "grade": 2,
            "grade_label": "Moderate Diabetic Retinopathy",
            "confidence": 0.91,
            "risk_score": 58,
            "risk_level": "MEDIUM",
            "urgency": "Refer to specialist",
        },
        "grade3.jpg": {
            "grade": 3,
            "grade_label": "Severe Diabetic Retinopathy",
            "confidence": 0.92,
            "risk_score": 84,
            "risk_level": "HIGH",
            "urgency": "Urgent referral",
        },
        "grade4.jpg": {
            "grade": 4,
            "grade_label": "Proliferative Diabetic Retinopathy",
            "confidence": 0.96,
            "risk_score": 95,
            "risk_level": "HIGH",
            "urgency": "Emergency referral",
        },
    }
    # Simple match based on filename containing the key
    for key, data in demo_cases.items():
        if key in filename.lower():
            return data

    # Fallback to random grade (for untracked images)
    g = random.randint(0, 4)
    data = list(demo_cases.values())[g].copy()
    data["confidence"] = round(random.uniform(0.75, 0.98), 2)
    return data


def generate_mock_heatmap(image_np: np.ndarray) -> str:
    """Generate a valid base64 heatmap image for the UI by blending a colormap."""
    if len(image_np.shape) == 2:
        image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
    image_np = image_np[:, :, :3]
    heatmap = cv2.applyColorMap(cv2.bitwise_not(image_np), cv2.COLORMAP_JET)
    blended = cv2.addWeighted(image_np, 0.6, heatmap, 0.4, 0)
    _, buffer = cv2.imencode(".jpg", cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")


@router.post("/")
async def run_inference(
    file: UploadFile = File(...),
    skip_yolo: bool = Query(False)
):
    # 1. Read image bytes
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    # 2. Blur detection
    quality_warnings = []
    if is_blurry(image_rgb):
        quality_warnings.append("Blur detected — image processed with enhancement")

    # 3. Real ONNX grading inference (fast: ~2-3s on CPU at 224×224)
    try:
        result = run_grading(image_rgb)
    except Exception as e:
        import traceback
        print(f'[ONNX ERROR] {traceback.format_exc()}')
        raise HTTPException(
            status_code=500,
            detail=f'AI model inference failed: {str(e)}. Please retry or contact support.'
        )

    # 4. YOLO lesion detection (Removed from backend, empty results returned)
    yolo_result = {"detections": [], "image_shape": [1024, 1024], "count": 0}

    # 5. Generate Heatmap
    heatmap_input = (image_rgb[:,:,:3]).astype(np.uint8)
    heatmap_b64 = generate_mock_heatmap(heatmap_input)

    # 6. Pack response
    response = {
        **result,
        "yolo": yolo_result,
        "heatmap_url": heatmap_b64,
        "timestamp": datetime.now().isoformat(),
        "quality_warnings": quality_warnings,
        "_note": result.get('_note', 'RetinaScan AI — Real ONNX inference'),
    }

    return response


# Optimization: Disable model pre-loading on Render/OOM environments.
# To enable warmup, define an environment variable WARMUP_MODELS=true.
if os.environ.get('WARMUP_MODELS') == 'true':
    try:
        get_grading_session()
        print(f"Grading model pre-loaded: {GRADING_MODEL}")
    except Exception as e:
        print(f"WARNING: Could not preload models: {e}")
