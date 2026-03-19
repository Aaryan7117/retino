import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import ResultsView from './components/ResultsView';
import CampDashboard from './components/CampDashboard';
import OfflineIndicator from './components/OfflineIndicator';
import BackendIndicator from './components/BackendIndicator';
import BusinessModel from './components/BusinessModel';
import ValidationMetrics from './components/ValidationMetrics';
import YoloResultsPage from './components/YoloResultsPage';
import DoctorPortal from './components/DoctorPortal';
import JudgeQA from './components/JudgeQA';
import { flushSyncQueue } from './utils/indexedDB';
// NEW IMPORTS
import Auth from './components/Auth';
import { supabase } from './utils/supabaseClient';
import { logout } from './utils/auth';
import DoctorDashboard from './components/DoctorDashboard';

// --- Update-available toast ----
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
      <span>New update available. Refresh to update.</span>
      <button
        onClick={handleUpdate}
        className="ml-1 bg-white text-blue-700 px-3 py-1 rounded-lg text-xs font-bold"
      >
        Refresh
      </button>
      <button onClick={onDismiss}>✕</button>
    </div>
  );
}

function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setPrompt(null);
      }
    }
  };

  return (
    <button onClick={handleInstall}>
      {installed ? 'Installed' : 'Install App'}
    </button>
  );
}

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/scan', label: 'New Scan' },
  { to: '/camp', label: 'Camp Stats' },
  { to: '/business', label: 'Business' },
  { to: '/validation', label: 'Validation' },
  { to: '/doctor-dashboard', label: 'Doctor Dashboard' },
];

export default function App() {
  const [updateWb, setUpdateWb] = useState(null);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // NEW: user state
  const [user, setUser] = useState(null);

  // NEW: Auth listener
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Existing SW update listener
  useEffect(() => {
    const handler = (e) => {
      setUpdateWb(e.detail);
      setShowUpdateToast(true);
    };
    window.addEventListener('sw:update-available', handler);
    return () => window.removeEventListener('sw:update-available', handler);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 Back online. Syncing...");
      flushSyncQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // ✅ BLOCK APP IF NOT LOGGED IN
  if (!user) {
    return <Auth />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 flex flex-col text-slate-100">

        {/* HEADER */}
        <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

            <div className="text-white font-bold">
              RetinaScan <span className="text-blue-400">AI</span>
            </div>

            <nav className="hidden md:flex gap-2">
              {NAV.map(({ to, label }) => (
                <NavLink key={to} to={to}>
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <InstallButton />
              <BackendIndicator />
              <OfflineIndicator />

              {/* ✅ Logout Button */}
              <button
                onClick={logout}
                className="bg-red-600 px-3 py-1 rounded text-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<Scanner />} />
            <Route path="/results" element={<ResultsView />} />
            <Route path="/camp" element={<CampDashboard />} />
            <Route path="/business" element={<BusinessModel />} />
            <Route path="/validation" element={<ValidationMetrics />} />
            <Route path="/yolo-results" element={<YoloResultsPage />} />
            <Route path="/doctor" element={<DoctorPortal />} />
            <Route path="/qa" element={<JudgeQA />} />
            <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
          </Routes>
        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 bg-slate-950 py-3 text-center text-xs text-slate-500">
          © 2026 RetinaScan AI
        </footer>

        {showUpdateToast && (
          <UpdateToast wb={updateWb} onDismiss={() => setShowUpdateToast(false)} />
        )}
      </div>
    </BrowserRouter>
  );
}