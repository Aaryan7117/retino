import { useState, useEffect } from 'react';
import { getQueuedRequests } from '../utils/indexedDB';

export default function BackendIndicator() {
    const [status, setStatus] = useState('checking'); // 'checking', 'connected', 'disconnected'
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        let isMounted = true;
        
        async function checkHealth() {
            try {
                const base = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                // Abort request quickly if backend is completely down
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const res = await fetch(`${base}/health`, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (isMounted) {
                    if (res.ok) {
                        setStatus('connected');
                    } else {
                        setStatus('disconnected');
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setStatus('disconnected');
                }
            }
        }

        // Track actual internet connection state
        function handleOnline() {
            if (isMounted) checkHealth();
        }
        function handleOffline() {
            if (isMounted) setStatus('disconnected');
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Initial check
        if (navigator.onLine) {
            checkHealth();
        } else {
            setStatus('disconnected');
        }
        
        // Poll every 10 seconds
        const id = setInterval(() => {
            if (navigator.onLine) checkHealth();
        }, 10000);

        const badgeId = setInterval(async () => {
            const queue = await getQueuedRequests();
            setPendingCount(queue.length);
        }, 5000);
        
        return () => {
            isMounted = false;
            clearInterval(id);
            clearInterval(badgeId);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);



    if (status === 'checking') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                <span>API</span>
            </div>
        );
    }

    if (status === 'connected') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-400 transition-colors">
                <span className="w-2 h-2 rounded-full bg-emerald-500 relative badge-ping" />
                <span>API</span>
            </div>
        );
    }

    // Disconnected state
    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 text-xs font-bold text-rose-400 transition-colors" title="Backend Server Disconnected">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>API</span>
        </div>
    );
}
