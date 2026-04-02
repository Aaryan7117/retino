// Auth.jsx — Authentication portal for medical professionals. Handles login and registration with Supabase.

import { useState } from "react"
import { login, signUp } from "../utils/auth"
import { supabase } from "../utils/supabaseClient"

/**
 * Auth Component
 * Provides a unified interface for medical professionals to sign in or create an account.
 * Features include password visibility toggle, error handling, and responsive split-panel design.
 */
export default function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState("login") // 'login' | 'signup' | 'reset'
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [resetSuccess, setResetSuccess] = useState(false)

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

  const handleResetPassword = async () => {
    setErrorMessage("")
    setResetSuccess(false)
    setIsAuthenticating(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setResetSuccess(true)
    } catch (err) {
      setErrorMessage(err.message)
    }
    setIsAuthenticating(false)
  }
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0A0F1E] font-['Outfit']">
      {/* LEFT PANEL: Branding and Value Proposition */}
      <div className="hidden md:flex md:w-1/2 bg-[#060B14] relative overflow-hidden flex-col justify-between p-16 border-r border-[#1F2937]">
        
        {/* Subtle dot grid pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e2937_1px,transparent_1px)] bg-[size:32px_32px] opacity-30 pointer-events-none"></div>
        
        {/* Decorative ambient gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-full h-full bg-violet-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-full h-full bg-blue-600/5 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>

        <div className="z-10 relative">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">RetinaScan <span className="text-violet-500">AI</span></h1>
          </div>
          <p className="text-slate-200 text-2xl font-bold max-w-sm leading-tight">
            Advanced Diabetic Retinopathy <span className="text-violet-400">Diagnostics</span>
          </p>
          <div className="mt-12 flex flex-col gap-5">
            {[
              { label: '92% AI Sensitivity', color: 'bg-violet-500' },
              { label: 'Grade 0–4 Classification', color: 'bg-blue-500' },
              { label: 'Cloud & Offline Sync', color: 'bg-emerald-500' }
            ].map(feat => (
              <div key={feat.label} className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-widest">
                <span className={`w-2 h-2 rounded-full ${feat.color} shadow-lg shadow-current/50`}></span>
                {feat.label}
              </div>
            ))}
          </div>
        </div>

        {/* Central Illustration: Updated Retina Scan */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-40 pointer-events-none scale-110">
          <svg viewBox="0 0 380 380" className="w-full h-full drop-shadow-[0_0_50px_rgba(124,58,237,0.2)]">
            <circle cx="190" cy="190" r="175" fill="#080D18" stroke="#1F2937" strokeWidth="1" />
            <circle cx="190" cy="190" r="150" fill="none" stroke="#1e1b4b" strokeWidth="2" strokeDasharray="4 12" className="animate-spin-slow" style={{ animationDuration: '60s' }} />
            
            {/* Blood vessels with violet/blue hues */}
            <path d="M 270 190 Q 240 140 170 110 T 70 70" fill="none" stroke="#6D28D9" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            <path d="M 270 200 Q 210 220 150 260 T 80 310" fill="none" stroke="#3B82F6" strokeWidth="5" strokeLinecap="round" opacity="0.3" />
            <path d="M 260 180 Q 190 160 120 150 T 50 130" fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
            
            <circle cx="150" cy="190" r="35" fill="#000000" opacity="0.5" filter="blur(10px)" />
            <circle cx="270" cy="190" r="45" fill="#C084FC" opacity="0.2" filter="blur(12px)" />
            <circle cx="270" cy="190" r="20" fill="#E879F9" opacity="0.4" filter="blur(4px)" />
            
            <line x1="10" y1="10" x2="370" y2="10" stroke="#8B5CF6" strokeWidth="4" className="animate-[scan_4s_ease-in-out_infinite_alternate]" strokeOpacity="0.6" />
          </svg>
        </div>

        <div className="z-10 relative">
          <div className="bg-[#111827]/50 border border-[#1F2937] rounded-2xl px-6 py-4 inline-block">
            <p className="text-[#8B5CF6] text-[10px] font-black uppercase tracking-[0.2em] mb-1">Onnx Runtime Engine</p>
            <p className="text-slate-500 text-[10px] font-mono">NEURAL_NET_V3: STATUS_ACTIVE</p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Form Controls */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-y-auto">
        {/* Mobile Background decoration */}
        <div className="md:hidden absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-violet-600/10 to-transparent pointer-events-none"></div>

        {/* Main Form Centerer */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 py-20">
          <div className="w-full max-w-md z-10 space-y-10">
            
            {/* Mobile logo */}
            <div className="md:hidden flex flex-col items-center gap-4 mb-12">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-2xl">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">RetinaScan <span className="text-violet-500">AI</span></h1>
            </div>

            <div className="text-center md:text-left space-y-2">
              <h2 className="text-4xl font-black text-white tracking-tighter">
                {isLoginMode ? "Clinician Login" : "Join the Network"}
              </h2>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
                {isLoginMode ? "Identify yourself to proceed" : "Secure portal for medical professionals"}
              </p>
            </div>

            {/* Form Card */}
            <div className="bg-[#111827] border border-[#1F2937] rounded-[32px] p-8 md:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
              
              {mode === 'reset' ? (
                <div className="space-y-6">
                  <div>
                    <label className="section-label">Medical Email</label>
                    <input
                      type="email"
                      placeholder="doctor@hospital.com"
                      className="input py-4 text-base"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); setResetSuccess(false); }}
                    />
                  </div>

                  {resetSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-2xl text-emerald-400 text-xs font-black uppercase tracking-wider text-center">
                      Check your email for instructions
                    </div>
                  )}

                  <button onClick={handleResetPassword} disabled={isAuthenticating || !email} className="w-full btn-primary py-5 rounded-2xl font-black text-base uppercase tracking-widest">
                    {isAuthenticating ? 'Sending...' : 'Authorize Reset →'}
                  </button>

                  <div className="text-center pt-4">
                    <button onClick={() => { setMode('login'); setErrorMessage(''); setResetSuccess(false); }} className="text-xs font-black text-slate-500 hover:text-violet-400 uppercase tracking-widest transition-colors">
                      ← Back to Authentication
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="section-label">Professional Email</label>
                    <input
                      type="email"
                      placeholder="doctor@hospital.com"
                      autoComplete="email"
                      className="input py-4 text-base"
                      onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); }}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="section-label ml-0">Security Code</label>
                      {isLoginMode && (
                        <button type="button" onClick={() => { setMode('reset'); setErrorMessage(''); setResetSuccess(false); }} className="text-[10px] font-black text-slate-600 hover:text-violet-400 uppercase tracking-widest transition-colors">
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={passwordVisible ? "text" : "password"}
                        placeholder="••••••••"
                        className="input py-4 pr-14 text-base"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrorMessage(""); }}
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordVisible(!passwordVisible)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-white transition-colors"
                      >
                        {passwordVisible ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/25 px-5 py-4 rounded-2xl flex items-start gap-3 text-red-400 text-[11px] font-bold leading-tight">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      {errorMessage}
                    </div>
                  )}

                  <button
                    onClick={handleAuthSubmit}
                    disabled={isAuthenticating}
                    className="w-full btn-primary py-5 rounded-2xl font-black text-base uppercase tracking-widest transition-transform active:scale-95"
                  >
                    {isAuthenticating ? (
                      <span className="flex items-center gap-3">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Verifying...
                      </span>
                    ) : (
                      isLoginMode ? "Access Portal →" : "Register Access →"
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {isLoginMode ? "No credentials?" : "Already active?"}{" "}
                      <button
                        onClick={() => { setIsLoginMode(!isLoginMode); setErrorMessage(""); }}
                        className="text-white hover:text-violet-400 transition-colors underline underline-offset-4 decoration-violet-500"
                      >
                        {isLoginMode ? "Register" : "Login"}
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Impact Bar: Now part of the flex flow at the bottom */}
        <div className="w-full pb-10 flex justify-center px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 px-10 py-5 rounded-[40px] bg-[#111827]/80 border border-[#1F2937] backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col items-center md:items-start text-center">
              <span className="text-[10px] font-black text-violet-500 uppercase tracking-[0.2em]">National Reach</span>
              <span className="text-white text-sm font-black">Deployed in 3 states</span>
            </div>
            <div className="hidden md:block w-px h-8 bg-[#1F2937]"></div>
            <div className="flex flex-col items-center md:items-start text-center">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Clinical Volume</span>
              <span className="text-white text-sm font-black">12,000+ Scans</span>
            </div>
            <div className="hidden md:block w-px h-8 bg-[#1F2937]"></div>
            <div className="flex flex-col items-center md:items-start text-center">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">AI Performance</span>
              <span className="text-white text-sm font-black text-emerald-400">94% Accuracy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

