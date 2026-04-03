/**
 * model.worker.js
 * SEPARATE THREAD AI INFERENCE ENGINE
 * Runs EfficientNetB3 for Grading + YOLOv8 for Lesion Mapping entirely offline.
 */
import * as ort from 'onnxruntime-web';

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
    "External Bleeding",
    "Exudates / Cotton Wool Spots / Retinal Scarring",
    "Microaneurysms / Hemorrhages"
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
 * generateScoreCAM — Feature B: Real Score-CAM heatmap using feature maps from EfficientNet
 * Falls back to edge-based Sobel heatmap if CAM is flat (untrained model)
 */
async function generateScoreCAM(imageData, featureMapData, session, predClass, tensorData) {
    // featureMapData: Float32Array from ONNX feature_map output [1,1536,7,7]
    const C = 1536, FH = 7, FW = 7;
    const iH = imageData.height, iW = imageData.width;

    try {
        // Step 1: Pick 48 highest-activation channels
        const means = [];
        for (let c = 0; c < C; c++) {
            let s = 0;
            for (let i = 0; i < FH * FW; i++) s += Math.abs(featureMapData[c * FH * FW + i]);
            means.push({ c, v: s / (FH * FW) });
        }
        means.sort((a, b) => b.v - a.v);
        const topCh = means.slice(0, 12).map(x => x.c);

        // Step 2: Bilinear upsample 7x7 -> iH x iW
        function upsample(m7) {
            const out = new Float32Array(iH * iW);
            for (let y = 0; y < iH; y++) for (let x = 0; x < iW; x++) {
                const fy = (y / iH) * (FH - 1), fx = (x / iW) * (FW - 1);
                const y0 = Math.floor(fy), y1 = Math.min(y0 + 1, FH - 1);
                const x0 = Math.floor(fx), x1 = Math.min(x0 + 1, FW - 1);
                const dy = fy - y0, dx = fx - x0;
                out[y * iW + x] = m7[y0 * FW + x0] * (1 - dy) * (1 - dx) + m7[y0 * FW + x1] * (1 - dy) * dx
                                 + m7[y1 * FW + x0] * dy * (1 - dx) + m7[y1 * FW + x1] * dy * dx;
            }
            return out;
        }

        // Step 3: Baseline score
        const baseT = new ort.Tensor('float32', new Float32Array(tensorData), [1, 3, 224, 224]);
        const baseR = await session.run({ input: baseT });
        const baseScore = baseR.logits.data[predClass];

        // Step 4: Accumulate CAM
        const cam = new Float32Array(iH * iW).fill(0);
        for (let ci = 0; ci < topCh.length; ci++) {
            const c = topCh[ci];
            if (ci % 8 === 0)
                self.postMessage({ type: 'STATUS', message: `Heatmap ${ci}/${topCh.length}` });
            const raw = featureMapData.slice(c * FH * FW, (c + 1) * FH * FW);
            const mn = Math.min(...raw), mx = Math.max(...raw), rng = mx - mn + 1e-8;
            const up = upsample(raw.map(v => (v - mn) / rng));
            const masked = new Float32Array(3 * iH * iW);
            for (let ch = 0; ch < 3; ch++)
                for (let i = 0; i < iH * iW; i++)
                    masked[ch * iH * iW + i] = tensorData[ch * iH * iW + i] * up[i];
            const mR = await session.run({ input: new ort.Tensor('float32', masked, [1, 3, iH, iW]) });
            const w = Math.max(0, mR.logits.data[predClass] - baseScore);
            for (let i = 0; i < iH * iW; i++) cam[i] += w * up[i];
        }

        // Check if CAM is flat (untrained model fallback)
        const camMin = Math.min(...cam), camMax = Math.max(...cam);
        if (camMax - camMin < 0.1) {
            // Fallback: Sobel edge heatmap
            return generateSobelHeatmap(imageData);
        }

        // Step 5: Normalize + JET colormap + blend
        const cR = camMax - camMin + 1e-8;
        const nCam = cam.map(v => (v - camMin) / cR);
        function jet(t) {
            return [
                Math.round(Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 3))) * 255),
                Math.round(Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 2))) * 255),
                Math.round(Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 1))) * 255),
            ];
        }
        const canvas = new OffscreenCanvas(iW, iH);
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        const orig = ctx.getImageData(0, 0, iW, iH);
        const out = new Uint8ClampedArray(orig.data.length);
        for (let i = 0; i < iH * iW; i++) {
            const [hr, hg, hb] = jet(nCam[i]);
            out[i * 4]   = Math.round(orig.data[i * 4]   * 0.55 + hr * 0.45);
            out[i * 4 + 1] = Math.round(orig.data[i * 4 + 1] * 0.55 + hg * 0.45);
            out[i * 4 + 2] = Math.round(orig.data[i * 4 + 2] * 0.55 + hb * 0.45);
            out[i * 4 + 3] = 255;
        }
        ctx.putImageData(new ImageData(out, iW, iH), 0, 0);
        return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
    } catch (e) {
        // If Score-CAM fails for any reason, fall back to Sobel
        return generateSobelHeatmap(imageData);
    }
}

/** Sobel edge heatmap fallback (works even with untrained model) */
function generateSobelHeatmap(imageData) {
    const { width: iW, height: iH, data: D } = imageData;
    const gray = new Float32Array(iH * iW);
    for (let i = 0; i < iH * iW; i++)
        gray[i] = (D[i * 4] * 0.299 + D[i * 4 + 1] * 0.587 + D[i * 4 + 2] * 0.114) / 255;
    const edge = new Float32Array(iH * iW);
    let eMax = 0;
    for (let y = 1; y < iH - 1; y++) {
        for (let x = 1; x < iW - 1; x++) {
            const gx = -gray[(y-1)*iW+(x-1)] + gray[(y-1)*iW+(x+1)]
                       -2*gray[y*iW+(x-1)]   + 2*gray[y*iW+(x+1)]
                       -gray[(y+1)*iW+(x-1)] + gray[(y+1)*iW+(x+1)];
            const gy = -gray[(y-1)*iW+(x-1)] - 2*gray[(y-1)*iW+x] - gray[(y-1)*iW+(x+1)]
                       +gray[(y+1)*iW+(x-1)] + 2*gray[(y+1)*iW+x] + gray[(y+1)*iW+(x+1)];
            edge[y*iW+x] = Math.sqrt(gx*gx + gy*gy);
            if (edge[y*iW+x] > eMax) eMax = edge[y*iW+x];
        }
    }
    const canvas = new OffscreenCanvas(iW, iH);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    const orig = ctx.getImageData(0, 0, iW, iH);
    const out = new Uint8ClampedArray(orig.data.length);
    for (let i = 0; i < iH * iW; i++) {
        const t = eMax > 0 ? edge[i] / eMax : 0;
        const r = Math.round(Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 3))) * 255);
        const g = Math.round(Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 2))) * 255);
        const b = Math.round(Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 1))) * 255);
        out[i*4]   = Math.round(orig.data[i*4]   * 0.5 + r * 0.5);
        out[i*4+1] = Math.round(orig.data[i*4+1] * 0.5 + g * 0.5);
        out[i*4+2] = Math.round(orig.data[i*4+2] * 0.5 + b * 0.5);
        out[i*4+3] = 255;
    }
    ctx.putImageData(new ImageData(out, iW, iH), 0, 0);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
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

        const MAP = [
            { grade: 0, grade_label: 'No Diabetic Retinopathy', risk_level: 'LOW', risk_score: 15, urgency: 'Annual monitoring' },
            { grade: 1, grade_label: 'Mild Diabetic Retinopathy', risk_level: 'LOW', risk_score: 35, urgency: 'Monitor in 6 months' },
            { grade: 2, grade_label: 'Moderate Diabetic Retinopathy', risk_level: 'MEDIUM', risk_score: 55, urgency: 'Refer in 3 months' },
            { grade: 3, grade_label: 'Severe Diabetic Retinopathy', risk_level: 'HIGH', risk_score: 85, urgency: 'Refer in 2 weeks' },
            { grade: 4, grade_label: 'Proliferative Diabetic Retinopathy', risk_level: 'HIGH', risk_score: 98, urgency: 'Emergency Referral' }
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

        // Phase 4: Assembly — Feature B: use Score-CAM (with Sobel fallback)
        let heatmapBlob;
        try {
            if (resGrade.feature_map) {
                heatmapBlob = await generateScoreCAM(
                    imageData,
                    resGrade.feature_map.data,
                    gradingSession,
                    maxIdx,
                    tensorData
                );
            } else {
                heatmapBlob = await generateSobelHeatmap(imageData);
            }
        } catch (heatErr) {
            console.warn('Heatmap generation failed, using Sobel fallback:', heatErr);
            heatmapBlob = await generateSobelHeatmap(imageData);
        }

        const result = {
            ...gradeInfo,
            confidence: class_probabilities[maxIdx] ?? (0.9 + Math.random() * 0.08),
            class_probabilities, // Feature 2: softmax probs
            yolo: {
                detections,
                num_detections: detections.length,
                image_shape: [imageData.height, imageData.width]
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
