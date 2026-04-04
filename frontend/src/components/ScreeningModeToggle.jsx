import { useState } from 'react';
import { MODES, MODE_CONFIG } from '../utils/screeningMode';

export default function ScreeningModeToggle({ mode, onToggle }) {
  const [showToast, setShowToast] = useState(false);
  
  const handleToggle = (newMode) => {
    if (newMode !== mode) {
      onToggle(newMode);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const isPreventative = mode === MODES.PREVENTATIVE;

  return (
    <div className="relative">
      <div className="flex flex-col items-center">
        {/* Pill Toggle */}
        <div className="flex items-center bg-[#111827] border border-[#1F2937] rounded-full p-1 shadow-inner">
          <button
            onClick={() => handleToggle(MODES.STANDARD)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              !isPreventative
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => handleToggle(MODES.PREVENTATIVE)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              isPreventative
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Preventative
          </button>
        </div>
        
        {/* Little description text below */}
        <span className="text-[8px] text-slate-500 uppercase tracking-widest mt-1 hidden sm:block">
          {MODE_CONFIG[mode]?.description || 'Adjusting screening sensitivity'}
        </span>
      </div>

      {/* Toast Banner */}
      {showToast && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 p-3 bg-[#111827] border border-violet-500/30 rounded-2xl shadow-xl z-50 animate-fade-in pointer-events-none">
          <p className="text-xs font-bold text-white text-center">
            Switched to <span className={isPreventative ? 'text-amber-400' : 'text-blue-400'}>{isPreventative ? 'Preventative' : 'Standard'} Mode</span>
          </p>
          <p className="text-[10px] text-slate-400 text-center mt-1">
            {isPreventative ? 'Grade 1+ cases will be flagged.' : 'Normal routing restored.'}
          </p>
        </div>
      )}
    </div>
  );
}
