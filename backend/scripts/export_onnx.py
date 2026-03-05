import os
import torch
import torch.nn as nn
import onnx
from torchvision.models import efficientnet_b3, EfficientNet_B3_Weights


class RetinaEfficientNet(nn.Module):
    def __init__(self, num_classes=5):
        super().__init__()
        # Load pre-trained EfficientNet-B3
        self.base_model = efficientnet_b3(weights=EfficientNet_B3_Weights.DEFAULT)

        # We need to extract features for Grad-CAM
        self.features = self.base_model.features
        self.avgpool = self.base_model.avgpool

        # Replace classifier with 5 classes (Grade 0-4)
        in_features = self.base_model.classifier[1].in_features
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True), nn.Linear(in_features, num_classes)
        )

    def forward(self, x):
        # Extract features (for Grad-CAM rendering later if needed)
        fmap = self.features(x)

        # Pool and classify
        x = self.avgpool(fmap)
        x = torch.flatten(x, 1)
        logits = self.classifier(x)

        # For ONNX export, we return both logits and the feature map
        # so the frontend can compute a Fast-CAM approximation without backprop
        return logits, fmap


def export_to_onnx():
    print("Initialize model...")
    model = RetinaEfficientNet(num_classes=5)
    model.eval()

    # Dummy input matching the preprocessing (1 batch, 3 channels, 224x224 height/width)
    dummy_input = torch.randn(1, 3, 224, 224)

    # Ensure frontend models directory exists
    out_dir = os.path.join(os.path.dirname(__file__), "../../frontend/public/models")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "retina_model.onnx")

    print(f"Exporting ONNX model to {out_path}...")
    torch.onnx.export(
        model,
        dummy_input,
        out_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["logits", "feature_map"],
    )

    # Force single file by loading and saving with onnx
    print("Inlining external data...")
    onnx_model = onnx.load(out_path, load_external_data=True)
    onnx.save_model(
        onnx_model, out_path, save_as_external_data=False, all_tensors_to_one_file=True
    )

    # Remove the .data file if it exists
    data_path = out_path + ".data"
    if os.path.exists(data_path):
        os.remove(data_path)

    print("✅ Export complete! Model is ready for browser offline inference.")


if __name__ == "__main__":
    export_to_onnx()
