import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VoiceGuide from './VoiceGuide';
import PDFGenerator from './PDFGenerator';
import ABDMIntegration from './ABDMIntegration';
import { savePatient } from '../utils/indexedDB';

const GRADE_INFO = [
    { label: 'No Diabetic Retinopathy', cls: 'grade-0', urgency: 'Annual checkup', accent: 'border-l-emerald-500' },
    { label: 'Mild Diabetic Retinopathy', cls: 'grade-1', urgency: 'Monitor in 6 months', accent: 'border-l-yellow-500' },
    { label: 'Moderate Diabetic Retinopathy', cls: 'grade-2', urgency: 'Refer in 3 months', accent: 'border-l-orange-500' },
    { label: 'Severe Diabetic Retinopathy', cls: 'grade-3', urgency: 'Refer within 2 weeks', accent: 'border-l-red-500' },
    { label: 'Proliferative Diabetic Retinopathy', cls: 'grade-4', urgency: '🚨 Emergency referral', accent: 'border-l-pink-500' },
];

export default function ResultsView() {
    const { state } = useLocation();
    const navigate = useNavigate();

    // Toggle between Original (0) and Heatmap (1)
    const [viewMode, setViewMode] = useState(1);
    const [confirmSaved, setConfirmSaved] = useState(false);

    // If navigated directly without scanning, prompt to return.
    if (!state || !state.result) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-black text-white">No Scan Data Found</h1>
                <p className="text-slate-400">Please upload and analyze a retinal image first.</p>
                <button onClick={() => navigate('/scan')} className="btn-primary inline-flex items-center gap-2">
                    Start New Scan
                </button>
            </div>
        );
    }

    const { result, imagePreview } = state;
    const info = GRADE_INFO[result.grade];

    return (
        <div className="space-y-6">
            <div>
                <p className="section-label">Results</p>
                <h1 className="text-4xl font-black text-white">Scan Analysis</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Image panels */}
                <div className="card-elevated space-y-4 flex flex-col">
                    <h2 className="text-lg font-black text-white">Fundus Analysis</h2>

                    <div className="relative flex-1 min-h-[300px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                        {/* Underlay: Original */}
                        <img
                            src={imagePreview}
                            alt="Original Retinal Scan"
                            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${viewMode === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                        />
                        {/* Overlay: Heatmap */}
                        <img
                            src={result.heatmap_url}
                            alt="Grad-CAM Heatmap"
                            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${viewMode === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode(0)}
                            className={`flex-1 text-sm ${viewMode === 0 ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            Original
                        </button>
                        <button
                            onClick={() => setViewMode(1)}
                            className={`flex-1 text-sm ${viewMode === 1 ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            AI Heatmap
                        </button>
                    </div>
                </div>

                {/* Clinical summary */}
                <div className="space-y-4">
                    <div className={`card-elevated border-l-4 ${info.accent}`}>
                        <p className="section-label mb-4">Clinical Summary</p>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">Diagnosis</p>
                        <p className="font-black text-xl text-white mt-1">{info.label}</p>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {[
                                { label: 'Confidence', value: `${Math.round(result.confidence * 100)}%` },
                                { label: 'Risk Score', value: `${result.risk_score}/100` },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-slate-700 rounded-xl p-3 border border-slate-600">
                                    <p className="text-slate-400 text-xs font-bold uppercase">{label}</p>
                                    <p className="text-3xl font-black text-white mt-1">{value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between items-center py-2 border-b border-slate-700">
                                <span className="text-slate-400 text-xs font-bold uppercase">Risk Level</span>
                                <span className={`grade-pill ${info.cls}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />{result.risk_level}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-slate-400 text-xs font-bold uppercase">Next Step</span>
                                <span className="text-white font-black text-sm">{info.urgency}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated space-y-2">
                        <p className="section-label mb-2">Actions</p>

                        {/* New VoiceGuide Component */}
                        <div className="mb-4">
                            <VoiceGuide patient={state.patient} result={result} />
                        </div>

                        <PDFGenerator
                            patient={state.patient || {}}
                            result={result}
                            imagePreview={imagePreview}
                        />

                        <ABDMIntegration
                            reportId={result.report_id || `RS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`}
                            patientName={state.patient?.name}
                        />

                        <button
                            onClick={() => navigate('/yolo-results', { state })}
                            className="w-full btn-secondary text-sm justify-start border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            Show Detailed Lesion Analysis
                        </button>

                        <button
                            onClick={async () => {
                                if (confirmSaved) { navigate('/camp'); return; }
                                try {
                                    const p = state.patient || {};
                                    const GRADE_LABELS = ['No Diabetic Retinopathy', 'Mild Diabetic Retinopathy', 'Moderate Diabetic Retinopathy', 'Severe Diabetic Retinopathy', 'Proliferative Diabetic Retinopathy'];
                                    const RISK_MAP = ['LOW', 'LOW', 'MEDIUM', 'HIGH', 'HIGH'];
                                    await savePatient({
                                        id: p.patientId || `TN-${Date.now()}`,
                                        name: p.name || 'Unknown',
                                        age: Number(p.age) || 0,
                                        gender: p.gender || '',
                                        diabeticSince: Number(p.diabeticSince) || 0,
                                        contact: p.contact || '',
                                        patientId: p.patientId || `TN-${Date.now()}`,
                                        grade: result.grade,
                                        diagnosis: GRADE_LABELS[result.grade] || 'Unknown',
                                        confidence: result.confidence,
                                        risk_score: result.risk_score,
                                        risk: RISK_MAP[result.grade] || 'LOW',
                                        urgency: result.urgency || '',
                                        timestamp: new Date().toISOString(),
                                        heatmap_url: result.heatmap_url || null,
                                    });
                                } catch { /* already saved by Scanner */ }
                                sessionStorage.removeItem('retinascan_patient_draft');
                                setConfirmSaved(true);
                            }}
                            className={`w-full text-sm justify-start ${confirmSaved ? 'btn-primary bg-emerald-600' : 'btn-secondary'}`}
                        >
                            {confirmSaved ? '✅ Saved! → View Camp Stats' : '✅ Confirm & Save to Queue'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
