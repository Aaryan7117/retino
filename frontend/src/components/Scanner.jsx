// Scanner.jsx — Main screening interface for capturing fundus images and running AI analysis
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeImage } from '../utils/modelInference';
import { savePatient, logAudit, blobToBase64 } from '../utils/indexedDB';
import { generateCombinedHeatmap } from '../utils/imageUtils';
import AutoRetinaCam from './AutoRetinaCam';

const FORM_FIELDS = [
    { id: 'name', label: 'Full Name', type: 'text', col: 2 },
    { id: 'age', label: 'Age (years)', type: 'number', col: 1 },
    { id: 'diabeticSince', label: 'Diabetic Since (yrs)', type: 'number', col: 1 },
    { id: 'contact', label: 'Mobile Number', type: 'tel', col: 2 },
    { id: 'abhaId', label: 'ABHA Insurance ID (optional)', type: 'text', col: 2 },
];

/**
 * Sub-component for uploading or capturing an image for a specific eye.
 */
function EyeUploadZone({ label, eyeKey, currentImageData, onSet, onClear }) {
    const fileInputRef = useRef(null);
    if (currentImageData) return (
        <div className='relative rounded-3xl overflow-hidden border-2 border-emerald-500/30 group animate-fade-in aspect-square shadow-2xl shadow-emerald-500/5 bg-[#0A0F1E]'>
            <img src={currentImageData.preview} className='w-full h-full object-cover grayscale-[0.2] transition-all group-hover:grayscale-0 group-hover:scale-105' alt={label} />
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] via-transparent to-transparent opacity-60"></div>
            
            <div className="absolute top-4 left-4 flex flex-col gap-1">
                <span className='bg-violet-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl border border-violet-400/30 shadow-lg'>{label}</span>
                <span className='w-fit bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest shadow-lg'>Verified ✓</span>
            </div>

            <button 
                onClick={onClear} 
                className='absolute top-4 right-4 w-10 h-10 bg-rose-600/90 backdrop-blur-md text-white rounded-2xl flex items-center justify-center border border-rose-400/30 hover:bg-rose-500 transition-all font-black shadow-lg scale-90 hover:scale-100'
                title="Discard Scan"
            >
                ✕
            </button>
            
            <div className="absolute bottom-4 left-0 right-0 px-4 text-center">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest drop-shadow-md">Scan Ready for Analysis</p>
            </div>
        </div>
    );
    return (
        <div className='border-2 border-dashed border-[#1F2937] bg-[#0A0F1E]/50 rounded-[40px] aspect-square flex flex-col items-center justify-center p-8 text-center hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group cursor-pointer'>
            <div className="w-16 h-16 rounded-3xl bg-[#111827] border border-[#1F2937] flex items-center justify-center text-3xl mb-6 shadow-inner group-hover:scale-110 transition-transform">
                {eyeKey === 'right' ? '👁️' : '👁️‍🗨️'}
            </div>
            <div className='text-white text-sm font-black uppercase tracking-[0.2em] mb-2 leading-none'>{label}</div>
            <div className='text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-8'>Internal Fundus Photography</div>
            
            <div className='flex flex-col w-full gap-3'>
                <button onClick={() => fileInputRef.current?.click()}
                    className='btn-secondary py-3 text-[10px] uppercase tracking-widest font-black w-full border-[#1F2937] hover:border-violet-500/30'>
                    Upload File
                </button>
                <div className="flex items-center gap-2 w-full px-2">
                    <div className="h-px flex-1 bg-[#1F2937]"></div>
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">or</span>
                    <div className="h-px flex-1 bg-[#1F2937]"></div>
                </div>
                <button onClick={() => onSet('camera')}
                    className='btn-primary py-3 text-[10px] uppercase tracking-widest font-black w-full shadow-lg shadow-violet-900/20'>
                    📷 Use Camera
                </button>
            </div>
            
            <input ref={fileInputRef} type='file' accept='image/*' className='hidden'
                onChange={e => {
                    const selectedFile = e.target.files[0]; if (!selectedFile) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_DIM = 1024;
                            let { width, height } = img;
                            if (width > MAX_DIM || height > MAX_DIM) {
                                const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                                width = Math.round(width * ratio);
                                height = Math.round(height * ratio);
                            }
                            canvas.width = width; canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                            const base64 = dataUrl.split(',')[1];
                            const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                            const newFile = new File([binary], selectedFile.name || 'scan.jpg', { type: 'image/jpeg' });
                            onSet({ file: newFile, preview: dataUrl });
                        };
                        img.src = ev.target.result;
                    };
                    reader.readAsDataURL(selectedFile);
                }} />
        </div>
    );
}

export default function Scanner() {
    const navigate = useNavigate();

    // -- State --
    const [rightEye, setRightEye] = useState(null);  // {file, preview}
    const [leftEye, setLeftEye] = useState(null);    // {file, preview}
    const [activeEye, setActiveEye] = useState('right');
    const [showCamera, setShowCamera] = useState(null); // 'right' | 'left' | null
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const [patientData, setPatientData] = useState(() => {
        const saved = sessionStorage.getItem('retinascan_patient_draft');
        return saved ? JSON.parse(saved) : { name: '', age: '', gender: 'Male', diabeticSince: '', contact: '', abhaId: '' };
    });

    // Save/Restore image previews to/from session storage (PWA persistence)
    useEffect(() => {
        if (rightEye?.preview?.startsWith('data:')) {
            sessionStorage.setItem('retinascan_right_preview', rightEye.preview);
        }
        if (leftEye?.preview?.startsWith('data:')) {
            sessionStorage.setItem('retinascan_left_preview', leftEye.preview);
        }
    }, [rightEye?.preview, leftEye?.preview]);

    useEffect(() => {
        const rCache = sessionStorage.getItem('retinascan_right_preview');
        const lCache = sessionStorage.getItem('retinascan_left_preview');
        
        const base64ToFile = (dataUrl, filename) => {
             const base64 = dataUrl.split(',')[1];
             if (!base64) return null;
             try {
                const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                return new File([binary], filename, { type: 'image/jpeg' });
             } catch(e){ return null; }
        };

        if (rCache?.startsWith('data:')) {
            setRightEye({ file: base64ToFile(rCache, 'rightEye.jpg'), preview: rCache, restoredFromCache: true });
        }
        if (lCache?.startsWith('data:')) {
            setLeftEye({ file: base64ToFile(lCache, 'leftEye.jpg'), preview: lCache, restoredFromCache: true });
        }
    }, []);

    // Save draft to session storage
    useEffect(() => {
        sessionStorage.setItem('retinascan_patient_draft', JSON.stringify(patientData));
    }, [patientData]);

    const handleScan = async () => {
        if (!rightEye || isAnalyzing) return;



        if (!patientData.name.trim() || !patientData.age || !patientData.contact.trim()) {
            setErrorMsg('Mandatory clinical data missing: Name, Age, and Contact required.');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            return;
        }

        setIsAnalyzing(true);
        setErrorMsg('');

        try {
            setProgressMsg('Loading AI Model (first offline run may take 30-60 sec)...');

            const [rightInferenceResult, leftInferenceResult] = await Promise.all([
                analyzeImage(rightEye.file, (msg) => setProgressMsg(`Right Eye: ${msg}`)),
                leftEye
                    ? analyzeImage(leftEye.file, (msg) => setProgressMsg(`Left Eye: ${msg}`))
                    : Promise.resolve(null),
            ]);

            const deriveRiskScore = (res) => {
                if (!res) return 0;
                const probs = res.class_probabilities;
                if (probs && probs.length === 5) {
                    const weights = [0, 25, 50, 75, 100];
                    return probs.reduce((acc, p, i) => acc + (p * weights[i]), 0);
                }
                return res.grade * 22;
            };

            const rightRisk = deriveRiskScore(rightInferenceResult);
            const leftRisk = deriveRiskScore(leftInferenceResult);
            const overallRiskScore = Math.max(rightRisk, leftRisk);

            const [rightHeatB64, leftHeatB64, rightImgB64, leftImgB64] = await Promise.all([
                rightInferenceResult.heatmapBlob ? blobToBase64(rightInferenceResult.heatmapBlob) : Promise.resolve(null),
                (leftInferenceResult && leftInferenceResult.heatmapBlob) ? blobToBase64(leftInferenceResult.heatmapBlob) : Promise.resolve(null),
                rightEye?.file ? blobToBase64(rightEye.file) : Promise.resolve(null),
                leftEye?.file  ? blobToBase64(leftEye.file)  : Promise.resolve(null),
            ]);

            const overallGradeValue = leftInferenceResult
                ? Math.max(rightInferenceResult.grade, leftInferenceResult.grade)
                : rightInferenceResult.grade;

            setProgressMsg('Generating Lesion Segmentation Overlays...');
            const rightFinalHeatmap = await generateCombinedHeatmap(
                rightHeatB64 || rightInferenceResult.heatmapUrl || rightInferenceResult.heatmap_url,
                rightInferenceResult.yoloDetections || rightInferenceResult.yolo
            );
            const leftFinalHeatmap = leftInferenceResult ? await generateCombinedHeatmap(
                leftHeatB64 || leftInferenceResult.heatmapUrl || leftInferenceResult.heatmap_url,
                leftInferenceResult.yoloDetections || leftInferenceResult.yolo
            ) : null;

            const now = new Date();
            const patientId = `TN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-3)}`;

            const patientRecord = {
                ...patientData,
                abhaId: patientData.abhaId || '',
                id: patientId,
                patientId,
                timestamp: now.toISOString(),
                grade: overallGradeValue,
                risk_score: overallRiskScore,
                diagnosis: rightInferenceResult.diagnosis || rightInferenceResult.grade_label || '',
                confidence: rightInferenceResult.confidence,
                risk: overallGradeValue >= 3 ? 'HIGH' : overallGradeValue >= 2 ? 'MEDIUM' : 'LOW',
                risk_level: overallGradeValue >= 3 ? 'HIGH' : overallGradeValue >= 2 ? 'MEDIUM' : 'LOW',
                urgency: rightInferenceResult.urgency,
                rightEye: {
                    grade: rightInferenceResult.grade,
                    grade_label: rightInferenceResult.grade_label,
                    diagnosis: rightInferenceResult.diagnosis,
                    confidence: rightInferenceResult.confidence,
                    class_probabilities: rightInferenceResult.class_probabilities || [],
                    heatmap_url: rightFinalHeatmap,
                    raw_heatmap_url: rightHeatB64 || rightInferenceResult.heatmapUrl || rightInferenceResult.heatmap_url,
                    image_url: rightImgB64 || rightEye.preview,
                    yoloDetections: rightInferenceResult.yoloDetections || rightInferenceResult.yolo || null,
                    imageQuality: rightInferenceResult.imageQuality || 'Sufficient Image Quality',
                },
                leftEye: leftInferenceResult ? {
                    grade: leftInferenceResult.grade,
                    grade_label: leftInferenceResult.grade_label,
                    diagnosis: leftInferenceResult.diagnosis,
                    confidence: leftInferenceResult.confidence,
                    class_probabilities: leftInferenceResult.class_probabilities || [],
                    heatmap_url: leftFinalHeatmap,
                    raw_heatmap_url: leftHeatB64 || leftInferenceResult.heatmapUrl || leftInferenceResult.heatmap_url,
                    image_url: leftImgB64 || leftEye.preview,
                    yoloDetections: leftInferenceResult.yoloDetections || leftInferenceResult.yolo || null,
                    imageQuality: leftInferenceResult.imageQuality || 'Sufficient Image Quality',
                } : null,
            };

            await savePatient(patientRecord);
            await logAudit({ type: 'SCAN', patientId: patientRecord.id, grade: patientRecord.grade, confidence: patientRecord.confidence });

            navigate('/results', { state: { record: patientRecord } });
            sessionStorage.removeItem('retinascan_patient_draft');
            sessionStorage.removeItem('retinascan_right_preview');
            sessionStorage.removeItem('retinascan_left_preview');
        } catch (err) {
            console.error('Analysis failed:', err);
            let displayError = err.message || 'Biometric analysis failed. Please verify image quality and retry.';
            
            // Provide clearer guidance for common offline/worker failures
            if (
                displayError.toLowerCase().includes('worker') ||
                displayError.toLowerCase().includes('undefined') ||
                displayError.toLowerCase().includes('wasm') ||
                displayError.toLowerCase().includes('fetch') ||
                displayError.toLowerCase().includes('404')
            ) {
                displayError = 'AI Engine failed to start. If you are online, please wait 10 seconds and retry — the AI models are downloading in the background. If offline, please connect to Wi-Fi first.';
            }
            setErrorMsg(displayError);
        } finally {
            setIsAnalyzing(false);
            setProgressMsg('');
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-10 font-['Outfit'] animate-fade-in pb-20">

            {/* Header */}
            <div>
                <p className="section-label">Diagnostic Portal</p>
                <div className="flex items-center gap-3">
                   <h1 className="text-4xl font-black text-white tracking-tighter">Retinal Screening</h1>
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-1" />
                </div>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2">Dual-eye inference engine · OD Required • OS Optional</p>
            </div>

            {/* Fundus Images Section */}
            <div className="card-elevated space-y-8 bg-[#111827]">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">Fundus Capture</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resolution</span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black">224px ✓</span>
                    </div>
                </div>

                {/* Eye selector tabs */}
                <div className='flex bg-[#0A0F1E] p-1.5 rounded-2xl border border-[#1F2937] gap-1.5'>
                    {[['right', 'Right Eye (OD)'], ['left', 'Left Eye (OS)']].map(([eye, lbl]) => (
                        <button key={eye} onClick={() => setActiveEye(eye)}
                            className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeEye === eye
                                ? 'bg-violet-600 text-white shadow-xl shadow-violet-900/40'
                                : 'text-slate-500 hover:text-slate-300'}`}>
                            {lbl}
                            {eye === 'right' && rightEye && <span className='absolute top-2 right-2 flex h-2 w-2'><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                            {eye === 'left' && leftEye && <span className='absolute top-2 right-2 flex h-2 w-2'><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                        </button>
                    ))}
                </div>

                {/* Grid for zones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Active Zone */}
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Focus: {activeEye === 'right' ? 'Oculus Dexter' : 'Oculus Sinister'}</p>
                        {activeEye === 'right' ? (
                            <EyeUploadZone label='Right Eye (OD)' eyeKey='right'
                                currentImageData={rightEye}
                                onSet={(v) => v === 'camera' ? setShowCamera('right') : setRightEye(v)}
                                onClear={() => setRightEye(null)} />
                        ) : (
                            <EyeUploadZone label='Left Eye (OS)' eyeKey='left'
                                currentImageData={leftEye}
                                onSet={(v) => v === 'camera' ? setShowCamera('left') : setLeftEye(v)}
                                onClear={() => setLeftEye(null)} />
                        )}
                    </div>

                    {/* Quick Preview & Guidance */}
                    <div className="space-y-4">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Screening Summary</p>
                         <div className="bg-[#0A0F1E] rounded-3xl p-6 border border-[#1F2937] space-y-6">
                            {(rightEye || leftEye) ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={`aspect-square rounded-2xl border ${rightEye ? 'border-violet-500/30 bg-violet-500/5' : 'border-dashed border-slate-800 bg-slate-900/40'} flex items-center justify-center overflow-hidden`}>
                                        {rightEye ? <img src={rightEye.preview} className="w-full h-full object-cover" alt="OD" /> : <span className="text-xl opacity-20">OD</span>}
                                    </div>
                                    <div className={`aspect-square rounded-2xl border ${leftEye ? 'border-violet-500/30 bg-violet-500/5' : 'border-dashed border-slate-800 bg-slate-900/40'} flex items-center justify-center overflow-hidden`}>
                                        {leftEye ? <img src={leftEye.preview} className="w-full h-full object-cover" alt="OS" /> : <span className="text-xl opacity-20">OS</span>}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-10 text-center">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">No biometric data captured.<br/>Please proceed with OD scan.</p>
                                </div>
                            )}
                            
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-black shrink-0">✓</div>
                                    <p className="text-[11px] text-slate-400 font-medium">Automatic lesion detection enabled</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-black shrink-0">✓</div>
                                    <p className="text-[11px] text-slate-400 font-medium">Multiclass Grade 0-4 classification</p>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* Patient form */}
            <div className="card-elevated space-y-8 bg-[#111827]">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">Clinical Metadata</h2>
                    <button
                        onClick={() => {
                            if (confirm('Permanently clear all biometric and clinical data?')) {
                                setPatientData({ name: '', age: '', gender: 'Male', diabeticSince: '', contact: '' });
                                setRightEye(null);
                                setLeftEye(null);
                            }
                        }}
                        className="text-[9px] font-black text-slate-600 hover:text-rose-400 uppercase tracking-widest transition-all px-3 py-1 bg-[#0A0F1E] rounded-lg border border-[#1F2937]"
                    >
                        Reset Profile
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {FORM_FIELDS.map(({ id, label, type }) => (
                        <div key={id}>
                            <label className="section-label ml-0">{label}</label>
                            <input type={type} value={patientData[id]}
                                onChange={(e) => setPatientData({ ...patientData, [id]: e.target.value })}
                                className="input py-4 text-base bg-[#0A0F1E] border-[#1F2937]" placeholder={type === 'tel' ? '+91-XXXXX-XXXXX' : ''} />
                        </div>
                    ))}
                    <div className="md:col-span-1">
                        <label className="section-label ml-0">Patient Gender</label>
                        <select value={patientData.gender}
                            onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
                            className="input py-4 text-base bg-[#0A0F1E] border-[#1F2937] appearance-none">
                            <option>Male</option><option>Female</option><option>Other</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
                <div className="bg-rose-900/30 border border-rose-500/40 p-6 rounded-[24px] flex items-start gap-4 animate-shake">
                    <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg">!</div>
                    <div className="space-y-1">
                        <p className="text-rose-400 text-xs font-black uppercase tracking-widest">Incomplete Data</p>
                        <p className="text-rose-200/80 text-sm font-medium">{errorMsg}</p>
                    </div>
                </div>
            )}

            {/* Analysis CTA */}
            <div className="pt-6">
                <button
                    onClick={handleScan}
                    disabled={!rightEye || isAnalyzing}
                    className={`w-full text-base py-6 font-black tracking-[0.2em] uppercase rounded-[32px] text-white transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden group ${isAnalyzing ? 'bg-violet-900 cursor-wait' :
                        rightEye
                            ? 'bg-gradient-to-r from-violet-600 to-blue-600 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-violet-900/60'
                            : 'bg-[#1F2937] text-slate-600 cursor-not-allowed border border-[#374151]'
                        }`}
                >
                    {isAnalyzing && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
                    
                    <div className="flex items-center gap-4 relative z-10">
                        {isAnalyzing ? (
                            <>
                                <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="animate-pulse">{progressMsg || 'Processing...'}</span>
                            </>
                        ) : (
                            <>
                                <svg className={`w-6 h-6 transition-transform group-hover:rotate-12 ${rightEye ? 'text-white' : 'text-slate-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                                <span>{rightEye ? `Initiate Dual-Eye Analysis →` : 'Provide OD Scan to Proceed'}</span>
                            </>
                        )}
                    </div>
                </button>
                {rightEye && !isAnalyzing && (
                    <p className="text-center text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mt-6 animate-fade-in">
                        Authenticated Clinical Personnel Only • HIPAA Compliant Pipeline
                    </p>
                )}
            </div>

            {/* Camera Overlay */}
            {showCamera && (
                <div className="fixed inset-0 z-[100] animate-fade-in">
                    <AutoRetinaCam
                        eyeLabel={showCamera === 'right' ? 'Right Eye (OD)' : 'Left Eye (OS)'}
                        onCapture={(capturedFile, capturedPreview) => {
                            if (showCamera === 'right') setRightEye({ file: capturedFile, preview: capturedPreview });
                            else setLeftEye({ file: capturedFile, preview: capturedPreview });
                            setShowCamera(null);
                        }}
                        onCancel={() => setShowCamera(null)}
                    />
                </div>
            )}
        </div>
    );
}
