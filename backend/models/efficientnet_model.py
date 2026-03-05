"""
efficientnet_model.py
EfficientNetB3 model wrapper for DR grading.
Full implementation in Section 2.
"""

from __future__ import annotations

import torch
import torch.nn as nn
from typing import Optional


class EfficientNetModel:
    """
    Wraps a pretrained EfficientNetB3 fine-tuned on APTOS 2019.

    Usage:
        model = EfficientNetModel()
        model.load('path/to/weights.pt')
        probs = model.predict(image_tensor)  # shape [1,3,224,224]
    """

    NUM_CLASSES = 5
    INPUT_SIZE = 224

    def __init__(self, weights_path: Optional[str] = None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = self._build()
        if weights_path:
            self.load(weights_path)

    def _build(self) -> nn.Module:
        # TODO Section 2: load efficientnet_b3 from torchvision / efficientnet_pytorch
        raise NotImplementedError("Model build implemented in Section 2")

    def load(self, weights_path: str) -> None:
        """Load fine-tuned weights."""
        state = torch.load(weights_path, map_location=self.device)
        self.model.load_state_dict(state)
        self.model.eval()

    def predict(self, tensor: torch.Tensor) -> dict:
        """
        Run inference and return structured result.

        Args:
            tensor: Float tensor of shape [1, 3, 224, 224]

        Returns:
            {
                'grade': int,
                'grade_label': str,
                'confidence': float,
                'risk_score': int,
                'risk_level': str,
                'urgency': str,
                'probabilities': list[float]
            }
        """
        # TODO Section 2: implement forward pass + softmax + postprocess
        raise NotImplementedError("predict() implemented in Section 2")

    def export_onnx(self, output_path: str) -> None:
        """Export model to ONNX format for browser inference."""
        # TODO Section 2: torch.onnx.export(...)
        raise NotImplementedError("export_onnx() implemented in Section 2")
