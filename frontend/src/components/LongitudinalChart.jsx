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

    if (scans.length < 2) return null;

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
