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
