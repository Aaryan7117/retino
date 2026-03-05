import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeImage } from '../utils/modelInference';
import { savePatient } from '../utils/indexedDB';

const FIELDS = [
    { id: 'name', label: 'Full Name', type: 'text', col: 2 },
    { id: 'age', label: 'Age (years)', type: 'number', col: 1 },
    { id: 'diabeticSince', label: 'Diabetic Since (yrs)', type: 'number', col: 1 },
    { id: 'contact', label: 'Mobile Number', type: 'tel', col: 2 },
];

export default function Scanner() {
    const navigate = useNavigate();
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [patient, setPatient] = useState(() => {
        try {
            const saved = sessionStorage.getItem('retinascan_patient_draft');
            return saved ? JSON.parse(saved) : { name: '', age: '', gender: 'Male', diabeticSince: '', contact: '' };
        } catch {
            return { name: '', age: '', gender: 'Male', diabeticSince: '', contact: '' };
        }
    });
    const [dragging, setDragging] = useState(false);

    // Save draft to session storage whenever form changes
    useEffect(() => {
        sessionStorage.setItem('retinascan_patient_draft', JSON.stringify(patient));
    }, [patient]);

    // AI Inference State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleFile = (file) => {
        if (!file) return;
        setImage(file);
        setPreview(URL.createObjectURL(file));
        setErrorMsg(''); // clear previous errors
    };

    const handleAnalyze = async () => {
        if (!image) return;

        // Form Validation Check
        if (!patient.name.trim() || !patient.age || !patient.contact.trim()) {
            setErrorMsg('Please fill in the Patient Name, Age, and Contact Number to continue.');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            return;
        }

        setIsAnalyzing(true);
        setErrorMsg('');

        try {
            // Run true offline inference via Web Worker
            const result = await analyzeImage(image, (msg) => setProgressMsg(msg));

            // Generate a unique Patient ID for this session
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const seq = String(Date.now()).slice(-3);
            const patientId = `TN-${dateStr}-${seq}`;

            const patientWithId = { ...patient, patientId };

            // Build the full record and persist to IndexedDB immediately
            const GRADE_LABELS = [
                'No Diabetic Retinopathy',
                'Mild Diabetic Retinopathy',
                'Moderate Diabetic Retinopathy',
                'Severe Diabetic Retinopathy',
                'Proliferative Diabetic Retinopathy',
            ];
            const RISK_MAP = ['LOW', 'LOW', 'MEDIUM', 'HIGH', 'HIGH'];

            const record = {
                id: patientId,
                name: patient.name,
                age: Number(patient.age),
                gender: patient.gender,
                diabeticSince: Number(patient.diabeticSince) || 0,
                contact: patient.contact,
                patientId,
                grade: result.grade,
                diagnosis: GRADE_LABELS[result.grade] || 'Unknown',
                confidence: result.confidence,
                risk_score: result.risk_score,
                risk: RISK_MAP[result.grade] || 'LOW',
                urgency: result.urgency || '',
                timestamp: now.toISOString(),
                heatmap_url: result.heatmap_url || null,
            };

            try {
                await savePatient(record);
            } catch (idbErr) {
                console.warn('IndexedDB save failed (non-fatal):', idbErr);
            }

            // Navigate to results page
            navigate('/results', { state: { result, patient: patientWithId, imagePreview: preview } });
        } catch (err) {
            console.error('Analysis failed:', err);
            setErrorMsg(err.message || 'Failed to analyze image. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            {/* Header */}
            <div>
                <p className="section-label">Screening</p>
                <h1 className="text-4xl font-black text-white">New Retinal Scan</h1>
                <p className="text-slate-400 text-sm mt-2">Upload a fundus photograph and fill in patient details</p>
            </div>

            {/* Upload zone */}
            <div className="card-elevated space-y-4">
                <div className="flex items-center gap-2 relative group w-max">
                    <h2 className="text-lg font-black text-white">Fundus Image</h2>
                    <svg className="w-5 h-5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {/* Tooltip */}
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 w-64 p-3 bg-slate-800 text-slate-300 text-xs rounded-xl border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-2xl">
                        Must be a valid retinal fundus photograph: a circular image of the back of the eye with characteristic dark borders.
                    </div>
                </div>
                <div
                    onClick={() => document.getElementById('img-input').click()}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-blue-500 bg-blue-900/20 scale-[1.01]' :
                        preview ? 'border-slate-600 bg-slate-700/40' :
                            'border-slate-600 hover:border-blue-500 hover:bg-blue-900/10'
                        }`}
                >
                    {preview ? (
                        <div className="space-y-2">
                            <img src={preview} alt="Retina scan" className="max-h-64 mx-auto rounded-xl shadow-xl" />
                            <p className="text-xs text-slate-400">Click to replace image</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-700 flex items-center justify-center">
                                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-bold text-white">Drop image here or click to upload</p>
                                <p className="text-sm text-slate-500 mt-1">JPG, PNG or BMP · Fundus photography recommended</p>
                            </div>
                        </div>
                    )}
                </div>
                <input id="img-input" type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])} />
            </div>

            {/* Patient form */}
            <div className="card-elevated space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-white">Patient Information</h2>
                    <button
                        onClick={() => {
                            if (confirm('Clear form data?')) {
                                setPatient({ name: '', age: '', gender: 'Male', diabeticSince: '', contact: '' });
                                setImage(null);
                                setPreview(null);
                            }
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
                    >
                        Clear Form
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {FIELDS.map(({ id, label, type }) => (
                        <div key={id}>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
                            <input type={type} value={patient[id]}
                                onChange={(e) => setPatient({ ...patient, [id]: e.target.value })}
                                className="input" placeholder={type === 'tel' ? '+91-XXXXX-XXXXX' : ''} />
                        </div>
                    ))}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Gender</label>
                        <select value={patient.gender}
                            onChange={(e) => setPatient({ ...patient, gender: e.target.value })}
                            className="input">
                            <option>Male</option><option>Female</option><option>Other</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
                <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-medium">{errorMsg}</p>
                </div>
            )}

            {/* CTA */}
            <button
                onClick={handleAnalyze}
                disabled={!image || isAnalyzing}
                className={`w-full text-base py-4 font-black tracking-wide rounded-2xl text-white transition-all flex items-center justify-center gap-3 ${isAnalyzing ? 'bg-blue-800 cursor-wait' :
                    image
                        ? 'bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-900/50 active:scale-[0.99]'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
            >
                {isAnalyzing ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {progressMsg || 'Analyzing...'}
                    </>
                ) : image ? '🔬 Analyze Retinal Image' : 'Upload an image to continue'}
            </button>
        </div>
    );
}
