import { useState, useRef, useEffect, useCallback } from 'react';
import { startCamera, captureFrame, stopCamera } from '../utils/cameraCapture';

// Props: { eyeLabel: string, onCapture(file, previewUrl): void, onCancel(): void }
export default function AutoRetinaCam({ eyeLabel, onCapture, onCancel }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const steadyRef = useRef(0);
  const doneRef   = useRef(false);
  const [status, setStatus]   = useState('searching');
  const [pct,    setPct]      = useState(0);
  const [facing, setFacing]   = useState('environment');

  // Analysis runs every 200ms
  const analyse = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || doneRef.current) return;
    const W = v.videoWidth, H = v.videoHeight;
    if (!W || !H) return;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0);
    // Centre 40% region
    const cx = Math.floor(W * 0.3), cy = Math.floor(H * 0.3);
    const cw = Math.floor(W * 0.4), ch = Math.floor(H * 0.4);
    const d = ctx.getImageData(cx, cy, cw, ch).data;
    let rS = 0, bS = 0, brS = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      rS += d[i]; bS += d[i + 2];
      brS += (d[i] + d[i + 1] + d[i + 2]) / 3;
      n++;
    }
    const avgR = rS / n, avgB = bS / n, avgBr = brS / n;
    // Corner brightness
    const co = ctx.getImageData(0, 0, Math.floor(W * 0.1), Math.floor(H * 0.1)).data;
    let cBr = 0, cN = 0;
    for (let i = 0; i < co.length; i += 4) { cBr += (co[i] + co[i + 1] + co[i + 2]) / 3; cN++; }
    const avgCo = cBr / cN;
    // Sharpness (variance)
    let gM = 0; const gs = [];
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; gs.push(g); gM += g;
    }
    gM /= gs.length;
    const vr = gs.reduce((s, v) => s + (v - gM) ** 2, 0) / gs.length;
    const ok = avgR > avgB * 1.05 && avgBr > 40 && avgBr > avgCo + 15 && vr > 200;
    if (ok) {
      steadyRef.current = Math.min(steadyRef.current + 1, 8);
    } else {
      steadyRef.current = Math.max(0, steadyRef.current - 2);
    }
    const p = Math.round((steadyRef.current / 8) * 100);
    setPct(p);
    setStatus(p >= 100 ? 'capturing' : p > 0 ? 'detected' : 'searching');
    if (steadyRef.current >= 8 && !doneRef.current) {
      doneRef.current = true;
      setTimeout(async () => {
        const { file, previewUrl } = await captureFrame(videoRef.current);
        stopCamera(streamRef.current);
        onCapture(file, previewUrl);
      }, 200);
    }
  }, [onCapture]);

  useEffect(() => { const id = setInterval(analyse, 200); return () => clearInterval(id); }, [analyse]);

  useEffect(() => {
    startCamera(videoRef.current, facing)
      .then(s => { streamRef.current = s; })
      .catch(() => setStatus('error'));
    return () => stopCamera(streamRef.current);
  }, [facing]);

  const RING = status === 'capturing' ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.7)]'
             : status === 'detected'  ? 'border-yellow-400  shadow-[0_0_20px_rgba(250,204,21,0.5)]'
             : 'border-white/30';

  return (
    <div className='fixed inset-0 z-50 bg-black flex flex-col'>
      <canvas ref={canvasRef} className='hidden' />
      {/* Top bar */}
      <div className='absolute top-0 inset-x-0 z-10 flex justify-between items-center px-4 py-3 bg-gradient-to-b from-black/80 to-transparent'>
        <button onClick={() => { stopCamera(streamRef.current); onCancel(); }}
          className='w-10 h-10 rounded-full bg-black/50 text-white text-lg flex items-center justify-center'>✕</button>
        <span className='text-white font-bold text-sm'>{eyeLabel}</span>
        <button onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}
          className='w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-lg'>🔄</button>
      </div>
      {/* Video */}
      <video ref={videoRef} autoPlay playsInline
        className='absolute inset-0 w-full h-full object-cover' />
      {/* Targeting ring */}
      <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
        <div className={`w-56 h-56 rounded-full border-4 transition-all duration-300 ${RING}`} />
        {pct > 0 && (
          <svg className='absolute w-64 h-64' viewBox='0 0 100 100'>
            <circle cx='50' cy='50' r='46' fill='none'
              stroke='rgba(52,211,153,0.5)' strokeWidth='3'
              strokeDasharray={`${pct * 2.89} ${289}`}
              strokeLinecap='round' transform='rotate(-90 50 50)' />
          </svg>
        )}
      </div>
      {/* Status text */}
      <div className='absolute bottom-32 inset-x-0 text-center pointer-events-none'>
        {status === 'searching'  && <p className='text-white font-bold drop-shadow'>Point at retina · Auto-captures when detected</p>}
        {status === 'detected'   && <p className='text-yellow-300 font-bold drop-shadow animate-pulse'>Hold steady...</p>}
        {status === 'capturing'  && <p className='text-emerald-300 font-black drop-shadow text-lg'>Captured! ✓</p>}
        {status === 'error'      && <p className='text-red-400 font-bold text-sm'>Camera unavailable</p>}
      </div>
      {/* Manual shutter — always visible */}
      <div className='absolute bottom-8 inset-x-0 flex justify-center'>
        <button
          onClick={async () => {
            doneRef.current = true;
            const { file, previewUrl } = await captureFrame(videoRef.current);
            stopCamera(streamRef.current);
            onCapture(file, previewUrl);
          }}
          className='w-16 h-16 rounded-full bg-white border-4 border-slate-300 shadow-xl active:scale-95 transition-transform'>
          <div className='w-10 h-10 rounded-full bg-slate-800 mx-auto mt-1' />
        </button>
      </div>
    </div>
  );
}
