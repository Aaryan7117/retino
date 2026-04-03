/**
 * OfflineIndicator.jsx — Feature 8: Sync Status Badge
 * Shows Online/Offline status + pending sync count from IndexedDB
 */
import { useState, useEffect } from 'react';
import { getQueuedRequests, flushSyncQueue } from '../utils/indexedDB';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pending, setPending] = useState(0);

    useEffect(() => {
        const goOn  = () => setIsOnline(true);
        const goOff = () => setIsOnline(false);
        window.addEventListener('online',  goOn);
        window.addEventListener('offline', goOff);
        return () => { window.removeEventListener('online', goOn); window.removeEventListener('offline', goOff); };
    }, []);

    useEffect(() => {
        async function check() {
            try {
                if (navigator.onLine) {
                    await flushSyncQueue();
                }
                const q = await getQueuedRequests();
                setPending(Array.isArray(q) ? q.length : 0);
            } catch { setPending(0); }
        }
        check();
        const id = setInterval(check, 10000);
        return () => clearInterval(id);
    }, []);

    // Hidden when online and no pending requests
    if (isOnline && pending === 0) return null;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            !isOnline
                ? 'bg-amber-900/40 border-amber-700/60 text-amber-300'
                : 'bg-sky-900/40 border-sky-700/60 text-sky-300'
        }`}>
            <span className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'}`} />
            <span className="sm:inline hidden">{!isOnline ? 'Offline' : 'Syncing'}</span>
            {pending > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full">{pending} pending</span>}
        </div>
    );
}
