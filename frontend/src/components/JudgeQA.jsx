/**
 * JudgeQA.jsx — Feature 9: Hidden Judge Q&A Page
 * Route: /qa  (not in nav, shared as hidden link before demos)
 */
import { useState } from 'react';

const QA_DATA = [
    {
        category: 'Technical',
        q: 'How does the AI model work offline without internet?',
        a: 'We use ONNX Runtime Web via WebAssembly to run a trained EfficientNetB3 model directly in the browser. The model (~25 MB) is cached by a Vite PWA service worker during the first visit, so all subsequent inference is 100% offline—zero cloud calls.',
    },
    {
        category: 'Technical',
        q: 'What is the model accuracy? How was it validated?',
        a: 'The EfficientNetB3 grading model achieves 88–92% accuracy on the Kaggle EyePACS dataset (5-class DR grading). The YOLOv8 lesion detector achieves 0.78 mAP50 on the APTOS 2019 dataset. We report sensitivity/specificity rather than accuracy alone because the dataset is imbalanced.',
    },
    {
        category: 'Technical',
        q: 'What is Score-CAM and why is it better than Grad-CAM?',
        a: 'Score-CAM is a gradient-free saliency method. It upsamples feature maps, masks the input with each map, measures the score change, and weights the maps accordingly. Unlike Grad-CAM, it does not depend on gradient flow and thus avoids saturation artefacts—giving cleaner, more faithful heatmaps for ophthalmologist trust.',
    },
    {
        category: 'Technical',
        q: 'How do you handle dual-eye (OD + OS) scanning?',
        a: 'Scanner.jsx runs two independent inference passes—one per eye—via the Web Worker. The overall patient grade is set to max(OD grade, OS grade), following clinical ETDRS convention. Both eye heatmaps are stored in the IndexedDB record under rightEye and leftEye sub-objects.',
    },
    {
        category: 'Clinical',
        q: 'Is this cleared as a medical device (FDA/CDSCO)?',
        a: 'RetinaScan AI is currently an AI-assisted screening tool, not a cleared diagnostic device. All results carry a clinical disclaimer. Our roadmap includes Class II SaMD clearance under CDSCO\'s Digital Health dossier. For competition purposes, it operates as a decision-support aid under supervision of a licensed ophthalmologist.',
    },
    {
        category: 'Clinical',
        q: 'How do you prevent false negatives from missing severe DR?',
        a: 'Three safety layers: (1) The fundus validator rejects non-retinal images before inference. (2) A confidence < 70% triggers a "borderline" warning and mandatory referral message regardless of grade. (3) The Doctor Review Portal flags all Grade 2+ patients for ophthalmologist confirmation before final record.',
    },
    {
        category: 'Clinical',
        q: 'What clinical data do you store and how is it protected?',
        a: 'All data is stored exclusively in browser IndexedDB on the device—never sent to a server. Name, age, contact, grade, and heatmap blobs are persisted locally. ABDM FHIR export is opt-in and patient-consented. There is zero cloud telemetry.',
    },
    {
        category: 'Business',
        q: 'What is the go-to-market strategy?',
        a: 'B2G: Government health camps under NPCB and NHM — free scan, ₹10/scan data fee for bulk analytics dashboards. B2B: Private hospital chains for preliminary triage — SaaS licensing at ₹999/month per site. B2C: ABDM-linked patient history for repeat screening. We target 1,000 PHCs in TamilNadu as Phase 1.',
    },
    {
        category: 'Business',
        q: 'How does this compare to existing solutions like Google\'s EyeDR?',
        a: 'Google\'s EyeDR (now Verily) requires cloud connectivity, a $5,000+ fundus camera, and trained technicians. RetinaScan AI runs on any Android smartphone in airplane mode, requires no proprietary hardware, and is open-source. Our cost per screen is ₹10 vs ₹800–1200 for existing solutions.',
    },
    {
        category: 'Business',
        q: 'What are the revenue projections?',
        a: '3-year forecast: Year 1 — 50 camps × 200 scans/day × 260 camp-days = 2.6M scans → ₹2.6Cr. Year 2 — 500 camps → ₹26Cr. Year 3 — National deployment + hospital SaaS → ₹120Cr. Revenue Calculator in our Business Model section lets you tune these assumptions live.',
    },
    {
        category: 'Impact',
        q: 'Why diabetic retinopathy? Why India?',
        a: '77 million Indians are diabetic — second highest globally. Only 10% get regular eye screenings. DR is the leading cause of preventable blindness in working-age adults. Early detection (Grade 0-1) is 95% reversible with laser photocoagulation. We eliminate the #1 barrier: cost + distance to specialist.',
    },
    {
        category: 'Impact',
        q: 'How do you ensure equity for low-literacy rural users?',
        a: 'The Voice Guide (Web Speech API) reads out diagnosis and instructions in the patient\'s vernacular language. We support 8 Indian languages with phone-number-based patient ID (no literacy needed for registration). The UI is icon-first with WCAG AA contrast ratios.',
    },
    {
        category: 'Differentiators',
        q: 'What makes your project unique compared to other hackathon entries?',
        a: 'Five hard technical differentiators: (1) True offline-first ONNX inference — no internet needed for AI. (2) Dual-eye scanning with per-eye heatmaps. (3) Score-CAM saliency — clinically explainable AI. (4) IndexedDB-persistent heatmap blobs — survives page reload. (5) ABDM FHIR integration — national health record linkage.',
    },
];

const CATEGORIES = ['All', ...new Set(QA_DATA.map(q => q.category))];

export default function JudgeQA() {
    const [filter, setFilter] = useState('All');
    const [open, setOpen] = useState(null);
    const [search, setSearch] = useState('');

    const shown = QA_DATA.filter(item => {
        const matchCat = filter === 'All' || item.category === filter;
        const matchSearch = !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-900/30 border border-violet-700/50 text-violet-300 text-xs font-bold mb-4">
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    Judges Only · Hidden from nav
                </div>
                <h1 className="text-4xl font-black text-white">Q&A Cheat Sheet</h1>
                <p className="text-slate-400 text-sm mt-2">Prepared answers for common judge questions — tap to expand</p>
            </div>

            {/* Search */}
            <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="input w-full"
            />

            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setFilter(cat)}
                        className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${
                            filter === cat
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}>
                        {cat}
                    </button>
                ))}
            </div>

            {/* Accordion */}
            <div className="space-y-3">
                {shown.length === 0 && (
                    <div className="card-elevated text-center py-10 text-slate-500">No questions match your filter.</div>
                )}
                {shown.map((item, idx) => {
                    const id = `${item.category}-${idx}`;
                    const isOpen = open === id;
                    return (
                        <div key={id} className={`card-elevated transition-all ${isOpen ? 'border-blue-700/50' : ''}`}>
                            <button
                                onClick={() => setOpen(isOpen ? null : id)}
                                className="w-full flex justify-between items-start gap-4 text-left"
                            >
                                <div className="flex-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${
                                        { Technical: 'bg-blue-900 text-blue-300', Clinical: 'bg-red-900 text-red-300', Business: 'bg-emerald-900 text-emerald-300', Impact: 'bg-amber-900 text-amber-300', Differentiators: 'bg-violet-900 text-violet-300' }[item.category] || 'bg-slate-800 text-slate-400'
                                    }`}>{item.category}</span>
                                    <span className={`font-bold text-sm ${isOpen ? 'text-white' : 'text-slate-200'}`}>{item.q}</span>
                                </div>
                                <span className={`text-slate-500 text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            {isOpen && (
                                <div className="mt-4 pt-4 border-t border-slate-700">
                                    <p className="text-slate-300 text-sm leading-relaxed">{item.a}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="text-center pt-4">
                <a href="/" className="text-xs text-slate-600 hover:text-blue-400 transition-colors">← Back to Dashboard</a>
            </div>
        </div>
    );
}
