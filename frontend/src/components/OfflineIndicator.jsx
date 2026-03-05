/**
 * OfflineIndicator — uses only standard Tailwind
 */
import { useState, useEffect } from 'react';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const on = () => setIsOnline(true), off = () => setIsOnline(false);
        window.addEventListener('online', on); window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    return (
        <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border shrink-0 transition-colors ${isOnline
                ? 'bg-emerald-900/60 text-emerald-400 border-emerald-700'
                : 'bg-amber-900/60  text-amber-400  border-amber-700'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {isOnline ? 'Connected' : 'Offline'}
        </div>
    );
}
