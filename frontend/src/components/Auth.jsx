// Auth.jsx — Authentication portal for medical professionals. Handles login and registration with Supabase.

import { useState } from "react"
import { login, signUp } from "../utils/auth"

/**
 * Auth Component
 * Provides a unified interface for medical professionals to sign in or create an account.
 * Features include password visibility toggle, error handling, and responsive split-panel design.
 */
export default function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  /**
   * Handles the submission of the authentication form.
   * Dispatches to either the login or signUp utility based on the current mode.
   */
  const handleAuthSubmit = async () => {
    setErrorMessage("")
    setIsAuthenticating(true)
    try {
      if (isLoginMode) {
        await login(email, password)
      } else {
        await signUp(email, password)
      }
    } catch (err) {
      setErrorMessage(err.message)
    }
    setIsAuthenticating(false)
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900">
      {/* LEFT PANEL: Branding and Value Proposition */}
      <div className="hidden md:flex md:w-1/2 bg-slate-950 relative overflow-hidden flex-col justify-between p-12 border-r border-slate-800/80">
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>
        
        {/* Decorative ambient gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/30 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-900/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>

        <div className="z-10 relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-blue-900/50">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">RetinaScan <span className="text-blue-500">AI</span></h1>
          </div>
          <p className="text-slate-300 text-xl font-medium max-w-md leading-snug">
            Screening diabetic retinopathy in rural India
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 92% sensitivity
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Grade 0–4 classification
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Works Offline
            </div>
          </div>
        </div>

        {/* Central Illustration: Interactive Retinal Scan Visualization */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] opacity-80 pointer-events-none">
          <svg viewBox="0 0 380 380" className="w-full h-full drop-shadow-2xl">
            {/* Outer dark retina bounds */}
            <circle cx="190" cy="190" r="170" fill="#0f172a" />
            
            {/* Concentric scan rings */}
            <circle cx="190" cy="190" r="150" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeDasharray="4 8" className="animate-spin-slow" style={{ animationDuration: '30s' }} />
            <circle cx="190" cy="190" r="110" fill="none" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="2 6" opacity="0.5" />
            <circle cx="190" cy="190" r="70" fill="none" stroke="#1e3a8a" strokeWidth="1" opacity="0.3" />

            {/* Blood vessels radiating from optic disc */}
            <path d="M 270 190 Q 240 140 170 110 T 70 70" fill="none" stroke="#ea580c" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            <path d="M 270 200 Q 210 220 150 260 T 80 310" fill="none" stroke="#f87171" strokeWidth="5" strokeLinecap="round" opacity="0.3" />
            <path d="M 260 180 Q 190 160 120 150 T 50 130" fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
            <path d="M 265 210 Q 220 270 170 290 T 100 330" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            <path d="M 275 195 Q 250 205 210 180 T 130 170" fill="none" stroke="#f87171" strokeWidth="2" opacity="0.4" />
            
            {/* Macula (central dark area) */}
            <circle cx="150" cy="190" r="30" fill="#000000" opacity="0.4" filter="blur(8px)" />
            
            {/* Optic Disc (Bright entry point) */}
            <circle cx="270" cy="190" r="40" fill="#fcd34d" opacity="0.8" filter="blur(6px)" />
            <circle cx="270" cy="190" r="25" fill="#fef08a" filter="blur(2px)" />
            
            {/* Scanning line animation */}
            <line x1="10" y1="10" x2="370" y2="10" stroke="#3b82f6" strokeWidth="3" className="animate-[scan_3s_ease-in-out_infinite]" strokeOpacity="0.8" />
            <defs>
              <style>
                {`
                  @keyframes scan {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(350px); }
                  }
                  .animate-spin-slow { animation: spin 40s linear infinite; }
                `}
              </style>
            </defs>
          </svg>
        </div>

        <div className="z-10 relative mt-auto">
          <p className="text-slate-500 text-xs font-mono">
            System initialization... ONNX Runtime ready.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL: Form Controls */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 relative">
        <div className="w-full max-w-md space-y-8">
          
          {/* Mobile logo (hidden on desktop screens) */}
          <div className="md:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-white">RetinaScan <span className="text-blue-500">AI</span></h1>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-black text-white tracking-tight">
              {isLoginMode ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-slate-400 mt-2 text-sm font-semibold">
              {isLoginMode ? "Sign in to access the clinician portal" : "Register as a medical professional"}
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <input
                  type="email"
                  placeholder="doctor@clinic.com"
                  autoComplete="email"
                  className="w-full px-5 py-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete={isLoginMode ? "current-password" : "new-password"}
                    className="w-full px-5 py-3.5 pr-12 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                    onChange={(e) => { setPassword(e.target.value); setErrorMessage(""); }}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
                  >
                    {passwordVisible ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/50 px-4 py-3 rounded-xl flex items-center gap-3 text-red-400 text-sm font-bold animate-shake">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleAuthSubmit}
                disabled={isAuthenticating}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all text-white font-black text-base py-4 rounded-xl shadow-lg shadow-blue-900/40 relative overflow-hidden group disabled:opacity-70"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isAuthenticating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Authenticating...
                    </>
                  ) : (
                    isLoginMode ? "Sign In to Portal →" : "Register Account →"
                  )}
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm font-medium text-slate-400">
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => { setIsLoginMode(!isLoginMode); setErrorMessage(""); }}
                  className="text-white hover:text-blue-400 transition-colors font-bold underline decoration-blue-500/30 underline-offset-4"
                >
                  {isLoginMode ? "Sign Up" : "Log In"}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Global Impact / Stats Bar */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center w-full px-6">
          <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-slate-800/50 border border-slate-700 backdrop-blur-md">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><span className="text-xl leading-none -mt-0.5">🏥</span> Deployed in 3 states</span>
            <span className="w-1 h-1 rounded-full bg-slate-600 hidden md:block"></span>
            <span className="text-xs font-bold text-slate-300 hidden md:inline">12,000+ scans</span>
            <span className="w-1 h-1 rounded-full bg-slate-600 hidden md:block"></span>
            <span className="text-xs font-bold text-slate-300 text-emerald-400 hidden md:inline">94% referral accuracy</span>
          </div>
        </div>
      </div>
    </div>
  )
}