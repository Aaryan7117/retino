// CampDashboard.jsx — Operational dashboard for vision screening camps. 
// Provides real-time stats, patient records management, and AI visualization tools.

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAllPatients, deletePatient, getAuditLog } from '../utils/indexedDB';
import { useScreeningMode } from '../utils/screeningContext';
import { shouldRefer, MODE_CONFIG } from '../utils/screeningMode';

/**
 * Export patient data to a CSV file for offline reporting.
 */
function exportPatientDataToCSV(patients) {
    const CSV_HEADERS = [
        'ID', 'Name', 'Age', 'Gender', 'Diabetic Yrs', 'Contact', 'Overall Grade',
        'Right Eye Grade', 'Left Eye Grade', 'Diagnosis', 'Confidence%', 'Risk', 'Urgency', 'Scan Time'
    ];
    
    const CSV_ROWS = patients.map(patient => [
        patient.id || '', 
        patient.name || '', 
        patient.age || '', 
        patient.gender || '',
        patient.diabeticSince || 0, 
        patient.contact || '',
        patient.grade ?? '',
        patient.rightEye?.grade ?? '',
        patient.leftEye?.grade ?? '',
        (patient.diagnosis || '').replace(/,/g, ';'),
        Math.round((patient.confidence || 0) * 100),
        patient.risk || '', 
        (patient.urgency || '').replace(/,/g, ';'),
        patient.timestamp ? new Date(patient.timestamp).toLocaleString('en-IN') : ''
    ]);

    const csvContent = [CSV_HEADERS, ...CSV_ROWS].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
    downloadAnchor.download = `RetinaScan_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadAnchor.click();
}

/* ── UI Configuration Constants ────────────────────────── */
const CLINICAL_GRADES = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Prolif. DR'];
const GRADE_HEX_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#ec4899'];
const GRADE_TEXT_CLASSES = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];

/* ── Utility Functions ─────────────────────────────────── */
function getRiskClass(riskLevel) {
    const riskMap = { HIGH: 'grade-3', MEDIUM: 'grade-2', LOW: 'grade-0' };
    return riskMap[riskLevel] ?? 'grade-0';
}

function formatTime(timestamp) {
    try {
        if (!timestamp) return 'No Time';
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return 'Invalid Date';
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        const dateStr = isToday ? 'Today' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return `${dateStr}, ${timeStr}`;
    } catch (e) {
        return 'Invalid Time';
    }
}

function useAnimatedCounter(targetValue, animationDuration = 800) {
    const [currentValue, setCurrentValue] = useState(0);
    const previousTarget = useRef(0);

    useEffect(() => {
        const initialValue = previousTarget.current;
        const deltaValue = targetValue - initialValue;
        if (deltaValue === 0) {
           setCurrentValue(targetValue);
           return;
        }

        const totalFrames = 30;
        let currentFrame = 0;
        
        const animationTimer = setInterval(() => {
            currentFrame++;
            setCurrentValue(Math.round(initialValue + deltaValue * (currentFrame / totalFrames)));
            
            if (currentFrame >= totalFrames) {
                clearInterval(animationTimer);
                previousTarget.current = targetValue;
            }
        }, animationDuration / totalFrames);

        return () => clearInterval(animationTimer);
    }, [targetValue, animationDuration]);

    return currentValue;
}

function DonutChart({ patientRecords }) {
    const SVG_SIZE = 180;
    const RADIUS = 72;
    const STROKE_WIDTH = 20;
    const CENTER_COORD = SVG_SIZE / 2;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const GAP = 3;

    const totalCount = patientRecords.length || 1;
    const gradeFrequencies = GRADE_HEX_COLORS.map((_, grade) =>
        patientRecords.filter(p => (p.grade ?? p.gradeOD ?? 0) === grade).length
    );

    const GLOW_COLORS = [
        '16,185,129',  // emerald
        '245,158,11',  // amber
        '249,115,22',  // orange
        '239,68,68',   // red
        '236,72,153',  // pink
    ];

    const segments = [];
    let cumulativeOffset = 0;
    for (let i = 0; i < gradeFrequencies.length; i++) {
        const freq = gradeFrequencies[i];
        const percent = freq / totalCount;
        const dashLen = Math.max(0, percent * CIRCUMFERENCE - GAP);
        segments.push({ index: i, freq, dashLen, offset: cumulativeOffset, percent });
        cumulativeOffset += percent * CIRCUMFERENCE;
    }

    const highestGrade = segments.reduce((max, s) => s.freq > max.freq ? s : max, segments[0]);

    return (
        <div className="flex flex-col lg:flex-row items-center gap-10">
            {/* Ring with glow */}
            <div className="relative shrink-0 flex items-center justify-center">
                <div className="absolute inset-0" style={{ filter: `blur(30px)`, background: `radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)` }} />
                <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
                    <defs>
                        {GLOW_COLORS.map((rgb, i) => (
                            <filter key={i} id={`glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                <feColorMatrix type="matrix" values={`0 0 0 0 ${parseInt(rgb.split(',')[0])/255} 0 0 0 0 ${parseInt(rgb.split(',')[1])/255} 0 0 0 0 ${parseInt(rgb.split(',')[2])/255} 0 0 0 1 0`} in="blur" result="coloredBlur" />
                                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        ))}
                    </defs>

                    {/* Background track */}
                    <circle cx={CENTER_COORD} cy={CENTER_COORD} r={RADIUS} fill="none"
                        stroke="#1a2035" strokeWidth={STROKE_WIDTH} />

                    {/* Segments */}
                    {segments.map(({ index, dashLen, offset }) => dashLen > 0 && (
                        <circle
                            key={index}
                            cx={CENTER_COORD} cy={CENTER_COORD} r={RADIUS}
                            fill="none"
                            stroke={GRADE_HEX_COLORS[index]}
                            strokeWidth={STROKE_WIDTH}
                            strokeDasharray={`${dashLen} ${CIRCUMFERENCE}`}
                            strokeDashoffset={-(offset - CIRCUMFERENCE / 4)}
                            strokeLinecap="round"
                            filter={`url(#glow-${index})`}
                            style={{ 
                                transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)',
                                filter: `drop-shadow(0 0 10px ${GRADE_HEX_COLORS[index]}77)`
                            }}
                        />
                    ))}

                    {/* Center total count */}
                    <text x={CENTER_COORD} y={CENTER_COORD - 10} textAnchor="middle"
                        fill="white" fontSize="30" fontWeight="900" fontFamily="Outfit, sans-serif">
                        {patientRecords.length}
                    </text>
                    <text x={CENTER_COORD} y={CENTER_COORD + 12} textAnchor="middle"
                        fill="#475569" fontSize="9" fontWeight="800" fontFamily="Outfit, sans-serif"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                        RECORDS
                    </text>
                </svg>
            </div>

            {/* Legend bars */}
            <div className="flex flex-col gap-3.5 w-full">
                {GRADE_HEX_COLORS.map((colorValue, gradeIdx) => {
                    const frequency = patientRecords.filter(p => (p.grade ?? p.gradeOD ?? 0) === gradeIdx).length;
                    const percentShare = totalCount > 0 ? Math.round((frequency / totalCount) * 100) : 0;
                    const isHighest = gradeIdx === highestGrade?.index && frequency > 0;

                    return (
                        <div key={gradeIdx} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorValue, boxShadow: `0 0 6px ${colorValue}` }} />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Grade {gradeIdx} · <span className="text-slate-600">{CLINICAL_GRADES[gradeIdx]}</span>
                                    </span>
                                    {isHighest && <span className="text-[8px] bg-violet-500/10 border border-violet-500/30 text-violet-400 font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Most Common</span>}
                                </div>
                                <span className="text-[10px] font-black" style={{ color: colorValue }}>
                                    {frequency} <span className="text-slate-600 font-medium">({percentShare}%)</span>
                                </span>
                            </div>
                            <div className="w-full bg-[#0A0F1E] rounded-full h-[6px] overflow-hidden border border-[#1F2937]/70 relative">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${percentShare}%`,
                                        background: `linear-gradient(90deg, ${colorValue}bb, ${colorValue})`,
                                        boxShadow: `0 0 10px ${colorValue}88`
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function StatCard({ label, targetValue, icon, suffixLabel = '' }) {
    const displayedValue = useAnimatedCounter(targetValue);
    return (
        <div className="stat-card group">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-all font-black">
                {icon}
            </div>
            <span className="text-3xl font-black text-white tabular-nums">
                {displayedValue}{suffixLabel}
            </span>
            <span className="section-label">{label}</span>
        </div>
    );
}

function PatientCard({ patient, onRemoveRecord, onInspectRecord }) {
    const risk = patient.risk || patient.risk_level || 'LOW';
    const grade = patient.grade ?? patient.gradeOD ?? 0;

    return (
        <div className="bg-[#111827] border border-[#1F2937] rounded-3xl p-6 group hover:border-violet-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] transition-all flex flex-col justify-between relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
            
            <div>
                <div className="flex items-center gap-4 mb-5 border-b border-[#1F2937] pb-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg border border-white/5 ${
                        patient.gender === 'Female' ? 'bg-gradient-to-br from-rose-500/20 to-rose-900/40 text-rose-400' : 'bg-gradient-to-br from-violet-500/20 to-violet-900/40 text-violet-400'
                    }`}>
                        {patient.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-wider ${
                                risk === 'LOW' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                risk === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                                {risk}
                            </span>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest font-mono">
                                ID: {patient.id?.slice(0, 10)}
                            </span>
                        </div>
                        <h3 className="text-lg font-black text-white truncate group-hover:text-violet-400 transition-colors">
                            {patient.name}
                        </h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                            {patient.age}y • {patient.gender || 'Unknown'}
                        </p>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="bg-[#0A0F1E] rounded-2xl p-4 border border-[#1F2937] min-h-[70px]">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Automated Assessment</p>
                        <p className="text-white text-[11px] font-bold leading-relaxed line-clamp-2 italic opacity-80">
                            "{patient.diagnosis || 'No clinical remarks generated.'}"
                        </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <div className={`text-sm font-black ${GRADE_TEXT_CLASSES[grade]}`}>
                                {CLINICAL_GRADES[grade]}
                            </div>
                            <div className="text-[9px] uppercase font-black tracking-widest text-slate-600">Clinical Grade</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="text-white text-sm font-black tabular-nums">
                                {Math.round((patient.confidence || 0) * 100)}%
                            </div>
                            <div className="text-[9px] uppercase font-black tracking-widest text-slate-600">AI Confidence</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={onInspectRecord}
                    className="flex-1 py-3.5 rounded-xl bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest transition-all hover:bg-violet-500 shadow-lg shadow-violet-900/20"
                >
                    Open Report
                </button>
                <button 
                    onClick={onRemoveRecord}
                    className="px-4 rounded-xl bg-[#0A0F1E] border border-[#1F2937] text-slate-500 hover:text-rose-500 hover:border-rose-500/30 transition-all"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[#1F2937]/50 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    Captured {formatTime(patient.timestamp).split(',')[1]}
                </span>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    {formatTime(patient.timestamp).split(',')[0]}
                </span>
            </div>
        </div>
    );
}

export default function CampDashboard() {
    const [patientRecords, setPatientRecords] = useState([]);
    const [inspectedPatient, setInspectedPatient] = useState(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [operationAuditLog, setOperationAuditLog] = useState([]);
    const [isAuditLogVisible, setIsAuditLogVisible] = useState(false);
    const [searchQueryString, setSearchQueryString] = useState('');
    const [activeGradeFilter, setActiveGradeFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQueryString, activeGradeFilter]);

    async function syncDashboardData() {
        try {
            const records = await getAllPatients();
            setPatientRecords(records);
            getAuditLog(30).then(setOperationAuditLog).catch(() => {});
        } catch (err) {
            console.error('CampDashboard: Remote sync failed', err);
        } finally {
            setIsDataLoading(false);
        }
    }

    useEffect(() => {
        syncDashboardData();
        const syncInterval = setInterval(syncDashboardData, 5000);
        return () => clearInterval(syncInterval);
    }, []);

    async function handlePatientRemoval(recordId) {
        if (!confirm('Permanently delete this diagnostic record? This cannot be undone.')) return;
        try {
            await deletePatient(recordId);
            setPatientRecords(prev => prev.filter(p => p.id !== recordId));
        } catch (err) {
            console.error('CampDashboard: Removal operation failed', err);
        }
    }

    const { mode } = useScreeningMode();

    const highRiskCount = patientRecords.filter(p => p.risk === 'HIGH').length;
    const moderateRiskCount = patientRecords.filter(p => p.risk === 'MEDIUM').length;
    const totalReferralsNeeded = patientRecords.filter(p => shouldRefer(p, mode)).length;
    const currentSessionDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const visiblePatientQueue = useMemo(() => {
        let queue = [...patientRecords].sort((a, b) => b.timestamp - a.timestamp);
        if (searchQueryString.trim()) {
            const lowerQuery = searchQueryString.toLowerCase();
            queue = queue.filter(p =>
                (p.name || '').toLowerCase().includes(lowerQuery) ||
                (p.id || '').toLowerCase().includes(lowerQuery) ||
                (p.diagnosis || '').toLowerCase().includes(lowerQuery)
            );
        }
        if (activeGradeFilter === 'high') {
            queue = queue.filter(p => p.risk === 'HIGH');
        } else if (activeGradeFilter === 'refer') {
            queue = queue.filter(p => shouldRefer(p, mode));
        } else if (activeGradeFilter !== 'all') {
            queue = queue.filter(p => p.grade === Number(activeGradeFilter));
        }
        return queue;
    }, [patientRecords, searchQueryString, activeGradeFilter]);

    const totalPages = Math.ceil(visiblePatientQueue.length / ITEMS_PER_PAGE) || 1;
    const paginatedPatients = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return visiblePatientQueue.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [visiblePatientQueue, currentPage]);

    return (
        <div className="space-y-8 pb-10 font-['Outfit'] animate-fade-in">

            {/* HEADER */}
            <div className="flex items-end justify-between flex-wrap gap-4 px-2">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.history.back()} className="flex items-center justify-center w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600 hover:text-white transition-all group shrink-0">
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter leading-none">Clinical Records</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Vision Camp Operations · {currentSessionDate}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => exportPatientDataToCSV(patientRecords)} 
                        disabled={!patientRecords.length}
                        className='bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] border-none rounded-2xl py-3.5 px-6 h-auto text-[10px] uppercase tracking-[0.2em] font-black animate-pulse transition-all'
                    >
                        Export CSV
                    </button>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest leading-none">Live Sync active</span>
                    </div>
                </div>
            </div>

            {/* MODE BANNER */}
            {mode === 'preventative' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-amber-500 animate-fade-in shadow-lg shadow-amber-500/5">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="text-xs font-black uppercase tracking-widest">PREVENTATIVE MODE ACTIVE — Grade 1+ cases with Risk Score &gt; 35 are flagged</p>
                    </div>
                </div>
            )}

            {/* METRICS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    label="Total Scans" 
                    targetValue={patientRecords.length} 
                    icon={<svg className="w-6 h-6 text-violet-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} 
                />
                <StatCard 
                    label="High Risk" 
                    targetValue={highRiskCount} 
                    icon={<svg className="w-6 h-6 text-rose-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} 
                />
                <StatCard 
                    label="Avg Scan Time" 
                    targetValue={28} 
                    icon={<svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
                    suffixLabel="s" 
                />
                <StatCard 
                    label="Total Referrals" 
                    targetValue={totalReferralsNeeded} 
                    icon={<svg className="w-6 h-6 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>} 
                />
            </div>

            {/* MAIN QUEUE */}
            <div className="card-elevated bg-[#111827]">
                <div className="flex items-center justify-between mb-8 px-2">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Patient Registry</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                            Showing {visiblePatientQueue.length} of {patientRecords.length} clinical profiles
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="md:col-span-2 relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Find by name, patient ID, or diagnosis result..."
                            value={searchQueryString}
                            onChange={e => setSearchQueryString(e.target.value)}
                            className="input pl-12 py-4 bg-[#0A0F1E] text-sm font-medium border-[#1F2937]"
                        />
                    </div>
                    <div className="flex bg-[#0A0F1E] p-1.5 rounded-2xl border border-[#1F2937] gap-1">
                        {[['all','All'],['high','🚨 Risk'],['refer','⚠ Refer'],].map(([filterKey, filterLabel]) => (
                            <button key={filterKey} onClick={() => setActiveGradeFilter(filterKey)}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${activeGradeFilter === filterKey ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' : 'text-slate-500 hover:text-slate-300'}`}>
                                {filterLabel}
                            </button>
                        ))}
                    </div>
                </div>

                {isDataLoading ? (
                    <div className="py-24 text-center">
                        <div className="animate-spin w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Synchronizing clinical data…</p>
                    </div>
                ) : visiblePatientQueue.length === 0 ? (
                    <div className="py-24 text-center bg-[#0A0F1E]/50 rounded-[40px] border border-[#1F2937] border-dashed">
                        <p className="text-slate-600 font-black uppercase tracking-[0.2em] text-xs">
                            {searchQueryString || activeGradeFilter !== 'all' ? 'No matches found for filters' : 'Queue is currently empty'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {paginatedPatients.map(record => (
                                <PatientCard
                                    key={record.id}
                                    patient={record}
                                    onRemoveRecord={() => handlePatientRemoval(record.id)}
                                    onInspectRecord={() => setInspectedPatient(record)}
                                />
                            ))}
                        </div>
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-12">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#0A0F1E] border border-[#1F2937] text-slate-400 hover:text-white disabled:opacity-20 transition-all font-black"
                                >
                                    ←
                                </button>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#0A0F1E] border border-[#1F2937] text-slate-400 hover:text-white disabled:opacity-20 transition-all font-black"
                                >
                                    →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* DISTRIBUTION GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="card-elevated bg-[#111827]">
                    <h2 className="text-xl font-black text-white mb-10 tracking-tight uppercase">Severity Spread</h2>
                    <DonutChart patientRecords={patientRecords} />
                </div>

                <div className='card-elevated bg-[#111827] flex flex-col'>
                    <div className="flex items-center justify-between mb-10">
                        <h2 className='text-xl font-black text-white tracking-tight uppercase'>System Activity</h2>
                        <button 
                            onClick={() => setIsAuditLogVisible(prev => !prev)}
                            className='text-[9px] font-black text-violet-400 uppercase tracking-widest hover:text-white px-3 py-1 bg-violet-500/10 rounded-lg border border-violet-500/20'
                        >
                            {isAuditLogVisible ? 'Hide Logs' : 'View Logs'}
                        </button>
                    </div>
                    {isAuditLogVisible ? (
                        <div className="overflow-y-auto max-h-[300px] pr-2 scrollbar-style">
                            <table className='w-full text-left'>
                                <thead>
                                    <tr className="border-b border-[#1F2937]">
                                        <th className="pb-3 text-[9px] font-black text-slate-600 uppercase tracking-widest">Event</th>
                                        <th className="pb-3 text-[9px] font-black text-slate-600 uppercase tracking-widest">Context</th>
                                        <th className="pb-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1F2937]/30">
                                    {operationAuditLog.map(entry => (
                                        <tr key={entry.id} className="text-[11px]">
                                            <td className="py-4 font-bold text-slate-300">{entry.type}</td>
                                            <td className="py-4 font-mono text-[10px] text-slate-600">{entry.device.slice(0, 20)}...</td>
                                            <td className="py-4 text-right font-black text-slate-500">{formatTime(entry.ts).split(',')[1]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                             <div className="w-16 h-16 rounded-full bg-[#0A0F1E] flex items-center justify-center mb-4 text-2xl border border-[#1F2937] shadow-inner">
                                <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                             </div>
                             <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Operational logs minimized</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL / INSPECTOR */}
            {inspectedPatient && (
                <div
                    className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0A0F1E]/95 backdrop-blur-xl animate-fade-in'
                    onClick={() => setInspectedPatient(null)}
                >
                    <div
                        className='bg-[#111827] border border-[#1F2937] rounded-[40px] w-full max-w-2xl shadow-[0_32px_120px_-20px_rgba(0,0,0,1)] flex flex-col max-h-[95vh] overflow-hidden'
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className='flex items-center justify-between px-10 py-8 border-b border-[#1F2937]'>
                             <div className="flex items-center gap-6">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-violet-900/40">
                                    {inspectedPatient.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className='text-3xl font-black text-white leading-tight tracking-tight'>{inspectedPatient.name}</h2>
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] mt-1 opacity-60">Clinical Reference: {inspectedPatient.id}</p>
                                </div>
                             </div>
                            <button
                                onClick={() => setInspectedPatient(null)}
                                className='w-12 h-12 flex items-center justify-center rounded-2xl bg-[#0A0F1E] border border-[#1F2937] text-slate-500 hover:text-white hover:bg-rose-600 hover:border-rose-500 transition-all'
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className='overflow-y-auto flex-1 p-10 space-y-10 scrollbar-hide'>
                            
                            {/* Bio Grid */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-[#0A0F1E] p-5 rounded-[24px] border border-[#1F2937] shadow-inner">
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Patient Demographics</p>
                                    <p className="text-white font-black text-xl">{inspectedPatient.age}y / {inspectedPatient.gender}</p>
                                </div>
                                <div className="bg-[#0A0F1E] p-5 rounded-[24px] border border-[#1F2937] shadow-inner">
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">History</p>
                                    <p className="text-white font-black text-xl">{inspectedPatient.diabeticSince} Yrs Diabetic</p>
                                </div>
                                <div className="bg-[#0A0F1E] p-5 rounded-[24px] border border-[#1F2937] shadow-inner flex flex-col justify-center">
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Risk Status</p>
                                    <div className={`grade-pill text-[10px] py-1.5 ${getRiskClass(inspectedPatient.risk)}`}>{inspectedPatient.risk} Tier</div>
                                </div>
                            </div>

                            {/* Assessment Results */}
                            <div className="relative group p-8 rounded-[40px] overflow-hidden border border-violet-500/30">
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-blue-600/5 z-0" />
                                <div className="absolute top-0 right-0 p-8 z-10 text-right">
                                     <p className="text-violet-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">AI Confidence</p>
                                     <p className="text-white font-black text-4xl tabular-nums tracking-tighter">{Math.round(inspectedPatient.confidence * 100)}%</p>
                                </div>
                                
                                <div className="relative z-10 space-y-4">
                                    <p className="text-violet-400 text-[10px] font-black uppercase tracking-[0.3em]">Automated Diagnosis</p>
                                    <h3 className="text-4xl font-black text-white tracking-tight leading-[1.1] max-w-sm">
                                        {inspectedPatient.diagnosis}
                                    </h3>
                                    <div className="pt-4 flex items-start gap-4">
                                        <div className="w-1 h-12 bg-violet-600 rounded-full" />
                                        <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm italic">
                                            {inspectedPatient.urgency || "No immediate clinical intervention required. Proceed with annual routine retinopathy screening."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Imagery Section */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-black uppercase tracking-[0.2em] text-[10px] ml-1 opacity-70">Diagnostic Imaging / AI Interpretation</h3>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Right Eye */}
                                    <div className="space-y-4">
                                        <div className="bg-[#0A0F1E] p-3 rounded-[32px] border border-[#1F2937] group">
                                            <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] mb-3 text-center">Right Eye (OD)</p>
                                            <div className="relative rounded-2xl overflow-hidden aspect-square shadow-2xl">
                                                <img src={inspectedPatient.rightEye?.image_url || inspectedPatient.od_image_url || inspectedPatient.image_url} className="w-full h-full object-cover bg-black" alt="OD" />
                                                {(inspectedPatient.rightEye?.heatmap_url || inspectedPatient.od_heatmap_url || inspectedPatient.heatmap_url) && (
                                                    <img src={inspectedPatient.rightEye?.heatmap_url || inspectedPatient.od_heatmap_url || inspectedPatient.heatmap_url} className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-500" alt="Heatmap" />
                                                )}
                                                <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[8px] font-black text-white uppercase tracking-widest">Original Scan</div>
                                            </div>
                                            {(inspectedPatient.rightEye?.heatmap_url || inspectedPatient.od_heatmap_url || inspectedPatient.heatmap_url) && (
                                                <div className="mt-3 relative rounded-2xl overflow-hidden aspect-square border border-violet-500/20">
                                                    <img src={inspectedPatient.rightEye?.heatmap_url || inspectedPatient.od_heatmap_url || inspectedPatient.heatmap_url} className="w-full h-full object-cover bg-black" alt="OD AI" />
                                                    <div className="absolute bottom-3 left-3 px-3 py-1 bg-violet-600/80 backdrop-blur-md rounded-lg border border-violet-400/20 text-[8px] font-black text-white uppercase tracking-widest">Lesion Detection</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Left Eye */}
                                    <div className="space-y-4">
                                        <div className="bg-[#0A0F1E] p-3 rounded-[32px] border border-[#1F2937] group">
                                            <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] mb-3 text-center">Left Eye (OS)</p>
                                            {inspectedPatient.leftEye?.image_url || inspectedPatient.os_image_url ? (
                                                <div className="space-y-3">
                                                    <div className="relative rounded-2xl overflow-hidden aspect-square shadow-2xl">
                                                        <img src={inspectedPatient.leftEye?.image_url || inspectedPatient.os_image_url} className="w-full h-full object-cover bg-black" alt="OS" />
                                                        {(inspectedPatient.leftEye?.heatmap_url || inspectedPatient.os_heatmap_url) && (
                                                            <img src={inspectedPatient.leftEye?.heatmap_url || inspectedPatient.os_heatmap_url} className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-500" alt="Heatmap" />
                                                        )}
                                                        <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[8px] font-black text-white uppercase tracking-widest">Original Scan</div>
                                                    </div>
                                                    {(inspectedPatient.leftEye?.heatmap_url || inspectedPatient.os_heatmap_url) && (
                                                        <div className="relative rounded-2xl overflow-hidden aspect-square border border-violet-500/20">
                                                            <img src={inspectedPatient.leftEye?.heatmap_url || inspectedPatient.os_heatmap_url} className="w-full h-full object-cover bg-black" alt="OS AI" />
                                                            <div className="absolute bottom-3 left-3 px-3 py-1 bg-violet-600/80 backdrop-blur-md rounded-lg border border-violet-400/20 text-[8px] font-black text-white uppercase tracking-widest">Lesion Detection</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="aspect-square flex items-center justify-center flex-col gap-4 rounded-[28px] bg-[#0D1221] border border-dashed border-[#1F2937] transition-all group-hover:bg-[#111827]">
                                                    <div className="w-16 h-16 rounded-full bg-[#111827] flex items-center justify-center text-3xl font-black text-slate-800 border border-[#1F2937]">?</div>
                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] text-center px-6 leading-relaxed">Monocular Screening<br/>OS Data Unavailable</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className='px-10 py-8 border-t border-[#1F2937] flex gap-4'>
                            <button
                                onClick={() => setInspectedPatient(null)}
                                className='px-10 btn-secondary py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-[11px]'
                            >
                                Close Inspector
                            </button>
                            <Link to={`/results?id=${inspectedPatient.id}`} state={{ record: inspectedPatient }} className="flex-1 btn-primary py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-[11px] text-center shadow-2xl shadow-violet-900/40">
                                View Full Clinical Report →
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
