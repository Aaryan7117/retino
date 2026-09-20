import urllib.request
import json
import os

# Test 1: health check
req = urllib.request.urlopen("http://localhost:8000/health")
print("Health:", req.read().decode())

# Test 2: inference with real image
image_path = os.path.join(os.path.dirname(__file__), "../data/samples/idrid_samples/idrid_grade_3.jpg")

boundary = b"----retinaboundary"
with open(image_path, "rb") as f:
    image_data = f.read()

body = (
    b"--" + boundary + b"\r\n"
    b"Content-Disposition: form-data; name=\"file\"; filename=\"grade3.jpg\"\r\n"
    b"Content-Type: image/jpeg\r\n\r\n"
    + image_data
    + b"\r\n--" + boundary + b"--\r\n"
)

req2 = urllib.request.Request(
    "http://localhost:8000/api/inference/",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary=----retinaboundary"},
    method="POST"
)
resp = urllib.request.urlopen(req2)
data = json.loads(resp.read().decode())
print("===== INFERENCE RESULT =====")
print("Grade:", data.get("grade"))
print("Grade label:", data.get("grade_label"))
print("Confidence:", round(data.get("confidence", 0)*100, 1), "%")
print("Risk level:", data.get("risk_level"))
print("Risk score:", data.get("risk_score"))
print("ONNX fallback note:", data.get("_note", "NONE — real ONNX ran OK"))
print("Has heatmap:", bool(data.get("heatmap_url")))
print("Arbitration:", json.dumps(data.get("arbitration"), indent=2))
print("YOLO Detection Count:", data.get("yolo", {}).get("count"))
if data.get("yolo", {}).get("detections"):
    print("Sample Detections:", data["yolo"]["detections"][:3])

