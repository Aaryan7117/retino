// modelInference.js — Handles AI inference: tries FastAPI backend first, falls back to browser ONNX Web Worker

import { preprocessImageForONNX, validateFundusImage } from './imagePreprocessing';
import { setScanInProgress } from '../components/BackendIndicator';

/**
 * Sends the image to the FastAPI backend for fast server-side ONNX inference.
 * Falls back to browser ONNX if the backend is unreachable or times out.
 * 
 * @param {File} imageFile - The raw image file to analyze.
 * @param {Function} onProgress - Callback for updating the UI with progress messages.
 * @returns {Promise<Object>} The API response from the backend.
 */
async function analyzeViaBackend(imageFile, onProgress) {
    onProgress('Sending to server for fast analysis...');
    
    const formData = new FormData();
    formData.append('file', imageFile);
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    // PERF: skip_yolo=true skips the slow 1024×1024 YOLO model during the main scan.
    // YOLO is only needed on the Lesion Analysis page which triggers a separate call.
    // This cuts backend response time from ~60s to ~3-5s on CPU.
    const inferenceResponse = await fetch(`${backendUrl}/api/inference/?skip_yolo=true`, {
        method: 'POST',
        body: formData,
        // 15s timeout — cold starts are prevented by the keep-alive ping in App.jsx
        signal: AbortSignal.timeout(15000),
    });

    if (!inferenceResponse.ok) throw new Error(`Backend ${inferenceResponse.status}`);
    
    const responseData = await inferenceResponse.json();
    onProgress('Server analysis complete ✅');

    // Backend returns heatmap as base64 data URL string directly
    return {
        ...responseData,
        heatmapBlob: null,
        heatmap_url: responseData.heatmap_url || null,
        source: 'backend',
        yoloDetections: responseData.yolo || null,
    };
}


/**
 * Main wrapper to run AI inference.
 * Strategy: Try backend first when online (3-5x faster), fall back to browser ONNX Web Worker.
 *
 * @param {File} imageFile - The image uploaded by the user.
 * @param {Function} onProgress - Callback for loading states (e.g. "Loading model...", "Running inference...").
 * @returns {Promise<Object>} The API response format matching backend spec.
 */
export const analyzeImage = async (imageFile, onProgress) => {
    // Signal BackendIndicator to pause health polls — backend is busy, not down
    setScanInProgress(true);
    try {
        // Try backend first when online (3-5x faster than browser ONNX)
        if (navigator.onLine) {
            try {
                return await analyzeViaBackend(imageFile, onProgress);
            } catch (err) {
                console.warn('Backend failed, falling back to browser ONNX:', err.message);
                onProgress('Server unavailable — switching to offline AI...');
            }
        } else {
            onProgress('Offline mode — running AI on device...');
        }

    // --- Browser ONNX Web Worker ---
    // We use a Web Worker for on-device inference to ensure the main UI thread 
    // remains responsive. Running heavy matrix multiplications (WASM) directly 
    // on the main thread would freeze the browser for several seconds.
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        img.onload = () => {
            try {
                onProgress('Preprocessing image...');

                // Feature 1: Validate on ORIGINAL image BEFORE resizing
                // Draw the original image onto a validation canvas (max 400px, preserving aspect)
                const VALIDATION_SIZE = 400; // CRITICAL: 400px used for fundus validation
                const scaleFactor = Math.min(1, VALIDATION_SIZE / Math.max(img.width, img.height));
                const validatedWidth = Math.round(img.width * scaleFactor);
                const validatedHeight = Math.round(img.height * scaleFactor);
                
                const validationCanvas = document.createElement('canvas');
                validationCanvas.width = validatedWidth;
                validationCanvas.height = validatedHeight;
                const validationCtx = validationCanvas.getContext('2d');
                validationCtx.drawImage(img, 0, 0, validatedWidth, validatedHeight);
                const validationImageData = validationCtx.getImageData(0, 0, validatedWidth, validatedHeight);

                const validationResult = validateFundusImage(validationImageData);
                if (validationResult.warnings?.length > 0)
                    validationResult.warnings.forEach(w => onProgress('⚠ ' + w));

                // 2. Preprocess for ONNX (resize to 224×224, normalize)
                // CRITICAL: Input must be exactly 224x224px — EfficientNetB3 was trained at this resolution
                const { tensorData, blurScore, imageData } = preprocessImageForONNX(img);

                // Warn about blur but don't block
                if (blurScore < 20) onProgress('⚠ Blurry image detected — results may be less accurate.');

                // 4. Send to Web Worker for non-blocking inference
                const inferenceWorker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });

                inferenceWorker.onmessage = (event) => {
                    const { type, message, result, error, heatmapBlob } = event.data;

                    if (type === 'STATUS') {
                        onProgress(message);
                    } else if (type === 'RESULT') {
                        URL.revokeObjectURL(objectUrl);

                        // Create object URL in main thread so it survives worker termination
                        result.heatmap_url = URL.createObjectURL(heatmapBlob);
                        result.heatmapBlob = heatmapBlob; // Pass the raw blob back for persistence
                        result.source = 'offline'; // Tag the source for UI display

                        inferenceWorker.terminate();
                        resolve(result);
                    } else if (type === 'ERROR') {
                        URL.revokeObjectURL(objectUrl);
                        inferenceWorker.terminate();
                        reject(new Error(error));
                    }
                };

                inferenceWorker.onerror = (err) => {
                    URL.revokeObjectURL(objectUrl);
                    inferenceWorker.terminate();
                    reject(new Error(`Worker error: ${err.message}`));
                };

                // Send the Float32Array and filename (for demo deterministic results)
                inferenceWorker.postMessage({
                    type: 'INFERENCE',
                    tensorData: tensorData,
                    imageData: imageData, // Send imagedata so worker can draw heatmap
                    filename: imageFile.name
                }, [tensorData.buffer]); // Transfer buffer for speed

            } catch (err) {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image file.'));
        };

        img.src = objectUrl;
    });
    } finally {
        // Reset flag so health checks resume after scan completes
        setScanInProgress(false);
    }
};

