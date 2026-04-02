import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllPatients, getQueuedRequests } from '../utils/indexedDB';

export default function Dashboard() {
    const [todayPatients, setTodayPatients] = useState([]);
    const [dashboardDate, setDashboardDate] = useState("");
    const [pendingCount, setPendingCount] = useState(0);

    const todayStr = new Date().toISOString().slice(0, 10);

    function formatDashboardDate() {
        return new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }

    async function loadPatients() {
        try {
            const all = await getAllPatients();
            const today = (all || []).filter((p) => {
                if (!p.timestamp) return false;
                const tsString = String(p.timestamp);
                return tsString.slice(0, 10) === todayStr;
            });
            setTodayPatients(today);
        } catch (err) {
            console.error('Failed to load patients for dashboard', err);
        }
    }

    useEffect(() => {
        loadPatients();
        setDashboardDate(formatDashboardDate());
        getQueuedRequests().then((q) => setPendingCount(q.length));
        
        const id = setInterval(() => {
            loadPatients();
            setDashboardDate(formatDashboardDate());
            getQueuedRequests().then((q) => setPendingCount(q.length));
        }, 5000);
        
        return () => clearInterval(id);
    }, []);

    const todayScans = todayPatients.length;
    const highRisk = todayPatients.filter((p) => (p.risk_level || p.risk) === 'HIGH').length;
    const referrals = todayPatients.filter((p) => {
        const r = p.risk_level || p.risk;
        return r === 'HIGH' || r === 'MEDIUM';
    }).length;

    return (
        <div className="space-y-10 animate-fade-in font-['Outfit']">
            
            {/* HERO SECTION */}
            <section className="relative overflow-hidden rounded-[32px] bg-[#0A0F1E] border border-[#1F2937] shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-blue-900/20 to-transparent z-0"></div>
                <div className="absolute inset-0 bg-[radial-gradient(#1e2937_1px,transparent_1px)] bg-[size:24px_24px] opacity-30 z-0"></div>
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                
                <div className="relative z-10 p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10">
                    <div className="text-center md:text-left space-y-6 max-w-xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-[0.2em]">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                            </span>
                            AI Diagnostics active
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tighter">
                            Precision <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">Diagnosis</span> <br />
                            at Scale
                        </h2>
                        <p className="text-slate-400 text-lg font-medium leading-relaxed">
                            Screen for Diabetic Retinopathy in under 60 seconds with 94% clinical accuracy. Empowering primary healthcare with mobile AI.
                        </p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                            <Link to="/scan" className="btn-primary px-8 py-4 rounded-2xl text-base shadow-2xl shadow-violet-600/30">
                                Start New Scan
                            </Link>
                            <Link to="/camp" className="btn-secondary px-8 py-4 rounded-2xl text-base">
                                View Patient Queue
                            </Link>
                        </div>
                    </div>

                    {/* Quick Stats Reveal */}
                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0">
                        <div className="bg-[#111827]/60 backdrop-blur-md border border-[#1F2937] p-6 rounded-3xl flex flex-col items-center text-center gap-1 shadow-xl">
                            <span className="text-3xl font-black text-white">{todayScans}</span>
                            <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest leading-none">Scans Today</span>
                        </div>
                        <div className="bg-[#111827]/60 backdrop-blur-md border border-[#1F2937] p-6 rounded-3xl flex flex-col items-center text-center gap-1 shadow-xl">
                            <span className="text-3xl font-black text-rose-500">{referrals}</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Referrals</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* SYNC STATUS */}
            <div className="flex justify-center">
                {!navigator.onLine ? (
                    <span className="rounded-full text-[10px] font-bold px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> Offline — Syncing Paused
                    </span>
                ) : pendingCount > 0 ? (
                    <span className="rounded-full text-[10px] font-bold px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"></span> {pendingCount} records syncing to cloud...
                    </span>
                ) : (
                    <span className="rounded-full text-[10px] font-bold px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Cloud Database Linked & Synced
                    </span>
                )}
            </div>

            {/* STATS OVERVIEW */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Patients', value: todayScans, icon: <svg className="w-6 h-6 text-violet-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
                    { label: 'AI Verifications', value: todayScans, icon: <svg className="w-6 h-6 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
                    { label: 'High Risk cases', value: highRisk, icon: <svg className="w-6 h-6 text-rose-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
                    { label: 'System Uptime', value: '99.8%', icon: <svg className="w-6 h-6 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
                ].map((stat, i) => (
                    <div key={i} className="stat-card group">
                        <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform`}>
                            {stat.icon}
                        </div>
                        <span className="text-3xl font-black text-white">{stat.value}</span>
                        <span className="section-label">{stat.label}</span>
                    </div>
                ))}
            </section>

            {/* RECENT PATIENTS QUEUE */}
            <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider">Patient Queue</h3>
                    <Link to="/camp" className="text-xs font-black text-violet-400 hover:text-white transition-colors uppercase tracking-[0.2em]">
                        View Full History →
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todayPatients.length === 0 ? (
                        <div className="col-span-full py-20 bg-[#111827] border border-[#1F2937] border-dashed rounded-[32px] flex flex-col items-center justify-center text-slate-500">
                            <div className="w-16 h-16 rounded-full bg-[#0A0F1E] flex items-center justify-center mb-4 text-2xl opacity-40">📊</div>
                            <p className="font-bold uppercase tracking-widest text-xs">No active cases in queue for {dashboardDate}</p>
                        </div>
                    ) : (
                        todayPatients.slice(0, 6).map(patient => (
                            <div key={patient.id} className="bg-[#111827] border border-[#1F2937] p-6 rounded-3xl hover:border-violet-500/30 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className="w-10 h-10 rounded-xl bg-violet-900/20 text-violet-400 flex items-center justify-center font-black text-sm group-hover:bg-violet-600 group-hover:text-white transition-all">
                                        {patient.name?.[0] || '?'}
                                    </div>
                                    <div className={`grade-pill grade-${patient.grade ?? patient.gradeOD ?? 0}`}>
                                        Grade {patient.grade ?? patient.gradeOD ?? 0}
                                    </div>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <h4 className="text-white font-black truncate text-lg">{patient.name || 'Anonymous Patient'}</h4>
                                    <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${
                                        patient.risk_level === 'HIGH' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                        patient.risk_level === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                    }`}>
                                        {patient.risk_level || 'LOW'}
                                    </span>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                                        ID: {patient.id?.slice(0, 8) || 'Unknown'} • {(() => {
                                            try {
                                                return patient.timestamp ? new Date(patient.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Time';
                                            } catch (e) {
                                                return 'Invalid Time';
                                            }
                                        })()}
                                    </p>
                                </div>
                                <div className="mt-6 flex gap-2 relative z-10">
                                    <Link to={`/results?id=${patient.id}`} className="flex-1 btn-secondary text-[10px] py-3.5 h-auto uppercase tracking-widest font-black">
                                        Open Report
                                    </Link>
                                    <button className="px-4 bg-[#0A0F1E] border border-[#1F2937] rounded-xl text-slate-400 hover:text-white transition-all">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.482 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6a3 3 0 100-2.684m0 2.684l6.632-3.316" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
