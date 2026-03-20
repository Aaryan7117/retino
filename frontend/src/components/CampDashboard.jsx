// CampDashboard.jsx — Operational dashboard for vision screening camps. 
// Provides real-time stats, patient records management, and AI visualization tools.

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAllPatients, deletePatient, getAuditLog } from '../utils/indexedDB';

/**
 * Export patient data to a CSV file for offline reporting.
 * @param {Array<Object>} patients - List of patient records to export.
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

/**
 * Renders an AI-generated heatmap with YOLOv8 object detection overlays.
 * Handles multiple image source types (Base64, Blob URLs, etc.) for offline persistence.
 */
function HeatmapOverlay({ heatmapBlob, heatmapUrl, yoloDetections }) {
    const [activeImageSource, setActiveImageSource] = useState(null);

    useEffect(() => {
        // Source priority logic for offline resilience
        if (heatmapUrl && heatmapUrl.startsWith('data:')) {
            setActiveImageSource(heatmapUrl); // Base64 is most reliable for offline records
            return;
        }
        if (heatmapUrl && heatmapUrl.startsWith('blob:')) {
            setActiveImageSource(heatmapUrl); // Temporary session blobs
            return;
        }
        if (heatmapUrl && heatmapUrl.startsWith('http')) {
            setActiveImageSource(heatmapUrl); // Remote cloud storage
            return;
        }

        if (!heatmapBlob) return;
        
        let temporaryUrl;
        try {
            if (heatmapBlob instanceof Blob) {
                temporaryUrl = URL.createObjectURL(heatmapBlob);
                setActiveImageSource(temporaryUrl);
            }
        } catch (e) {
            console.error('HeatmapOverlay: Initialization failed', e);
        }
        
        return () => { 
            if (temporaryUrl) URL.revokeObjectURL(temporaryUrl); 
        };
    }, [heatmapBlob, heatmapUrl]);

    if (!activeImageSource) return (
        <div className="aspect-square w-full max-h-64 bg-slate-950 flex items-center justify-center rounded-lg border border-slate-700">
            <p className="text-slate-500 text-xs text-center px-4 italic">
                AI visualization unavailable for this record.
            </p>
        </div>
    );

    return (
        <div className="relative aspect-square w-full max-h-64 bg-black rounded-lg overflow-hidden border border-slate-700">
            <img src={activeImageSource} alt="Retinal Heatmap" className="w-full h-full object-contain" />
            
            {/* Draw YOLO Bounding Boxes */}
            {yoloDetections?.detections?.map((det, index) => {
                const [x1, y1, x2, y2] = det.bbox;
                const sourceWidth = yoloDetections.image_shape[1];
                const sourceHeight = yoloDetections.image_shape[0];
                
                return (
                    <div
                        key={index}
                        className="absolute border-2 border-yellow-400 group"
                        style={{
                            left: `${(x1 / sourceWidth) * 100}%`,
                            top: `${(y1 / sourceHeight) * 100}%`,
                            width: `${((x2 - x1) / sourceWidth) * 100}%`,
                            height: `${((y2 - y1) / sourceHeight) * 100}%`
                        }}
                    >
                        <span className="absolute -top-5 left-0 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {det.class_name} ({Math.round(det.confidence * 100)}%)
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/* ── UI Configuration Constants ────────────────────────── */
const CLINICAL_GRADES = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Prolif. DR'];
const GRADE_HEX_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#ec4899'];
const GRADE_TEXT_CLASSES = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];

/* ── Utility Functions ─────────────────────────────────── */
/**
 * Maps risk levels to CSS classes.
 * @param {string} riskLevel - The risk level (e.g., 'HIGH', 'MEDIUM', 'LOW').
 * @returns {string} The corresponding CSS class.
 */
function getRiskClass(riskLevel) {
    const riskMap = { HIGH: 'grade-3', MEDIUM: 'grade-2', LOW: 'grade-0' };
    return riskMap[riskLevel] ?? 'grade-0';
}

/**
 * Formats timestamps for local display.
 * @param {number | string} timestamp - The timestamp to format.
 * @returns {string} The formatted time string.
 */
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Hook for smooth, high-performance numeric animations.
 * @param {number} targetValue - The final value to animate to.
 * @param {number} [animationDuration=800] - The duration of the animation in milliseconds.
 * @returns {number} The current animated value.
 */
function useAnimatedCounter(targetValue, animationDuration = 800) {
    const [currentValue, setCurrentValue] = useState(0);
    const previousTarget = useRef(0);

    useEffect(() => {
        const initialValue = previousTarget.current;
        const deltaValue = targetValue - initialValue;
        if (deltaValue === 0) return;

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

/**
 * Renders a segmented donut chart for patient grade distribution.
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.patientRecords - An array of patient records.
 */
function DonutChart({ patientRecords }) {
    const SVG_SIZE = 160;
    const RADIUS = 60;
    const STROKE_WIDTH = 22;
    const CENTER_COORD = SVG_SIZE / 2;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    const totalCount = patientRecords.length || 1;
    const gradeFrequencies = GRADE_HEX_COLORS.map((_, grade) => 
        patientRecords.filter(p => p.grade === grade).length
    );

    // Calculate chart segments
    const { chartSegments } = gradeFrequencies.reduce(
        (acc, freq, index) => {
            const percentage = freq / totalCount;
            const dashLength = percentage * CIRCUMFERENCE;
            acc.chartSegments.push({ index, freq, dashLength, currentOffset: acc.cumulativeOffset, percentage });
            acc.cumulativeOffset += dashLength;
            return acc;
        },
        { cumulativeOffset: 0, chartSegments: [] },
    );

    return (
        <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative shrink-0">
                <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
                    <circle cx={CENTER_COORD} cy={CENTER_COORD} r={RADIUS} fill="none"
                        stroke="#1e293b" strokeWidth={STROKE_WIDTH} />

                    {chartSegments.map(({ index, dashLength, currentOffset }) => (
                        <circle
                            key={index}
                            cx={CENTER_COORD} cy={CENTER_COORD} r={RADIUS}
                            fill="none"
                            stroke={GRADE_HEX_COLORS[index]}
                            strokeWidth={STROKE_WIDTH}
                            strokeDasharray={`${dashLength} ${CIRCUMFERENCE - dashLength}`}
                            strokeDashoffset={-(currentOffset - CIRCUMFERENCE / 4)}
                            strokeLinecap="butt"
                            style={{ transition: 'stroke-dasharray 0.7s ease' }}
                        />
                    ))}

                    <text x={CENTER_COORD} y={CENTER_COORD - 5} textAnchor="middle"
                        fill="white" fontSize="20" fontWeight="900">
                        {patientRecords.length}
                    </text>
                    <text x={CENTER_COORD} y={CENTER_COORD + 12} textAnchor="middle"
                        fill="#94a3b8" fontSize="9" fontWeight="600">
                        SCANS
                    </text>
                </svg>
            </div>

            {/* distribution Legend */}
            <div className="grid grid-cols-1 gap-2 w-full">
                {GRADE_HEX_COLORS.map((colorValue, gradeIdx) => {
                    const frequency = patientRecords.filter(p => p.grade === gradeIdx).length;
                    const percentShare = totalCount > 0 ? Math.round((frequency / totalCount) * 100) : 0;
                    
                    return (
                        <div key={gradeIdx} className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorValue }} />
                            <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div className="h-2 rounded-full transition-all duration-700"
                                    style={{ width: `${percentShare}%`, background: colorValue }} />
                            </div>
                            <span className="text-xs font-bold text-slate-400 w-24 text-right">
                                <span style={{ color: colorValue }}>Grade {gradeIdx}</span>
                                <span className="text-slate-500"> · {frequency} ({percentShare}%)</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Reusable stat block with animated counter.
 * @param {Object} props - The component props.
 * @param {string} props.label - The label for the stat.
 * @param {number} props.targetValue - The target value for the counter.
 * @param {string} props.icon - An emoji or icon for the stat.
 * @param {string} props.backgroundColor - Tailwind CSS class for background color.
 * @param {string} props.glowEffect - Tailwind CSS class for shadow/glow effect.
 * @param {string} [props.suffixLabel=''] - Optional suffix for the displayed value.
 */
function StatCard({ label, targetValue, icon, backgroundColor, glowEffect, suffixLabel = '' }) {
    const displayedValue = useAnimatedCounter(targetValue);
    return (
        <div className={`rounded-2xl p-5 flex flex-col items-center gap-2 text-center shadow-xl ${glowEffect} ${backgroundColor}`}>
            <span className="text-3xl">{icon}</span>
            <span className="text-4xl font-black text-white tabular-nums">
                {displayedValue}{suffixLabel}
            </span>
            <span className="text-xs font-bold text-white/70">{label}</span>
        </div>
    );
}

/**
 * Individual row in the patient history table.
 * @param {Object} props - The component props.
 * @param {Object} props.patient - The patient record object.
 * @param {boolean} props.markAsNew - If true, applies a slide-in animation.
 * @param {function} props.onRemoveRecord - Callback for deleting the record.
 * @param {function} props.onInspectRecord - Callback for viewing record details.
 */
function PatientTableRow({ patient, markAsNew, onRemoveRecord, onInspectRecord }) {
    const [isRowVisible, setIsRowVisible] = useState(!markAsNew);

    useEffect(() => {
        if (markAsNew) {
            const visibilityDelay = setTimeout(() => setIsRowVisible(true), 30);
            return () => clearTimeout(visibilityDelay);
        }
    }, [markAsNew]);

    return (
        <tr style={{
            opacity: isRowVisible ? 1 : 0,
            transform: isRowVisible ? 'translateY(0)' : 'translateY(-16px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
            <td className="font-mono text-[11px] text-slate-500">{patient.id}</td>
            <td className="font-bold text-white">{patient.name}</td>
            <td className="text-slate-300">{patient.age}</td>
            <td className="text-slate-400 text-xs max-w-[160px] truncate">{patient.diagnosis}</td>
            <td>
                <span className={`grade-pill grade-${patient.grade}`}>Grade {patient.grade}</span>
            </td>
            <td className={`font-black ${GRADE_TEXT_CLASSES[patient.grade]}`}>
                {Math.round(patient.confidence * 100)}%
            </td>
            <td>
                <span className={`grade-pill ${getRiskClass(patient.risk)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {patient.risk}
                </span>
            </td>
            <td className="text-slate-500 text-xs">{formatTime(patient.timestamp)}</td>
            <td>
                <div className="flex items-center gap-2">
                    <button onClick={onInspectRecord} className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-600/30 rounded-lg transition-colors" title="View Details">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button onClick={onRemoveRecord} className="p-1.5 text-red-400 hover:text-white hover:bg-red-600/30 rounded-lg transition-colors" title="Delete Record">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </td>
        </tr>
    );
}

/**
 * Main Dashboard Component
 * Orchestrates data loading, filtering, stats calculation, and high-level UI controls.
 */
export default function CampDashboard() {
    const [patientRecords, setPatientRecords] = useState([]);
    const [inspectedPatient, setInspectedPatient] = useState(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [operationAuditLog, setOperationAuditLog] = useState([]);
    const [isAuditLogVisible, setIsAuditLogVisible] = useState(false);
    const [searchQueryString, setSearchQueryString] = useState('');
    const [activeGradeFilter, setActiveGradeFilter] = useState('all');

    /**
     * Refreshes dashboard data from IndexedDB.
     */
    async function syncDashboardData() {
        try {
            const records = await getAllPatients();
            setPatientRecords(records);
            // Feature 7: Fetch diagnostic audit trail
            getAuditLog(30).then(setOperationAuditLog).catch(() => {});
        } catch (err) {
            console.error('CampDashboard: Remote sync failed', err);
        } finally {
            setIsDataLoading(false);
        }
    }

    // Polling effect to keep dashboard in sync with background AI processes
    useEffect(() => {
        syncDashboardData();
        const syncInterval = setInterval(syncDashboardData, 5000);
        return () => clearInterval(syncInterval);
    }, []);

    /**
     * Permanent removal of a patient record.
     * @param {string} recordId - The ID of the patient record to delete.
     */
    async function handlePatientRemoval(recordId) {
        if (!confirm('Permanently delete this diagnostic record? This cannot be undone.')) return;
        try {
            await deletePatient(recordId);
            setPatientRecords(prev => prev.filter(p => p.id !== recordId));
        } catch (err) {
            console.error('CampDashboard: Removal operation failed', err);
        }
    }

    /* Derivative clinical metrics */
    const highRiskCount = patientRecords.filter(p => p.risk === 'HIGH').length;
    const moderateRiskCount = patientRecords.filter(p => p.risk === 'MEDIUM').length;
    const totalReferralsNeeded = highRiskCount + moderateRiskCount;
    const currentSessionDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    /**
     * Filters patients based on search queries and grade/risk selectors.
     * @returns {Array<Object>} The filtered list of patient records.
     */
    const visiblePatientQueue = useMemo(() => {
        let queue = patientRecords;
        
        // Multi-field search logic
        if (searchQueryString.trim()) {
            const lowerQuery = searchQueryString.toLowerCase();
            queue = queue.filter(p =>
                (p.name || '').toLowerCase().includes(lowerQuery) ||
                (p.id || '').toLowerCase().includes(lowerQuery) ||
                (p.diagnosis || '').toLowerCase().includes(lowerQuery)
            );
        }

        // Functional sorting and filtering
        if (activeGradeFilter === 'high') {
            queue = queue.filter(p => p.risk === 'HIGH');
        } else if (activeGradeFilter === 'refer') {
            queue = queue.filter(p => p.grade >= 2);
        } else if (activeGradeFilter !== 'all') {
            queue = queue.filter(p => p.grade === Number(activeGradeFilter));
        }

        return queue;
    }, [patientRecords, searchQueryString, activeGradeFilter]);

    return (
        <div className="space-y-8">

            {/* ── Dashboard Header ────────────────────────── */}
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <p className="section-label">Operations</p>
                    <h1 className="text-4xl font-black text-white">Today's Camp Stats</h1>
                    <p className="text-slate-400 text-sm mt-1">Vision Camp · {currentSessionDate}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Diagnostic Data Export */}
                    <button 
                        onClick={() => exportPatientDataToCSV(patientRecords)} 
                        disabled={!patientRecords.length}
                        className='flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/60 transition-colors disabled:opacity-40'
                    >
                        <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                            <path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
                        </svg>
                        Export CSV
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900/30 border border-emerald-700/40">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 text-sm font-bold">Live Updates Active</span>
                    </div>
                </div>
            </div>

            {/* ── Operational metrics ──────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Scans" targetValue={patientRecords.length} icon="📋" backgroundColor="bg-blue-600" glowEffect="shadow-blue-900/40" />
                <StatCard label="High Risk" targetValue={highRiskCount} icon="🚨" backgroundColor="bg-rose-600" glowEffect="shadow-rose-900/40" />
                <StatCard label="Scan Time" targetValue={28} icon="⏱️" backgroundColor="bg-amber-500" glowEffect="shadow-amber-900/40" suffixLabel="s" />
                <StatCard label="Referrals" targetValue={totalReferralsNeeded} icon="📤" backgroundColor="bg-emerald-600" glowEffect="shadow-emerald-900/40" />
            </div>

            {/* ── Main Patient Queue ───────────────────────── */}
            <div className="card-elevated">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <p className="section-label">Queue</p>
                        <h2 className="text-xl font-black text-white">Recent Patients</h2>
                    </div>
                    <span className="text-xs text-slate-500 italic">
                        New scans appear automatically every 12 s (demo)
                    </span>
                </div>

                {/* Queue Controls: Search and filter selectors */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name, ID, or diagnosis..."
                            value={searchQueryString}
                            onChange={e => setSearchQueryString(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                        />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {[['all','All'],['high','🚨 High'],['refer','⚠ Refer'],].map(([filterKey, filterLabel]) => (
                            <button key={filterKey} onClick={() => setActiveGradeFilter(filterKey)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeGradeFilter === filterKey ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
                                {filterLabel}
                            </button>
                        ))}
                    </div>
                </div>
                
                <p className="text-xs text-slate-500 mb-3">
                    Showing {Math.min(visiblePatientQueue.length, 15)} of {patientRecords.length} patient{patientRecords.length !== 1 ? 's' : ''}
                    {searchQueryString || activeGradeFilter !== 'all' ? ` (filtered)` : ''}
                </p>

                {isDataLoading ? (
                    <p className="text-center text-slate-400 py-12">Synchronizing clinical data…</p>
                ) : visiblePatientQueue.length === 0 ? (
                    <p className="text-center text-slate-400 py-12">
                        {searchQueryString || activeGradeFilter !== 'all' ? 'No patients match current filters.' : 'Queue empty. New scans will appear here.'}
                    </p>
                ) : (
                    <div className="overflow-x-auto -mx-6">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {['Patient ID', 'Name', 'Age', 'Diagnosis', 'Grade', 'Conf.', 'Risk', 'Time', 'Actions'].map(header => (
                                        <th key={header}>{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visiblePatientQueue.slice(0, 15).map(record => (
                                    <PatientTableRow
                                        key={record.id}
                                        patient={record}
                                        markAsNew={false}
                                        onRemoveRecord={() => handlePatientRemoval(record.id)}
                                        onInspectRecord={() => setInspectedPatient(record)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── grade distribution analytics ─────────────── */}
            <div className="card-elevated">
                <p className="section-label">Analytics</p>
                <h2 className="text-xl font-black text-white mb-6">DR Severity Distribution</h2>
                <DonutChart patientRecords={patientRecords} />
            </div>

            {/* ── Operational Audit Trail ──────────────────── */}
            <div className='card-elevated mt-6'>
                <button 
                    onClick={() => setIsAuditLogVisible(prev => !prev)}
                    className='w-full flex justify-between text-sm font-bold text-slate-400'
                >
                    <span>System Audit Trail ({operationAuditLog.length})</span>
                    <span>{isAuditLogVisible ? '▲' : '▼'}</span>
                </button>
                {isAuditLogVisible && (
                    <table className='data-table w-full mt-3 text-xs'>
                        <thead><tr><th>Timestamp</th><th>Activity</th><th>Grade</th><th>Hardware Context</th></tr></thead>
                        <tbody>{operationAuditLog.map(entry => (
                            <tr key={entry.id}>
                                <td className='font-mono'>{formatTime(entry.ts)}</td>
                                <td>{entry.type}</td>
                                <td>{entry.grade}</td>
                                <td className='font-mono text-slate-500'>{entry.device}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                )}
            </div>

            {/* ── Clinical Portal Pivot ────────────────────── */}
            <div className='flex justify-center mt-12 mb-6'>
                {/* Use React Router Link (client-side nav) — plain <a href> causes a hard reload which 404s on Vercel */}
                <Link to='/doctor' className='group flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 shadow-lg hover:bg-indigo-900/60 transition-all font-bold text-indigo-300 hover:text-white group'>
                    <svg className="w-5 h-5 text-indigo-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Switch to Specialist Portal
                    <svg className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>

            {/* ── Diagnostic Detail Modal ──────────────────── */}
            {inspectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <button onClick={() => setInspectedPatient(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h2 className="text-2xl font-black text-white mb-4">Patient Diagnostics</h2>
                        <div className="space-y-4">
                            {/* patient metadata */}
                            <div className="bg-slate-800 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Biographics</p>
                                <p className="text-lg font-bold text-white">{inspectedPatient.name} <span className="text-slate-400 font-normal">({inspectedPatient.age}y, {inspectedPatient.gender})</span></p>
                                <p className="text-sm text-slate-400 mt-1">Diagnostic ID: <span className="font-mono text-white">{inspectedPatient.id}</span></p>
                                <p className="text-sm text-slate-400 mt-1">Primary Contact: <span className="text-white">{inspectedPatient.contact}</span></p>
                                <p className="text-sm text-slate-400 mt-1">Medical History: <span className="text-white">Diabetic since {inspectedPatient.diabeticSince} years</span></p>
                            </div>

                            {/* AI result visualization */}
                            <div className="bg-slate-800 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">AI Inference Results</p>
                                <p className="text-xl font-black text-white">{inspectedPatient.diagnosis}</p>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                        <p className="text-xs text-slate-400">Classification Conf.</p>
                                        <p className="font-bold text-white">{Math.round(inspectedPatient.confidence * 100)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">Risk Severity Index</p>
                                        <p className="font-bold text-white">{inspectedPatient.risk_score}/100</p>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <p className="text-xs text-slate-400">Action Protocol</p>
                                    <p className="font-bold text-white max-w-sm">{inspectedPatient.urgency || getRiskClass(inspectedPatient.risk)}</p>
                                </div>
                            </div>

                            {/* Imaging Panel */}
                            <div className="bg-slate-800 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-tighter">Lesion Topology & Heatmap</p>
                                <HeatmapOverlay
                                    heatmapBlob={inspectedPatient.heatmap_blob}
                                    heatmapUrl={inspectedPatient.heatmap_url || inspectedPatient.rightEye?.heatmap_url}
                                    yoloDetections={inspectedPatient.result_yolo || inspectedPatient.rightEye?.yoloDetections}
                                />
                                <p className="text-[10px] text-slate-500 mt-2 italic text-center">
                                    Offline persistent visualization engine enabled.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
