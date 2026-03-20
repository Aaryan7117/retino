// Scanner.jsx — Main screening interface for capturing fundus images and running AI analysis

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeImage } from '../utils/modelInference';
import { savePatient, logAudit, blobToBase64 } from '../utils/indexedDB';
import AutoRetinaCam from './AutoRetinaCam';

const FORM_FIELDS = [
    { id: 'name', label: 'Full Name', type: 'text', col: 2 },
    { id: 'age', label: 'Age (years)', type: 'number', col: 1 },
    { id: 'diabeticSince', label: 'Diabetic Since (yrs)', type: 'number', col: 1 },
    { id: 'contact', label: 'Mobile Number', type: 'tel', col: 2 },
];

/**
 * Sub-component for uploading or capturing an image for a specific eye.
 */
function EyeUploadZone({ label, eyeKey, currentImageData, onSet, onClear }) {
    const fileInputRef = useRef(null);
    if (currentImageData) return (
        <div className='relative rounded-xl overflow-hidden border border-slate-700'>
            <img src={currentImageData.preview} className='w-full aspect-square object-cover' alt={label} />
            <span className='absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded'>{label}</span>
            <button onClick={onClear} className='absolute top-2 right-2 w-6 h-6 bg-slate-900/80 text-white rounded-full text-xs flex items-center justify-center'>✕</button>
            <div className='absolute bottom-2 left-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded font-bold'>Ready ✓</div>
        </div>
    );
    return (
        <div className='border-2 border-dashed border-slate-600 rounded-xl p-5 text-center hover:border-blue-500 transition-colors'>
            <div className='text-slate-400 text-sm font-bold mb-1'>{label}</div>
            <div className='text-slate-500 text-xs mb-3'>Fundus photograph</div>
            <div className='flex gap-2 justify-center'>
                <button onClick={() => fileInputRef.current?.click()}
                    className='btn-secondary text-xs px-3 py-1.5'>Upload</button>
                <button onClick={() => onSet('camera')}
                    className='btn-secondary text-xs px-3 py-1.5'>📷 Camera</button>
            </div>
            <input ref={fileInputRef} type='file' accept='image/*' className='hidden'
                onChange={e => {
                    const selectedFile = e.target.files[0]; if (!selectedFile) return;
                    onSet({ file: selectedFile, preview: URL.createObjectURL(selectedFile) });
                }} />
        </div>
    );
}

export default function Scanner() {
    const navigate = useNavigate();

    // -- State --
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [rightEye, setRightEye] = useState(null);  // {file, preview}
    const [leftEye, setLeftEye] = useState(null);    // {file, preview}
    const [activeEye, setActiveEye] = useState('right');
    const [showCamera, setShowCamera] = useState(null); // 'right' | 'left' | null
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [dragging, setDragging] = useState(false);

    // Always start with a blank form — no draft restore
    const [patientData, setPatientData] = useState({ name: '', age: '', gender: 'Male', diabeticSince: '', contact: '' });

    // Save draft to session storage whenever form changes
    useEffect(() => {
        sessionStorage.setItem('retinascan_patient_draft', JSON.stringify(patientData));
    }, [patientData]);

    const handleFile = (file) => {
        if (!file) return;
        setImage(file);
        setPreview(URL.createObjectURL(file));
        setErrorMsg('');
    };

    /**
     * Primary handler for running the dual-eye scan process.
     * Validates form, runs inference (potentially in parallel), 
     * persists results to IndexedDB, and navigates to Results view.
     */
    const handleScan = async () => {
        if (!rightEye || isAnalyzing) return;

        // Form validation
        if (!patientData.name.trim() || !patientData.age || !patientData.contact.trim()) {
            setErrorMsg('Please fill in the Patient Name, Age, and Contact Number to continue.');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            return;
        }

        setIsAnalyzing(true);
        setErrorMsg('');

        try {
            setProgressMsg('🔄 Scanning both eyes simultaneously...');

            // CRITICAL: Promise.all() is used to run inference for both eyes in parallel,
            // significantly reducing total wait time compared to sequential execution.
            const [rightInferenceResult, leftInferenceResult] = await Promise.all([
                analyzeImage(rightEye.file, (msg) => setProgressMsg(`OD: ${msg}`)),
                leftEye
                    ? analyzeImage(leftEye.file, (msg) => setProgressMsg(`OS: ${msg}`))
                    : Promise.resolve(null),
            ]);

            // CRITICAL: Convert heatmap blobs and image files to Base64 data URLs.
            // This is required because IndexedDB stores persistent data, but 
            // blob:// URLs are temporary and will break when the page is refreshed.
            // Base64 strings ensure the images remain available indefinitely.
            const [rightHeatB64, leftHeatB64, rightImgB64, leftImgB64] = await Promise.all([
                rightInferenceResult.heatmapBlob ? blobToBase64(rightInferenceResult.heatmapBlob) : Promise.resolve(null),
                (leftInferenceResult && leftInferenceResult.heatmapBlob) ? blobToBase64(leftInferenceResult.heatmapBlob) : Promise.resolve(null),
                rightEye?.file ? blobToBase64(rightEye.file) : Promise.resolve(null),
                leftEye?.file  ? blobToBase64(leftEye.file)  : Promise.resolve(null),
            ]);

            // CRITICAL: Overall grade is set as the maximum (worst) grade found in either eye.
            // This ensures that if even one eye shows severe DR, the patient is flagged accordingly.
            const overallGradeValue = leftInferenceResult
                ? Math.max(rightInferenceResult.grade, leftInferenceResult.grade)
                : rightInferenceResult.grade;

            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const seq = String(Date.now()).slice(-3);
            const patientId = `TN-${dateStr}-${seq}`;

            const patientRecord = {
                ...patientData,
                id: patientId,
                patientId,
                name: patientData.name,
                age: Number(patientData.age),
                gender: patientData.gender,
                diabeticSince: Number(patientData.diabeticSince) || 0,
                contact: patientData.contact,
                timestamp: now.toISOString(),
                grade: overallGradeValue,
                diagnosis: rightInferenceResult.diagnosis || rightInferenceResult.grade_label || '',
                confidence: rightInferenceResult.confidence,
                risk_score: rightInferenceResult.risk_score,
                risk: overallGradeValue >= 3 ? 'HIGH' : overallGradeValue >= 2 ? 'MEDIUM' : 'LOW',
                risk_level: overallGradeValue >= 3 ? 'HIGH' : overallGradeValue >= 2 ? 'MEDIUM' : 'LOW',
                urgency: rightInferenceResult.urgency,
                // Dual-eye sub-objects
                rightEye: {
                    grade: rightInferenceResult.grade,
                    grade_label: rightInferenceResult.grade_label,
                    diagnosis: rightInferenceResult.diagnosis,
                    confidence: rightInferenceResult.confidence,
                    class_probabilities: rightInferenceResult.class_probabilities || [],
                    heatmap_url: rightHeatB64 || rightInferenceResult.heatmapUrl || rightInferenceResult.heatmap_url,
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
                    heatmap_url: leftHeatB64 || leftInferenceResult.heatmapUrl || leftInferenceResult.heatmap_url,
                    image_url: leftImgB64 || leftEye.preview,
                    yoloDetections: leftInferenceResult.yoloDetections || leftInferenceResult.yolo || null,
                    imageQuality: leftInferenceResult.imageQuality || 'Sufficient Image Quality',
                } : null,
            };

            try {
                // CRITICAL: Save to IndexedDB (Offline-First)
                await savePatient(patientRecord);
                // Feature 7: Audit log
                await logAudit({ type: 'SCAN', patientId: patientRecord.id, grade: patientRecord.grade, confidence: patientRecord.confidence });
            } catch (idbErr) {
                console.warn('IndexedDB save failed (non-fatal):', idbErr);
            }

            navigate('/results', { state: { record: patientRecord } });
        } catch (err) {
            console.error('Analysis failed:', err);
            setErrorMsg(err.message || 'Scan failed. Please try again.');
        } finally {
            setIsAnalyzing(false);
            setProgressMsg('');
        }
    };

    /**
     * LEGACY handler for single-eye scans.
     */
    const handleAnalyze = async () => {
        if (!image) return;
        if (!patientData.name.trim() || !patientData.age || !patientData.contact.trim()) {
            setErrorMsg('Please fill in the Patient Name, Age, and Contact Number to continue.');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            return;
        }
        setIsAnalyzing(true);
        setErrorMsg('');
        try {
            const result = await analyzeImage(image, (msg) => setProgressMsg(msg));
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const seq = String(Date.now()).slice(-3);
            const patientId = `TN-${dateStr}-${seq}`;
            const patientWithId = { ...patientData, patientId };
            const GRADE_LABELS = [
                'No Diabetic Retinopathy', 'Mild Diabetic Retinopathy', 'Moderate Diabetic Retinopathy',
                'Severe Diabetic Retinopathy', 'Proliferative Diabetic Retinopathy',
            ];
            const RISK_MAP = ['LOW', 'LOW', 'MEDIUM', 'HIGH', 'HIGH'];
            const patientRecord = {
                id: patientId,
                name: patientData.name,
                age: Number(patientData.age),
                gender: patientData.gender,
                diabeticSince: Number(patientData.diabeticSince) || 0,
                contact: patientData.contact,
                patientId,
                grade: result.grade,
                diagnosis: GRADE_LABELS[result.grade] || 'Unknown',
                confidence: result.confidence,
                risk_score: result.risk_score,
                risk: RISK_MAP[result.grade] || 'LOW',
                urgency: result.urgency || '',
                result_yolo: result.yolo || null,
                timestamp: now.toISOString(),
                heatmap_url: result.heatmap_url || null,
                heatmap_blob: result.heatmapBlob || null,
            };
            try {
                await savePatient(patientRecord);
                await logAudit({ type: 'SCAN', patientId: patientRecord.id, grade: patientRecord.grade, confidence: patientRecord.confidence });
            } catch (idbErr) {
                console.warn('IndexedDB save failed (non-fatal):', idbErr);
            }
            navigate('/results', { state: { result, patient: patientWithId, imagePreview: preview } });
        } catch (err) {
            console.error('Analysis failed:', err);
            setErrorMsg(err.message || 'Failed to analyze image. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const isDualMode = rightEye !== null;

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            {/* Header */}
            <div>
                <p className="section-label">Screening</p>
                <h1 className="text-4xl font-black text-white">New Retinal Scan</h1>
                <p className="text-slate-400 text-sm mt-2">Dual-eye scanning · Right Eye (OD) required · Left Eye (OS) optional</p>
            </div>

            {/* Fundus Images Section */}
            <div className="card-elevated space-y-4">
                <h2 className="text-lg font-black text-white">Fundus Images</h2>

                {/* Eye selector tabs */}
                <div className='flex gap-1 p-1 bg-slate-900 rounded-xl'>
                    {[['right', 'Right Eye (OD)'], ['left', 'Left Eye (OS)']].map(([eye, lbl]) => (
                        <button key={eye} onClick={() => setActiveEye(eye)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeEye === eye
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'}`}>
                            {lbl}
                            {eye === 'right' && rightEye && <span className='ml-1 text-emerald-400 text-xs'>✓</span>}
                            {eye === 'left' && leftEye && <span className='ml-1 text-emerald-400 text-xs'>✓</span>}
                            {eye === 'left' && !leftEye && <span className='ml-1 text-slate-600 text-xs'>(optional)</span>}
                        </button>
                    ))}
                </div>

                {/* Upload zone for active eye */}
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

                {/* Both-eye preview when both captured */}
                {rightEye && leftEye && (
                    <div className='grid grid-cols-2 gap-2 mt-3'>
                        <div className='relative'>
                            <img src={rightEye.preview} className='w-full rounded-lg aspect-square object-cover' alt="Right Eye" />
                            <span className='absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded font-bold'>OD</span>
                        </div>
                        <div className='relative'>
                            <img src={leftEye.preview} className='w-full rounded-lg aspect-square object-cover' alt="Left Eye" />
                            <span className='absolute top-1 left-1 bg-violet-600 text-white text-xs px-1.5 py-0.5 rounded font-bold'>OS</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Legacy single-eye upload (hidden when dual-eye mode active) */}
            {!isDualMode && (
                <div className="card-elevated space-y-4">
                    <div className="flex items-center gap-2 relative group w-max">
                        <h2 className="text-lg font-black text-white">Single-Eye Mode</h2>
                        <span className="text-xs text-slate-500">(legacy fallback)</span>
                    </div>
                    <div
                        onClick={() => document.getElementById('img-input').click()}
                        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragging ? 'border-blue-500 bg-blue-900/20 scale-[1.01]' :
                            preview ? 'border-slate-600 bg-slate-700/40' :
                                'border-slate-600 hover:border-blue-500 hover:bg-blue-900/10'
                            }`}
                    >
                        {preview ? (
                            <div className="space-y-2">
                                <img src={preview} alt="Retina scan" className="max-h-48 mx-auto rounded-xl shadow-xl" />
                                <p className="text-xs text-slate-400">Click to replace image</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-700 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">Drop image here or click to upload</p>
                                    <p className="text-xs text-slate-500 mt-1">JPG, PNG or BMP · Fundus photography recommended</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <input id="img-input" type="file" accept="image/*" className="hidden"
                        onChange={(e) => handleFile(e.target.files[0])} />
                </div>
            )}

            {/* Patient form */}
            <div className="card-elevated space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-white">Patient Information</h2>
                    <button
                        onClick={() => {
                            if (confirm('Clear form data?')) {
                                setPatientData({ name: '', age: '', gender: 'Male', diabeticSince: '', contact: '' });
                                setImage(null);
                                setPreview(null);
                                setRightEye(null);
                                setLeftEye(null);
                            }
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
                    >
                        Clear Form
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {FORM_FIELDS.map(({ id, label, type }) => (
                        <div key={id}>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
                            <input type={type} value={patientData[id]}
                                onChange={(e) => setPatientData({ ...patientData, [id]: e.target.value })}
                                className="input" placeholder={type === 'tel' ? '+91-XXXXX-XXXXX' : ''} />
                        </div>
                    ))}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Gender</label>
                        <select value={patientData.gender}
                            onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
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

            {/* Analysis CTA */}
            {isDualMode ? (
                <button
                    onClick={handleScan}
                    disabled={!rightEye || isAnalyzing}
                    className={`w-full text-base py-4 font-black tracking-wide rounded-2xl text-white transition-all flex items-center justify-center gap-3 ${isAnalyzing ? 'bg-blue-800 cursor-wait' :
                        rightEye
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
                    ) : rightEye ? `🔬 Analyze Both Eyes${leftEye ? ' (OD + OS)' : ' (OD only)'}` : 'Upload Right Eye image to continue'}
                </button>
            ) : (
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
            )}

            {/* Camera Overlay */}
            {showCamera && (
                <AutoRetinaCam
                    eyeLabel={showCamera === 'right' ? 'Right Eye (OD)' : 'Left Eye (OS)'}
                    onCapture={(capturedFile, capturedPreview) => {
                        if (showCamera === 'right') setRightEye({ file: capturedFile, preview: capturedPreview });
                        else setLeftEye({ file: capturedFile, preview: capturedPreview });
                        setShowCamera(null);
                    }}
                    onCancel={() => setShowCamera(null)}
                />
            )}
        </div>
    );
}

