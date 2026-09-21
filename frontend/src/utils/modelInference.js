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

        // Compute clinical arbitration from the YOLO detections so ClinicianValidationCard
        // always has lesion_summary data, regardless of whether inference ran backend or offline.
        const detections = yoloResult?.detections || [];
        let totalMA = 0, totalHM = 0, totalEX = 0;
        let minFoveaDistDD = Infinity;
        const foveaX = 0.5, foveaY = 0.5; // normalized center estimate
        const discDiameter = 0.15;         // ~15% of image width
        const quadrantCounts = { 'Superior-Temporal': 0, 'Superior-Nasal': 0, 'Inferior-Nasal': 0, 'Inferior-Temporal': 0 };

        detections.forEach(det => {
            const [x1, y1, x2, y2] = det.bbox;
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            if (det.class_name?.includes('Hemorrhages')) { totalHM++; }
            else if (det.class_name?.includes('Microaneurysms')) { totalMA++; }
            else if (det.class_name?.includes('Exudates')) {
                totalEX++;
                const distDD = Math.sqrt((cx - foveaX) ** 2 + (cy - foveaY) ** 2) / discDiameter;
                if (distDD < minFoveaDistDD) minFoveaDistDD = distDD;
            }
        });

        const hasMacularEdema = totalEX > 0 && minFoveaDistDD <= 1.0;
        const etdrs421Met = Object.values(quadrantCounts).every(c => c >= 20) || totalHM >= 80;
        let clinicalRuleApplied = 'ICDR Softmax Consensus';
        let backendGrade = responseData.grade ?? 0;
        if (etdrs421Met && backendGrade < 3) {
            backendGrade = 3;
            clinicalRuleApplied = 'ETDRS 4-2-1 Rule: Severe intraretinal hemorrhages across quadrants (Severe NPDR)';
        } else if (backendGrade === 0 && (totalMA > 0 || totalHM > 0 || totalEX > 0)) {
            if (totalHM > 0 || totalEX > 0) {
                backendGrade = 2;
                clinicalRuleApplied = 'ICDR Lesion Upgrade: Hemorrhages/exudates detected in early scan (Moderate NPDR)';
            } else {
                backendGrade = 1;
                clinicalRuleApplied = 'ICDR Lesion Upgrade: Focal microaneurysms detected in early scan (Mild NPDR)';
            }
        }

        baseResult.arbitration = {
            final_grade: backendGrade,
            is_referable: (backendGrade >= 2) || hasMacularEdema,
            has_macular_edema: hasMacularEdema,
            fovea_exudate_dist_dd: totalEX > 0 ? parseFloat(minFoveaDistDD.toFixed(2)) : null,
            clinical_rule_applied: clinicalRuleApplied,
            lesion_summary: {
                microaneurysms: totalMA,
                hemorrhages:    totalHM,
                hard_exudates:  totalEX,
                quadrant_distribution: quadrantCounts,
            },
        };

        // Bug 3 fix: Propagate re-arbitrated grade into top-level result fields
        // so Scanner.jsx picks up the correct grade for patientRecord and Dashboard display.
        const GRADE_MAP = [
            { grade_label: 'No Diabetic Retinopathy',        risk_level: 'LOW',    risk_score: 10, urgency: 'Routine annual screening at PHC' },
            { grade_label: 'Mild Diabetic Retinopathy',       risk_level: 'LOW',    risk_score: 28, urgency: 'Annual review; strict glycemic control' },
            { grade_label: 'Moderate Diabetic Retinopathy',   risk_level: 'MEDIUM', risk_score: 55, urgency: 'Referral to ophthalmologist within 6 months' },
            { grade_label: 'Severe Diabetic Retinopathy',     risk_level: 'HIGH',   risk_score: 85, urgency: 'Urgent referral within 3 months (high risk of PDR)' },
            { grade_label: 'Proliferative Diabetic Retinopathy', risk_level: 'HIGH', risk_score: 98, urgency: 'Emergency referral for PRP Laser / Anti-VEGF' },
        ];
        const arbInfo = GRADE_MAP[backendGrade] || GRADE_MAP[0];
        baseResult.grade       = backendGrade;
        baseResult.diagnosis   = arbInfo.grade_label;
        baseResult.grade_label = arbInfo.grade_label;
        baseResult.risk_level  = arbInfo.risk_level;
        baseResult.risk        = arbInfo.risk_level;
        baseResult.risk_score  = arbInfo.risk_score;
        baseResult.urgency     = hasMacularEdema
            ? 'URGENT: Clinically Significant Macular Edema (CSME) detected within 1 DD of fovea. Immediate referral for OCT & anti-VEGF injection.'
            : arbInfo.urgency;


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

                    const { tensorData, blurScore } = preprocessImageForONNX(img);
                    if (blurScore < 20) onProgress('⚠ Blurry image detected — results may be less accurate.');

                    // Prepare crisp, aspect-ratio-preserving ImageData for high-precision YOLO & Grad-CAM
                    const maxDim = 1024;
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const fullW = Math.round(img.width * scale);
                    const fullH = Math.round(img.height * scale);
                    const fullCanvas = document.createElement('canvas');
                    fullCanvas.width = fullW;
                    fullCanvas.height = fullH;
                    const fullCtx = fullCanvas.getContext('2d');
                    fullCtx.drawImage(img, 0, 0, fullW, fullH);
                    const fullImageData = fullCtx.getImageData(0, 0, fullW, fullH);

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
                            result.risk_level = result.risk_level || result.risk || (result.grade >= 3 ? 'HIGH' : result.grade >= 2 ? 'MEDIUM' : 'LOW');
                            result.risk = result.risk_level;
                            result.diagnosis = result.diagnosis || result.grade_label || 'Diagnostic evaluation complete';
                            inferenceWorker.terminate();
                            resolve(result);
                        } else if (type === 'ERROR') {
                            URL.revokeObjectURL(objectUrl);
                            inferenceWorker.terminate();
                            reject(new Error(error));
                        }
                    };

                    inferenceWorker.onerror = (err) => {
                        console.error('Inference Worker DOM Error:', err);
                        URL.revokeObjectURL(objectUrl);
                        inferenceWorker.terminate();
                        // Provide more context: often "undefined" means a 404 or script error on the worker itself
                        const msg = (err && err.message) ? err.message : "Worker initialization failed (check if model assets are cached or script exists)";
                        reject(new Error(`Worker error: ${msg}`));
                    };

                    inferenceWorker.postMessage({
                        type: 'INFERENCE',
                        tensorData: tensorData,
                        imageData: fullImageData,
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
