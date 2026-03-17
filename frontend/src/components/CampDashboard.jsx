import { useState, useEffect, useRef, useMemo } from 'react';
import { getAllPatients, deletePatient, getAuditLog } from '../utils/indexedDB';

// ── Feature 6: Camp CSV Export ───────────────────────────────────────────────
function exportCSV(patients) {
    const HDR = ['ID', 'Name', 'Age', 'Gender', 'Diabetic Yrs', 'Contact', 'Overall Grade',
        'Right Eye Grade', 'Left Eye Grade', 'Diagnosis', 'Confidence%', 'Risk', 'Urgency', 'Scan Time'];
    const ROWS = patients.map(p => [
        p.id || '', p.name || '', p.age || '', p.gender || '',
        p.diabeticSince || 0, p.contact || '',
        p.grade ?? '',
        p.rightEye?.grade ?? '',
        p.leftEye?.grade ?? '',
        (p.diagnosis || '').replace(/,/g, ';'),
        Math.round((p.confidence || 0) * 100),
        p.risk || '', (p.urgency || '').replace(/,/g, ';'),
        p.timestamp ? new Date(p.timestamp).toLocaleString('en-IN') : ''
    ]);
    const csv = [HDR, ...ROWS].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `RetinaScan_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

/* ── Components ────────────────────────────────────────── */
function HeatmapOverlay({ heatmapBlob, heatmapUrl, yoloDetections }) {
    const [blobUrl, setBlobUrl] = useState(null);

    useEffect(() => {
        // Case 1: Base64 data URL (new records after fix) — works after refresh!
        if (heatmapUrl && heatmapUrl.startsWith('data:')) {
            setBlobUrl(heatmapUrl);
            return;
        }
        // Case 2: Legacy blob:// URL (same-session only, may be dead after refresh)
        if (heatmapUrl && heatmapUrl.startsWith('blob:')) {
            setBlobUrl(heatmapUrl);
            return;
        }
        // Case 3: Any other heatmapUrl string (fallback)
        if (heatmapUrl) {
            setBlobUrl(heatmapUrl);
            return;
        }
        // Case 4: Raw Blob object (very old legacy records)
        if (!heatmapBlob) return;
        let url;
        try {
            if (heatmapBlob instanceof Blob) {
                url = URL.createObjectURL(heatmapBlob);
                setBlobUrl(url);
            }
        } catch (e) {
            console.error('HeatmapOverlay: Failed to create blob URL', e);
        }
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [heatmapBlob, heatmapUrl]);

    if (!blobUrl) return (
        <div className="aspect-square w-full max-h-64 bg-slate-950 flex items-center justify-center rounded-lg border border-slate-700">
            <p className="text-slate-500 text-xs text-center px-4 italic">
                Heatmap/YOLO data not found for this older record. Please perform a new scan.
            </p>
        </div>
    );

    return (
        <div className="relative aspect-square w-full max-h-64 bg-black rounded-lg overflow-hidden border border-slate-700">
            <img src={blobUrl} alt="Heatmap" className="w-full h-full object-contain" />
            {yoloDetections?.detections?.map((d, i) => {
                const [x1, y1, x2, y2] = d.bbox;
                const imgW = yoloDetections.image_shape[1];
                const imgH = yoloDetections.image_shape[0];
                return (
                    <div
                        key={i}
                        className="absolute border-2 border-yellow-400 group"
                        style={{
                            left: `${(x1 / imgW) * 100}%`,
                            top: `${(y1 / imgH) * 100}%`,
                            width: `${((x2 - x1) / imgW) * 100}%`,
                            height: `${((y2 - y1) / imgH) * 100}%`
                        }}
                    >
                        <span className="absolute -top-5 left-0 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {d.class_name} ({Math.round(d.confidence * 100)}%)
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/* ── Constants ─────────────────────────────────────────── */
const GRADE_LABELS = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Prolif. DR'];
const GRADE_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#ec4899'];
const GRADE_TEXT = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];

/* ── Helpers ───────────────────────────────────────────── */
function riskClass(risk) {
    return { HIGH: 'grade-3', MEDIUM: 'grade-2', LOW: 'grade-0' }[risk] ?? 'grade-0';
}

function timeStr(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/* ── Animated counter hook ─────────────────────────────── */
function useCountUp(target, duration = 800) {
    const [value, setValue] = useState(0);
    const prev = useRef(0);
    useEffect(() => {
        const start = prev.current;
        const diff = target - start;
        if (diff === 0) return;
        const steps = 30;
        let step = 0;
        const id = setInterval(() => {
            step++;
            setValue(Math.round(start + diff * (step / steps)));
            if (step >= steps) {
                clearInterval(id);
                prev.current = target;
            }
        }, duration / steps);
        return () => clearInterval(id);
    }, [target, duration]);
    return value;
}

/* ── Donut chart component ─────────────────────────────── */
function DonutChart({ patients }) {
    const SIZE = 160;
    const R = 60;
    const STROKE = 22;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const CIRC = 2 * Math.PI * R;

    const total = patients.length || 1;
    const counts = GRADE_COLORS.map((_, g) => patients.filter(p => p.grade === g).length);

    // Build segments: each gets a dasharray/dashoffset slice without mutating after render
    const { segments } = counts.reduce(
        (acc, count, i) => {
            const pct = count / total;
            const dash = pct * CIRC;
            acc.segments.push({ i, count, dash, offset: acc.offset, pct });
            acc.offset += dash;
            return acc;
        },
        { offset: 0, segments: [] },
    );

    return (
        <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative shrink-0">
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                    {/* Background circle */}
                    <circle cx={CX} cy={CY} r={R} fill="none"
                        stroke="#1e293b" strokeWidth={STROKE} />

                    {segments.map(({ i, dash, offset: off }) => (
                        <circle
                            key={i}
                            cx={CX} cy={CY} r={R}
                            fill="none"
                            stroke={GRADE_COLORS[i]}
                            strokeWidth={STROKE}
                            strokeDasharray={`${dash} ${CIRC - dash}`}
                            strokeDashoffset={-(off - CIRC / 4)}
                            strokeLinecap="butt"
                            style={{ transition: 'stroke-dasharray 0.7s ease' }}
                        />
                    ))}

                    {/* Centre label */}
                    <text x={CX} y={CY - 5} textAnchor="middle"
                        fill="white" fontSize="20" fontWeight="900">
                        {patients.length}
                    </text>
                    <text x={CX} y={CY + 12} textAnchor="middle"
                        fill="#94a3b8" fontSize="9" fontWeight="600">
                        SCANS
                    </text>
                </svg>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 gap-2 w-full">
                {GRADE_COLORS.map((color, g) => {
                    const count = patients.filter(p => p.grade === g).length;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                        <div key={g} className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                            <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div className="h-2 rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: color }} />
                            </div>
                            <span className="text-xs font-bold text-slate-400 w-24 text-right">
                                <span style={{ color }}>Grade {g}</span>
                                <span className="text-slate-500"> · {count} ({pct}%)</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Stat card with animated counter ──────────────────── */
function StatCard({ label, target, icon, bg, glow, suffix = '' }) {
    const value = useCountUp(target);
    return (
        <div className={`rounded-2xl p-5 flex flex-col items-center gap-2 text-center shadow-xl ${glow} ${bg}`}>
            <span className="text-3xl">{icon}</span>
            <span className="text-4xl font-black text-white tabular-nums">
                {value}{suffix}
            </span>
            <span className="text-xs font-bold text-white/70">{label}</span>
        </div>
    );
}

/* ── Patient row with slide-in animation ──────────────── */
function PatientRow({ p, isNew, onDelete, onView }) {
    const [visible, setVisible] = useState(!isNew);
    useEffect(() => {
        if (isNew) {
            const t = setTimeout(() => setVisible(true), 30);
            return () => clearTimeout(t);
        }
    }, [isNew]);

    return (
        <tr style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-16px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
            <td className="font-mono text-[11px] text-slate-500">{p.id}</td>
            <td className="font-bold text-white">{p.name}</td>
            <td className="text-slate-300">{p.age}</td>
            <td className="text-slate-400 text-xs max-w-[160px] truncate">{p.diagnosis}</td>
            <td>
                <span className={`grade-pill grade-${p.grade}`}>Grade {p.grade}</span>
            </td>
            <td className={`font-black ${GRADE_TEXT[p.grade]}`}>
                {Math.round(p.confidence * 100)}%
            </td>
            <td>
                <span className={`grade-pill ${riskClass(p.risk)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {p.risk}
                </span>
            </td>
            <td className="text-slate-500 text-xs">{timeStr(p.timestamp)}</td>
            <td>
                <div className="flex items-center gap-2">
                    <button onClick={onView} className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-600/30 rounded-lg transition-colors" title="View Details">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button onClick={onDelete} className="p-1.5 text-red-400 hover:text-white hover:bg-red-600/30 rounded-lg transition-colors" title="Delete Record">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </td>
        </tr>
    );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function CampDashboard() {
    const [patients, setPatients] = useState([]);
    const [viewPatient, setViewPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Feature 7: Audit log state
    const [auditLog, setAuditLog] = useState([]);
    const [showAudit, setShowAudit] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeFilter, setGradeFilter] = useState('all'); // 'all' | 'high' | 'refer' | '0'|'1'|'2'|'3'|'4'

    async function loadPatients() {
        try {
            const real = await getAllPatients();
            setPatients(real);
            // Feature 7: Load audit log
            getAuditLog(30).then(setAuditLog).catch(() => {});
        } catch (err) {
            console.error('Failed to load patients', err);
        } finally {
            setIsLoading(false);
        }
    }

    // Load data initially and every 5 seconds (to catch new scans if left open)
    useEffect(() => {
        loadPatients();
        const id = setInterval(loadPatients, 5000);
        return () => clearInterval(id);
    }, []);

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this scan record?')) return;
        try {
            await deletePatient(id);
            setPatients(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error('Failed to delete patient', err);
        }
    }

    /* Derived stats */
    const high = patients.filter(p => p.risk === 'HIGH').length;
    const medium = patients.filter(p => p.risk === 'MEDIUM').length;
    const referrals = high + medium;
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const filteredPatients = useMemo(() => {
        let result = patients;
        // Text search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.id || '').toLowerCase().includes(q) ||
                (p.diagnosis || '').toLowerCase().includes(q)
            );
        }
        // Grade/risk filter
        if (gradeFilter === 'high') result = result.filter(p => p.risk === 'HIGH');
        else if (gradeFilter === 'refer') result = result.filter(p => p.grade >= 2);
        else if (gradeFilter !== 'all') result = result.filter(p => p.grade === Number(gradeFilter));
        return result;
    }, [patients, searchQuery, gradeFilter]);

    return (
        <div className="space-y-8">

            {/* ── Page header ─────────────────────────────── */}
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <p className="section-label">Operations</p>
                    <h1 className="text-4xl font-black text-white">Today's Camp Stats</h1>
                    <p className="text-slate-400 text-sm mt-1">Eye Camp · {today}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Feature 6: CSV Export button */}
                    <button onClick={() => exportCSV(patients)} disabled={!patients.length}
                        className='flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/60 transition-colors disabled:opacity-40'>
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

            {/* ── Animated stat cards ──────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Scans" target={patients.length} icon="📋" bg="bg-blue-600" glow="shadow-blue-900/40" />
                <StatCard label="High Risk" target={high} icon="🚨" bg="bg-rose-600" glow="shadow-rose-900/40" />
                <StatCard label="Scan Time" target={28} icon="⏱️" bg="bg-amber-500" glow="shadow-amber-900/40" suffix="s" />
                <StatCard label="Referrals" target={referrals} icon="📤" bg="bg-emerald-600" glow="shadow-emerald-900/40" />
            </div>

            {/* ── Patient table ────────────────────────────── */}
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

                {/* Search and filter controls */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name, ID, or diagnosis..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                        />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {[['all','All'],['high','🚨 High'],['refer','⚠ Refer'],].map(([key, label]) => (
                            <button key={key} onClick={() => setGradeFilter(key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${gradeFilter === key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                    Showing {Math.min(filteredPatients.length, 15)} of {patients.length} patient{patients.length !== 1 ? 's' : ''}
                    {searchQuery || gradeFilter !== 'all' ? ` (filtered)` : ''}
                </p>

                {isLoading ? (
                    <p className="text-center text-slate-400 py-12">Loading patient data…</p>
                ) : filteredPatients.length === 0 ? (
                    <p className="text-center text-slate-400 py-12">
                        {searchQuery || gradeFilter !== 'all' ? 'No patients match your search.' : 'No scans recorded yet.'}
                    </p>
                ) : (
                    <div className="overflow-x-auto -mx-6">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {['Patient ID', 'Name', 'Age', 'Diagnosis', 'Grade', 'Conf.', 'Risk', 'Time', 'Actions'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPatients.slice(0, 15).map(p => (
                                    <PatientRow
                                        key={p.id}
                                        p={p}
                                        isNew={false}
                                        onDelete={() => handleDelete(p.id)}
                                        onView={() => setViewPatient(p)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Grade distribution (donut + bars) ────────── */}
            <div className="card-elevated">
                <p className="section-label">Distribution</p>
                <h2 className="text-xl font-black text-white mb-6">DR Grade Breakdown</h2>
                <DonutChart patients={patients} />
            </div>

            {/* ── Feature 7: Audit Log ───────────────────────── */}
            <div className='card-elevated mt-6'>
                <button onClick={() => setShowAudit(s => !s)}
                    className='w-full flex justify-between text-sm font-bold text-slate-400'>
                    <span>Audit Log ({auditLog.length})</span>
                    <span>{showAudit ? '▲' : '▼'}</span>
                </button>
                {showAudit && (
                    <table className='data-table w-full mt-3 text-xs'>
                        <thead><tr><th>Time</th><th>Type</th><th>Grade</th><th>Device</th></tr></thead>
                        <tbody>{auditLog.map(e => (
                            <tr key={e.id}>
                                <td className='font-mono'>{new Date(e.ts).toLocaleTimeString('en-IN')}</td>
                                <td>{e.type}</td><td>{e.grade}</td>
                                <td className='font-mono text-slate-500'>{e.device}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                )}
            </div>

            {/* ── Feature 4: Doctor Review Portal link ─────── */}
            <div className='text-center mt-4'>
                <a href='/doctor' className='text-xs text-slate-600 hover:text-red-400 transition-colors'>
                    Doctor Review Portal
                </a>
            </div>

            {/* ── View Patient Modal ───────────────────────── */}
            {viewPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
                        <button onClick={() => setViewPatient(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h2 className="text-2xl font-black text-white mb-4">Scan Details</h2>
                        <div className="space-y-4">
                            <div className="bg-slate-800 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase">Patient</p>
                                <p className="text-lg font-bold text-white">{viewPatient.name} <span className="text-slate-400 font-normal">({viewPatient.age}y, {viewPatient.gender})</span></p>
                                <p className="text-sm text-slate-400 mt-1">ID: <span className="font-mono text-white">{viewPatient.id}</span></p>
                                <p className="text-sm text-slate-400 mt-1">Contact: <span className="text-white">{viewPatient.contact}</span></p>
                                <p className="text-sm text-slate-400 mt-1">Diabetic since: <span className="text-white">{viewPatient.diabeticSince} years</span></p>
                            </div>
                            <div className="bg-slate-800 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase">AI Diagnosis</p>
                                <p className="text-xl font-black text-white">{viewPatient.diagnosis}</p>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                        <p className="text-xs text-slate-400">Confidence</p>
                                        <p className="font-bold text-white">{Math.round(viewPatient.confidence * 100)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">Risk Score</p>
                                        <p className="font-bold text-white">{viewPatient.risk_score}/100</p>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <p className="text-xs text-slate-400">Recommendation</p>
                                    <p className="font-bold text-white max-w-sm">{viewPatient.urgency || riskClass(viewPatient.risk)}</p>
                                </div>
                            </div>
                            <div className="bg-slate-800 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Lesion Mapping & Heatmap</p>
                                <HeatmapOverlay
                                    heatmapBlob={viewPatient.heatmap_blob}
                                    heatmapUrl={viewPatient.heatmap_url || viewPatient.rightEye?.heatmap_url}
                                    yoloDetections={viewPatient.result_yolo || viewPatient.rightEye?.yoloDetections}
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
