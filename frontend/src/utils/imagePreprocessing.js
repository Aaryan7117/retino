/**
 * Heuristic validation to check if an uploaded image is a valid fundus photograph.
 * Checks for the characteristic dark padding corners and biological center variance.
 * @throws {Error} If the image fails the validation heuristics.
 */
export const validateFundusImage = (imageData) => {
    const { width, height, data } = imageData;

    const getRegionStats = (startX, startY, w, h) => {
        let sumIntensity = 0;
        let sumSquaredIntensity = 0;
        let count = 0;

        for (let y = Math.floor(startY); y < startY + h; y++) {
            for (let x = Math.floor(startX); x < startX + w; x++) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const idx = (y * width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    // Standard relative luminance (perceptual brightness, 0.0 to 1.0)
                    const intensity = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

                    sumIntensity += intensity;
                    sumSquaredIntensity += intensity * intensity;
                    count++;
                }
            }
        }

        const mean = sumIntensity / count;
        // Variance formula: E[X^2] - (E[X])^2
        const variance = (sumSquaredIntensity / count) - (mean * mean);
        return { mean, variance };
    };

    // 1. Check Corner Dark Masks (Fundus images are circular)
    const cornerSize = 40; // 40x40 corners on a 224x224 image
    const tl = getRegionStats(0, 0, cornerSize, cornerSize).mean;
    const tr = getRegionStats(width - cornerSize, 0, cornerSize, cornerSize).mean;
    const bl = getRegionStats(0, height - cornerSize, cornerSize, cornerSize).mean;
    const br = getRegionStats(width - cornerSize, height - cornerSize, cornerSize, cornerSize).mean;

    // A certificate or normal photo will likely have bright corners or varied corners.
    // Fundus images usually have pitch black corners.
    const avgCornerBrightness = (tl + tr + bl + br) / 4;

    if (avgCornerBrightness > 0.3) {
        throw new Error("Invalid Image: Please upload a retinal fundus photograph (eye image from fundus camera)");
    }

    // 2. Check Center Variance (biological structure vs solid color)
    const centerSize = 100;
    const cx = (width - centerSize) / 2;
    const cy = (height - centerSize) / 2;
    const centerStats = getRegionStats(cx, cy, centerSize, centerSize);

    if (centerStats.variance < 0.001) {
        throw new Error("Invalid Image: Please upload a retinal fundus photograph (eye image from fundus camera)");
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
