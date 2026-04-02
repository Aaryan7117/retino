// modelInference.js — Handles AI inference: tries FastAPI backend first, falls back to browser ONNX Web Worker

import { preprocessImageForONNX, validateFundusImage } from './imagePreprocessing';
import { setScanInProgress } from '../components/BackendIndicator';

/**
 * Sends the image to the FastAPI backend for fast server-side ONNX inference.
 * Falls back to browser ONNX if the backend is unreachable or times out.
 */
async function analyzeViaBackend(imageFile, onProgress) {
    onProgress('Sending to server for fast analysis...');
    
    const formData = new FormData();
    formData.append('file', imageFile);
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    // PERF: skip_yolo=true skips the slow 1024×1024 YOLO model on the backend.
    const inferenceResponse = await fetch(`${backendUrl}/api/inference/?skip_yolo=true`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(15000),
    });

    if (!inferenceResponse.ok) throw new Error(`Backend ${inferenceResponse.status}`);
    
    const responseData = await inferenceResponse.json();
    onProgress('Grading complete ✅ — Running lesion detection...');

    const baseResult = {
        ...responseData,
        heatmapBlob: null,
        heatmap_url: responseData.heatmap_url || null,
        source: 'backend',
        yoloDetections: null,
        risk_level: responseData.risk_level || responseData.risk || 'LOW', // Standardize
    };

    // Run YOLO locally in-browser
    try {
        const yoloResult = await runYoloLocally(imageFile, onProgress);
        baseResult.yolo = yoloResult;
        baseResult.yoloDetections = yoloResult;
        onProgress('Lesion mapping complete ✅');
    } catch (yoloErr) {
        console.warn('[YOLO local] Failed, continuing without detections:', yoloErr.message);
    }

    return baseResult;
}

/**
 * Runs YOLOv8 lesion detection locally using the browser ONNX worker.
 */
function runYoloLocally(imageFile, onProgress) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width  = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                URL.revokeObjectURL(objectUrl);

                const worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });

                worker.onmessage = (event) => {
                    const { type, yolo, error } = event.data;
                    if (type === 'STATUS') {
                        onProgress(event.data.message);
                    } else if (type === 'YOLO_RESULT') {
                        worker.terminate();
                        resolve(yolo);
                    } else if (type === 'YOLO_ERROR') {
                        worker.terminate();
                        reject(new Error(error));
                    }
                };

                worker.onerror = (err) => {
                    worker.terminate();
                    reject(new Error(`YOLO worker error: ${err.message}`));
                };

                worker.postMessage({ type: 'YOLO_ONLY', imageData });
            } catch (err) {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image for YOLO'));
        };

        img.src = objectUrl;
    });
}

/**
 * Main wrapper to run AI inference.
 * Strategy: Try backend first when online, fall back to browser ONNX Web Worker.
 */
export const analyzeImage = async (imageFile, onProgress) => {
    setScanInProgress(true);
    try {
        if (navigator.onLine) {
            try {
                const result = await analyzeViaBackend(imageFile, onProgress);
                return result;
            } catch (err) {
                console.warn('Backend failed, falling back to browser ONNX:', err.message);
                onProgress('Server unavailable — switching to offline AI...');
            }
        } else {
            onProgress('Offline mode — running AI on device...');
        }

        // --- Browser ONNX Web Worker Fallback ---
        return await new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(imageFile);

            img.onload = () => {
                try {
                    onProgress('Preprocessing image...');
                    const VALIDATION_SIZE = 400;
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

                    const { tensorData, blurScore, imageData } = preprocessImageForONNX(img);
                    if (blurScore < 20) onProgress('⚠ Blurry image detected — results may be less accurate.');

                    const inferenceWorker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });

                    inferenceWorker.onmessage = (event) => {
                        const { type, message, result, error, heatmapBlob } = event.data;
                        if (type === 'STATUS') {
                            onProgress(message);
                        } else if (type === 'RESULT') {
                            URL.revokeObjectURL(objectUrl);
                            result.heatmap_url = URL.createObjectURL(heatmapBlob);
                            result.heatmapBlob = heatmapBlob;
                            result.source = 'offline';
                            result.risk_level = result.risk_level || result.risk || 'LOW'; // Standardize
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

                    inferenceWorker.postMessage({
                        type: 'INFERENCE',
                        tensorData: tensorData,
                        imageData: imageData,
                        filename: imageFile.name
                    }, [tensorData.buffer]);
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
        setScanInProgress(false);
    }
};
