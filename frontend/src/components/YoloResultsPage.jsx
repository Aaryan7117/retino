import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const YoloResultsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showAnnotated, setShowAnnotated] = useState(true);

    const { result, imagePreview } = location.state || {};
    const yolo = result?.yolo;

    if (!yolo || !imagePreview) {
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

    const { detections, num_detections } = yolo;

    // Group detections by class
    const stats = detections.reduce((acc, det) => {
        acc[det.class_name] = (acc[det.class_name] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => navigate(-1)}
                            className="text-slate-400 hover:text-white flex items-center gap-2 mb-2 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Visualizer (Left) */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl group">
                            <img
                                src={imagePreview}
                                alt="Fundus Image"
                                className="w-full h-auto"
                            />

                            {showAnnotated && detections.map((det, idx) => {
                                const [x1, y1, x2, y2] = det.bbox;
                                const imgWidth = yolo.image_shape[1];
                                const imgHeight = yolo.image_shape[0];

                                const colors = {
                                    0: 'border-red-500 bg-red-500/10',
                                    1: 'border-yellow-400 bg-yellow-400/10',
                                    2: 'border-blue-400 bg-blue-400/10'
                                };

                                return (
                                    <div
                                        key={idx}
                                        className={`absolute border-2 pointer-events-none rounded transition-all duration-300 ${colors[det.class_id] || 'border-white'}`}
                                        style={{
                                            left: `${(x1 / imgWidth) * 100}%`,
                                            top: `${(y1 / imgHeight) * 100}%`,
                                            width: `${((x2 - x1) / imgWidth) * 100}%`,
                                            height: `${((y2 - y1) / imgHeight) * 100}%`
                                        }}
                                    >
                                        <span className={`absolute -top-6 left-0 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-t whitespace-nowrap ${colors[det.class_id].split(' ')[0].replace('border-', 'bg-')}`}>
                                            {det.class_name} ({Math.round(det.confidence * 100)}%)
                                        </span>
                                    </div>
                                );
                            })}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

                            <div className="absolute bottom-6 left-6 flex gap-3">
                                <button
                                    onClick={() => setShowAnnotated(!showAnnotated)}
                                    className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-xl backdrop-blur-md ${showAnnotated
                                            ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                                            : 'bg-slate-800/80 text-slate-300'
                                        }`}
                                >
                                    {showAnnotated ? 'Hide Bounding Boxes' : 'Show Bounding Boxes'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">AI Model Footprint</h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                The YOLOv8 (You Only Look Once) model analyzes the fundus image at a 1024x1024 resolution to identify local structural anomalies.
                                Unlike the global EfficientNet grading, this localized mapping helps clinicians pinpoint specific areas of retinal stress.
                            </p>
                        </div>
                    </div>

                    {/* Stats & Findings (Right) */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Summary Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                Clinical Findings
                            </h2>

                            <div className="space-y-4">
                                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total Lesions Detected</div>
                                    <div className="text-4xl font-black text-white">{num_detections}</div>
                                </div>

                                <div className="space-y-3">
                                    {Object.entries(stats).map(([label, count]) => (
                                        <div key={label} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl">
                                            <span className="text-sm font-medium text-slate-300">{label}</span>
                                            <span className="px-3 py-1 bg-slate-700 rounded-lg text-sm font-bold">{count}</span>
                                        </div>
                                    ))}
                                    {num_detections === 0 && (
                                        <div className="text-center py-6 text-slate-500 italic text-sm">
                                            No lesions detected in this scan.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Inventory List */}
                        {detections.length > 0 && (
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-hidden">
                                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Detections log</h2>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {detections.map((det, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-800/20 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-all">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${det.class_id === 0 ? 'bg-red-500' :
                                                        det.class_id === 1 ? 'bg-yellow-400' : 'bg-blue-400'
                                                    }`} />
                                                <span className="text-xs font-bold text-slate-200">{det.class_name}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-500">{Math.round(det.confidence * 100)}% conf.</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-6 bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border border-blue-500/20 rounded-3xl">
                            <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 italic">Medical Note</h4>
                            <p className="text-[10px] text-slate-400 leading-normal">
                                Visual markers are AI-generated suggestions. Final clinical diagnosis should be based on full ophthalmic evaluation.
                                Boxes represent coordinates identified by the YOLOv8 model in real-time.
                            </p>
                        </div>

                    </div>
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
