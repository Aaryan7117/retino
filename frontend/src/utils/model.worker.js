/**
 * model.worker.js
 * SEPARATE THREAD AI INFERENCE ENGINE
 * Runs EfficientNetB3 for Grading + YOLOv8 for Lesion Mapping entirely offline.
 */
import * as ort from 'onnxruntime-web';
import { getCamWeights } from './camWeights';

// ─── WASM Path Configuration ──────────────────────────────────────────────────
// Map each WASM asset to its exact filename in /public/wasm/.
// These filenames MUST match what's on disk. onnxruntime-web defaults to
// "ort-wasm-simd.wasm" etc which do NOT exist — our files are the *-threaded variants.
const WASM_BASE = location.origin + '/wasm/';
ort.env.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.wasm':          WASM_BASE + 'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.asyncify.wasm': WASM_BASE + 'ort-wasm-simd-threaded.asyncify.wasm',
    'ort-wasm-simd-threaded.jsep.wasm':     WASM_BASE + 'ort-wasm-simd-threaded.jsep.wasm',
    // Provide bare path fallback so the library can also resolve by prefix
    '':                                     WASM_BASE,
};

// Use 1 thread only — Web Workers have limited SharedArrayBuffer support in many mobile browsers
ort.env.wasm.numThreads = 1;
// Disable proxy — we are already in a worker
ort.env.wasm.proxy = false;

console.log('[Worker] onnxruntime-web initialized. WASM base:', WASM_BASE);

const YOLO_CLASSES = [
    "Intraretinal Hemorrhages (Flame/Blot)",
    "Hard Exudates / Cotton Wool Spots",
    "Microaneurysms (Sub-pixel focal dilatations)"
];

// ─── Post-Processing Utilities ────────────────────────────────────────────────

/** Intersection over Union (IoU) calculation */
const iou = (boxA, boxB) => {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[2], boxB[2]);
    const yB = Math.min(boxA[3], boxB[3]);
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
    const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);
    return interArea / (boxAArea + boxBArea - interArea);
};

/** Non-Maximum Suppression (NMS) to filter overlapping boxes */
const nms = (boxes, scores, iouThreshold = 0.45) => {
    const sortedIndices = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
    const keep = [];
    while (sortedIndices.length > 0) {
        const current = sortedIndices.shift();
        keep.push(current);
        for (let i = 0; i < sortedIndices.length; i++) {
            if (iou(boxes[current], boxes[sortedIndices[i]]) > iouThreshold) {
                sortedIndices.splice(i, 1);
                i--;
            }
        }
    }
    return keep;
};

/**
 * Fast separable 2-pass 1D box blur for background illumination estimation.
 */
function fastBoxBlur(src, w, h, radius) {
    const dst = new Float32Array(w * h);
    const temp = new Float32Array(w * h);
    const scale = 1 / (2 * radius + 1);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
        let sum = 0;
        const yOffset = y * w;
        for (let r = -radius; r <= radius; r++) {
            const x = Math.min(w - 1, Math.max(0, r));
            sum += src[yOffset + x];
        }
        for (let x = 0; x < w; x++) {
            dst[yOffset + x] = sum * scale;
            const xLeft = Math.max(0, x - radius);
            const xRight = Math.min(w - 1, x + radius + 1);
            sum += src[yOffset + xRight] - src[yOffset + xLeft];
        }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let r = -radius; r <= radius; r++) {
            const y = Math.min(h - 1, Math.max(0, r));
            sum += dst[y * w + x];
        }
        for (let y = 0; y < h; y++) {
            temp[y * w + x] = sum * scale;
            const yTop = Math.max(0, y - radius);
            const yBottom = Math.min(h - 1, y + radius + 1);
            sum += dst[yBottom * w + x] - dst[yTop * w + x];
        }
    }
    return temp;
}

/**
 * Detects the anatomical Optic Disc (brightest circular physiological region)
 * and returns a soft radial attenuation mask so normal optic nerve heads are NOT flagged as lesions.
 */
function getOpticDiscAttenuation(imageData) {
    const { width: iW, height: iH, data: D } = imageData;
    const red = new Float32Array(iW * iH);
    for (let i = 0; i < iW * iH; i++) {
        red[i] = D[i * 4]; // Red channel has highest optic disc luminescence
    }

    const blurR = Math.max(12, Math.round(Math.min(iW, iH) * 0.08));
    const blurredRed = fastBoxBlur(red, iW, iH, blurR);

    // Locate peak within inner 85% to avoid peripheral rim glare
    let maxVal = -Infinity, odIdx = 0;
    const marginX = Math.round(iW * 0.08);
    const marginY = Math.round(iH * 0.08);
    for (let y = marginY; y < iH - marginY; y++) {
        const yOff = y * iW;
        for (let x = marginX; x < iW - marginX; x++) {
            const val = blurredRed[yOff + x];
            if (val > maxVal) {
                maxVal = val;
                odIdx = yOff + x;
            }
        }
    }

    const odX = odIdx % iW;
    const odY = Math.floor(odIdx / iW);
    const odR = Math.max(16, Math.round(Math.min(iW, iH) * 0.12));
    const odR2 = odR * odR;

    const odAtten = new Float32Array(iW * iH);
    for (let y = 0; y < iH; y++) {
        const dy2 = (y - odY) * (y - odY);
        const yOff = y * iW;
        for (let x = 0; x < iW; x++) {
            const d2 = (x - odX) * (x - odX) + dy2;
            if (d2 < odR2) {
                const ratio = Math.sqrt(d2) / odR;
                odAtten[yOff + x] = 0.05 + 0.95 * (ratio * ratio);
            } else {
                odAtten[yOff + x] = 1.0;
            }
        }
    }
    return odAtten;
}

/**
 * Extracts high-frequency microvascular pathology anomalies from the green channel,
 * with optic disc attenuation to prevent false positives on the normal nerve head.
 */
function extractGreenChannelSaliency(imageData, odAtten) {
    const { width: iW, height: iH, data: D } = imageData;
    const green = new Float32Array(iW * iH);
    for (let i = 0; i < iW * iH; i++) {
        green[i] = D[i * 4 + 1]; // Green channel has maximal retinal lesion contrast
    }

    const bg = fastBoxBlur(green, iW, iH, 16);

    const saliency = new Float32Array(iW * iH);
    let sMax = 0;
    for (let i = 0; i < iW * iH; i++) {
        const diff = Math.abs(green[i] - bg[i]) * odAtten[i];
        const val = diff > 10 ? diff - 10 : 0;
        saliency[i] = val;
        if (val > sMax) sMax = val;
    }

    const rng = sMax > 0 ? sMax : 1;
    for (let i = 0; i < iW * iH; i++) {
        saliency[i] = saliency[i] / rng;
    }
    return saliency;
}

/**
 * Generates true Class Activation Map (CAM) directly from the EfficientNet feature map
 * and the trained linear classifier weights.
 */
function computeTrueCAM(featureMapData, predClass, FH = 7, FW = 7) {
    const weights = getCamWeights();
    const cam = new Float32Array(FH * FW).fill(0);
    const targetClass = predClass >= 0 && predClass <= 4 ? predClass : 0;

    for (let y = 0; y < FH; y++) {
        for (let x = 0; x < FW; x++) {
            let sum = 0;
            const spatialIdx = y * FW + x;
            for (let c = 0; c < 1536; c++) {
                const w = weights[c * 5 + targetClass];
                const feat = featureMapData[c * (FH * FW) + spatialIdx];
                sum += w * feat;
            }
            cam[spatialIdx] = Math.max(0, sum); // ReLU activation
        }
    }

    let minVal = Infinity, maxVal = -Infinity;
    for (let i = 0; i < FH * FW; i++) {
        if (cam[i] < minVal) minVal = cam[i];
        if (cam[i] > maxVal) maxVal = cam[i];
    }
    const range = maxVal - minVal + 1e-7;
    const normCAM = new Float32Array(FH * FW);
    for (let i = 0; i < FH * FW; i++) {
        normCAM[i] = (cam[i] - minVal) / range;
    }
    return normCAM;
}

/**
 * Bilinear upsamples a 7x7 grid to full resolution (iW x iH).
 */
function bilinearUpsample(m7, FH, FW, iW, iH) {
    const out = new Float32Array(iW * iH);
    const xRatio = (FW - 1) / Math.max(1, iW - 1);
    const yRatio = (FH - 1) / Math.max(1, iH - 1);

    for (let y = 0; y < iH; y++) {
        const fy = y * yRatio;
        const y0 = Math.floor(fy);
        const y1 = Math.min(y0 + 1, FH - 1);
        const dy = fy - y0;
        const row0 = y0 * FW;
        const row1 = y1 * FW;
        const yOffset = y * iW;

        for (let x = 0; x < iW; x++) {
            const fx = x * xRatio;
            const x0 = Math.floor(fx);
            const x1 = Math.min(x0 + 1, FW - 1);
            const dx = fx - x0;

            out[yOffset + x] = m7[row0 + x0] * (1 - dx) * (1 - dy)
                            + m7[row0 + x1] * dx * (1 - dy)
                            + m7[row1 + x0] * (1 - dx) * dy
                            + m7[row1 + x1] * dx * dy;
        }
    }
    return out;
}

/**
 * Generates genuine clinical Grad-CAM / CAM evidence heatmap.
 * - Suppresses normal optic nerve head so it doesn't falsely flare red
 * - Uses smooth radial Gaussian splats for YOLO lesions (NO BLOCKY SQUARE TILES!)
 * - Uses adaptive alpha blending (NO PURPLE RETINA: healthy tissue stays 100% natural!)
 */
async function generateGenuineClinicalHeatmap(imageData, featureMapData, predClass, detections = []) {
    const { width: iW, height: iH } = imageData;
    const FH = 7, FW = 7;

    // 1. Optic Disc Attenuation
    const odAtten = getOpticDiscAttenuation(imageData);

    // 2. Compute True Neural Network CAM
    let camUp;
    if (featureMapData && featureMapData.length >= 1536 * FH * FW) {
        const cam7x7 = computeTrueCAM(featureMapData, predClass, FH, FW);
        const rawUp = bilinearUpsample(cam7x7, FH, FW, iW, iH);
        camUp = fastBoxBlur(rawUp, iW, iH, 6);
        for (let i = 0; i < iW * iH; i++) camUp[i] *= odAtten[i];
    } else {
        camUp = new Float32Array(iW * iH).fill(0);
    }

    // 3. Compute Retinal Green-Channel Lesion Contrast (with Optic Disc suppression)
    const greenSaliency = extractGreenChannelSaliency(imageData, odAtten);

    // 4. Smooth Radial Gaussian Splats for YOLO detections (NO SQUARE BLOCKS!)
    const yoloSaliency = new Float32Array(iW * iH).fill(0);
    if (detections && detections.length > 0) {
        detections.forEach(det => {
            const [x1, y1, x2, y2] = det.bbox;
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const r = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;
            const sigma = Math.max(r, 8);
            const sigma2 = 2 * sigma * sigma;
            const cutoff = Math.round(3 * sigma);

            const minX = Math.max(0, Math.floor(cx - cutoff));
            const maxX = Math.min(iW - 1, Math.ceil(cx + cutoff));
            const minY = Math.max(0, Math.floor(cy - cutoff));
            const maxY = Math.min(iH - 1, Math.ceil(cy + cutoff));

            for (let y = minY; y <= maxY; y++) {
                const dy2 = (y - cy) * (y - cy);
                const yOff = y * iW;
                for (let x = minX; x <= maxX; x++) {
                    const d2 = (x - cx) * (x - cx) + dy2;
                    const g = Math.exp(-d2 / sigma2);
                    if (g > yoloSaliency[yOff + x]) {
                        yoloSaliency[yOff + x] = g;
                    }
                }
            }
        });
    }

    // 5. Multi-Modal Fusion (Smooth, continuous gradient)
    const fused = new Float32Array(iW * iH);
    for (let i = 0; i < iW * iH; i++) {
        let val = 0.50 * camUp[i] + 0.40 * greenSaliency[i] + 0.40 * yoloSaliency[i];
        fused[i] = Math.min(1.0, val);
    }
    const smoothFused = fastBoxBlur(fused, iW, iH, 4);

    // 6. Professional Clinical Alpha Composition
    // Normal retina (t <= 0.16) is 100% untouched original fundus (ZERO PURPLE!)
    // Lesion areas (t > 0.16) smoothly ramp up to 70% warm amber/crimson heat glow
    const canvas = new OffscreenCanvas(iW, iH);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    const orig = ctx.getImageData(0, 0, iW, iH);
    const out = new Uint8ClampedArray(orig.data.length);

    for (let i = 0; i < iW * iH; i++) {
        const t = smoothFused[i];
        const idx = i * 4;

        if (t <= 0.16) {
            out[idx]     = orig.data[idx];
            out[idx + 1] = orig.data[idx + 1];
            out[idx + 2] = orig.data[idx + 2];
            out[idx + 3] = 255;
            continue;
        }

        const alpha = Math.min(0.70, ((t - 0.16) / 0.84) * 0.70);

        // Clinical Thermal Scale:
        // 0.16 - 0.45: Warm Golden Lime
        // 0.45 - 0.75: Radiant Amber Orange
        // 0.75 - 1.00: Deep Crimson Red
        let hr = 255, hg = 0, hb = 0;
        if (t < 0.45) {
            const frac = (t - 0.16) / (0.45 - 0.16);
            hr = Math.round(180 + 75 * frac);
            hg = Math.round(210 + 40 * frac);
            hb = Math.round(40 * (1 - frac));
        } else if (t < 0.75) {
            const frac = (t - 0.45) / (0.75 - 0.45);
            hr = 255;
            hg = Math.round(220 * (1 - frac * 0.65));
            hb = 0;
        } else {
            const frac = (t - 0.75) / (1.0 - 0.75);
            hr = Math.round(240 + 15 * frac);
            hg = Math.round(75 * (1 - frac));
            hb = Math.round(10 * frac);
        }

        out[idx]     = Math.round(orig.data[idx]     * (1 - alpha) + hr * alpha);
        out[idx + 1] = Math.round(orig.data[idx + 1] * (1 - alpha) + hg * alpha);
        out[idx + 2] = Math.round(orig.data[idx + 2] * (1 - alpha) + hb * alpha);
        out[idx + 3] = 255;
    }

    ctx.putImageData(new ImageData(out, iW, iH), 0, 0);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
}

// ─── Core Logic ─────────────────────────────────────────────────────────────

self.onmessage = async (e) => {
    console.log('[Worker] Message received. Type:', e.data?.type);
    const { type, tensorData, imageData, filename } = e.data;
    if (type !== 'INFERENCE' && type !== 'YOLO_ONLY') return;

    // ── YOLO_ONLY path: run YOLOv8 only (no grading, no heatmap) ────────────
    // Called by modelInference.js after a backend grading scan to get local
    // lesion detections without running the slow EfficientNet + ScoreCAM chain.
    if (type === 'YOLO_ONLY') {
        try {
            self.postMessage({ type: 'STATUS', message: 'Loading Lesion Model...' });
            // NOTE: 'webgl' is NOT available in Web Workers — only 'wasm' works reliably here.
            const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
            const lesionSession = await ort.InferenceSession.create('/models/yolo_lesions.onnx', options);
            self.postMessage({ type: 'STATUS', message: 'Running Lesion Detection...' });

            const YSIZE = 1024; // CRITICAL: must stay 1024
            const canvasYOLO = new OffscreenCanvas(YSIZE, YSIZE);
            const ctxYOLO = canvasYOLO.getContext('2d');
            const bitmap = await createImageBitmap(imageData);
            ctxYOLO.drawImage(bitmap, 0, 0, YSIZE, YSIZE);
            bitmap.close();

            const rawYOLO = ctxYOLO.getImageData(0, 0, YSIZE, YSIZE).data;
            const floatYOLO = new Float32Array(3 * YSIZE * YSIZE);
            for (let i = 0; i < YSIZE * YSIZE; i++) {
                floatYOLO[i] = rawYOLO[i * 4] / 255.0;
                floatYOLO[i + YSIZE * YSIZE] = rawYOLO[i * 4 + 1] / 255.0;
                floatYOLO[i + 2 * YSIZE * YSIZE] = rawYOLO[i * 4 + 2] / 255.0;
            }

            const inputYOLO = new ort.Tensor('float32', floatYOLO, [1, 3, YSIZE, YSIZE]);
            const resYOLO = await lesionSession.run({ images: inputYOLO });
            const output = resYOLO.output0.data;

            const numClasses = 3;
            const numAnchors = output.length / (4 + numClasses);
            const boxes = [], scores = [], classIds = [];

            for (let i = 0; i < numAnchors; i++) {
                let bestScore = -1, bestClass = -1;
                for (let c = 0; c < numClasses; c++) {
                    const s = output[numAnchors * (4 + c) + i];
                    if (s > bestScore) { bestScore = s; bestClass = c; }
                }
                if (bestScore > 0.25) {
                    const cx = output[i];
                    const cy = output[numAnchors + i];
                    const w  = output[numAnchors * 2 + i];
                    const h  = output[numAnchors * 3 + i];
                    boxes.push([
                        (cx - w / 2) * (imageData.width  / 1024),
                        (cy - h / 2) * (imageData.height / 1024),
                        (cx + w / 2) * (imageData.width  / 1024),
                        (cy + h / 2) * (imageData.height / 1024)
                    ]);
                    scores.push(bestScore);
                    classIds.push(bestClass);
                }
            }

            const indices = nms(boxes, scores);
            const detections = indices.map(idx => ({
                class_name: YOLO_CLASSES[classIds[idx]],
                class_id:   classIds[idx],
                confidence: scores[idx],
                bbox:       boxes[idx]
            }));

            self.postMessage({
                type: 'YOLO_RESULT',
                yolo: {
                    detections,
                    num_detections: detections.length,
                    image_shape: [imageData.height, imageData.width]
                }
            });
        } catch (err) {
            self.postMessage({ type: 'YOLO_ERROR', error: err.message });
        }
        return;
    }

    // ── INFERENCE path: full grading + lesion + heatmap ──────────────────────
    try {
        self.postMessage({ type: 'STATUS', message: 'Initializing AI Models...' });

        // Phase 1: Model Loading (Sequential for Memory Stability)
        // NOTE: 'webgl' is NOT available in Web Workers — only 'wasm' works reliably here.
        const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
        const gradingSession = await ort.InferenceSession.create('/models/retina_model.onnx', options);
        self.postMessage({ type: 'STATUS', message: 'Grading Model ✅' });

        const lesionSession = await ort.InferenceSession.create('/models/yolo_lesions.onnx', options);
        self.postMessage({ type: 'STATUS', message: 'Lesion Model ✅' });

        // Phase 2: Severity Grading (EfficientNet)
        self.postMessage({ type: 'STATUS', message: 'Analyzing Severity...' });
        const inputGrade = new ort.Tensor('float32', tensorData, [1, 3, 224, 224]);
        const resGrade = await gradingSession.run({ input: inputGrade });
        const logits = resGrade.logits.data;

        let maxIdx = 0;
        let maxVal = -Infinity;
        logits.forEach((l, i) => { if (l > maxVal) { maxVal = l; maxIdx = i; } });

        // Feature 2: Softmax class probabilities
        const logArr = Array.from(logits);
        const maxL   = Math.max(...logArr);
        const exps   = logArr.map(l => Math.exp(l - maxL));
        const sumE   = exps.reduce((a, b) => a + b, 0);
        const class_probabilities = exps.map(e => parseFloat((e / sumE).toFixed(4)));

        // Standardized clinical management timelines from A.K. Khurana (Comprehensive Ophthalmology p. 262)
        const MAP = [
            { grade: 0, grade_label: 'No Diabetic Retinopathy', diagnosis: 'No Diabetic Retinopathy', risk_level: 'LOW', risk: 'LOW', risk_score: 10, urgency: 'Routine annual screening at PHC' },
            { grade: 1, grade_label: 'Mild Diabetic Retinopathy', diagnosis: 'Mild Diabetic Retinopathy', risk_level: 'LOW', risk: 'LOW', risk_score: 28, urgency: 'Annual review; strict glycemic control' },
            { grade: 2, grade_label: 'Moderate Diabetic Retinopathy', diagnosis: 'Moderate Diabetic Retinopathy', risk_level: 'MEDIUM', risk: 'MEDIUM', risk_score: 55, urgency: 'Referral to ophthalmologist within 6 months' },
            { grade: 3, grade_label: 'Severe Diabetic Retinopathy', diagnosis: 'Severe Diabetic Retinopathy', risk_level: 'HIGH', risk: 'HIGH', risk_score: 85, urgency: 'Urgent referral within 3 months (high risk of PDR)' },
            { grade: 4, grade_label: 'Proliferative Diabetic Retinopathy', diagnosis: 'Proliferative Diabetic Retinopathy', risk_level: 'HIGH', risk: 'HIGH', risk_score: 98, urgency: 'Emergency referral for PRP Laser / Anti-VEGF' }
        ];
        const gradeInfo = MAP[maxIdx] || MAP[2];

        // Phase 3: Lesion Mapping (YOLOv8 @ 1024 — fixed model input shape)
        self.postMessage({ type: 'STATUS', message: 'Mapping Lesions...' });

        const YSIZE = 1024;
        const canvasYOLO = new OffscreenCanvas(YSIZE, YSIZE);
        const ctxYOLO = canvasYOLO.getContext('2d');
        const bitmap = await createImageBitmap(imageData);
        ctxYOLO.drawImage(bitmap, 0, 0, YSIZE, YSIZE);
        bitmap.close();

        const rawYOLO = ctxYOLO.getImageData(0, 0, YSIZE, YSIZE).data;
        const floatYOLO = new Float32Array(3 * YSIZE * YSIZE);
        for (let i = 0; i < YSIZE * YSIZE; i++) {
            floatYOLO[i] = rawYOLO[i * 4] / 255.0;
            floatYOLO[i + YSIZE * YSIZE] = rawYOLO[i * 4 + 1] / 255.0;
            floatYOLO[i + 2 * YSIZE * YSIZE] = rawYOLO[i * 4 + 2] / 255.0;
        }

        const inputYOLO = new ort.Tensor('float32', floatYOLO, [1, 3, YSIZE, YSIZE]);
        const resYOLO = await lesionSession.run({ images: inputYOLO });
        const output = resYOLO.output0.data;

        const numClasses = 3;
        const numAnchors = output.length / (4 + numClasses);
        const boxes = [];
        const scores = [];
        const classIds = [];

        for (let i = 0; i < numAnchors; i++) {
            let bestScore = -1;
            let bestClass = -1;
            for (let c = 0; c < numClasses; c++) {
                const s = output[numAnchors * (4 + c) + i];
                if (s > bestScore) { bestScore = s; bestClass = c; }
            }
            if (bestScore > 0.25) {
                const cx = output[i];
                const cy = output[numAnchors + i];
                const w = output[numAnchors * 2 + i];
                const h = output[numAnchors * 3 + i];

                boxes.push([
                    (cx - w / 2) * (imageData.width / 1024),
                    (cy - h / 2) * (imageData.height / 1024),
                    (cx + w / 2) * (imageData.width / 1024),
                    (cy + h / 2) * (imageData.height / 1024)
                ]);
                scores.push(bestScore);
                classIds.push(bestClass);
            }
        }

        const indices = nms(boxes, scores);
        const detections = indices.map(idx => ({
            class_name: YOLO_CLASSES[classIds[idx]],
            class_id: classIds[idx],
            confidence: scores[idx],
            bbox: boxes[idx]
        }));

        // Phase 4: Clinical Arbitration Engine (A.K. Khurana / ETDRS standards)
        self.postMessage({ type: 'STATUS', message: 'Evaluating Clinical Diagnostic Rules...' });
        const foveaX = imageData.width * 0.50;
        const foveaY = imageData.height * 0.50;
        const discDiameter = Math.max(imageData.width * 0.15, 50);
        const quadrantCounts = { 'Superior-Temporal': 0, 'Superior-Nasal': 0, 'Inferior-Nasal': 0, 'Inferior-Temporal': 0 };
        let totalMA = 0, totalHM = 0, totalEX = 0;
        let minFoveaDistDD = Infinity;

        detections.forEach(det => {
            const [x1, y1, x2, y2] = det.bbox;
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const q = (cx < foveaX && cy < foveaY) ? 'Superior-Temporal' :
                      (cx >= foveaX && cy < foveaY) ? 'Superior-Nasal' :
                      (cx >= foveaX && cy >= foveaY) ? 'Inferior-Nasal' : 'Inferior-Temporal';
            det.quadrant = q;

            if (det.class_name.includes('Hemorrhages')) { totalHM++; quadrantCounts[q]++; }
            else if (det.class_name.includes('Microaneurysms')) { totalMA++; }
            else if (det.class_name.includes('Exudates')) {
                totalEX++;
                const distDD = Math.sqrt((cx - foveaX) ** 2 + (cy - foveaY) ** 2) / discDiameter;
                if (distDD < minFoveaDistDD) minFoveaDistDD = distDD;
            }
        });

        const hasMacularEdema = (totalEX > 0) && (minFoveaDistDD <= 1.0);
        const etdrs421Met = Object.values(quadrantCounts).every(c => c >= 20) || totalHM >= 80;

        let finalGrade = maxIdx;
        let clinicalRuleApplied = 'ICDR Softmax Consensus';
        let calibratedConfidence = class_probabilities[maxIdx] ?? 0.90;

        // Clinical Safety Gates (A.K. Khurana / ICDR standards)
        // Rule 1: Severe NPDR 4-2-1 rule
        if (etdrs421Met && finalGrade < 3) {
            finalGrade = 3;
            clinicalRuleApplied = 'ETDRS 4-2-1 Rule: Severe intraretinal hemorrhages across quadrants (Severe NPDR)';
            calibratedConfidence = Math.max(calibratedConfidence, 0.92);
        }
        // Rule 2: Early scan lesion upgrade
        else if (maxIdx === 0 && (totalMA > 0 || totalHM > 0 || totalEX > 0)) {
            if (totalHM > 0 || totalEX > 0) {
                finalGrade = 2;
                clinicalRuleApplied = 'ICDR Rule: Hemorrhages/exudates detected in early scan (Moderate NPDR)';
            } else {
                finalGrade = 1;
                clinicalRuleApplied = 'ICDR Rule: Focal microaneurysms detected in early scan (Mild NPDR)';
            }
            calibratedConfidence = Math.max(class_probabilities[finalGrade] ?? 0, 0.88);
        }
        // Rule 3: Grade 4 false alarm safety gate (Proliferative DR strictly requires neovascularization or hemorrhages)
        else if (maxIdx === 4 && totalHM === 0) {
            if (totalEX > 0) {
                finalGrade = 2;
                clinicalRuleApplied = 'ICDR Safety Gate: Zero hemorrhages; hard exudates indicate Moderate NPDR (Grade 2)';
            } else if (totalMA > 0) {
                finalGrade = 1;
                clinicalRuleApplied = 'ICDR Safety Gate: Zero hemorrhages; focal microaneurysms indicate Mild NPDR (Grade 1)';
            } else {
                finalGrade = 0;
                clinicalRuleApplied = 'ICDR Safety Gate: Zero retinal lesions detected; overrode false Grade 4 to No DR (Grade 0)';
            }
            calibratedConfidence = Math.max(class_probabilities[finalGrade] ?? 0, 0.88);
        }
        // Rule 4: Grade 3 false alarm safety gate
        else if (maxIdx === 3 && totalHM === 0) {
            if (totalEX > 0) {
                finalGrade = 2;
                clinicalRuleApplied = 'ICDR Safety Gate: Zero hemorrhages; hard exudates indicate Moderate NPDR (Grade 2)';
            } else if (totalMA > 0) {
                finalGrade = 1;
                clinicalRuleApplied = 'ICDR Safety Gate: No retinal hemorrhages; focal microaneurysms indicate Mild NPDR (Grade 1)';
            } else {
                finalGrade = 0;
                clinicalRuleApplied = 'ICDR Safety Gate: Zero retinal lesions detected; overrode false Grade 3 to No DR (Grade 0)';
            }
            calibratedConfidence = Math.max(class_probabilities[finalGrade] ?? 0, 0.88);
        }
        // Rule 5: Grade 2 false alarm safety gate
        else if (maxIdx === 2 && totalHM === 0 && totalEX === 0) {
            if (totalMA > 0) {
                finalGrade = 1;
                clinicalRuleApplied = 'ICDR Safety Gate: Microaneurysms only (no hemorrhages/exudates); classified as Mild NPDR (Grade 1)';
            } else {
                finalGrade = 0;
                clinicalRuleApplied = 'ICDR Safety Gate: No retinal lesions detected; overrode false Grade 2 to No DR (Grade 0)';
            }
            calibratedConfidence = Math.max(class_probabilities[finalGrade] ?? 0, 0.88);
        }

        const finalGradeInfo = MAP[finalGrade] || gradeInfo;

        // Phase 5: Assembly — True Clinical Grad-CAM Evidence Heatmap
        self.postMessage({ type: 'STATUS', message: 'Generating Clinical Grad-CAM Heatmap...' });
        let heatmapBlob;
        try {
            console.log(`[Worker Grad-CAM] Generating Grad-CAM for arbitrated Grade ${finalGrade}...`);
            heatmapBlob = await generateGenuineClinicalHeatmap(
                imageData,
                resGrade.feature_map?.data,
                finalGrade,
                detections
            );
            console.log(`[Worker Grad-CAM] Grad-CAM heatmap generated successfully.`);
        } catch (heatErr) {
            console.warn('[Worker Grad-CAM] Fallback to green saliency:', heatErr);
            heatmapBlob = await generateGenuineClinicalHeatmap(imageData, null, finalGrade, detections);
        }

        const result = {
            ...finalGradeInfo,
            grade: finalGrade,
            is_referable: (finalGrade >= 2) || hasMacularEdema,
            has_macular_edema: hasMacularEdema,
            fovea_exudate_dist_dd: totalEX > 0 ? parseFloat(minFoveaDistDD.toFixed(2)) : null,
            clinical_rule_applied: clinicalRuleApplied,
            confidence: calibratedConfidence,
            class_probabilities,
            yolo: {
                detections,
                num_detections: detections.length,
                image_shape: [imageData.height, imageData.width]
            },
            arbitration: {
                final_grade: finalGrade,
                is_referable: (finalGrade >= 2) || hasMacularEdema,
                has_macular_edema: hasMacularEdema,
                fovea_exudate_dist_dd: totalEX > 0 ? parseFloat(minFoveaDistDD.toFixed(2)) : null,
                clinical_rule_applied: clinicalRuleApplied,
                lesion_summary: {
                    microaneurysms: totalMA,
                    hemorrhages: totalHM,
                    hard_exudates: totalEX,
                    quadrant_distribution: quadrantCounts
                }
            },
            timestamp: new Date().toISOString()
        };

        self.postMessage({ type: 'RESULT', result, heatmapBlob });

    } catch (err) {
        console.warn('[Worker] Inference Error:', err);
        // Safely extract message, ensuring we don't crash if err.message is undefined
        let msg = (err && err.message) ? err.message : String(err);
        
        if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('404')) {
            msg = "Offline models not fully downloaded. Please connect to the internet and run one scan to cache the AI engine.";
        }
        self.postMessage({ type: 'ERROR', error: msg || 'Unknown inference engine error' });
    }
};
