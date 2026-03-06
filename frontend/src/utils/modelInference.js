import { preprocessImageForONNX, validateFundusImage } from './imagePreprocessing';
import { API_BASE_URL } from './apiConfig';

/**
 * Main wrapper to run offline AI inference via a Web Worker.
 * 
 * @param {File} imageFile - The image uploaded by the user
 * @param {Function} onProgress - Callback for loading states (e.g. "Loading model...", "Running inference...")
 * @returns {Promise<Object>} The API response format matching backend spec
 */
export const analyzeImage = async (imageFile, onProgress) => {
    return new Promise((resolve, reject) => {
        // 1. Convert File to HTMLImageElement to draw on Canvas
        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        img.onload = () => {
            try {
                onProgress('Preprocessing image...');

                // 2. Preprocess (Resize, Crop, Normalize, Blur Check)
                const { tensorData, blurScore, imageData } = preprocessImageForONNX(img);

                // 2.5 Heuristic OOD Validation
                // This will throw if the image is obviously not a fundus photograph
                validateFundusImage(imageData);

                // 3. Reject if blurry (threshold < 100 typically means out of focus)
                // For hackathon demo, we log but allow passing if it fails slightly OR we strictly enforce
                if (blurScore < 50) { // Set lower for broader demo acceptance
                    URL.revokeObjectURL(url);
                    throw new Error('Image quality too low (blurry). Please retake the photo.');
                }

                // 4. Send to backend Python API for full inference including Grad-CAM
                onProgress('Analyzing via AI model...');

                const formData = new FormData();
                formData.append('file', imageFile);

                fetch(`${API_BASE_URL}/inference/`, {
                    method: 'POST',
                    body: formData,
                })
                    .then(res => {
                        if (!res.ok) {
                            return res.json().then(err => { throw new Error(err.detail || 'API Error'); });
                        }
                        return res.json();
                    })
                    .then(data => {
                        URL.revokeObjectURL(url);
                        resolve(data);
                    })
                    .catch(err => {
                        URL.revokeObjectURL(url);
                        reject(err);
                    });
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image file.'));
        };

        img.src = url;
    });
};
