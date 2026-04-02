import { useState, useEffect } from 'react';
import { getAllPatients } from '../utils/indexedDB';

const GRADE_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#EC4899'];

export default function LongitudinalChart({ contact }) {
    const [scans, setScans] = useState([]);
    useEffect(() => {
        getAllPatients()
            .then(all => {
                const matched = all
                    .filter(p => p.contact === contact)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                setScans(matched);
            })
            .catch(() => setScans([]));
    }, [contact]);

    if (scans.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center space-y-4 bg-slate-900/50 rounded-2xl border border-slate-800/50">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <div>
                    <p className="text-white font-bold text-sm">Baseline Analysis</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-[200px] mx-auto">
                        This is the patient's first scan. Progression analytics will appear after future screenings.
                    </p>
                </div>
            </div>
        );
    }

    const n = scans.length;
    const W = 400, H = 180;
    const PAD_L = 55, PAD_T = 30, PAD_B = 30, PAD_R = 20;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const xOf = i => PAD_L + (i / (n - 1)) * chartW;
    const yOf = g => PAD_T + chartH - (g / 4) * chartH;

    const pts = scans.map((s, i) => `${xOf(i)},${yOf(s.grade)}`).join(' ');
    const last = scans[n - 1], first = scans[0];
    const trend = last.grade < first.grade ? { text: '↓ Improving', color: '#10B981' }
                : last.grade > first.grade ? { text: '↑ Worsening', color: '#EF4444' }
                : { text: '= Stable', color: '#F59E0B' };

    const GRADE_NAMES = ['None', 'Mild', 'Moderate', 'Severe', 'Prolif.'];

    return (
        <div className="card-elevated space-y-3">
            <div className="flex justify-between items-center">
                <p className="section-label">Patient History</p>
                <span className="text-xs text-slate-500">{n} scans recorded</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: '#0F172A', borderRadius: 8 }}>
                {/* Gridlines + Y labels */}
                {[0, 1, 2, 3, 4].map(g => (
                    <g key={g}>
                        <line x1={PAD_L} y1={yOf(g)} x2={W - PAD_R} y2={yOf(g)} stroke="#1E293B" strokeWidth="1" />
                        <text x={PAD_L - 4} y={yOf(g) + 4} textAnchor="end" fill="#475569" fontSize="9">{GRADE_NAMES[g]}</text>
                    </g>
                ))}
                {/* X axis date labels */}
                {scans.map((s, i) => (
                    <text key={i} x={xOf(i)} y={H - 5} textAnchor="middle" fill="#475569" fontSize="8">
                        {new Date(s.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </text>
                ))}
                {/* Data line */}
                <polyline points={pts} stroke="#3B82F6" strokeWidth="2" fill="none" />
                {/* Data points */}
                {scans.map((s, i) => (
                    <circle key={i} cx={xOf(i)} cy={yOf(s.grade)} r={i === n - 1 ? 7 : 6}
                        fill={GRADE_COLORS[s.grade]}
                        stroke={i === n - 1 ? 'white' : 'none'} strokeWidth="2" />
                ))}
                {/* Trend indicator */}
                <text x={W - PAD_R - 5} y={PAD_T - 5} textAnchor="end" fill={trend.color} fontSize="10" fontWeight="bold">
                    {trend.text}
                </text>
            </svg>
        </div>
    );
}
