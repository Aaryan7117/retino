import onnxruntime as ort
from pathlib import Path
import cv2
import numpy as np

YOLO_CLASSES = [
    "External Bleeding",
    "Exudates / Cotton Wool Spots / Retinal Scarring",
    "Microaneurysms / Hemorrhages"
]

LESION_MODEL = str(Path('backend/models/yolo_lesions.onnx'))
print("Loading model...", LESION_MODEL)
sess = ort.InferenceSession(LESION_MODEL, providers=['CPUExecutionProvider'])

print("Creating dummy image...")
# Dummy image with a bright feature
img = np.zeros((1024, 1024, 3), dtype=np.uint8)
img[400:600, 400:600, :] = 255
img[100:200, 100:200, 0] = 255 # Red feature
img[800:900, 800:900, 1] = 255 # Green feature

img_f = img.astype(np.float32) / 255.0
tensor = img_f.transpose(2, 0, 1)
tensor = np.expand_dims(tensor, 0)

input_name = sess.get_inputs()[0].name
print("Running inference...")
outputs = sess.run(None, {input_name: tensor})

raw_output = outputs[0][0]
print("Raw output shape:", raw_output.shape)

if raw_output.shape[0] < raw_output.shape[1]:
    output = raw_output
else:
    output = raw_output.T
    
print("Processed output shape:", output.shape)

boxes_tensor = output[:4, :]  # [4, N]
scores_tensor = output[4:, :]  # [3, N]

max_scores = np.max(scores_tensor, axis=0)
class_ids = np.argmax(scores_tensor, axis=0)
print(f"Global max score: {np.max(max_scores)}")

mask = max_scores > 0.25
valid_boxes = boxes_tensor[:, mask].T
valid_scores = max_scores[mask]
valid_class_ids = class_ids[mask]

print(f"Valid boxes detected > 0.25: {len(valid_scores)}")

boxes = []
for i in range(len(valid_scores)):
    cx, cy, w, h = valid_boxes[i]
    x1 = cx - (w / 2)
    y1 = cy - (h / 2)
    boxes.append([float(x1), float(y1), float(w), float(h)])

scores = valid_scores.tolist()

detections = []
if len(boxes) > 0:
    indices = cv2.dnn.NMSBoxes(boxes, scores, 0.25, 0.45)
    print("NMS Indices:", indices)
    if len(indices) > 0:
        for i in np.array(indices).flatten():
            idx = int(i)
            x1, y1, w, h = boxes[idx]
            detections.append({
                "bbox": [x1, y1, x1 + w, y1 + h],
                "class_id": int(valid_class_ids[idx]),
                "class_name": YOLO_CLASSES[int(valid_class_ids[idx])],
                "confidence": float(scores[idx])
            })

print("Final Detections Count:", len(detections))
