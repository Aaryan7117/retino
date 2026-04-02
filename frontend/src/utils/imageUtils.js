/**
 * imageUtils.js — Utility functions for complex image processing and overlays.
 */

/**
 * Generates a combined lesion mapping by overlaying YOLO bounding boxes 
 * on an AI-generated heatmap image.
 * 
 * @param {string} heatmapUrl - The base64 or URL of the AI heatmap.
 * @param {Object} yoloData - YOLO detection results object { detections: [], image_shape: [h, w] }.
 * @returns {Promise<string>} The combined heatmap image as a Base64 data URL.
 */
export async function generateCombinedHeatmap(heatmapUrl, yoloData) {
    if (!heatmapUrl) return null;
    if (!yoloData || !yoloData.detections || yoloData.detections.length === 0) {
        return heatmapUrl; // No boxes to draw, return original heatmap
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // 1. Draw the heatmap background
            ctx.drawImage(img, 0, 0);

            // 2. Draw YOLO bounding boxes
            const [sourceH, sourceW] = yoloData.image_shape || [img.height, img.width];
            const detections = yoloData.detections || [];

            detections.forEach(det => {
                const [x1, y1, x2, y2] = det.bbox;
                const boxX = (x1 / sourceW) * img.width;
                const boxY = (y1 / sourceH) * img.height;
                const boxW = ((x2 - x1) / sourceW) * img.width;
                const boxH = ((y2 - y1) / sourceH) * img.height;

                // Color coding by class (0: Microaneurysms, 1: Exudates, 2: Hemorrhages)
                if (det.class_id === 0)      ctx.strokeStyle = '#FF0000'; // Red
                else if (det.class_id === 1) ctx.strokeStyle = '#FFEE00'; // Yellow
                else                         ctx.strokeStyle = '#FF00FF'; // Magenta
                
                ctx.lineWidth = 2;
                ctx.strokeRect(boxX, boxY, boxW, boxH);
                
                // Optional: Draw small label background
                ctx.fillStyle = ctx.strokeStyle;
                ctx.globalAlpha = 0.4;
                ctx.fillRect(boxX, boxY - 14, ctx.measureText(det.class_name).width + 6, 14);
                ctx.globalAlpha = 1.0;
                
                // Draw label text
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(det.class_name, boxX + 3, boxY - 3);
            });

            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => resolve(heatmapUrl); // Safe fallback
        img.src = heatmapUrl;
    });
}
