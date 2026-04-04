// ResultsView.jsx — Displays AI-generated DR classification results for single-eye and dual-eye scans.
// Supports grade probability charts, heatmap toggles, PDF export, WhatsApp sharing, and camp queue saving.

import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import VoiceGuide from './VoiceGuide';
import PDFGenerator from './PDFGenerator';
import ABDMIntegration from './ABDMIntegration';
import SplitHeatmapView from './SplitHeatmapView';
import LongitudinalChart from './LongitudinalChart';
import { savePatient, getPatientById } from '../utils/indexedDB';
import { useScreeningMode } from '../utils/screeningContext';

const GRADE_INFO = [
    { label: 'No Diabetic Retinopathy', cls: 'grade-0', urgency: 'Annual checkup', accent: 'border-l-emerald-500', bg: 'bg-emerald-500/5' },
    { label: 'Mild Diabetic Retinopathy', cls: 'grade-1', urgency: 'Monitor in 6 months', accent: 'border-l-yellow-500', bg: 'bg-yellow-500/5' },
    { label: 'Moderate Diabetic Retinopathy', cls: 'grade-2', urgency: 'Refer in 3 months', accent: 'border-l-orange-500', bg: 'bg-orange-500/5' },
    { label: 'Severe Diabetic Retinopathy', cls: 'grade-3', urgency: 'Refer within 2 weeks', accent: 'border-l-red-500', bg: 'bg-red-500/5' },
    { label: 'Proliferative Diabetic Retinopathy', cls: 'grade-4', urgency: '🚨 Emergency referral', accent: 'border-l-pink-500', bg: 'bg-pink-500/5' },
];

const GRADE_C = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];

/**
 * Renders a summary card for one eye's AI inference result.
 * Includes grade pill, confidence %, diagnosis text, and optional heatmap split view.
 */
function EyeResultCard({ label, accent, data }) {
    const ACCENT_STYLES = {
        blue: 'border-blue-600/30 bg-blue-600/5',
        violet: 'border-violet-600/30 bg-violet-600/5'
    };
    const TEXT_ACCENT = {
        blue: 'text-blue-400',
        violet: 'text-violet-400'
    };
    
    return (
        <div className={`card-elevated border-t-4 ${ACCENT_STYLES[accent]} space-y-4`}>
            <div className='flex justify-between items-center'>
                <h3 className={`font-black text-xs uppercase tracking-[0.2em] ${TEXT_ACCENT[accent]}`}>{label}</h3>
                <span className={`grade-pill grade-${data.grade}`}>Grade {data.grade}</span>
            </div>
            
            <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-black ${GRADE_C[data.grade]}`}>
                    {(data.confidence * 100).toFixed(1)}%
                </p>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence</span>
            </div>
            
            <p className='text-sm text-slate-300 font-medium leading-relaxed'>{data.diagnosis}</p>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0F1E] border border-[#1F2937] w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
                <span className='text-[10px] font-black text-slate-500 uppercase tracking-widest'>{data.imageQuality || 'Valid Scan'}</span>
            </div>

            {/* Feature B: Split heatmap */}
            {(data.raw_heatmap_url || data.heatmap_url) && data.image_url && (
                <div className="mt-4 pt-4 border-t border-[#1F2937]/50">
                    <SplitHeatmapView
                        originalUrl={data.image_url}
                        heatmapUrl={data.raw_heatmap_url || data.heatmap_url}
                    />
                </div>
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
        <div className='card-elevated space-y-6 bg-[#111827]'>
            <div className="flex items-center justify-between">
                <p className='section-label ml-0'>Grade Probability Distribution</p>
                <div className="px-2 py-0.5 rounded-lg bg-violet-600/10 border border-violet-600/20 text-violet-400 text-[10px] font-black uppercase tracking-widest">Neural Output</div>
            </div>
            
            <div className="space-y-4">
                {probs.map((prob, i) => (
                    <div key={i}>
                        <div className='flex justify-between text-[10px] font-black uppercase tracking-widest mb-2'>
                            <span className={i === best ? TXTS[i] : 'text-slate-500'}>
                                {i === best ? '● ' : ''}{LBL[i]}
                            </span>
                            <span className={i === best ? 'text-white' : 'text-slate-700'}>
                                {(prob * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className='h-2 bg-[#0A0F1E] rounded-full overflow-hidden border border-[#1F2937]/50 p-[1px]'>
                            <div
                                className={`h-full rounded-full ${BARS[i]} ${i !== best ? 'opacity-20 translate-x-[-2px]' : 'shadow-lg shadow-current/30'}`}
                                style={{ width: `${(prob * 100).toFixed(1)}%`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                            />
                        </div>
                    </div>
                ))}
            </div>
            
            {Math.max(...probs) < 0.70 && (
                <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-black flex items-center justify-center font-black text-xs">!</span>
                    <p className='text-[11px] text-amber-200/80 font-bold uppercase tracking-wider'>
                        Confidence below 70% — Refer to specialist for clinical confirmation.
                    </p>
                </div>
            )}
        </div>
    );
}

function RiskProbabilityMeter({ riskScore, mode }) {
    const pct = Math.min(100, Math.max(0, riskScore || 0));
    const threshold = mode === 'preventative' ? 35 : 50;
    const isFlagged = pct > threshold;
    return (
        <div className='card-elevated space-y-3 bg-[#111827]'>
            <div className='flex justify-between items-center'>
                <p className='section-label ml-0'>Risk Probability Score</p>
                <span className={isFlagged ? 'text-amber-400 font-black text-sm' : 'text-slate-500 text-sm'}>
                    {isFlagged ? `FLAGGED in ${mode === 'preventative' ? 'Preventative' : 'Standard'} Mode` : 'Within Normal Range'}
                </span>
            </div>
            <div className='h-4 bg-[#0A0F1E] rounded-full overflow-hidden relative border border-[#1F2937]/50'>
                <div className='h-full rounded-full transition-all duration-700'
                    style={{ 
                        width: pct + '%',
                        background: pct > 75 ? '#ef4444' : pct > 50 ? '#f97316' : pct > 35 ? '#f59e0b' : '#10b981' 
                    }} 
                />
                <div className='absolute top-0 h-full border-l-2 border-white/40'
                    style={{ left: threshold + '%' }} title={'Referral threshold: ' + threshold} />
            </div>
            <div className='flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500'>
                <span>0</span>
                <span className='text-slate-400'>Threshold: {threshold}</span>
                <span>100</span>
            </div>
            <p className='text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-2'>
                Risk Score: <span className="text-white">{pct}/100</span>
                {mode === 'preventative' && pct > threshold && pct < 50
                    ? ' — FLAGGED IN PREVENTATIVE MODE ONLY.'
                    : ''}
            </p>
        </div>
    );
}

/**
 * Main ResultsView Component
 * Reads scan results from React Router state and renders the appropriate layout.
 */
export default function ResultsView() {
    const { state } = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    // Internal States
    const [record, setRecord] = useState(state?.record || null);
    const [isLoading, setIsLoading] = useState(!state?.record && searchParams.get('id'));
    const [confirmSaved, setConfirmSaved] = useState(false);
    const [showWaModal, setShowWaModal] = useState(false);
    const [waNumber, setWaNumber] = useState('');
    const [waTarget, setWaTarget] = useState(null); // 'legacy' or 'dual'
    const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
    const [viewMode, setViewMode] = useState(0);
    const { mode } = useScreeningMode();

    // Effect: Load from IndexedDB if State is lost (e.g. Refresh)
    useEffect(() => {
        const id = searchParams.get('id');
        if (!record && id) {
            setIsLoading(true);
            getPatientById(id).then(data => {
                if (data) setRecord(data);
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        }
    }, [searchParams, record]);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 animate-pulse">
                <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retrieving Diagnostic Data...</p>
            </div>
        );
    }

    if (!record && (!state || !state.result)) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center font-['Outfit'] animate-fade-in">
                <div className="max-w-xl w-full space-y-10">
                    <div className="relative mx-auto w-32 h-32">
                        <div className="absolute inset-0 bg-violet-600/20 rounded-full blur-2xl animate-pulse"></div>
                        <div className="relative w-full h-full bg-[#111827] border-2 border-[#1F2937] rounded-full flex items-center justify-center shadow-2xl">
                             <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">Diagnostic Data Missing</h1>
                        <p className="text-slate-500 font-medium text-lg max-w-md mx-auto leading-relaxed">
                            We couldn't retrieve the analysis results. This usually happens if you refresh the page or navigate here without a scan.
                        </p>
                    </div>

                    <div className="pt-4">
                        <button 
                            onClick={() => navigate('/scan')} 
                            className="group relative inline-flex items-center justify-center px-10 py-5 font-black text-white uppercase tracking-widest bg-violet-600 rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-violet-900/40"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                Start New Scan
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const activeRecord = record ? (record.rightEye ? record : (record.od_image_url ? {
        ...record,
        rightEye: {
            image_url: record.od_image_url,
            heatmap_url: record.od_heatmap_url,
            raw_heatmap_url: record.od_heatmap_url,
            grade: record.gradeOD ?? record.grade ?? 0,
            confidence: record.confidenceOD ?? record.confidence ?? 0,
            diagnosis: record.diagnosisOD ?? record.diagnosis ?? 'Unknown',
        },
        leftEye: record.os_image_url ? {
            image_url: record.os_image_url,
            heatmap_url: record.os_heatmap_url,
            raw_heatmap_url: record.os_heatmap_url,
            grade: record.gradeOS ?? record.grade ?? 0,
            confidence: record.confidenceOS ?? record.confidence ?? 0,
            diagnosis: record.diagnosisOS ?? record.diagnosis ?? 'Unknown',
        } : null
    } : record)) : null;

    const result = (activeRecord?.grade !== undefined) ? {
        grade: activeRecord.grade,
        confidence: activeRecord.confidence,
        risk_score: activeRecord.risk_score,
        risk_level: activeRecord.risk_level,
        urgency: activeRecord.urgency,
        heatmap_url: activeRecord.heatmap_url || activeRecord.rightEye?.heatmap_url,
        raw_heatmap_url: activeRecord.raw_heatmap_url || activeRecord.rightEye?.raw_heatmap_url,
        grade_label: activeRecord.rightEye?.grade_label || '',
        diagnosis: activeRecord.diagnosis,
        class_probabilities: activeRecord.rightEye?.class_probabilities || activeRecord.class_probabilities,
    } : (state?.result || null);
    
    const imagePreview = state?.imagePreview || activeRecord?.rightEye?.image_url || activeRecord?.image_url || null;
    const patientData = state?.patient || activeRecord;
    const info = GRADE_INFO[result?.grade ?? 0];

    return (
        <div className="max-w-4xl mx-auto space-y-10 font-['Outfit'] pb-24 animate-fade-in relative pt-12">
            
            {/* Back Button */}
            <button onClick={() => navigate(-1)} className="absolute top-0 left-0 flex items-center justify-center w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600 hover:text-white transition-all group">
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            </button>

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="section-label">Diagnostic Output</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">Diagnostic Analysis</h1>
                </div>
                <div className="flex items-center gap-3 bg-[#111827] px-4 py-2.5 rounded-2xl border border-[#1F2937]">
                    <div className="flex flex-col items-end">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Patient UID</p>
                        <p className="text-xs font-black text-white mt-1 uppercase">#RS-{activeRecord?.id?.slice(0, 8) || 'LEGACY'}</p>
                    </div>
                </div>
            </div>

            {/* Layout Split: Results vs Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Visualizations Column */}
                <div className="lg:col-span-12 space-y-8">
                    
                    {/* ──── DUAL EYE MODE ──── */}
                    {activeRecord?.rightEye ? (
                        <div className="space-y-8">
                            
                            {/* Assessment Hero Card */}
                            <div className={`card-elevated border-l-8 ${info?.accent} ${info?.bg} p-8 md:p-10 relative overflow-hidden group`}>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
                                
                                <div className="relative z-10 space-y-6">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Combined Result (Worst Grade)</p>
                                            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">{info?.label}</h2>
                                        </div>
                                        <div className="bg-[#0A0F1E]/60 backdrop-blur-xl px-8 py-4 rounded-[32px] border border-[#1F2937] text-center shadow-2xl">
                                            <p className={`text-4xl font-black ${GRADE_C[activeRecord.grade ?? activeRecord.gradeOD ?? 0]} leading-none`}>Grade {activeRecord.grade ?? activeRecord.gradeOD ?? 0}</p>
                                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-2">{activeRecord.risk_level || 'LOW'} Risk Level</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                                        <div className="bg-[#0A0F1E]/40 rounded-2xl p-4 border border-[#1F2937]/50">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Next Action</p>
                                            <p className="text-sm font-black text-white mt-1">{info?.urgency}</p>
                                        </div>
                                        <div className="bg-[#0A0F1E]/40 rounded-2xl p-4 border border-[#1F2937]/50">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Confidence Score</p>
                                            <p className="text-sm font-black text-white mt-1">{Math.round((activeRecord.confidence || 0) * 100)}% Match</p>
                                        </div>
                                        <div className="bg-[#0A0F1E]/40 rounded-2xl p-4 border border-[#1F2937]/50">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inference ID</p>
                                            <p className="text-sm font-bold font-mono text-slate-400 mt-1 uppercase">{activeRecord?.id?.slice(0, 10) || 'Unknown'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Two Eyes Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <EyeResultCard label='Right Eye (OD)' accent='blue' data={activeRecord.rightEye} />
                                {activeRecord.leftEye
                                    ? <EyeResultCard label='Left Eye (OS)' accent='violet' data={activeRecord.leftEye} />
                                    : <div className='card-elevated flex flex-col items-center justify-center text-slate-600 gap-4 border-dashed border-2 border-[#1F2937] min-h-[300px] bg-transparent'>
                                        <div className="text-4xl opacity-10">👁️‍🗨️</div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] max-w-[200px] text-center leading-relaxed">Left eye data was not captured in this screening cycle</p>
                                      </div>
                                }
                            </div>
                        </div>
                    ) : (
                        /* ──── LEGACY SINGLE EYE MODE ──── */
                        <div className="space-y-8">
                             {/* Hero Split Visualization */}
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="card-elevated space-y-6 flex flex-col bg-[#111827]">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-black text-white uppercase tracking-tight">Fundus Image View</h2>
                                        <div className="flex gap-1.5 p-1 bg-[#0A0F1E] rounded-xl border border-[#1F2937]">
                                            <button onClick={() => setViewMode(0)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 0 ? 'bg-violet-600 text-white' : 'text-slate-600 hover:text-slate-300'}`}>Raw</button>
                                            <button onClick={() => setViewMode(1)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 1 ? 'bg-violet-600 text-white' : 'text-slate-600 hover:text-slate-300'}`}>CAM</button>
                                        </div>
                                    </div>
                                    
                                    <div className="relative aspect-square bg-[#0A0F1E] rounded-[40px] overflow-hidden border border-[#1F2937] group">
                                        <img src={imagePreview} className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${viewMode === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="Scan" />
                                        <img src={result?.raw_heatmap_url || result?.heatmap_url} className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${viewMode === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="Heatmap" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                                    </div>
                                </div>

                                <div className={`card-elevated border-l-8 ${info?.accent} ${info?.bg} h-full flex flex-col justify-between p-10`}>
                                    <div className="space-y-6">
                                        <p className="section-label ml-0">Inference Conclusion</p>
                                        <div className="space-y-2">
                                            <h2 className="text-4xl font-black text-white tracking-tighter leading-tight">{info?.label}</h2>
                                            <p className="text-slate-400 font-medium leading-relaxed">{result?.diagnosis}</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 py-4">
                                            <div className="bg-[#0A0F1E]/60 p-5 rounded-3xl border border-[#1F2937]">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Confidence</p>
                                                <p className={`text-2xl font-black ${GRADE_C[result?.grade ?? 0]}`}>{Math.round((result?.confidence || 0) * 100)}%</p>
                                            </div>
                                            <div className="bg-[#0A0F1E]/60 p-5 rounded-3xl border border-[#1F2937]">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Risk Score</p>
                                                <p className="text-2xl font-black text-white">{result?.risk_score ?? 0}<span className="text-[10px] text-slate-600">/100</span></p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Clinical Protocol</span>
                                            <span className="text-white text-sm font-black">{info?.urgency}</span>
                                        </div>
                                        <div className={`grade-pill grade-${result?.grade} text-lg px-6 py-2`}>Grade {result?.grade}</div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}

                    {/* Probability Distributions (Common component) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-8">
                            {(activeRecord?.rightEye?.class_probabilities?.length > 0 || result?.class_probabilities?.length > 0) && (
                                <GradeProbChart probs={activeRecord?.rightEye?.class_probabilities || result.class_probabilities} />
                            )}
                            <RiskProbabilityMeter riskScore={result?.risk_score} mode={mode} />
                        </div>
                        
                        {/* History Insight */}
                        {(patientData?.contact || activeRecord?.contact) && (
                            <div className="card-elevated bg-[#111827] space-y-6">
                                <div className="flex items-center justify-between">
                                    <p className='section-label ml-0'>Patient Progression</p>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                </div>
                                <LongitudinalChart contact={patientData?.contact || activeRecord?.contact} />
                            </div>
                        )}
                    </div>

                    {/* ACTION PANEL */}
                    <div className="card-elevated space-y-8 bg-[#111827] border-violet-500/20">
                        <div className="flex items-center justify-between px-2">
                             <h3 className="text-xl font-black text-white tracking-widest uppercase text-left w-full ml-1">Clinical Workflow</h3>
                             <p className="hidden md:block text-[10px] whitespace-nowrap font-black text-violet-500 uppercase tracking-widest px-3 py-1 bg-violet-600/10 rounded-lg border border-violet-600/20">Authorized Export</p>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-2">
                            
                            {/* Left Column: Visual Analysis */}
                            <div className="lg:col-span-12">
                                <button onClick={() => navigate('/yolo-results', { state: activeRecord ? { record: activeRecord } : state })}
                                    className="w-full group relative overflow-hidden bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/30 rounded-[32px] p-8 text-left transition-all hover:border-violet-500/60 hover:shadow-2xl hover:shadow-violet-900/20">
                                    <div className="flex items-center justify-between relative z-10">
                                        <div>
                                            <p className="text-xs font-black text-violet-400 uppercase tracking-widest mb-1">Visual Intelligence</p>
                                            <h4 className="text-2xl font-black text-white">Full Micro-Lesion Mapping</h4>
                                            <p className="text-slate-400 text-sm mt-2 max-w-lg">Advanced computer vision identifies microaneurysms, hemorrhages, and exudates with pixel-level precision.</p>
                                        </div>
                                        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-xl">🗺️</div>
                                    </div>
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 blur-[100px] rounded-full -mr-20 -mt-20"></div>
                                </button>
                            </div>

                            {/* Voice Guide Area (7 columns) */}
                            <div className="lg:col-span-7 flex flex-col">
                                <VoiceGuide 
                                    patient={patientData} 
                                    result={result} 
                                    language={selectedLanguage} 
                                    onLanguageChange={setSelectedLanguage} 
                                />
                            </div>

                            {/* Actions Stack (5 columns) */}
                            <div className="lg:col-span-5 flex flex-col gap-4">
                                <PDFGenerator 
                                    patient={patientData || {}} 
                                    result={result} 
                                    imagePreview={imagePreview} 
                                    record={activeRecord} 
                                    language={selectedLanguage} 
                                />

                                <button
                                    onClick={() => {
                                        const pName = patientData?.name || activeRecord?.name || 'Patient';
                                        const g = activeRecord?.grade ?? result?.grade ?? 0;
                                        const risk = activeRecord?.risk_level ?? result?.risk_level ?? 'LOW';
                                        const conf = Math.round((activeRecord?.confidence ?? result?.confidence ?? 0) * 100);
                                        
                                        const msg = encodeURIComponent(
                                            `🏥 *RetinaScan AI+ Clinical Report*\n` +
                                            `----------------------------\n` +
                                            `👤 *Patient:* ${pName}\n` +
                                            `👁 *DR Grade:* ${GRADE_INFO[g]?.label}\n` +
                                            `📊 *Confidence:* ${conf}%\n` +
                                            `🚨 *Risk Level:* ${risk}\n\n` +
                                            `🏥 *Recommendation:* ${GRADE_INFO[g]?.urgency}\n\n` +
                                            `_Signifying prompt attention may be required._`
                                        );
                                        window.open(`https://wa.me/?text=${msg}`, '_blank');
                                    }}
                                    className="w-full btn bg-emerald-600/10 border-2 border-emerald-500/30 hover:bg-emerald-600 hover:border-emerald-500 text-emerald-400 hover:text-white group justify-start px-6 transition-all rounded-3xl"
                                    style={{ minHeight: '72px' }}
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">💬</span>
                                    <div className="text-left ml-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 group-hover:opacity-100 mb-0.5">Instant Outreach</p>
                                        <p className="text-sm font-bold">WhatsApp Clinical Summary</p>
                                    </div>
                                </button>

                                <ABDMIntegration 
                                    reportId={result?.report_id || `RS-${Date.now()}`} 
                                    patientName={patientData?.name || activeRecord?.name} 
                                />

                                <button
                                    onClick={async () => {
                                        if (confirmSaved) { navigate('/camp'); return; }
                                        try {
                                            const pId = patientData?.id || activeRecord?.id;
                                            if (pId) {
                                                await savePatient({ ...activeRecord, ...patientData, id: pId });
                                                setConfirmSaved(true);
                                            } else {
                                                // Fallback if data is raw
                                                const p = patientData || {};
                                                const p_id = p.patientId || `TN-${Date.now()}`;
                                                await savePatient({
                                                    ...p,
                                                    id: p_id,
                                                    grade: result?.grade,
                                                    diagnosis: GRADE_INFO[result?.grade]?.label || 'Unknown',
                                                    confidence: result?.confidence,
                                                    risk_level: result?.risk_level || 'LOW',
                                                    timestamp: new Date().toISOString(),
                                                });
                                                setConfirmSaved(true);
                                            }
                                        } catch (e) { console.error('Save failed', e); }
                                    }}
                                    className={`w-full flex items-center justify-start gap-4 px-6 rounded-3xl font-black transition-all hover:scale-[1.02] border-2 group ${confirmSaved ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-[#0A0F1E] border-[#1F2937] text-slate-400 hover:border-violet-500/50 hover:text-white'}`}
                                    style={{ minHeight: '72px' }}
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">{confirmSaved ? '📑' : '💾'}</span>
                                    <div className="text-left ml-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 group-hover:opacity-100 mb-0.5">Registry Management</p>
                                        <p className="text-sm font-bold">{confirmSaved ? 'Return to Camp Dashboard' : 'Archive to Patient Registry'}</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* WhatsApp Modal - kept for backwards compatibility if needed, but the direct button above is preferred by user */}
                {showWaModal && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center px-4 animate-fade-in" onClick={() => setShowWaModal(false)}>
                    <div className="bg-[#111827] border border-violet-500/20 shadow-2xl rounded-[40px] p-10 w-full max-w-md space-y-8" onClick={e => e.stopPropagation()}>
                       {/* (Internal modal content simplified for brevity, user primarily wants the working "Transmission" button above) */}
                       <h3 className="text-2xl font-black text-white text-center">Send to WhatsApp</h3>
                       <button onClick={() => setShowWaModal(false)} className="w-full btn-primary">Close</button>
                    </div>
                  </div>
                )}
            </div>
        </div>
    );
}
