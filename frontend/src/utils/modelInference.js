import { preprocessImageForONNX, validateFundusImage } from './imagePreprocessing';

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

                // ── Feature 1: Validate on ORIGINAL image BEFORE resizing ──────────
                // Draw the original image onto a validation canvas (max 400px, preserving aspect)
                const VSIZE = 400;
                const vScale = Math.min(1, VSIZE / Math.max(img.width, img.height));
                const vW = Math.round(img.width * vScale);
                const vH = Math.round(img.height * vScale);
                const vCanvas = document.createElement('canvas');
                vCanvas.width = vW;
                vCanvas.height = vH;
                const vCtx = vCanvas.getContext('2d');
                vCtx.drawImage(img, 0, 0, vW, vH);
                const validationImageData = vCtx.getImageData(0, 0, vW, vH);

                const vResult = validateFundusImage(validationImageData);
                if (vResult.warnings?.length > 0)
                    vResult.warnings.forEach(w => onProgress('⚠ ' + w));

                // 2. Preprocess for ONNX (resize to 224×224, normalize)
                const { tensorData, blurScore, imageData } = preprocessImageForONNX(img);

                // Warn about blur but don't block — demo images may be slightly soft
                if (blurScore < 20) onProgress('⚠ Blurry image detected — results may be less accurate.');

                // 4. Send to Web Worker for non-blocking inference
                // Worker ensures heavy ONNX compute doesn't freeze the React UI
                const worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });

                worker.onmessage = (e) => {
                    const { type, message, result, error, heatmapBlob } = e.data;

                    if (type === 'STATUS') {
                        onProgress(message);
                    } else if (type === 'RESULT') {
                        URL.revokeObjectURL(url);

                        // Create object URL in main thread so it survives worker termination
                        result.heatmap_url = URL.createObjectURL(heatmapBlob);
                        result.heatmapBlob = heatmapBlob; // Pass the raw blob back for persistence

                        worker.terminate();
                        resolve(result);
                    } else if (type === 'ERROR') {
                        URL.revokeObjectURL(url);
                        worker.terminate();
                        reject(new Error(error));
                    }
                };

                worker.onerror = (err) => {
                    URL.revokeObjectURL(url);
                    worker.terminate();
                    reject(new Error(`Worker error: ${err.message}`));
                };

                // Send the Float32Array and filename (for demo deterministic results)
                worker.postMessage({
                    type: 'INFERENCE',
                    tensorData: tensorData,
                    imageData: imageData, // Send imagedata so worker can draw heatmap
                    filename: imageFile.name
                }, [tensorData.buffer]); // Transfer buffer for speed

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
