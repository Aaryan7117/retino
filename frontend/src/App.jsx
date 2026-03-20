// App.jsx — Root component of the RetinaScan AI PWA. Handles routing, authentication state, and service worker updates.

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';

import Auth from './components/Auth';
import BackendIndicator from './components/BackendIndicator';
import BusinessModel from './components/BusinessModel';
import CampDashboard from './components/CampDashboard';
import Dashboard from './components/Dashboard';
import DoctorPortal from './components/DoctorPortal';
import JudgeQA from './components/JudgeQA';
import OfflineIndicator from './components/OfflineIndicator';
import ResultsView from './components/ResultsView';
import Scanner from './components/Scanner';
import ValidationMetrics from './components/ValidationMetrics';
import YoloResultsPage from './components/YoloResultsPage';

import { logout } from './utils/auth';
import { flushSyncQueue } from './utils/indexedDB';
import { supabase } from './utils/supabaseClient';

/**
 * Toast notification for service worker updates.
 */
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

/**
 * Button to trigger PWA installation prompt.
 */
function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAlreadyInstalled(true);
        setInstallPrompt(null);
      }
    }
  };

  return (
    <button
      onClick={handleInstallClick}
      className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
        isAlreadyInstalled 
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {isAlreadyInstalled ? 'Installed' : 'Install App'}
    </button>
  );
}

const NAVIGATION_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/scan', label: 'New Scan' },
  { to: '/camp', label: 'Camp Stats' },
  { to: '/business', label: 'Business' },
  { to: '/validation', label: 'Validation' },
];

export default function App() {
  const [waitingServiceWorker, setWaitingServiceWorker] = useState(null);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [userSession, setUserSession] = useState(null);

  /**
   * Effect: Auth State Listener
   * Initial check for current user and subscription to auth state changes in Supabase.
   */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserSession(data?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserSession(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  /**
   * Effect: Service Worker Update Listener
   * Listens for custom 'sw:update-available' event to prompt user for a refresh.
   */
  useEffect(() => {
    const handleSWUpdate = (event) => {
      setWaitingServiceWorker(event.detail);
      setShowUpdateToast(true);
    };
    window.addEventListener('sw:update-available', handleSWUpdate);
    return () => window.removeEventListener('sw:update-available', handleSWUpdate);
  }, []);

  /**
   * Effect: Online Sync Listener
   * Automatically flushes the IndexedDB sync queue when the application regains internet connectivity.
   */
  useEffect(() => {
    const handleOnlineStatus = () => {
      console.log("🌐 Application back online. Syncing queued requests...");
      flushSyncQueue();
    };

    window.addEventListener('online', handleOnlineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
    };
  }, []);

  /**
   * Effect: Backend Keep-Alive Ping
   * Pings the backend /health endpoint every 10 minutes to prevent Render free tier
   * from spinning down. Also fires immediately on app load to wake the server early,
   * so the first scan doesn't hit a cold start delay.
   */
  useEffect(() => {
    const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const ping = () => fetch(`${BACKEND}/health`, { mode: 'no-cors' }).catch(() => {});
    // Wake the backend immediately when the app opens
    ping();
    // Then keep it warm every 10 minutes
    const keepAliveTimer = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(keepAliveTimer);
  }, []);

  // Guard: Redirect to Authentication if no user session exists
  if (!userSession) {
    return <Auth />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 flex flex-col text-slate-100">

        {/* HEADER */}
        <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">

          {/* Row 1: Logo + Action Buttons */}
          <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">

            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex flex-col justify-center">
                <div className="text-white font-black text-base leading-tight tracking-tight">
                  RetinaScan <span className="text-blue-500">AI</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold leading-none mt-0.5 hidden sm:block">
                  Diabetic Retinopathy Screening
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <InstallButton />
              <BackendIndicator />
              <OfflineIndicator />
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-all"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Row 2: Scrollable Nav Tabs (visible on all screen sizes) */}
          <div className="border-t border-slate-800/60 overflow-x-auto scrollbar-hide">
            <nav className="flex items-center gap-1 px-4 py-1.5 min-w-max">
              {NAVIGATION_ITEMS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `px-4 py-1.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                        : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
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
          </Routes>
        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 bg-slate-950 py-3 text-center text-xs text-slate-500">
          © 2026 RetinaScan AI
        </footer>

        {showUpdateToast && (
          <UpdateToast wb={waitingServiceWorker} onDismiss={() => setShowUpdateToast(false)} />
        )}
      </div>
    </BrowserRouter>
  );
}