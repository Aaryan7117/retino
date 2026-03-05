/**
 * BusinessModel.jsx
 * Section 9: Business Model Pitch Page
 * Provides a glossy, presentation-ready overview of the project's commercial viability.
 */
import React from 'react';

export default function BusinessModel() {
    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-12">

            {/* Header / Value Proposition */}
            <div className="text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-900/30 border border-violet-500/30 text-violet-300 text-sm font-bold tracking-wide uppercase shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
                    Startup Pitch deck
                </div>
                <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 drop-shadow-lg pb-2">
                    Democratizing Eyecare
                </h1>
                <p className="max-w-3xl mx-auto text-xl text-slate-400 leading-relaxed font-medium">
                    Over 70 million Indians suffer from diabetes, but screening reaches less than 10%.
                    We are replacing expensive $5000+ proprietary machines with an open-source, AI-powered smartphone suite.
                </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Target TAM", val: "$1.2B+", color: "text-emerald-400" },
                    { label: "Capex per Camp", val: "₹0", color: "text-blue-400" },
                    { label: "Cost per Scan", val: "₹10", color: "text-violet-400" },
                    { label: "Current Outreach", val: "100k+ PHCs", color: "text-amber-400" }
                ].map((stat, i) => (
                    <div key={i} className="card-elevated text-center py-6 border-slate-700/50 hover:border-slate-500 transition-colors group">
                        <div className={`text-4xl font-black ${stat.color} mb-2 drop-shadow-md group-hover:scale-110 transition-transform`}>{stat.val}</div>
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Main Sections Grid */}
            <div className="grid md:grid-cols-2 gap-8">

                {/* 1. Target Market */}
                <div className="card-elevated relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-600/20 transition-all"></div>
                    <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
                        <span className="p-2 bg-blue-900/40 text-blue-400 rounded-xl">🎯</span> Target Market
                    </h3>
                    <ul className="space-y-4 text-slate-300">
                        <li className="flex items-start gap-3">
                            <span className="text-blue-400 mt-1">▸</span>
                            <div>
                                <strong className="text-white block">Government Health Centers (PHCs)</strong>
                                Deploying the offline AI into India's 1.5 Lakh Ayushman Bharat health clinics.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-blue-400 mt-1">▸</span>
                            <div>
                                <strong className="text-white block">Rural NGO Eye Camps</strong>
                                Enabling frontline health workers to screen 500+ patients a day without internet.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-blue-400 mt-1">▸</span>
                            <div>
                                <strong className="text-white block">Private Hospital Chains</strong>
                                B2B licensing for preliminary triage before ophthalmologist review.
                            </div>
                        </li>
                    </ul>
                </div>

                {/* 2. Revenue Model */}
                <div className="card-elevated relative overflow-hidden group">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl -mr-10 -mb-10 group-hover:bg-emerald-600/20 transition-all"></div>
                    <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
                        <span className="p-2 bg-emerald-900/40 text-emerald-400 rounded-xl">💸</span> Revenue Streams
                    </h3>
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700">
                            <h4 className="font-bold text-emerald-400 mb-2.5 flex justify-between">
                                <span>1. SaaS Licensing (B2G/B2B)</span>
                                <span className="text-white">60% Rev</span>
                            </h4>
                            <p className="text-sm text-slate-400">Subscription access to Camp Dashboards, PDF reporting pipelines, and bulk offline syncing capabilities for institutions.</p>
                        </div>
                        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700">
                            <h4 className="font-bold text-emerald-400 mb-2.5 flex justify-between">
                                <span>2. Pay-per-Scan API</span>
                                <span className="text-white">40% Rev</span>
                            </h4>
                            <p className="text-sm text-slate-400">Low-cost micro-transactions (₹10/scan) for independent clinical setups using our integrated APIs.</p>
                        </div>
                    </div>
                </div>

                {/* 3. Competitive Advantage */}
                <div className="card-elevated relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl -ml-10 -mt-10 group-hover:bg-violet-600/20 transition-all"></div>
                    <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
                        <span className="p-2 bg-violet-900/40 text-violet-400 rounded-xl">⚡</span> The Moat
                    </h3>
                    <div className="space-y-5">
                        <div>
                            <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-bold text-slate-300">Offline-First Execution</span>
                                <span className="text-violet-400 font-mono">WebAssembly</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 w-[100%]"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-bold text-slate-300">Zero-Data Liability</span>
                                <span className="text-violet-400 font-mono">Local Compute</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 w-[100%]"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-bold text-slate-300">Multilingual Accessibility</span>
                                <span className="text-violet-400 font-mono">Any Language</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 w-[100%]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Ecosystem Integration */}
                <div className="card-elevated relative overflow-hidden group">
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-600/10 rounded-full blur-3xl -ml-10 -mb-10 group-hover:bg-amber-600/20 transition-all"></div>
                    <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
                        <span className="p-2 bg-amber-900/40 text-amber-400 rounded-xl">🔗</span> Ecosystem Scale
                    </h3>
                    <div className="h-full flex flex-col justify-center">
                        <p className="text-slate-300 mb-6 font-medium">
                            By integrating directly with the <strong className="text-white">Ayushman Bharat Digital Mission (ABDM)</strong> ecosystem, we instantly attach screening records to a patient's national health ID (ABHA).
                        </p>
                        <div className="flex items-center gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-700">
                            <div className="w-12 h-12 bg-amber-500/20 text-amber-500 flex items-center justify-center rounded-lg shadow-inner">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            </div>
                            <div>
                                <h4 className="text-white font-bold">Pan-India Interoperability</h4>
                                <p className="text-xs text-slate-400 mt-1">Prevents repeated scans and aggregates massive state-level public health data natively.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
