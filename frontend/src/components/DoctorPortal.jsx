import { useState, useEffect } from 'react';
import { getAllPatients } from '../utils/indexedDB';
import { saveReview, getAllReviews } from '../utils/indexedDB';

const GRADE_LABELS = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Proliferative DR'];
const GRADE_COLORS = ['text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-pink-400'];

function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function DoctorPortal() {
    const [patients, setPatients] = useState([]);
    const [reviews, setReviews] = useState({});
    const [tab, setTab] = useState('urgent');
    const [overrides, setOverrides] = useState({});
    const [notes, setNotes] = useState({});
    const [showNote, setShowNote] = useState({});

    async function reload() {
        const all = await getAllPatients();
        const flagged = all.filter(p => p.grade >= 2 || p.risk === 'HIGH');
        setPatients(flagged);
        const revs = await getAllReviews();
        const revMap = {};
        revs.forEach(r => { revMap[r.patientId] = r; });
        setReviews(revMap);
    }

    useEffect(() => {
        reload();
        const id = setInterval(reload, 30000);
        return () => clearInterval(id);
    }, []);

    const tabs = {
        urgent: patients.filter(p => p.grade >= 3),
        refer: patients.filter(p => p.grade >= 2),
        all: patients,
    };

    const shown = tabs[tab] || [];
    const reviewed = Object.keys(reviews).length;
    const pending = patients.length - reviewed;
    const avgConf = patients.length > 0
        ? Math.round(patients.reduce((s, p) => s + (p.confidence || 0), 0) / patients.length * 100)
        : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            {/* Header */}
            <div>
                <p className="section-label">Medical Review</p>
                <h1 className="text-4xl font-black text-white">Doctor Review Portal</h1>
                <div className="mt-3 bg-red-900/30 border border-red-700/50 text-red-300 text-xs font-bold px-4 py-2 rounded-xl">
                    ⚕ CLINICAL DISCLAIMER: AI diagnoses are screening tools only. All overrides and confirmations must be made by a licensed ophthalmologist. Results are stored locally and not transmitted.
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Flagged', val: patients.length, color: 'text-blue-400' },
                    { label: 'Reviewed', val: reviewed, color: 'text-emerald-400' },
                    { label: 'Pending', val: pending, color: 'text-amber-400' },
                    { label: 'Avg Confidence', val: `${avgConf}%`, color: 'text-violet-400' },
                ].map(({ label, val, color }) => (
                    <div key={label} className="card-elevated text-center py-4">
                        <div className={`text-3xl font-black ${color}`}>{val}</div>
                        <div className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wide">{label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-900 rounded-xl">
                {[['urgent', '🚨 Urgent (Grade 3-4)'], ['refer', '⚠ Refer (Grade 2+)'], ['all', 'All Flagged']].map(([key, lbl]) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === key ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                        {lbl} <span className="ml-1 text-xs opacity-70">({tabs[key].length})</span>
                    </button>
                ))}
            </div>

            {shown.length === 0 ? (
                <div className="card-elevated text-center py-16 text-slate-500">
                    <p className="text-4xl mb-4">✅</p>
                    <p className="font-bold">No patients in this category</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shown.map(p => {
                        const isReviewed = !!reviews[p.id];
                        const ov = overrides[p.id];
                        const noteVal = notes[p.id] || '';
                        return (
                            <div key={p.id} className="card-elevated relative space-y-3">
                                {/* Reviewed badge */}
                                {isReviewed && (
                                    <div className="absolute top-3 right-3 bg-emerald-700 text-white text-xs font-black px-2 py-0.5 rounded-full">
                                        Reviewed ✓
                                    </div>
                                )}

                                {/* Patient info */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-white font-black text-base">{p.name}</p>
                                        <p className="text-slate-400 text-xs">{p.age}y · {p.gender} · <span className="font-mono">{p.id}</span></p>
                                        <p className="text-slate-500 text-xs">{timeAgo(p.timestamp)}</p>
                                    </div>
                                    <span className={`grade-pill grade-${p.grade}`}>Grade {p.grade}</span>
                                </div>

                                <p className="text-slate-300 text-sm">{p.diagnosis}</p>
                                <p className="text-xs text-slate-500">Confidence: <span className="text-white font-bold">{Math.round((p.confidence || 0) * 100)}%</span></p>

                                {/* Heatmap images */}
                                {(p.rightEye?.heatmap_url || p.leftEye?.heatmap_url) && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {p.rightEye?.heatmap_url && (
                                            <div>
                                                <p className="text-xs text-blue-400 font-bold mb-1">OD (Right)</p>
                                                <img src={p.rightEye.heatmap_url} className="w-full rounded-lg aspect-square object-cover" alt="Right eye heatmap" />
                                            </div>
                                        )}
                                        {p.leftEye?.heatmap_url && (
                                            <div>
                                                <p className="text-xs text-violet-400 font-bold mb-1">OS (Left)</p>
                                                <img src={p.leftEye.heatmap_url} className="w-full rounded-lg aspect-square object-cover" alt="Left eye heatmap" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action row */}
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => saveReview({ patientId: p.id, confirmed: true, confirmedGrade: p.grade }).then(reload)}
                                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-900/50 border border-emerald-700 text-emerald-400 hover:bg-emerald-800/60 transition-colors">
                                        ✓ Confirm
                                    </button>
                                    <div className="flex-1 flex gap-1">
                                        <select value={ov ?? p.grade} onChange={e => setOverrides(o => ({ ...o, [p.id]: Number(e.target.value) }))}
                                            className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5">
                                            {[0, 1, 2, 3, 4].map(g => <option key={g} value={g}>Grade {g}</option>)}
                                        </select>
                                        <button
                                            onClick={() => saveReview({ patientId: p.id, override: true, confirmedGrade: ov ?? p.grade }).then(reload)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-900/50 border border-amber-700 text-amber-400 hover:bg-amber-800/60 transition-colors">
                                            Override
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowNote(n => ({ ...n, [p.id]: !n[p.id] }))}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-900/50 border border-blue-700 text-blue-400 hover:bg-blue-800/60 transition-colors">
                                        📝 Note
                                    </button>
                                </div>

                                {showNote[p.id] && (
                                    <div className="space-y-2">
                                        <textarea
                                            value={noteVal}
                                            onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))}
                                            maxLength={150}
                                            placeholder="Clinical note (max 150 chars)..."
                                            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg p-2 resize-none h-16"
                                        />
                                        <button
                                            onClick={() => saveReview({ patientId: p.id, note: noteVal }).then(reload)}
                                            className="w-full py-1.5 rounded-lg text-xs font-bold bg-blue-700 text-white hover:bg-blue-600 transition-colors">
                                            Save Note
                                        </button>
                                    </div>
                                )}

                                {/* Show existing review details */}
                                {reviews[p.id] && (
                                    <div className="bg-slate-800/50 rounded-lg p-2 text-xs text-slate-400">
                                        Reviewed: {reviews[p.id].confirmed ? `Confirmed Grade ${reviews[p.id].confirmedGrade}` : reviews[p.id].override ? `Overridden to Grade ${reviews[p.id].confirmedGrade}` : 'Note added'}
                                        {reviews[p.id].note && <p className="text-slate-300 mt-1">"{reviews[p.id].note}"</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="text-center pt-4">
                <a href="/" className="text-xs text-slate-600 hover:text-blue-400 transition-colors">← Back to Dashboard</a>
            </div>
        </div>
    );
}
