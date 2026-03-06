import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import ResultsView from './components/ResultsView';
import CampDashboard from './components/CampDashboard';
import OfflineIndicator from './components/OfflineIndicator';
import BusinessModel from './components/BusinessModel';
import ValidationMetrics from './components/ValidationMetrics';

// ─── Placeholder for sections not yet implemented ────────────────────────────
const Placeholder = ({ emoji, title, note }) => (
  <div className="max-w-2xl mx-auto py-20 text-center">
    <div className="text-6xl mb-4">{emoji}</div>
    <h1 className="text-3xl font-black text-white mb-2">{title}</h1>
    <p className="text-slate-400">{note}</p>
  </div>
);

// ─── Update-available toast ────────────────────────────────────────────────────
function UpdateToast({ wb, onDismiss }) {
  const handleUpdate = () => {
    if (wb) {
      wb.messageSkipWaiting();
    }
    onDismiss();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                    bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-2xl
                    shadow-2xl shadow-blue-900/60 border border-blue-500 animate-bounce-once">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>New version available</span>
      <button
        onClick={handleUpdate}
        className="ml-1 bg-white text-blue-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors"
      >
        Update now
      </button>
      <button
        onClick={onDismiss}
        className="text-blue-200 hover:text-white transition-colors ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ─── PWA install prompt button ─────────────────────────────────────────────────
function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(display-mode: standalone)').matches
      : false,
  );

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setPrompt(null);
    }
  };

  if (installed || !prompt) return null;

  return (
    <button
      id="install-btn"
      onClick={handleInstall}
      title="Install RetinaScan AI as an app"
      className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5
                 rounded-full border border-blue-600 bg-blue-900/40 text-blue-300
                 hover:bg-blue-800/60 hover:text-white transition-all duration-150 shrink-0"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Install App
    </button>
  );
}

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/scan', label: 'New Scan' },
  { to: '/camp', label: 'Camp Stats' },
  { to: '/business', label: 'Business' },
  { to: '/validation', label: 'Validation' },
];

export default function App() {
  const [updateWb, setUpdateWb] = useState(null);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Listen for SW update events dispatched by registerSW.js
  useEffect(() => {
    const handler = (e) => {
      setUpdateWb(e.detail);
      setShowUpdateToast(true);
    };
    window.addEventListener('sw:update-available', handler);
    return () => window.removeEventListener('sw:update-available', handler);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 flex flex-col text-slate-100">

        {/* ── Header ─────────────────────────────── */}
        <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50 shadow-xl shadow-black/40">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-3">

            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/60">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="12" cy="12" r="9" strokeDasharray="3 2" />
                </svg>
              </div>
              <div className="leading-none">
                <div className="text-white font-black text-base tracking-tight">
                  RetinaScan <span className="text-blue-400">AI</span>
                </div>
                <div className="text-slate-500 text-[10px] mt-0.5 font-medium">
                  Diabetic Retinopathy Screening
                </div>
              </div>
            </div>

            {/* Nav – desktop */}
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
              {NAV.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => {
                    if (to === '/scan') {
                      sessionStorage.removeItem('retinascan_patient_draft');
                    }
                  }}
                  className={({ isActive }) =>
                    `px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 whitespace-nowrap ${isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Desktop Install + Status */}
              <div className="hidden md:flex items-center gap-2">
                <InstallButton />
                <OfflineIndicator />
              </div>

              {/* Mobile status badge */}
              <div className="md:hidden">
                <OfflineIndicator />
              </div>

              {/* Mobile menu toggle */}
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-label="Toggle navigation menu"
              >
                <svg
                  className={`w-5 h-5 transform transition-transform duration-150 ${mobileNavOpen ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={mobileNavOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav drawer */}
          <div
            className={`md:hidden border-t border-slate-800 bg-slate-950/98 backdrop-blur-sm overflow-hidden transition-[max-height,opacity,transform] duration-200 ${
              mobileNavOpen ? 'max-h-80 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'
            }`}
          >
            <div className="px-4 py-3 space-y-3">
              <nav className="flex flex-col gap-1">
                {NAV.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={() => {
                      if (to === '/scan') {
                        sessionStorage.removeItem('retinascan_patient_draft');
                      }
                      setMobileNavOpen(false);
                    }}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`
                    }
                  >
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <InstallButton />
                {/* Connection status is already rendered above; keep this layout light */}
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ───────────────────────────────── */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<Scanner />} />
            <Route path="/results" element={<ResultsView />} />
            <Route path="/camp" element={<CampDashboard />} />
            <Route path="/business" element={<BusinessModel />} />
            <Route path="/validation" element={<ValidationMetrics />} />
          </Routes>
        </main>

        {/* ── Footer ─────────────────────────────── */}
        <footer className="border-t border-slate-800 bg-slate-950 py-4">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-semibold">© 2026 RetinaScan AI · Clustrex Hackathon</span>
            <span className="italic">AI-Assisted Screening — Not a substitute for licensed medical diagnosis</span>
          </div>
        </footer>

        {/* ── PWA Update Toast ────────────────────── */}
        {showUpdateToast && (
          <UpdateToast wb={updateWb} onDismiss={() => setShowUpdateToast(false)} />
        )}
      </div>
    </BrowserRouter>
  );
}
