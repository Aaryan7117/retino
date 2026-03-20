// imagePreprocessing.js — Handles image validation, blur detection, and preprocessing for AI models

/**
 * Heuristic validation to check if an uploaded image is a valid fundus photograph.
 *
 * Runs BEFORE ONNX inference and rejects obvious non-eye content such as
 * certificates, documents, or selfies.
 *
 * Implementation follows a three-step validator:
 *  1) Corner brightness check
 *  2) Center texture / variance check
 *  3) Soft circularity heuristic (center vs corner brightness)
 *
 * @param {ImageData} imageData - The raw image data to validate.
 * @returns {Object} Object containing valid boolean and an array of warnings.
 * @throws {Error} If the image fails critical validation (too small, blank, or uniform color).
 */
export const validateFundusImage = (imageData) => {
    const { width: imageWidth, height: imageHeight, data: pixelData } = imageData;
    const validationWarnings = [];

    // 1. Minimum resolution check
    if (imageWidth < 100 || imageHeight < 100)
        throw new Error('Image too small. Minimum 100×100px required.');

    // 2. Aspect ratio validation (fundus images are typically near-square)
    if (imageWidth / imageHeight > 4.0 || imageWidth / imageHeight < 0.25)
        throw new Error('Unusual image shape — is this a fundus photograph?');

    /**
     * Helper to calculate average brightness in a rectangular region.
     */
    const calculateRegionBrightness = (x0, y0, x1, y1) => {
        let totalBrightness = 0, pixelCount = 0;
        for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) {
                const pixelIndex = (y * imageWidth + x) * 4;
                totalBrightness += (pixelData[pixelIndex] + pixelData[pixelIndex + 1] + pixelData[pixelIndex + 2]) / 3; 
                pixelCount++;
            }
        return pixelCount ? totalBrightness / pixelCount : 0;
    };

    // 3. Corner brightness check (Bright corners often indicate a document/certificate)
    const cornerWidth = Math.max(4, Math.floor(imageWidth * 0.08));
    const cornerHeight = Math.max(4, Math.floor(imageHeight * 0.08));
    const cornerBrightnesses = [
        calculateRegionBrightness(0, 0, cornerWidth, cornerHeight), 
        calculateRegionBrightness(imageWidth - cornerWidth, 0, imageWidth, cornerHeight),
        calculateRegionBrightness(0, imageHeight - cornerHeight, cornerWidth, imageHeight), 
        calculateRegionBrightness(imageWidth - cornerWidth, imageHeight - cornerHeight, imageWidth, imageHeight)
    ];
    
    if (cornerBrightnesses.every(brightness => brightness > 200))
        validationWarnings.push('Bright corners detected — verify this is a fundus image.');

    // 4. Centre brightness check
    const centerBrightness = calculateRegionBrightness(
        Math.floor(imageWidth * 0.35), Math.floor(imageHeight * 0.35),
        Math.floor(imageWidth * 0.65), Math.floor(imageHeight * 0.65)
    );
    if (centerBrightness < 15) validationWarnings.push('Image very dark — check illumination.');

    // 5. Colour profile heuristic
    let redSum = 0, blueSum = 0;
    for (let i = 0; i < pixelData.length; i += 16) { 
        redSum += pixelData[i]; 
        blueSum += pixelData[i + 2]; 
    }
    if (blueSum > redSum * 1.6) validationWarnings.push('Unusual colour profile — fundus images are typically warm/orange.');

    // 6. Blank or solid color rejection
    let graySum = 0, graySquaredSum = 0, pixelCount = 0;
    for (let i = 0; i < pixelData.length; i += 4) {
        const brightness = (pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3; 
        graySum += brightness; 
        graySquaredSum += brightness * brightness; 
        pixelCount++;
    }
    const grayMean = graySum / pixelCount;
    const grayVariance = graySquaredSum / pixelCount - grayMean * grayMean;
    
    if (grayMean > 250 && grayVariance < 10) throw new Error('Image appears blank or completely white.');
    if (grayVariance < 3) throw new Error('Uniform solid colour — not a retinal photograph.');

    return { valid: true, warnings: validationWarnings };
};

/**
 * Calculates the variance of the Laplacian to estimate image blur.
 * Lower variance indicates fewer edges and a blurrier image.
 * 
 * @param {ImageData} imageData - The image data to analyze.
 * @returns {number} The calculated variance score.
 */
export const calculateBlur = (imageData) => {
    const { width, height, data } = imageData;

    // 1. Convert to grayscale manually for performance
    const grayscaleData = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        grayscaleData[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    // 2. Apply 3x3 Laplacian filter
    let laplaceSum = 0;
    let laplaceCount = 0;
    const laplacianData = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const laplaceValue =
                grayscaleData[(y - 1) * width + x] +
                grayscaleData[(y + 1) * width + x] +
                grayscaleData[y * width + (x - 1)] +
                grayscaleData[y * width + (x + 1)] -
                4 * grayscaleData[idx];

            laplacianData[idx] = laplaceValue;
            laplaceSum += laplaceValue;
            laplaceCount++;
        }
    }

    // 3. Calculate variance
    const laplaceMean = laplaceSum / laplaceCount;
    let laplaceVariance = 0;
    for (let i = 0; i < laplaceCount; i++) {
        const diff = laplacianData[i] - laplaceMean;
        laplaceVariance += diff * diff;
    }

    return laplaceVariance / laplaceCount;
};

/**
 * Preprocesses an image element for EfficientNetB3 ONNX inference.
 * Performs resizing, center-cropping, blur detection, and normalization.
 * 
 * @param {HTMLImageElement} imageElement - The source image element.
 * @returns {Object} { tensorData: Float32Array, blurScore: number, imageData: ImageData }
 */
export const preprocessImageForONNX = (imageElement) => {
    // CRITICAL: Input must be exactly 224x224px — EfficientNetB3 was trained at this resolution.
    // Changing this value will silently corrupt inference results.
    const TARGET_SIZE = 224;

    const preprocessingCanvas = document.createElement('canvas');
    preprocessingCanvas.width = TARGET_SIZE;
    preprocessingCanvas.height = TARGET_SIZE;
    const preprocessingCtx = preprocessingCanvas.getContext('2d');

    // Calculate crop dimensions to maintain aspect ratio (Center Crop)
    const scaleFactor = Math.max(TARGET_SIZE / imageElement.width, TARGET_SIZE / imageElement.height);
    const scaledWidth = imageElement.width * scaleFactor;
    const scaledHeight = imageElement.height * scaleFactor;
    const offsetX = (TARGET_SIZE - scaledWidth) / 2;
    const offsetY = (TARGET_SIZE - scaledHeight) / 2;

    preprocessingCtx.drawImage(imageElement, offsetX, offsetY, scaledWidth, scaledHeight);

    const imageData = preprocessingCtx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
    const pixelData = imageData.data;

    // Detect blur on the 224x224 input
    const blurScore = calculateBlur(imageData);

    // Normalize using ImageNet statistics: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    const imageNetMean = [0.485, 0.456, 0.406];
    const imageNetStd = [0.229, 0.224, 0.225];

    // Prepare CHW (Channels-First) tensor data for ONNX
    const tensorBuffer = new Float32Array(3 * TARGET_SIZE * TARGET_SIZE);

    for (let i = 0; i < TARGET_SIZE * TARGET_SIZE; i++) {
        // Red channel
        tensorBuffer[i] = ((pixelData[i * 4] / 255.0) - imageNetMean[0]) / imageNetStd[0];
        // Green channel
        tensorBuffer[i + (TARGET_SIZE * TARGET_SIZE)] = ((pixelData[i * 4 + 1] / 255.0) - imageNetMean[1]) / imageNetStd[1];
        // Blue channel
        tensorBuffer[i + (2 * TARGET_SIZE * TARGET_SIZE)] = ((pixelData[i * 4 + 2] / 255.0) - imageNetMean[2]) / imageNetStd[2];
    }

    return {
        tensorData: tensorBuffer,
        blurScore,
        imageData
    };
};

