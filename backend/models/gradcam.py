import torch
import torch.nn.functional as F
import cv2
import numpy as np


class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        # Register hooks
        self.target_layer.register_forward_hook(self.save_activation)
        self.target_layer.register_full_backward_hook(self.save_gradient)

    def save_activation(self, module, input, output):
        self.activations = output

    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0]

    def generate(self, input_tensor, target_class=None):
        """
        Generate Grad-CAM for a given input tensor.
        """
        self.model.eval()
        self.model.zero_grad()

        # Forward pass
        outputs = self.model(input_tensor)
        if isinstance(outputs, tuple):
            logits = outputs[0]
        else:
            logits = outputs

        if target_class is None:
            target_class = torch.argmax(logits, dim=1).item()

        # Backward pass for the target class
        score = logits[0, target_class]
        score.backward()

        # Get pooled gradients
        pooled_gradients = torch.mean(self.gradients, dim=[0, 2, 3])

        # Weight activations by gradients
        for i in range(self.activations.shape[1]):
            self.activations[:, i, :, :] *= pooled_gradients[i]

        # Create heatmap
        heatmap = torch.mean(self.activations, dim=1).squeeze()
        heatmap = F.relu(heatmap)
        heatmap /= torch.max(heatmap)

        return heatmap.detach().cpu().numpy()


def apply_colormap_on_image(
    org_im: np.ndarray, activation: np.ndarray, colormap_name=cv2.COLORMAP_JET
):
    """
    Apply heatmap onto an image.
    org_im: RGB image (H, W, 3)
    activation: 2D numpy array (H, W) or smaller, scaled 0-1
    """
    # Resize activation to match original image size
    activation = cv2.resize(activation, (org_im.shape[1], org_im.shape[0]))

    # Convert to 8-bit uint
    heatmap = np.uint8(255 * activation)
    heatmap = cv2.applyColorMap(heatmap, colormap_name)

    # Convert to RGB
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

    # Blend with original image
    superimposed_img = heatmap * 0.4 + org_im * 0.6
    superimposed_img = np.clip(superimposed_img, 0, 255).astype(np.uint8)

    return superimposed_img
