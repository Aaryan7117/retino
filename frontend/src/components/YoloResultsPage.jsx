import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';


function EyeCanvas({ imageUrl, yolo, label, accentClass }) {
    const [showBoxes, setShowBoxes] = useState(true);

    if (!imageUrl) return null;

    const rawDetections = yolo?.detections || [];
    const imgW = yolo?.image_shape?.[1] || 1024;
    const imgH = yolo?.image_shape?.[0] || 1024;

    // Filter out sub-pixel noise boxes (width or height < 1% of image dimension)
    const detections = rawDetections.filter(d => {
        const w = (d.bbox[2] - d.bbox[0]) / imgW;
        const h = (d.bbox[3] - d.bbox[1]) / imgH;
        return w > 0.01 && h > 0.01;
    });

    const COLORS = {
        0: 'border-red-500 bg-red-500/10',
        1: 'border-yellow-400 bg-yellow-400/10',
        2: 'border-blue-400 bg-blue-400/10',
    };
    const DOT = {
        0: 'bg-red-500',
        1: 'bg-yellow-400',
        2: 'bg-blue-400',
    };

    // Group by class for mini summary
    const stats = detections.reduce((acc, d) => {
        acc[d.class_name] = (acc[d.class_name] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit ${accentClass}`}>
                <span className="text-xs font-black uppercase tracking-wider">{label}</span>
                <span className="text-xs text-slate-400">{detections.length} lesions</span>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl">
                <img src={imageUrl} alt={label} className="w-full h-auto block" />

                {showBoxes && detections.map((det, idx) => {
                    const [x1, y1, x2, y2] = det.bbox;
                    return (
                        <div
                            key={idx}
                            className={`absolute border-2 pointer-events-none rounded ${COLORS[det.class_id] || 'border-white'}`}
                            style={{
                                left: `${(x1 / imgW) * 100}%`,
                                top: `${(y1 / imgH) * 100}%`,
                                width: `${((x2 - x1) / imgW) * 100}%`,
                                height: `${((y2 - y1) / imgH) * 100}%`,
                            }}
                        >
                            <span className={`absolute -top-5 left-0 text-[9px] font-bold text-white px-1 py-0.5 rounded-t whitespace-nowrap ${(COLORS[det.class_id] || '').split(' ')[0].replace('border-', 'bg-')}`}>
                                {det.class_name} ({Math.round(det.confidence * 100)}%)
                            </span>
                        </div>
                    );
                })}

                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                <div className="absolute bottom-4 left-4">
                    <button
                        onClick={() => setShowBoxes(s => !s)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm shadow-xl backdrop-blur-md transition-all ${showBoxes ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-300'}`}
                    >
                        {showBoxes ? 'Hide Boxes' : 'Show Boxes'}
                    </button>
                </div>
            </div>

            {/* Mini detection summary for this eye */}
            {Object.entries(stats).length > 0 && (
                <div className="space-y-1.5 bg-slate-900/50 rounded-xl p-3 border border-slate-800">
                    {Object.entries(stats).map(([name, count]) => (
                        <div key={name} className="flex justify-between items-center text-xs">
                            <span className="text-slate-300 truncate max-w-[160px]">{name}</span>
                            <span className="font-bold text-white bg-slate-700 px-2 py-0.5 rounded-lg">{count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// -- Main Page --
const YoloResultsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { result, imagePreview } = location.state || {};
    const record = location.state?.record;

    const odImage = imagePreview || record?.rightEye?.image_url;
    const osImage = record?.leftEye?.image_url;

    // YOLO detections come entirely from the client-side onnxruntime-web worker.
    // The model.worker.js runs yolo_lesions.onnx in-browser during the scan.
    // No backend call is made — this page is 100% offline-capable.
    const odYolo = result?.yolo || record?.rightEye?.yoloDetections;
    const osYolo = record?.leftEye?.yoloDetections;

    if (!odImage) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="text-6xl">⚠️</div>
                    <h1 className="text-2xl font-bold text-white">No Detection Data Found</h1>
                    <p className="text-slate-400">Please run a new scan to see detailed lesion analysis.</p>
                    <button
                        onClick={() => navigate('/scan')}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-500 transition-colors"
                    >
                        Go to Scanner
                    </button>
                </div>
            </div>
        );
    }

    // Combine detections from both eyes for totals
    const allDetections = [
        ...(odYolo?.detections || []),
        ...(osYolo?.detections || []),
    ];
    const totalLesions = allDetections.length;
    const allStats = allDetections.reduce((acc, d) => {
        acc[d.class_name] = (acc[d.class_name] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button onClick={() => navigate(-1)}
                            className="text-slate-400 hover:text-white flex items-center gap-2 mb-2 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Summary
                        </button>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                            Detailed Lesion Mapping
                        </h1>
                        <p className="text-slate-400">Client-side YOLOv8 Object Detection System v1.0</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-blue-900/30 border border-blue-500/30 rounded-xl">
                            <span className="text-xs font-bold text-blue-400 block uppercase tracking-wider">Status</span>
                            <span className="text-sm font-bold flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                100% Offline
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Dual-eye / single-eye visualiser grid ── */}
                <div className={`grid gap-6 ${osImage ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto'}`}>
                    <EyeCanvas
                        imageUrl={odImage}
                        yolo={odYolo}
                        label="Right Eye (OD)"
                        accentClass="bg-blue-900/40 border border-blue-700/40 text-blue-300"
                    />
                    {osImage && (
                        <EyeCanvas
                            imageUrl={osImage}
                            yolo={osYolo}
                            label="Left Eye (OS)"
                            accentClass="bg-violet-900/40 border border-violet-700/40 text-violet-300"
                        />
                    )}
                </div>

                {/* ── Combined Clinical Findings ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Totals */}
                    <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            Clinical Findings
                        </h2>
                        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 mb-4">
                            <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total Lesions (Both Eyes)</div>
                            <div className="text-5xl font-black text-white">{totalLesions}</div>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(allStats).map(([name, count]) => (
                                <div key={name} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl">
                                    <span className="text-sm text-slate-300 truncate">{name}</span>
                                    <span className="ml-2 px-3 py-1 bg-slate-700 rounded-lg text-sm font-bold">{count}</span>
                                </div>
                            ))}
                            {totalLesions === 0 && (
                                <div className='p-4 bg-amber-900/20 border border-amber-700/40 rounded-xl'>
                                    <p className='text-amber-400 font-bold text-sm mb-1'>
                                        Why 0 lesions with Grade 4?
                                    </p>
                                    <p className='text-slate-400 text-xs leading-relaxed'>
                                        The DR grade (0–4) comes from EfficientNetB3 which analyses the full
                                        retinal image globally. YOLO is a separate model that detects specific
                                        lesion locations. Both are independent — Grade 4 with 0 YOLO detections
                                        is medically valid. YOLO may miss lesions if the image resolution is
                                        low or confidence threshold (25%) is not reached.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detection Log */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Detections Log — Both Eyes</h2>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {allDetections.length === 0 && <p className="text-slate-500 italic text-sm">No detections.</p>}
                            {allDetections.map((det, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-800/20 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${det.class_id === 0 ? 'bg-red-500' : det.class_id === 1 ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                                        <span className="text-xs font-bold text-slate-200">{det.class_name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500">{Math.round(det.confidence * 100)}% conf.</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border border-blue-500/20 rounded-2xl">
                            <h4 className="text-xs font-bold text-blue-400 uppercase mb-1 italic">Medical Note</h4>
                            <p className="text-[10px] text-slate-400 leading-normal">
                                Visual markers are AI-generated suggestions. Final clinical diagnosis should be based on full ophthalmic evaluation.
                                Boxes represent coordinates identified by the YOLOv8 model in real-time.
                            </p>
                        </div>
                    </div>

                </div>

                {/* AI model note */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">AI Model Footprint</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                        The YOLOv8 (You Only Look Once) model analyzes each fundus image at 1024×1024 resolution to identify local structural anomalies.
                        Unlike the global EfficientNet grading, this localized mapping helps clinicians pinpoint specific areas of retinal stress across both eyes.
                    </p>
                </div>

            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default YoloResultsPage;
