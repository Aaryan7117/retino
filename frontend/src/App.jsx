// App.jsx — Root component of the RetinaScan AI PWA. Handles routing, authentication state, and service worker updates
import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';

import Auth from './components/Auth';
import BackendIndicator from './components/BackendIndicator';
import BusinessModel from './components/BusinessModel';
import CampDashboard from './components/CampDashboard';
import Dashboard from './components/Dashboard';
import DoctorPortal from './components/DoctorPortal';
import OfflineIndicator from './components/OfflineIndicator';
import ResetPassword from './components/ResetPassword';
import ResultsView from './components/ResultsView';
import Scanner from './components/Scanner';
import ValidationMetrics from './components/ValidationMetrics';
import YoloResultsPage from './components/YoloResultsPage';

// --- NEW ONBOARDING & PROFILE COMPONENTS ---
import RoleSelect from './components/RoleSelect';
import DoctorOnboarding from './components/DoctorOnboarding';
import PatientOnboarding from './components/PatientOnboarding';
import FindDoctors from './components/FindDoctors';
import ProfilePage from './components/ProfilePage';
import ScreeningModeToggle from './components/ScreeningModeToggle';

import { logout } from './utils/auth';
import { flushSyncQueue, syncPatientsFromCloud } from './utils/indexedDB';
import { supabase } from './utils/supabaseClient';
import { loadMode, saveMode } from './utils/screeningMode';
import { ScreeningContext, useScreeningMode } from './utils/screeningContext';

/**
 * Toast notification for service worker updates.
 */
function UpdateToast({ wb, onDismiss }) {
  const handleUpdate = () => {
    if (wb) wb.messageSkipWaiting();
    onDismiss();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                    bg-violet-700 text-white text-sm font-semibold px-5 py-3 rounded-2xl
                    shadow-2xl shadow-violet-900/60 border border-violet-500 animate-bounce-once">
      <span>New update available. Refresh to update.</span>
      <button
        onClick={handleUpdate}
        className="ml-1 bg-white text-violet-700 px-3 py-1 rounded-lg text-xs font-bold"
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
    } else {
      alert("To install RetinaScan AI, tap your browser's 'Share' or 'Menu' button and select 'Add to Home Screen'.");
    }
  };

  // Hide button if already installed as PWA or if running in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone || isAlreadyInstalled) return null;

  // On mobile, if no install prompt is available (e.g. iOS Safari), hide the button
  // to avoid header clutter since it will just show an alert anyway.
  if (!installPrompt && window.innerWidth < 640) return null;

  return (
    <button
      onClick={handleInstallClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight transition-all shrink-0 ${
        isAlreadyInstalled 
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
          : 'bg-[#1F2937] border-[#374151] text-slate-300 hover:bg-[#374151] hover:text-white'
      }`}
    >
      <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {isAlreadyInstalled ? 'Installed' : 'Install App'}
    </button>
  );
}

const BASE_NAVIGATION = [
  { to: '/', label: 'Dashboard' },
  { to: '/scan', label: 'New Scan' },
  { to: '/camp', label: 'Camp Stats' },
  { to: '/business', label: 'Business' },
  { to: '/validation', label: 'Validation' },
];

/**
 * AppContent Component: Handles the Auth Gate and Main Layout.
 * Must be wrapped in BrowserRouter.
 */
function AppContent({ userSession, userProfile, setUserProfile, profileLoading, sessionChecked, waitingServiceWorker, showUpdateToast, setShowUpdateToast }) {
  // Use context for screening mode to avoid prop drilling and shadowing
  const { mode: screeningMode, setMode: setScreeningModeAndSave } = useScreeningMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const isResetPage = location.pathname === '/reset-password';

  const isPatient = userProfile?.role === 'patient';
  const isDoctor = userProfile?.role === 'doctor';
  const navItems = isPatient
    ? [...BASE_NAVIGATION, { to: '/find-doctors', label: 'Find Doctors' }]
    : isDoctor
    ? [...BASE_NAVIGATION, { to: '/doctor', label: 'Review' }]
    : BASE_NAVIGATION;

  // Auth Gate
  if (!userSession && !isResetPage) {
    return <Auth />;
  }

  // Show loading spinner while profile loads
  if (userSession && profileLoading) {
    return (
      <div className='min-h-screen bg-[#0A0F1E] flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  // Helper: consider a profile "effectively complete" if key fields are filled,
  // regardless of the profile_complete flag (which can get stuck at false due to
  // failed upserts or race conditions on mobile).
  const isEffectivelyComplete = userProfile?.profile_complete || 
    (userProfile?.role && userProfile?.full_name && userProfile?.phone);

  // If profile is effectively complete but user is still on an onboarding route, redirect to home
  if (userSession && isEffectivelyComplete && location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/" replace />;
  }

  // No profile OR no role set = show role selection
  const needsRoleSelection = userSession && !profileLoading &&
    (!userProfile || !userProfile.role);

  // Has role but onboarding not complete = redirect to onboarding
  const needsOnboarding = userSession && userProfile &&
    userProfile.role && !userProfile.profile_complete;

  if (needsRoleSelection) {
    return <RoleSelect userId={userSession.id}
      onComplete={(profile) => setUserProfile(profile)} />;
  }

  if (needsOnboarding && !location.pathname.startsWith('/onboarding')) {
    const path = userProfile.role === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient';
    return <Navigate to={path} replace />;
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col text-slate-100">
      {/* HEADER */}
      <header className="bg-[#0A0F1E] border-b border-[#1F2937] sticky top-0 z-50 pt-safe">
        <div className="max-w-[1440px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-white font-black text-sm sm:text-base leading-none tracking-tighter">
                RetinaScan <span className="text-violet-500">AI</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 hidden sm:block">
                DR Screening Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <InstallButton />
            <BackendIndicator />
            <OfflineIndicator />
            <div className="h-6 w-px bg-[#1F2937] mx-0.5 sm:mx-1 hidden sm:block"></div>
            
            <ScreeningModeToggle mode={screeningMode} onToggle={setScreeningModeAndSave} />
            
            <div className="h-6 w-px bg-[#1F2937] mx-0.5 sm:mx-1 hidden sm:block"></div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1F2937] border border-[#374151] text-slate-300 hover:bg-[#374151] hover:text-white transition-all group"
                title="Account Menu"
              >
                <svg className="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[90]" 
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#0A0F1E] rounded-2xl shadow-2xl shadow-black/80 border border-[#1F2937] overflow-hidden z-[100] animate-fade-in flex flex-col">
                    <NavLink to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-[#1F2937] hover:text-white transition-colors">
                      <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' /></svg>
                      My Profile
                    </NavLink>
                    <a href="mailto:support@retinascan.ai?subject=Feedback" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-[#1F2937] hover:text-white transition-colors border-t border-[#1F2937]/50">
                      <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' /></svg>
                      Feedback
                    </a>
                    <button onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-[#1F2937]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-[#1F2937]/50 bg-[#0A0F1E]/50 backdrop-blur-md hidden lg:block">
          <nav className="max-w-[1440px] mx-auto flex items-center gap-1 px-4 py-2">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-[#1F2937]'
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 pb-24 md:pb-8 pb-safe">
        <Suspense fallback={<div className="flex items-center justify-center p-20"><div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div></div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<Scanner />} />
            <Route path="/results" element={<ResultsView />} />
            <Route path="/camp" element={<CampDashboard />} />
            <Route path="/business" element={<BusinessModel />} />
            <Route path="/validation" element={<ValidationMetrics />} />
            <Route path="/yolo-results" element={<YoloResultsPage />} />
            <Route path="/doctor" element={
              userProfile?.role === 'doctor' 
                ? <DoctorPortal /> 
                : <Navigate to="/" replace />
            } />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path='/onboarding/doctor' element={<DoctorOnboarding userId={userSession?.id} onComplete={setUserProfile} />} />
            <Route path='/onboarding/patient' element={<PatientOnboarding userId={userSession?.id} onComplete={setUserProfile} />} />
            <Route path='/find-doctors' element={<FindDoctors />} />
            <Route path='/profile' element={<ProfilePage userId={userSession?.id} profile={userProfile} onUpdate={setUserProfile} />} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* FOOTER (desktop only) */}
      <footer className="border-t border-[#1F2937] bg-[#0A0F1E] py-4 text-center hidden md:block">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">
          © 2026 RetinaScan AI • Precision DR Diagnostics
        </p>
      </footer>

      {/* MOBILE BOTTOM NAV */}
      {(() => {
        const I_HOME = <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
        const I_SCAN = <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
        const I_DOC = <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
        const I_HIST = <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
        const I_PROF = <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

        // Build mobile nav based on role
        const mobileNavItems = isDoctor
          ? [
              { to: '/', label: 'Home', icon: I_HOME },
              { to: '/scan', label: 'Scan', icon: I_SCAN },
              { to: '/doctor', label: 'Review', icon: I_DOC },
              { to: '/camp', label: 'Records', icon: I_HIST },
              { to: '/profile', label: 'Profile', icon: I_PROF },
            ]
          : isPatient
          ? [
              { to: '/', label: 'Home', icon: I_HOME },
              { to: '/scan', label: 'Scan', icon: I_SCAN },
              { to: '/find-doctors', label: 'Doctors', icon: I_DOC },
              { to: '/camp', label: 'History', icon: I_HIST },
              { to: '/profile', label: 'Profile', icon: I_PROF },
            ]
          : [
              { to: '/', label: 'Home', icon: I_HOME },
              { to: '/scan', label: 'Scan', icon: I_SCAN },
              { to: '/camp', label: 'Records', icon: I_HIST },
              { to: '/profile', label: 'Profile', icon: I_PROF },
            ];

        return (
          <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#0A0F1E]/95 backdrop-blur-lg border-t border-[#1F2937] safe-area-bottom">
            <div className="flex items-center justify-around py-2 px-1">
              {mobileNavItems.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                      isActive ? 'text-violet-400' : 'text-slate-600 hover:text-slate-400'
                    }`
                  }
                >
                  <span className="text-lg leading-none">{icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-tighter leading-none mt-0.5">{label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        );
      })()}

      {showUpdateToast && (
        <UpdateToast wb={waitingServiceWorker} onDismiss={() => setShowUpdateToast(false)} />
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div 
            className="absolute inset-0 bg-[#060B14]/80 backdrop-blur-sm" 
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative w-full max-w-sm bg-[#111827] border border-[#1F2937] rounded-[32px] p-8 shadow-2xl animate-scale-up">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl mb-6 mx-auto">
              👋
            </div>
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-2xl font-black text-white tracking-tight">Sign Out?</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Are you sure you want to end your session? Your offline data remains safe on this device.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary py-4 rounded-xl font-black text-xs uppercase tracking-widest"
              >
                Go Back
              </button>
              <button 
                onClick={() => { setShowLogoutConfirm(false); logout(); }}
                className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-900/40 transition-all active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [waitingServiceWorker, setWaitingServiceWorker] = useState(null);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [userSession, setUserSession] = useState(null);
  
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [screeningMode, setScreeningMode] = useState('standard');

  const setScreeningModeAndSave = async (mode) => {
    setScreeningMode(mode);
    if (userSession) {
      await saveMode(userSession.id, mode);
    }
  };

  useEffect(() => {
    if (userSession) {
      loadMode(userSession.id).then(m => setScreeningMode(m));
    }
  }, [userSession]);

  async function loadUserProfile(userId) {
    if (!userId) { setProfileLoading(false); return; }
    setProfileLoading(true); 

    // Attempt local cache first for instant load.
    const cached = localStorage.getItem(`rs_profile_${userId}`);
    if (cached) {
      setUserProfile(JSON.parse(cached));
    }

    const safetyTimeout = setTimeout(() => {
      console.warn('Profile load timed out, falling back to cache');
      setProfileLoading(false);
    }, 5000);
    try {
      if (!navigator.onLine) throw new Error('Offline');
      const { data, error } = await supabase.from('profiles')
        .select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      if (data) {
        // Auto-repair: if essential fields are filled but profile_complete is false,
        // fix the flag in the database so it never triggers onboarding again.
        if (!data.profile_complete && data.role && data.full_name && data.phone) {
          console.warn('[Profile] Auto-repairing profile_complete flag');
          data.profile_complete = true;
          supabase.from('profiles')
            .update({ profile_complete: true })
            .eq('id', userId)
            .then(() => console.log('[Profile] Repaired successfully'))
            .catch(e => console.warn('[Profile] Repair failed:', e));
        }
        localStorage.setItem(`rs_profile_${userId}`, JSON.stringify(data));
        setUserProfile(data);
      } else if (!cached) {
        setUserProfile(null);
      }
    } catch (e) {
      console.error('Profile fetch failed, using cache:', e.message);
      if (!cached) setUserProfile(null);
    } finally {
      clearTimeout(safetyTimeout);
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Fix 2: persist uid to localStorage for offline IndexedDB scoping
      if (session?.user) {
        localStorage.setItem('rs_uid', session.user.id);
      }
      // Fix 3: read cached profile synchronously before async loads
      const cachedUid = session?.user?.id;
      if (cachedUid) {
        const cached = localStorage.getItem(`rs_profile_${cachedUid}`);
        if (cached) setUserProfile(JSON.parse(cached));
      }
      setUserSession(session?.user ?? null);
      if (session?.user) {
         syncPatientsFromCloud();
         loadUserProfile(session.user.id).then(() => {
           setSessionChecked(true);
         });
      } else {
         setSessionChecked(true);
         setProfileLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Avoid flashing loading state on tab return (TOKEN_REFRESHED)
      if (session?.user) {
         if (_event === 'SIGNED_IN') {
             setProfileLoading(true);
             syncPatientsFromCloud();
             loadUserProfile(session.user.id);
         }
         setUserSession(session.user);
         localStorage.setItem('rs_uid', session.user.id);
      } else {
         setUserSession(null);
         localStorage.removeItem('rs_uid');
         setUserProfile(null);
         setProfileLoading(false);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleSWUpdate = (event) => {
      setWaitingServiceWorker(event.detail);
      setShowUpdateToast(true);
    };
    window.addEventListener('sw:update-available', handleSWUpdate);
    return () => window.removeEventListener('sw:update-available', handleSWUpdate);
  }, []);

  useEffect(() => {
    const handleOnlineStatus = () => flushSyncQueue();
    window.addEventListener('online', handleOnlineStatus);
    return () => window.removeEventListener('online', handleOnlineStatus);
  }, []);

  useEffect(() => {
    const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const ping = () => fetch(`${BACKEND}/health`, { mode: 'no-cors' }).catch(() => {});
    ping();
    const keepAliveTimer = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(keepAliveTimer);
  }, []);

  return (
    <ScreeningContext.Provider value={{ mode: screeningMode, setMode: setScreeningModeAndSave }}>
      <BrowserRouter>
        <AppContent 
          userSession={userSession}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          profileLoading={profileLoading}
          sessionChecked={sessionChecked}
          waitingServiceWorker={waitingServiceWorker}
          showUpdateToast={showUpdateToast}
          setShowUpdateToast={setShowUpdateToast}
        />
      </BrowserRouter>
    </ScreeningContext.Provider>
  );
}