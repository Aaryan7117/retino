/**
 * Heuristic validation to check if an uploaded image is a valid fundus photograph.
 *
 * Runs BEFORE ONNX inference and rejects obvious non-eye content such as
 * certificates, documents, or selfies.
 *
 * Implementation follows the requested three-step validator:
 *  1) Corner brightness check
 *  2) Center texture / variance check
 *  3) Soft circularity heuristic (center vs corner brightness)
 *
 * Throws an Error with a user-facing message if the image fails validation.
 */
export const validateFundusImage = (imageData) => {
    const { width, height, data } = imageData;

    // Helper: compute mean brightness (0–255) and variance for a rectangular region
    const getRegionStats = (startX, startY, w, h) => {
        let sum = 0;
        let sumSq = 0;
        let count = 0;

        const x0 = Math.max(0, Math.floor(startX));
        const y0 = Math.max(0, Math.floor(startY));
        const x1 = Math.min(width, Math.floor(startX + w));
        const y1 = Math.min(height, Math.floor(startY + h));

        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = (r + g + b) / 3; // 0–255
                sum += brightness;
                sumSq += brightness * brightness;
                count++;
            }
        }

        if (!count) {
            return { mean: 0, variance: 0 };
        }

        const mean = sum / count;
        const variance = Math.max(0, (sumSq / count) - (mean * mean));
        return { mean, variance };
    };

    const maxBrightness = 255;

    // ── STEP 1: Corner Brightness Check (Relaxed) ──────────────────────
    const cornerSize = 20;
    const tl = getRegionStats(0, 0, cornerSize, cornerSize).mean;
    const tr = getRegionStats(width - cornerSize, 0, cornerSize, cornerSize).mean;
    const bl = getRegionStats(0, height - cornerSize, cornerSize, cornerSize).mean;
    const br = getRegionStats(width - cornerSize, height - cornerSize, cornerSize, cornerSize).mean;

    const corners = [tl, tr, bl, br];
    // Relaxed threshold: 60% of max instead of 40%
    const darkThreshold = 0.6 * maxBrightness;
    const darkCornersCount = corners.filter((c) => c < darkThreshold).length;

    // Relaxed: Accept if at least 2 out of 4 corners are dark (instead of 3).
    const step1Failed = darkCornersCount < 2;

    // ── STEP 2: Center Variation Check (Relaxed) ───────────────────────
    // Sample a central 50x50 region.
    const centerSize = 50;
    const centerX = (width - centerSize) / 2;
    const centerY = (height - centerSize) / 2;
    const centerStats = getRegionStats(centerX, centerY, centerSize, centerSize);

    // Only reject if Variance is EXTREMELY low (pure document/uniform color)
    const extremelyLowVariance = 15;
    const brightThreshold = 0.9 * maxBrightness;

    // Fail only if it's both extremely flat AND bright (document-like)
    const step2Failed =
        centerStats.variance < extremelyLowVariance &&
        centerStats.mean > brightThreshold;

    // ── STEP 3: Circularity Heuristic (Relaxed) ────────────────────────
    // Compute difference between center brightness and corner brightness.
    const avgCornerBrightness = corners.reduce((a, b) => a + b, 0) / corners.length;

    // Only fail if almost no difference between center and corners (extremely flat and bright)
    const extremelyBrightCorner = 0.8 * maxBrightness;
    const tinyDifference = 15;

    const step3Failed =
        avgCornerBrightness > extremelyBrightCorner &&
        Math.abs(centerStats.mean - avgCornerBrightness) < tinyDifference;

    // Decision Logic
    if (step1Failed || step2Failed || step3Failed) {
        throw new Error('Invalid Image: Please upload a retinal fundus photograph (eye image from fundus camera).');
    }

    return true;
};

/**
 * A low variance indicates a blurry image (fewer edges).
 */
export const calculateBlur = (imageData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // 1. Convert to grayscale
    const gray = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        // Standard luminosity formula
        gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    // 2. Apply 3x3 Laplacian filter to detect edges
    // [ 0,  1,  0]
    // [ 1, -4,  1]
    // [ 0,  1,  0]
    let sum = 0;
    let count = 0;
    const laplace = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const val =
                gray[(y - 1) * width + x] +
                gray[(y + 1) * width + x] +
                gray[y * width + (x - 1)] +
                gray[y * width + (x + 1)] -
                4 * gray[idx];

            laplace[idx] = val;
            sum += val;
            count++;
        }
    }

    // 3. Calculate variance (mean of squared differences)
    const mean = sum / count;
    let variance = 0;
    for (let i = 0; i < count; i++) {
        const diff = laplace[i] - mean;
        variance += diff * diff;
    }

    return variance / count;
};

/**
 * Preprocess image for EfficientNetB3 ONNX inference
 * Resizes, center crops, normalizes with ImageNet stats, and returns a CHW Float32Array.
 */
export const preprocessImageForONNX = (imageElement) => {
    // EfficientNet expected size
    const SIZE = 224;

    // 1. Draw to canvas and resize (Cover / Center Crop equivalent)
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Calculate crop dimensions to maintain aspect ratio
    const scale = Math.max(SIZE / imageElement.width, SIZE / imageElement.height);
    const w = imageElement.width * scale;
    const h = imageElement.height * scale;
    const x = (SIZE - w) / 2;
    const y = (SIZE - h) / 2;

    ctx.drawImage(imageElement, x, y, w, h);

    // Get raw pixel data for ONNX CHW transformation
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const data = imageData.data;

    // Check blur purely on the visible resized image
    const blurScore = calculateBlur(imageData);

    // 2. Normalize and convert to CHW float32 array
    // ImageNet stats: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    const float32Data = new Float32Array(3 * SIZE * SIZE); // 3 channels

    for (let i = 0; i < SIZE * SIZE; i++) {
        // Red
        float32Data[i] = ((data[i * 4] / 255.0) - mean[0]) / std[0];
        // Green
        float32Data[i + (SIZE * SIZE)] = ((data[i * 4 + 1] / 255.0) - mean[1]) / std[1];
        // Blue
        float32Data[i + (2 * SIZE * SIZE)] = ((data[i * 4 + 2] / 255.0) - mean[2]) / std[2];
    }

    return {
        tensorData: float32Data,
        blurScore,
        imageData
    };
};
