import { Link } from 'react-router-dom';

const STATS = [
    { label: "Today's Scans", value: '0', icon: '📋', bg: 'bg-blue-600', glow: 'shadow-blue-900/40' },
    { label: 'High Risk', value: '0', icon: '⚠️', bg: 'bg-rose-600', glow: 'shadow-rose-900/40' },
    { label: 'Avg Scan Time', value: '—', icon: '⏱️', bg: 'bg-amber-500', glow: 'shadow-amber-900/40' },
    { label: 'Referrals Sent', value: '0', icon: '✅', bg: 'bg-emerald-600', glow: 'shadow-emerald-900/40' },
];

const FEATURES = [
    { icon: '🧠', title: 'AI-Powered Grading', bg: 'bg-blue-600/20   border-blue-700', desc: 'EfficientNetB3 on APTOS 2019 — 92% sensitivity, Grade 0–4 in under 3 seconds.' },
    { icon: '📶', title: 'True Offline Mode', bg: 'bg-violet-600/20 border-violet-700', desc: 'ONNX runs on-device. Works in zero-connectivity villages without any internet.' },
    { icon: '🇮🇳', title: 'ABDM / ABHA Ready', bg: 'bg-emerald-600/20 border-emerald-700', desc: 'Link every scan to a National ABHA Health ID. Government-deployment ready.' },
];

export default function Dashboard() {
    return (
        <div className="space-y-8">

            {/* ── Hero header ──────────────────────────────────── */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-8 shadow-2xl shadow-blue-900/30">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=60 height=60 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Ccircle cx=30 cy=30 r=1 fill=%22white%22 fill-opacity=0.07/%3E%3C/svg%3E')] opacity-60" />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="section-label text-blue-300">Welcome Back</p>
                        <h1 className="text-4xl font-black text-white mt-1">Camp Dashboard</h1>
                        <p className="text-blue-200 mt-2 text-sm">Wednesday, 4 March 2026 · Eye Camp Operations</p>
                    </div>
                    <Link to="/scan" className="btn-primary px-6 py-3 text-base whitespace-nowrap self-start sm:self-auto">
                        + New Scan
                    </Link>
                </div>
            </div>

            {/* ── Stat cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map(({ label, value, icon, bg, glow }) => (
                    <div key={label} className={`rounded-2xl p-5 flex flex-col items-center gap-2 text-center shadow-xl ${glow} ${bg}`}>
                        <span className="text-3xl">{icon}</span>
                        <span className="text-4xl font-black text-white">{value}</span>
                        <span className="text-xs font-semibold text-white/70">{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Feature cards ───────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FEATURES.map(({ icon, title, bg, desc }) => (
                    <div key={title} className={`rounded-2xl border p-5 flex gap-4 ${bg}`}>
                        <span className="text-3xl mt-0.5 shrink-0">{icon}</span>
                        <div>
                            <h3 className="font-black text-white text-sm">{title}</h3>
                            <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">{desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Patient queue ───────────────────────────────── */}
            <div className="card-elevated">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="section-label">Queue</p>
                        <h2 className="text-xl font-black text-white">Recent Patients</h2>
                    </div>
                    <Link to="/camp" className="btn-secondary text-sm">View Camp Stats →</Link>
                </div>
                <div className="flex flex-col items-center py-14 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mb-4 text-2xl">👁️</div>
                    <p className="font-bold text-white">No scans yet today</p>
                    <p className="text-slate-400 text-sm mt-1">Create your first scan to begin screening</p>
                    <Link to="/scan" className="btn-primary mt-5 px-6">Start Screening</Link>
                </div>
            </div>
        </div>
    );
}
