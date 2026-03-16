import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VoiceGuide from './VoiceGuide';
import PDFGenerator from './PDFGenerator';
import ABDMIntegration from './ABDMIntegration';
import SplitHeatmapView from './SplitHeatmapView';
import LongitudinalChart from './LongitudinalChart';
import { savePatient } from '../utils/indexedDB';

const GRADE_INFO = [
    { label: 'No Diabetic Retinopathy', cls: 'grade-0', urgency: 'Annual checkup', accent: 'border-l-emerald-500' },
    { label: 'Mild Diabetic Retinopathy', cls: 'grade-1', urgency: 'Monitor in 6 months', accent: 'border-l-yellow-500' },
    { label: 'Moderate Diabetic Retinopathy', cls: 'grade-2', urgency: 'Refer in 3 months', accent: 'border-l-orange-500' },
    { label: 'Severe Diabetic Retinopathy', cls: 'grade-3', urgency: 'Refer within 2 weeks', accent: 'border-l-red-500' },
    { label: 'Proliferative Diabetic Retinopathy', cls: 'grade-4', urgency: '🚨 Emergency referral', accent: 'border-l-pink-500' },
];

const GRADE_LABELS = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Proliferative DR'];
const GRADE_C = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];

// ── Feature A: Eye Result Card ───────────────────────────────────────────────
function EyeResultCard({ label, accent, data }) {
    const ACCENT = {
        blue: 'border-blue-600 bg-blue-950/20',
        violet: 'border-violet-600 bg-violet-950/20'
    };
    return (
        <div className={`card-elevated border-t-4 space-y-3 ${ACCENT[accent]}`}>
            <div className='flex justify-between items-start'>
                <h3 className='text-white font-black text-base'>{label}</h3>
                <span className={`grade-pill grade-${data.grade}`}>Grade {data.grade}</span>
            </div>
            <p className={`text-2xl font-black ${GRADE_C[data.grade]}`}>
                {(data.confidence * 100).toFixed(1)}%
            </p>
            <p className='text-sm text-slate-300'>{data.diagnosis}</p>
            <p className='text-xs text-slate-500'>Quality: {data.imageQuality}</p>
            {/* Feature B: Split heatmap */}
            {data.heatmap_url && data.image_url && (
                <SplitHeatmapView
                    originalUrl={data.image_url}
                    heatmapUrl={data.heatmap_url}
                />
            )}
        </div>
    );
}

// ── Feature 2: Grade Probability Chart ──────────────────────────────────────
function GradeProbChart({ probs }) {
    const LBL  = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Proliferative'];
    const BARS = ['bg-emerald-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500'];
    const TXTS = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];
    const best = probs.indexOf(Math.max(...probs));
    return (
        <div className='card-elevated space-y-2.5'>
            <p className='section-label'>Grade Probability Distribution</p>
            {probs.map((prob, i) => (
                <div key={i}>
                    <div className='flex justify-between text-xs font-bold mb-1'>
                        <span className={i === best ? TXTS[i] : 'text-slate-500'}>
                            {i === best ? '▶ ' : ''}{LBL[i]}
                        </span>
                        <span className={i === best ? 'text-white' : 'text-slate-600'}>
                            {(prob * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className='h-2 bg-slate-800 rounded-full overflow-hidden'>
                        <div
                            className={`h-full rounded-full ${BARS[i]} ${i !== best ? 'opacity-40' : ''}`}
                            style={{ width: `${(prob * 100).toFixed(1)}%`, transition: 'width 0.6s ease' }}
                        />
                    </div>
                </div>
            ))}
            {Math.max(...probs) < 0.70 && (
                <p className='text-xs text-amber-400 font-bold pt-1'>
                    ⚠ Confidence below 70% — borderline result. Refer to specialist.
                </p>
            )}
        </div>
    );
}

export default function ResultsView() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState(1);
    const [confirmSaved, setConfirmSaved] = useState(false);

    if (!state || (!state.result && !state.record)) {
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

    // Support both new dual-eye record format and legacy result format
    const record = state.record;
    const result = state.result || (record ? {
        grade: record.grade,
        confidence: record.confidence,
        risk_score: record.risk_score,
        risk_level: record.risk_level,
        urgency: record.urgency,
        heatmap_url: record.heatmap_url || record.rightEye?.heatmap_url,
        grade_label: record.rightEye?.grade_label || '',
        diagnosis: record.diagnosis,
        class_probabilities: record.rightEye?.class_probabilities,
    } : null);
    const imagePreview = state.imagePreview || record?.rightEye?.image_url;
    const patientData = state.patient || record;
    const info = GRADE_INFO[result?.grade ?? 0];

    return (
        <div className="space-y-6">
            <div>
                <p className="section-label">Results</p>
                <h1 className="text-4xl font-black text-white">Scan Analysis</h1>
            </div>

            {/* ── Legacy single-eye image panels (shown if no dual record) ── */}
            {!record?.rightEye && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card-elevated space-y-4 flex flex-col">
                        <h2 className="text-lg font-black text-white">Fundus Analysis</h2>
                        <div className="relative flex-1 min-h-[300px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                            <img src={imagePreview} alt="Original Retinal Scan"
                                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${viewMode === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} />
                            <img src={result?.heatmap_url} alt="Grad-CAM Heatmap"
                                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${viewMode === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setViewMode(0)} className={`flex-1 text-sm ${viewMode === 0 ? 'btn-primary' : 'btn-secondary'}`}>Original</button>
                            <button onClick={() => setViewMode(1)} className={`flex-1 text-sm ${viewMode === 1 ? 'btn-primary' : 'btn-secondary'}`}>AI Heatmap</button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className={`card-elevated border-l-4 ${info?.accent}`}>
                            <p className="section-label mb-4">Clinical Summary</p>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">Diagnosis</p>
                            <p className="font-black text-xl text-white mt-1">{info?.label}</p>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                {[
                                    { label: 'Confidence', value: `${Math.round((result?.confidence || 0) * 100)}%` },
                                    { label: 'Risk Score', value: `${result?.risk_score ?? 0}/100` },
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
                                    <span className={`grade-pill ${info?.cls}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />{result?.risk_level}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-slate-400 text-xs font-bold uppercase">Next Step</span>
                                    <span className="text-white font-black text-sm">{info?.urgency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Feature 2: Grade Probability Chart (legacy path) */}
                        {result?.class_probabilities?.length > 0 && (
                            <GradeProbChart probs={result.class_probabilities} />
                        )}

                        <div className="card-elevated space-y-3">
                            <p className="section-label mb-2">Actions</p>
                            <button onClick={() => navigate('/yolo-results', { state: record ? { record } : state })}
                                className="w-full btn-primary bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/60 text-sm justify-start gap-3 animate-pulse ring-2 ring-indigo-500/50">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                <span className="font-black uppercase tracking-wider">🔬 View Detailed Lesion Analysis</span>
                            </button>
                            <div className="mb-2">
                                <VoiceGuide patient={patientData} result={result} />
                            </div>
                            <PDFGenerator patient={patientData || {}} result={result} imagePreview={imagePreview} />
                            <ABDMIntegration
                                reportId={result?.report_id || `RS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`}
                                patientName={patientData?.name}
                            />
                            <button
                                onClick={async () => {
                                    if (confirmSaved) { navigate('/camp'); return; }
                                    try {
                                        const p = patientData || {};
                                        const GRADE_LABELS2 = ['No Diabetic Retinopathy', 'Mild Diabetic Retinopathy', 'Moderate Diabetic Retinopathy', 'Severe Diabetic Retinopathy', 'Proliferative Diabetic Retinopathy'];
                                        const RISK_MAP = ['LOW', 'LOW', 'MEDIUM', 'HIGH', 'HIGH'];
                                        await savePatient({
                                            id: p.patientId || `TN-${Date.now()}`,
                                            name: p.name || 'Unknown',
                                            age: Number(p.age) || 0,
                                            gender: p.gender || '',
                                            diabeticSince: Number(p.diabeticSince) || 0,
                                            contact: p.contact || '',
                                            patientId: p.patientId || `TN-${Date.now()}`,
                                            grade: result?.grade,
                                            diagnosis: GRADE_LABELS2[result?.grade] || 'Unknown',
                                            confidence: result?.confidence,
                                            risk_score: result?.risk_score,
                                            risk: RISK_MAP[result?.grade] || 'LOW',
                                            urgency: result?.urgency || '',
                                            timestamp: new Date().toISOString(),
                                            heatmap_url: result?.heatmap_url || null,
                                        });
                                    } catch { /* already saved */ }
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
            )}

            {/* ── Feature A: Dual-Eye Result Cards ── */}
            {record?.rightEye && (
                <>
                    {/* Overall summary */}
                    <div className={`card-elevated border-l-4 ${GRADE_INFO[record.grade]?.accent}`}>
                        <p className="section-label mb-4">Overall Assessment</p>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">Combined Diagnosis</p>
                                <p className="font-black text-xl text-white mt-1">{GRADE_INFO[record.grade]?.label}</p>
                                <p className="text-xs text-slate-500 mt-1">Grade = worst of both eyes</p>
                            </div>
                            <div className="text-right">
                                <span className={`grade-pill grade-${record.grade} text-base px-4 py-1.5`}>Grade {record.grade}</span>
                                <p className={`text-sm font-bold mt-2 ${record.risk_level === 'HIGH' ? 'text-red-400' : record.risk_level === 'MEDIUM' ? 'text-orange-400' : 'text-emerald-400'}`}>
                                    {record.risk_level} RISK
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Dual eye cards side by side */}
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <EyeResultCard label='Right Eye (OD)' accent='blue' data={record.rightEye} />
                        {record.leftEye
                            ? <EyeResultCard label='Left Eye (OS)' accent='violet' data={record.leftEye} />
                            : <div className='card-elevated flex items-center justify-center text-slate-600 text-sm italic border-dashed border-2 border-slate-800 min-h-[200px]'>
                                Left eye not scanned
                              </div>
                        }
                    </div>

                    {/* Feature 2: Grade Probability Chart for right eye */}
                    {record?.rightEye?.class_probabilities?.length > 0 && (
                        <GradeProbChart probs={record.rightEye.class_probabilities} />
                    )}

                    {/* Actions */}
                    <div className="card-elevated space-y-3">
                        <p className="section-label mb-2">Actions</p>

                        {/* YOLO Lesion button — for OD (right eye) image */}
                        <button onClick={() => navigate('/yolo-results', { state: { record } })}
                            className="w-full btn-primary bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/60 text-sm justify-start gap-3 animate-pulse ring-2 ring-indigo-500/50">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            <span className="font-black uppercase tracking-wider">🔬 View Detailed Lesion Analysis</span>
                        </button>

                        <VoiceGuide patient={record} result={{ grade: record.grade, grade_label: record.rightEye?.grade_label, diagnosis: record.diagnosis, confidence: record.confidence, risk_level: record.risk_level, urgency: record.urgency }} />
                        <PDFGenerator
                            patient={record}
                            result={{
                                grade: record.grade,
                                grade_label: record.rightEye?.grade_label,
                                confidence: record.confidence,
                                risk_level: record.risk_level,
                                risk_score: record.risk_score,
                                urgency: record.urgency,
                                heatmap_url: record.rightEye?.heatmap_url,
                                yolo: record.rightEye?.yoloDetections,
                            }}
                            imagePreview={record.rightEye?.image_url}
                        />
                        <ABDMIntegration
                            reportId={`RS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`}
                            patientName={record?.name}
                        />
                        <button onClick={() => navigate('/camp')} className="w-full text-sm btn-secondary justify-start">
                            📊 View Camp Statistics
                        </button>
                    </div>
                </>
            )}

            {/* Feature 5: Patient History Chart */}
            {(patientData?.contact || record?.contact) && (
                <LongitudinalChart contact={patientData?.contact || record?.contact} />
            )}
        </div>
    );
}
