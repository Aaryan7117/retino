import { useState, useRef, useEffect, useCallback } from 'react';

export default function SplitHeatmapView({ originalUrl, heatmapUrl }) {
  const containerRef = useRef(null);
  const [pos, setPos] = useState(50);       // split position 0-100%
  const [dragging, setDragging] = useState(false);

  const move = useCallback((clientX) => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  useEffect(() => {
    const up = () => setDragging(false);
    const mv = (e) => { if (dragging) move(e.touches ? e.touches[0].clientX : e.clientX); };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    };
  }, [dragging, move]);

  return (
    <div className='space-y-1'>
      <div className='flex justify-between text-xs text-slate-500 font-bold'>
        <span>Original</span><span>Drag to compare</span><span>AI Heatmap</span>
      </div>
      <div
        ref={containerRef}
        className='relative w-full aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-700 cursor-col-resize select-none'
        onMouseDown={e => { setDragging(true); move(e.clientX); }}
        onTouchStart={e => { setDragging(true); move(e.touches[0].clientX); }}
      >
        {/* Original — clipped on the right */}
        <img src={originalUrl} alt='Original'
          className='absolute inset-0 w-full h-full object-cover'
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false} />
        {/* Heatmap — clipped on the left */}
        <img src={heatmapUrl} alt='Heatmap'
          className='absolute inset-0 w-full h-full object-cover'
          style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
          draggable={false} />
        {/* Divider line */}
        <div className='absolute top-0 bottom-0 w-px bg-white/90'
          style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
          {/* Handle */}
          <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-teal-500 border-2 border-white shadow-xl flex items-center justify-center pointer-events-none'>
            <svg viewBox='0 0 16 16' className='w-4 h-4 text-white fill-current'>
              <path d='M5 3l-3 5 3 5V3zm6 0v10l3-5-3-5z' />
            </svg>
          </div>
        </div>
        {/* Labels */}
        <span className='absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded pointer-events-none'>Original</span>
        <span className='absolute top-2 right-2 bg-black/60 text-teal-300 text-xs font-bold px-2 py-0.5 rounded pointer-events-none'>AI Heatmap</span>
      </div>
      <p className='text-xs text-slate-600 italic text-center'>
        Red/orange = high AI attention · Drag the divider to compare
      </p>
    </div>
  );
}
