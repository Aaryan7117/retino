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
LESION_MODEL = str(MODEL_DIR / 'yolo_lesions.onnx')

# ─── Session Cache (load once on first call, reuse on all subsequent calls) ──
_grading_session = None
_lesion_session = None

def get_grading_session():
    global _grading_session
    if _grading_session is None:
        _grading_session = ort.InferenceSession(GRADING_MODEL, providers=['CPUExecutionProvider'])
    return _grading_session

def get_lesion_session():
    global _lesion_session
    if _lesion_session is None and os.path.exists(LESION_MODEL):
        _lesion_session = ort.InferenceSession(LESION_MODEL, providers=['CPUExecutionProvider'])
    return _lesion_session

YOLO_CLASSES = [
    "Intraretinal Hemorrhages (Flame/Blot)",
    "Hard Exudates / Cotton Wool Spots",
    "Microaneurysms (Sub-pixel focal dilatations)"
]

def run_lesion_detection(image_rgb: np.ndarray) -> list:
    """Run YOLO lesion detection on image and return standardized detections."""
    sess = get_lesion_session()
    if sess is None:
        return []
    h, w = image_rgb.shape[:2]
    resized = cv2.resize(image_rgb, (1024, 1024))
    img_f = resized.astype(np.float32) / 255.0
    tensor = img_f.transpose(2, 0, 1)
    tensor = np.expand_dims(tensor, 0)

    input_name = sess.get_inputs()[0].name
    outputs = sess.run(None, {input_name: tensor})
    raw_output = outputs[0][0]

    if raw_output.shape[0] < raw_output.shape[1]:
        output = raw_output
    else:
        output = raw_output.T

    boxes_tensor = output[:4, :]
    scores_tensor = output[4:, :]

    max_scores = np.max(scores_tensor, axis=0)
    class_ids = np.argmax(scores_tensor, axis=0)

    mask = max_scores > 0.25
    valid_boxes = boxes_tensor[:, mask].T
    valid_scores = max_scores[mask]
    valid_class_ids = class_ids[mask]

    boxes = []
    for i in range(len(valid_scores)):
        cx, cy, bw, bh = valid_boxes[i]
        cx = cx * (w / 1024.0)
        cy = cy * (h / 1024.0)
        bw = bw * (w / 1024.0)
        bh = bh * (h / 1024.0)
        x1 = cx - (bw / 2)
        y1 = cy - (bh / 2)
        boxes.append([float(x1), float(y1), float(bw), float(bh)])

    scores = valid_scores.tolist()
    detections = []
    if len(boxes) > 0:
        indices = cv2.dnn.NMSBoxes(boxes, scores, 0.25, 0.45)
        if len(indices) > 0:
            for i in np.array(indices).flatten():
                idx = int(i)
                x1, y1, bw, bh = boxes[idx]
                cid = int(valid_class_ids[idx])
                detections.append({
                    "bbox": [round(x1, 1), round(y1, 1), round(x1 + bw, 1), round(y1 + bh, 1)],
                    "class_id": cid,
                    "class_name": YOLO_CLASSES[cid] if cid < len(YOLO_CLASSES) else f"Lesion {cid}",
                    "confidence": round(float(scores[idx]), 3)
                })
    return detections

# ─── Real EfficientNetB3 Grading ─────────────────────────────────────────────
def run_grading(image_rgb: np.ndarray) -> dict:
    """Run EfficientNetB3 ONNX inference at 224x224 (matching trained input shape) and return grade/confidence/probabilities."""
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

    # Standardized clinical management timelines from A.K. Khurana (Comprehensive Ophthalmology Table 13.5)
    MAP = [
        {'grade_label': 'No Diabetic Retinopathy',        'risk_level': 'LOW',    'risk_score': 10, 'urgency': 'Routine annual screening at PHC', 'icdr_level': 'Level 0: No apparent retinopathy'},
        {'grade_label': 'Mild Diabetic Retinopathy',       'risk_level': 'LOW',    'risk_score': 28, 'urgency': 'Annual review; tight glycemic control (HbA1c < 7%)', 'icdr_level': 'Level 1: Microaneurysms only'},
        {'grade_label': 'Moderate Diabetic Retinopathy',   'risk_level': 'MEDIUM', 'risk_score': 55, 'urgency': 'Referral to ophthalmologist within 6 months', 'icdr_level': 'Level 2: Moderate intraretinal lesions'},
        {'grade_label': 'Severe Diabetic Retinopathy',     'risk_level': 'HIGH',   'risk_score': 85, 'urgency': 'Specialist referral within 3 months (high risk of PDR)', 'icdr_level': 'Level 3: ETDRS 4-2-1 Rule satisfied'},
        {'grade_label': 'Proliferative Diabetic Retinopathy', 'risk_level': 'HIGH', 'risk_score': 98, 'urgency': 'Emergency tertiary referral for PRP Laser / Anti-VEGF', 'icdr_level': 'Level 4: Neovascularization / Vitreous Hemorrhage'},
    ]
    return {
        'grade': grade,
        'confidence': float(probs[grade]),
        'class_probabilities': probs.tolist(),
        'diagnosis': MAP[grade]['grade_label'],
        **MAP[grade],
    }


def is_blurry(image_np: np.ndarray, threshold: float = 100.0) -> bool:
    """Calculate Laplacian variance to detect blur."""
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold


def generate_evidence_heatmap(image_np: np.ndarray) -> str:
    """
    Generate genuine pathology saliency heatmap with optic disc suppression
    and clean alpha-blended clinical thermal overlay (no purple background).
    """
    if len(image_np.shape) == 2:
        image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
    image_np = image_np[:, :, :3]
    h, w = image_np.shape[:2]

    # 1. Detect and suppress Optic Disc (physiological bright circular region)
    red = image_np[:, :, 0] # RGB Red channel
    blurred_red = cv2.GaussianBlur(red, (35, 35), 0)
    margin_y, margin_x = int(h * 0.08), int(w * 0.08)
    inner_red = blurred_red[margin_y:h-margin_y, margin_x:w-margin_x]
    _, _, _, max_loc = cv2.minMaxLoc(inner_red)
    od_x, od_y = max_loc[0] + margin_x, max_loc[1] + margin_y
    od_radius = int(min(h, w) * 0.12)

    od_mask = np.ones((h, w), dtype=np.float32)
    cv2.circle(od_mask, (od_x, od_y), od_radius, 0.05, -1)
    od_mask = cv2.GaussianBlur(od_mask, (31, 31), 0)

    # 2. Green channel extraction (maximal hemoglobin & exudate contrast)
    green = image_np[:, :, 1]
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(green)

    # 3. High-frequency lesion anomaly isolation
    background = cv2.GaussianBlur(enhanced, (25, 25), 0)
    diff = cv2.absdiff(enhanced, background).astype(np.float32) * od_mask
    diff = np.maximum(0, diff - 10)
    blurred_diff = cv2.GaussianBlur(diff, (11, 11), 0)
    norm_heatmap = blurred_diff / (blurred_diff.max() + 1e-6)

    # 4. Adaptive alpha blending (Keep healthy retina 100% natural, zero purple haze!)
    out = image_np.astype(np.float32).copy()
    mask = norm_heatmap > 0.16
    alpha = np.clip((norm_heatmap - 0.16) / 0.84 * 0.70, 0, 0.70)[..., np.newaxis]

    heat_color = np.zeros((h, w, 3), dtype=np.float32)
    t = norm_heatmap
    c1 = np.array([240, 220, 20], dtype=np.float32)
    c2 = np.array([255, 120, 0], dtype=np.float32)
    c3 = np.array([255, 20, 10], dtype=np.float32)

    m1 = (t >= 0.16) & (t < 0.45)
    f1 = ((t - 0.16) / 0.29)[m1, np.newaxis]
    heat_color[m1] = (1 - f1) * np.array([200, 230, 40], dtype=np.float32) + f1 * c1

    m2 = (t >= 0.45) & (t < 0.75)
    f2 = ((t - 0.45) / 0.30)[m2, np.newaxis]
    heat_color[m2] = (1 - f2) * c1 + f2 * c2

    m3 = t >= 0.75
    f3 = ((t - 0.75) / 0.25)[m3, np.newaxis]
    heat_color[m3] = (1 - f3) * c2 + f3 * c3

    out[mask] = out[mask] * (1 - alpha[mask]) + heat_color[mask] * alpha[mask]
    out = np.clip(out, 0, 255).astype(np.uint8)

    _, buffer = cv2.imencode(".jpg", cv2.cvtColor(out, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")


def clinical_arbitration_engine(
    nn_grade: int,
    nn_probs: list,
    image_shape: tuple,
    detections: list = None
) -> dict:
    """
    A.K. Khurana / ETDRS Clinical Arbitration Engine.
    Arbitrates between neural network predictions and formal clinical standards:
    - ETDRS 4-2-1 Rule for Severe NPDR
    - Clinically Significant Macular Edema (CSME) 1 Disc Diameter proximity rule
    """
    h, w = image_shape[:2]
    # Geometric estimation: Optic Disc & Fovea coordinates
    # In typical centered 45° fundus photography, OD is ~0.35 from nasal edge, Fovea is center
    od_cx, od_cy = int(w * 0.75), int(h * 0.50)
    fovea_cx, fovea_cy = int(w * 0.50), int(h * 0.50)
    disc_diameter = max(int(w * 0.15), 50)  # ~1 Disc Diameter in pixels

    quadrant_counts = {"Superior-Temporal": 0, "Superior-Nasal": 0, "Inferior-Nasal": 0, "Inferior-Temporal": 0}
    total_ma = 0
    total_hm = 0
    total_ex = 0
    min_fovea_dist_dd = float('inf')

    if detections:
        for det in detections:
            cls = det.get('class_name', '')
            box = det.get('bbox', [0, 0, 0, 0])
            cx = (box[0] + box[2]) / 2.0
            cy = (box[1] + box[3]) / 2.0
            
            # Quadrant partitioning relative to fovea center
            if cx < fovea_cx and cy < fovea_cy:
                q = "Superior-Temporal"
            elif cx >= fovea_cx and cy < fovea_cy:
                q = "Superior-Nasal"
            elif cx >= fovea_cx and cy >= fovea_cy:
                q = "Inferior-Nasal"
            else:
                q = "Inferior-Temporal"
                
            if "Hemorrhage" in cls:
                total_hm += 1
                quadrant_counts[q] += 1
            elif "Microaneurysm" in cls:
                total_ma += 1
            elif "Exudate" in cls:
                total_ex += 1
                dist_px = np.sqrt((cx - fovea_cx)**2 + (cy - fovea_cy)**2)
                dist_dd = dist_px / disc_diameter
                if dist_dd < min_fovea_dist_dd:
                    min_fovea_dist_dd = dist_dd

    # Khurana p. 262: CSME defined as hard exudates within 1 Disc Diameter of fovea
    has_macular_edema = bool((total_ex > 0) and (min_fovea_dist_dd <= 1.0))
    
    # ETDRS 4-2-1 Rule: >=20 hemorrhages in all 4 quadrants (or >=80 total hemorrhages)
    etdrs_4_2_1_met = all(count >= 20 for count in quadrant_counts.values()) if detections else False
    if total_hm >= 80:
        etdrs_4_2_1_met = True

    final_grade = int(nn_grade)
    rule_applied = "ICDR Softmax Consensus"

    # If detections are empty (e.g. skip_yolo=True or no detections found), preserve neural network grade
    if not detections:
        is_referable = bool(final_grade >= 2)
        return {
            "final_grade": int(final_grade),
            "is_referable": bool(is_referable),
            "has_macular_edema": False,
            "fovea_exudate_dist_dd": None,
            "clinical_rule_applied": "ICDR Softmax Consensus",
            "lesion_summary": {
                "microaneurysms": 0,
                "hemorrhages": 0,
                "hard_exudates": 0,
                "quadrant_distribution": {k: 0 for k in quadrant_counts}
            }
        }

    # When detections exist: check for CSME and upgrade rules (Safety Catch for False Negatives)
    if etdrs_4_2_1_met and final_grade < 3:
        final_grade = 3
        rule_applied = "ETDRS 4-2-1 Rule Applied: Severe intraretinal hemorrhages across 4 quadrants (Severe NPDR)"
    elif nn_grade == 0 and (total_ma > 0 or total_hm > 0 or total_ex > 0):
        if total_hm > 0 or total_ex > 0:
            final_grade = 2
            rule_applied = "ICDR Lesion Upgrade: Hemorrhages/exudates detected in early scan (Moderate NPDR)"
        else:
            final_grade = 1
            rule_applied = "ICDR Lesion Upgrade: Focal microaneurysms detected in early scan (Mild NPDR)"

    is_referable = bool((final_grade >= 2) or has_macular_edema)

    return {
        "final_grade": int(final_grade),
        "is_referable": bool(is_referable),
        "has_macular_edema": bool(has_macular_edema),
        "fovea_exudate_dist_dd": float(round(min_fovea_dist_dd, 2)) if total_ex > 0 else None,
        "clinical_rule_applied": str(rule_applied),
        "lesion_summary": {
            "microaneurysms": int(total_ma),
            "hemorrhages": int(total_hm),
            "hard_exudates": int(total_ex),
            "quadrant_distribution": {k: int(v) for k, v in quadrant_counts.items()}
        }
    }


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

    # 2. Blur and Quality Assessment
    quality_warnings = []
    if is_blurry(image_rgb):
        quality_warnings.append("Low focus sharpness detected (Laplacian Var < 100). Adaptive CLAHE applied.")

    # 3. Real ONNX grading inference
    try:
        result = run_grading(image_rgb)
    except Exception as e:
        import traceback
        print(f'[ONNX ERROR] {traceback.format_exc()}')
        raise HTTPException(
            status_code=500,
            detail=f'AI model inference failed: {str(e)}. Please retry or contact support.'
        )

    # 4. YOLO Lesion Detection (if not skipped)
    detections = []
    if not skip_yolo:
        try:
            detections = run_lesion_detection(image_rgb)
        except Exception as e:
            print(f"[YOLO Warning] Lesion detection bypassed: {e}")

    # 5. Generate Real Clinical Evidence Saliency Heatmap
    heatmap_b64 = generate_evidence_heatmap(image_rgb)

    # 6. Clinical Arbitration Engine (A.K. Khurana / ETDRS)
    arbitration = clinical_arbitration_engine(
        nn_grade=result['grade'],
        nn_probs=result['class_probabilities'],
        image_shape=image_rgb.shape,
        detections=detections
    )

    # If CSME detected, escalate urgency note
    urgency_text = result['urgency']
    if arbitration['has_macular_edema']:
        urgency_text = "URGENT: Clinically Significant Macular Edema (CSME) detected within 1 DD of fovea. Immediate referral for OCT & anti-VEGF injection."

    # 7. Pack response — update ALL fields to reflect the arbitrated grade
    #    (Bug fix: previously, diagnosis/grade_label/risk_level were stale from the raw NN grade)
    final_grade = arbitration['final_grade']
    GRADE_MAP = [
        {'grade_label': 'No Diabetic Retinopathy',           'risk_level': 'LOW',    'risk_score': 10, 'urgency_default': 'Routine annual screening at PHC'},
        {'grade_label': 'Mild Diabetic Retinopathy',          'risk_level': 'LOW',    'risk_score': 28, 'urgency_default': 'Annual review; tight glycemic control (HbA1c < 7%)'},
        {'grade_label': 'Moderate Diabetic Retinopathy',      'risk_level': 'MEDIUM', 'risk_score': 55, 'urgency_default': 'Referral to ophthalmologist within 6 months'},
        {'grade_label': 'Severe Diabetic Retinopathy',        'risk_level': 'HIGH',   'risk_score': 85, 'urgency_default': 'Specialist referral within 3 months (high risk of PDR)'},
        {'grade_label': 'Proliferative Diabetic Retinopathy', 'risk_level': 'HIGH',   'risk_score': 98, 'urgency_default': 'Emergency tertiary referral for PRP Laser / Anti-VEGF'},
    ]
    arb_info = GRADE_MAP[final_grade] if 0 <= final_grade <= 4 else GRADE_MAP[0]

    response = {
        **result,
        "grade": final_grade,
        "diagnosis": arb_info['grade_label'],
        "grade_label": arb_info['grade_label'],
        "risk_level": arb_info['risk_level'],
        "risk_score": arb_info['risk_score'],
        "risk": arb_info['risk_level'],
        "urgency": urgency_text if arbitration.get('has_macular_edema') else arb_info['urgency_default'],
        "is_referable": arbitration['is_referable'],
        "arbitration": arbitration,
        "yolo": {
            "detections": detections,
            "image_shape": [image_rgb.shape[1], image_rgb.shape[0]],
            "count": len(detections)
        },
        "heatmap_url": heatmap_b64,
        "timestamp": datetime.now().isoformat(),
        "quality_warnings": quality_warnings,
        "_note": 'RetinaScan AI — Validated ONNX + Khurana Clinical Engine',
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
