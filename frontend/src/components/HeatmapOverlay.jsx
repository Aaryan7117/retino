/**
 * HeatmapOverlay.jsx
 * Renders Grad-CAM heatmap overlaid on the original fundus image.
 * Full implementation in Section 2 (AI pipeline).
 */
export default function HeatmapOverlay({ originalSrc, heatmapSrc, show = true }) {
    if (!originalSrc) return null;
    return (
        <div className="relative rounded-lg overflow-hidden">
            <img
                src={originalSrc}
                alt="Original fundus"
                className="w-full object-contain"
            />
            {show && heatmapSrc && (
                <img
                    src={heatmapSrc}
                    alt="Grad-CAM heatmap"
                    className="absolute inset-0 w-full h-full object-contain mix-blend-multiply opacity-70"
                />
            )}
            {!heatmapSrc && (
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    Heatmap: Section 2
                </div>
            )}
        </div>
    );
}
