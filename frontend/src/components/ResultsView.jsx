// ResultsView.jsx — Displays AI-generated DR classification results for single-eye and dual-eye scans.
// Supports grade probability charts, heatmap toggles, PDF export, WhatsApp sharing, and camp queue saving.

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VoiceGuide from './VoiceGuide';
import PDFGenerator from './PDFGenerator';
import ABDMIntegration from './ABDMIntegration';
import SplitHeatmapView from './SplitHeatmapView';
import LongitudinalChart from './LongitudinalChart';
import { savePatient } from '../utils/indexedDB';
import { supabase } from '../utils/supabaseClient';
const GRADE_INFO = [
    { label: 'No Diabetic Retinopathy', cls: 'grade-0', urgency: 'Annual checkup', accent: 'border-l-emerald-500' },
    { label: 'Mild Diabetic Retinopathy', cls: 'grade-1', urgency: 'Monitor in 6 months', accent: 'border-l-yellow-500' },
    { label: 'Moderate Diabetic Retinopathy', cls: 'grade-2', urgency: 'Refer in 3 months', accent: 'border-l-orange-500' },
    { label: 'Severe Diabetic Retinopathy', cls: 'grade-3', urgency: 'Refer within 2 weeks', accent: 'border-l-red-500' },
    { label: 'Proliferative Diabetic Retinopathy', cls: 'grade-4', urgency: '🚨 Emergency referral', accent: 'border-l-pink-500' },
];

const GRADE_LABELS = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Proliferative DR'];
const GRADE_C = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];

/**
 * Renders a summary card for one eye's AI inference result.
 * Includes grade pill, confidence %, diagnosis text, and optional heatmap split view.
 */
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

/**
 * Displays a horizontal bar chart of model-output class probabilities (Grade 0–4).
 * Highlights the winning class and flags low-confidence borderline results.
 */
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

/**
 * Main ResultsView Component
 * Reads scan results from React Router state and renders the appropriate layout:
 * - Legacy single-eye path: image toggle + clinical summary + actions.
 * - Dual-eye path (record.rightEye present): overall summary + per-eye cards + actions.
 */
export default function ResultsView() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState(1);
    const [confirmSaved, setConfirmSaved] = useState(false);
    const [showWaModal, setShowWaModal] = useState(false);
    const [waNumber, setWaNumber] = useState('');
    const [waTarget, setWaTarget] = useState(null); // 'legacy' or 'dual'

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
                                onError={e => { e.target.style.opacity = '0'; }}
                                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${viewMode === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} />
                            <img src={result?.heatmap_url} alt="Grad-CAM Heatmap"
                                onError={e => { e.target.style.opacity = '0'; }}
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
                            {/* WhatsApp Share */}
                            <button
                                onClick={() => { setWaTarget('legacy'); setShowWaModal(true); }}
                                className="w-full btn-primary bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/60 text-sm justify-start gap-3 flex items-center px-4 py-3 rounded-xl font-black text-white transition-all"
                            >
                                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                Share via WhatsApp
                            </button>
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
                        {/* WhatsApp Share */}
                        <button
                            onClick={() => { setWaTarget('dual'); setShowWaModal(true); }}
                            className="w-full btn-primary bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/60 text-sm justify-start gap-3 flex items-center px-4 py-3 rounded-xl font-black text-white transition-all"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Share via WhatsApp
                        </button>
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

            {showWaModal && (
              <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4" onClick={() => setShowWaModal(false)}>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-white font-black text-lg">📱 Share via WhatsApp</h3>
                  <p className="text-slate-400 text-sm">Enter the patient's or doctor's 10-digit Indian mobile number</p>
                  <input
                    type="tel"
                    value={waNumber}
                    onChange={e => setWaNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                    maxLength={10}
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setShowWaModal(false)} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold text-sm">Cancel</button>
                    <button
                      onClick={() => {
                        const num = waNumber;
                        if (!/^[6-9]\d{9}$/.test(num)) { alert('Invalid Indian mobile number.'); return; }
                        const src = waTarget === 'dual' ? record : patientData;
                        const g = src?.grade ?? result?.grade ?? 0;
                        const text = encodeURIComponent(
                          `🏥 RetinaScan AI Report\n` +
                          `Patient: ${src?.name || 'Unknown'}\n` +
                          `Grade: ${g} — ${GRADE_INFO[g]?.label || ''}\n` +
                          `Confidence: ${Math.round(((src?.confidence || result?.confidence || 0)) * 100)}%\n` +
                          `Risk: ${src?.risk_level || result?.risk_level || 'LOW'}\n` +
                          `Next Step: ${GRADE_INFO[g]?.urgency || ''}\n` +
                          `⚠ AI Screening Support — Not a substitute for clinical diagnosis.`
                        );
                        window.open(`https://wa.me/91${num}?text=${text}`, '_blank', 'noopener,noreferrer');
                        setShowWaModal(false);
                        setWaNumber('');
                      }}
                      className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm"
                    >
                      Send →
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    );
}
