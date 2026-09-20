"""
export_trained_cbam.py
Exports the validated, clinically trained Diabetic Retinopathy EfficientNet-B3 + CBAM
attention model to ONNX and applies dynamic INT8 quantization.
Deploys to both backend/models/ and frontend/public/models/.
"""

import os
import sys
from pathlib import Path
import torch
import torch.nn as nn
import timm
from onnxruntime.quantization import quantize_dynamic, QuantType

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = Path(__file__).parent.parent.parent
CHECKPOINT_PATH = ROOT_DIR / "data" / "checkpoints" / "best_model.pth"
BACKEND_MODELS = ROOT_DIR / "backend" / "models"
FRONTEND_MODELS = ROOT_DIR / "frontend" / "public" / "models"

print("=" * 80)
print("🚀 EXPORTING CLINICALLY TRAINED EFFICIENTNET-B3 + CBAM TO PRODUCTION ONNX")
print("=" * 80)

# ─── 1. ARCHITECTURE DEFINITION ──────────────────────────────────────────────

class ChannelAttention(nn.Module):
    def __init__(self, in_planes, ratio=16):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Conv2d(in_planes, in_planes // ratio, 1, bias=False),
            nn.ReLU(),
            nn.Conv2d(in_planes // ratio, in_planes, 1, bias=False)
        )
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.sig = nn.Sigmoid()

    def forward(self, x):
        avg_out = self.fc(self.avg_pool(x))
        max_out = self.fc(self.max_pool(x))
        return self.sig(avg_out + max_out)

class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=kernel_size // 2, bias=False)
        self.sig = nn.Sigmoid()

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        return self.sig(self.conv(torch.cat([avg_out, max_out], dim=1)))

class CBAM(nn.Module):
    def __init__(self, in_planes):
        super().__init__()
        self.ca = ChannelAttention(in_planes)
        self.sa = SpatialAttention()

    def forward(self, x):
        x = x * self.ca(x)
        x = x * self.sa(x)
        return x

class EfficientNetB3_CBAM(nn.Module):
    def __init__(self, num_classes=5):
        super().__init__()
        self.backbone = timm.create_model('efficientnet_b3', pretrained=False, num_classes=0)
        self.cbam = CBAM(1536)
        self.classifier = nn.Linear(1536, num_classes)

    def forward(self, x):
        fmap = self.backbone.forward_features(x)
        rf = self.cbam(fmap)
        pooled = torch.mean(rf, dim=[2, 3])
        logits = self.classifier(pooled)
        return logits, rf

# ─── 2. LOAD TRAINED WEIGHTS ──────────────────────────────────────────────────

print(f"\n[1/3] Loading trained weights from {CHECKPOINT_PATH}...")
model = EfficientNetB3_CBAM(num_classes=5)
ckpt = torch.load(str(CHECKPOINT_PATH), map_location='cpu')
model.load_state_dict(ckpt, strict=True)
model.eval()
print("  ✓ Successfully loaded 100% of weights into EfficientNet-B3 + CBAM.")

# ─── 3. EXPORT TO ONNX ────────────────────────────────────────────────────────

print("\n[2/3] Exporting to TorchScript-based ONNX graph with dynamic spatial axes...")
raw_onnx = BACKEND_MODELS / "retina_model_cbam_fp32.onnx"
dummy_input = torch.randn(1, 3, 300, 300)

torch.onnx.export(
    model,
    dummy_input,
    str(raw_onnx),
    export_params=True,
    opset_version=14,
    do_constant_folding=True,
    input_names=["input"],
    output_names=["logits", "feature_map"],
    dynamic_axes={
        "input": {0: "batch", 2: "height", 3: "width"},
        "logits": {0: "batch"},
        "feature_map": {0: "batch", 2: "f_height", 3: "f_width"}
    },
    dynamo=False
)
fp32_size = os.path.getsize(raw_onnx) / (1024 * 1024)
print(f"  ✓ Exported FP32 ONNX: {fp32_size:.2f} MB")

# ─── 4. DYNAMIC INT8 QUANTIZATION ────────────────────────────────────────────

print("\n[3/3] Quantizing to Dynamic INT8 for Edge Deployment...")
target_int8 = BACKEND_MODELS / "retina_model.onnx"

quantize_dynamic(
    model_input=str(raw_onnx),
    model_output=str(target_int8),
    weight_type=QuantType.QUInt8,
    extra_options={'EnableGraphOptimizations': True}
)
int8_size = os.path.getsize(target_int8) / (1024 * 1024)
print(f"  ✓ Quantized INT8 ONNX: {int8_size:.2f} MB (Compression: {(1 - int8_size/fp32_size)*100:.1f}%)")

# Deploy to frontend public/models
import shutil
shutil.copyfile(target_int8, FRONTEND_MODELS / "retina_model.onnx")
print(f"  ✓ Deployed to Frontend: {FRONTEND_MODELS / 'retina_model.onnx'}")

print("\n" + "=" * 80)
print("🎉 PRODUCTION DEPLOYMENT COMPLETE — CLINICAL TRAINED WEIGHTS ACTIVE!")
print("=" * 80)
