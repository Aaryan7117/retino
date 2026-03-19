import { useState, useEffect } from 'react';

export default function BackendIndicator() {
    const [status, setStatus] = useState('checking'); // 'checking', 'connected', 'disconnected'

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
        
        return () => {
            isMounted = false;
            clearInterval(id);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (status === 'checking') {
        return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                <span>API</span>
            </div>
        );
    }

    if (status === 'connected') {
        return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-700/60 bg-emerald-900/40 text-xs font-semibold text-emerald-300 transition-colors">
                <span className="text-[10px] leading-none mb-[1px]">✓</span>
                <span>API</span>
            </div>
        );
    }

    // Disconnected state
    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-rose-700/60 bg-rose-900/40 text-xs font-semibold text-rose-300 transition-colors" title="Backend Server Disconnected">
            <span className="text-[10px] leading-none mb-[1px]">✕</span>
            <span>API</span>
        </div>
    );
}
