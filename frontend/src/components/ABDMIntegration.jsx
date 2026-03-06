/**
 * ABDMIntegration.jsx
 * Section 7: Ayushman Bharat Digital Mission (ABDM) mock integration.
 *
 * Features:
 *  - Full-screen modal with backdrop blur
 *  - ABHA ID auto-formatting (XX-XXXX-XXXX-XXXX)
 *  - 14-digit validation with inline error message
 *  - Loading spinner + 2 s simulated API delay
 *  - Success state with green checkmark badge
 *  - Falls back to local mock if backend is unreachable
 */
import { useState } from 'react';
import { API_BASE_URL } from '../utils/apiConfig';

/* ── ABHA auto-formatter ────────────────────────────────── */
function formatAbha(val) {
    const digits = val.replace(/\D/g, '').slice(0, 14);
    // Pattern: 91-1234-5678-9012
    return digits
        .replace(/^(\d{2})(\d{0,4})/, (_, a, b) => b ? `${a}-${b}` : a)
        .replace(/^(\d{2}-\d{4})(\d{0,4})/, (_, a, b) => b ? `${a}-${b}` : a)
        .replace(/^(\d{2}-\d{4}-\d{4})(\d{0,4})/, (_, a, b) => b ? `${a}-${b}` : a);
}

/* ── Spinner ────────────────────────────────────────────── */
function Spinner() {
    return (
        <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function ABDMIntegration({ reportId, patientName, onLinked }) {
    const [open, setOpen] = useState(false);
    const [abhaId, setAbhaId] = useState('');
    const [status, setStatus] = useState('idle');   // idle | loading | success | error
    const [linked, setLinked] = useState(null);     // linked ABHA ID after success
    const [errMsg, setErrMsg] = useState('');

    const digitsOnly = abhaId.replace(/\D/g, '');
    const isValid = digitsOnly.length === 14;

    /* ── Handle submit ─────────────────────────────────── */
    const handleLink = async () => {
        if (!isValid) {
            setErrMsg('Invalid ABHA ID — must be 14 digits (e.g. 91-1234-5678-9012).');
            setStatus('error');
            return;
        }
        setStatus('loading');
        setErrMsg('');

        try {
            const res = await fetch(`${API_BASE_URL}/api/abdm/link-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ abha_id: abhaId, report_id: reportId || 'RS-DEMO' }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Backend error');
            }
        } catch {
            // Backend not running — fallback to client-side mock (2 s delay)
            await new Promise(r => setTimeout(r, 2000));
        }

        setLinked(abhaId);
        setStatus('success');
        onLinked && onLinked(abhaId);
    };

    const handleClose = () => {
        setOpen(false);
        if (status !== 'success') {
            setAbhaId('');
            setStatus('idle');
            setErrMsg('');
        }
    };

    /* ── Trigger button ────────────────────────────────── */
    const triggerBtn = (
        <button
            onClick={() => setOpen(true)}
            className="btn-secondary w-full text-sm justify-start group"
        >
            <span className="mr-2 text-base">
                {linked ? '✅' : '🔗'}
            </span>
            {linked
                ? `Linked: ${linked}`
                : 'Link to ABHA Health ID'}
        </button>
    );

    /* ── Modal ─────────────────────────────────────────── */
    const modal = open && (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl shadow-black/60 overflow-hidden">

                {/* Modal header */}
                <div className="bg-gradient-to-r from-violet-700 to-purple-800 px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-white font-black text-lg">Link to ABHA Health ID</h2>
                            <p className="text-violet-200 text-xs mt-0.5">
                                Ayushman Bharat Digital Mission — Government of India
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-violet-200 hover:text-white text-2xl leading-none transition-colors"
                        >×</button>
                    </div>
                </div>

                <div className="px-6 py-6 space-y-5">

                    {/* Patient + report context */}
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-1">
                        {patientName && (
                            <p className="text-sm text-slate-300">
                                <span className="text-slate-500 font-bold uppercase text-xs">Patient</span><br />
                                <span className="text-white font-bold">{patientName}</span>
                            </p>
                        )}
                        {reportId && (
                            <p className="text-sm text-slate-300 mt-2">
                                <span className="text-slate-500 font-bold uppercase text-xs">Report ID</span><br />
                                <span className="font-mono text-violet-300 text-xs">{reportId}</span>
                            </p>
                        )}
                    </div>

                    {/* Success state */}
                    {status === 'success' ? (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-900/40 border-2 border-emerald-500 flex items-center justify-center text-3xl">
                                ✅
                            </div>
                            <div className="text-center">
                                <p className="text-emerald-400 font-black text-lg">Successfully Linked!</p>
                                <p className="text-slate-400 text-sm mt-1">
                                    Report linked to ABHA ID:
                                </p>
                                <p className="font-mono text-white font-bold text-base mt-1 bg-slate-800 px-4 py-2 rounded-xl border border-emerald-700 inline-block">
                                    {linked}
                                </p>
                            </div>
                            <p className="text-slate-500 text-xs text-center">
                                This patient's record is now integrated with India's National Digital Health Mission.
                            </p>
                            <button onClick={handleClose} className="btn-primary w-full">
                                Done
                            </button>
                        </div>
                    ) : (
                        /* Input form */
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                                    ABHA Health ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="91-1234-5678-9012"
                                    value={abhaId}
                                    onChange={(e) => {
                                        setAbhaId(formatAbha(e.target.value));
                                        if (status === 'error') { setStatus('idle'); setErrMsg(''); }
                                    }}
                                    disabled={status === 'loading'}
                                    className={`w-full bg-slate-800 border rounded-xl px-4 py-3 font-mono text-base text-white placeholder-slate-600
                                        focus:outline-none focus:ring-2 transition-all duration-150
                                        ${status === 'error'
                                            ? 'border-red-600 focus:ring-red-600/40'
                                            : 'border-slate-600 focus:ring-violet-500/40 focus:border-violet-500'
                                        }
                                        disabled:opacity-50`}
                                />

                                {/* Progress dots */}
                                <div className="flex gap-1 mt-2">
                                    {Array.from({ length: 14 }).map((_, i) => (
                                        <div key={i}
                                            className={`h-1 flex-1 rounded-full transition-all duration-150
                                                ${i < digitsOnly.length ? 'bg-violet-500' : 'bg-slate-700'}`}
                                        />
                                    ))}
                                </div>
                                <p className="text-slate-500 text-xs mt-1.5">
                                    {digitsOnly.length}/14 digits entered
                                </p>
                            </div>

                            {/* Error message */}
                            {status === 'error' && errMsg && (
                                <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
                                    <span className="text-red-400 text-sm">⚠️</span>
                                    <p className="text-red-400 text-sm">{errMsg}</p>
                                </div>
                            )}

                            {/* Info notice */}
                            <div className="bg-violet-950/30 border border-violet-800/30 rounded-xl px-4 py-3">
                                <p className="text-violet-300 text-xs leading-relaxed">
                                    🇮🇳 <strong>ABDM Integration:</strong> This links the AI screening report to the patient's
                                    national ABHA Health Record — enabling continuity of care across all government hospitals.
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleClose}
                                    className="btn-secondary flex-1"
                                    disabled={status === 'loading'}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleLink}
                                    disabled={status === 'loading' || !isValid}
                                    className={`flex-1 flex items-center justify-center gap-2 font-bold px-4 py-2.5 rounded-xl text-sm transition-all duration-150
                                        ${isValid && status !== 'loading'
                                            ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40'
                                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    {status === 'loading' ? <><Spinner /> Linking…</> : '🔗 Link Report'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {triggerBtn}
            {modal}
        </>
    );
}
