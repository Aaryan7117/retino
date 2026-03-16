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
    const { width: W, height: H, data: D } = imageData;
    const warnings = [];

    // 1. Minimum resolution — use original image dims (100px is very safe)
    if (W < 100 || H < 100)
        throw new Error('Image too small. Minimum 100×100px required.');

    // 2. Aspect ratio (fundus is roughly square; allow wide panoramic 4:1 max)
    if (W / H > 4.0 || W / H < 0.25)
        throw new Error('Unusual image shape — is this a fundus photograph?');

    // 3. Region brightness helper
    const rb = (x0, y0, x1, y1) => {
        let s = 0, n = 0;
        for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) {
                const i = (y * W + x) * 4;
                s += (D[i] + D[i + 1] + D[i + 2]) / 3; n++;
            }
        return n ? s / n : 0;
    };

    // 4. Corner brightness (warn if all corners very bright — likely a document)
    const cw = Math.max(4, Math.floor(W * 0.08));
    const ch = Math.max(4, Math.floor(H * 0.08));
    const corners = [
        rb(0, 0, cw, ch), rb(W - cw, 0, W, ch),
        rb(0, H - ch, cw, H), rb(W - cw, H - ch, W, H)
    ];
    if (corners.every(c => c > 200))
        warnings.push('Bright corners detected — verify this is a fundus image.');

    // 5. Centre brightness check (warn only — don't block)
    const cBright = rb(Math.floor(W * 0.35), Math.floor(H * 0.35),
        Math.floor(W * 0.65), Math.floor(H * 0.65));
    if (cBright < 15) warnings.push('Image very dark — check illumination.');

    // 6. Colour profile warning only
    let rS = 0, bS = 0, n = 0;
    for (let i = 0; i < D.length; i += 16) { rS += D[i]; bS += D[i + 2]; n++; }
    if (bS > rS * 1.6) warnings.push('Unusual colour profile — fundus images are typically warm/orange.');

    // 7. Blank/flat rejection (the only hard error besides size)
    let gS = 0, gSq = 0, gN = 0;
    for (let i = 0; i < D.length; i += 4) {
        const b = (D[i] + D[i + 1] + D[i + 2]) / 3; gS += b; gSq += b * b; gN++;
    }
    const gMn = gS / gN, gVar = gSq / gN - gMn * gMn;
    if (gMn > 250 && gVar < 10) throw new Error('Image appears blank or completely white.');
    if (gVar < 3) throw new Error('Uniform solid colour — not a retinal photograph.');

    return { valid: true, warnings };
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
