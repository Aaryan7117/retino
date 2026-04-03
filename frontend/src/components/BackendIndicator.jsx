// BackendIndicator.jsx — Shows live backend API connectivity status.
// Uses a periodic health check. Skips polling while a scan is in progress
// to prevent false-disconnected flashes (backend is busy, not down).

import { useState, useEffect, useRef } from 'react';
import { getQueuedRequests } from '../utils/indexedDB';

/**
 * Reference counter: incremented when a scan starts, decremented when it ends.
 * BackendIndicator skips health checks while this is > 0, preventing false-red
 * flashes when the backend is busy processing inference.
 */
let _scanCount = 0;
export const setScanInProgress = (active) => { _scanCount += active ? 1 : -1; };
export const isScanInProgress = () => _scanCount > 0;

export default function BackendIndicator() {
    const [status, setStatus] = useState('checking');
    const [pendingCount, setPendingCount] = useState(0);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        async function checkHealth() {
            // Skip the check while inference is running — backend is busy, not down
            if (isScanInProgress()) return;

            try {
                const base = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                const controller = new AbortController();
                // 8s timeout: enough for a busy backend but short enough to detect real outages
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const res = await fetch(`${base}/health`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (isMounted.current) {
                    setStatus(res.ok ? 'connected' : 'disconnected');
                }
            } catch {
                if (isMounted.current) setStatus('disconnected');
            }
        }

        function handleOnline() { if (isMounted.current) checkHealth(); }
        function handleOffline() { if (isMounted.current) setStatus('disconnected'); }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        navigator.onLine ? checkHealth() : setStatus('disconnected');

        // Poll every 20s (less aggressive — backend response times can be slow on free tier)
        const healthInterval = setInterval(() => {
            if (navigator.onLine) checkHealth();
        }, 20000);

        // Sync queue badge — every 5s
        const badgeInterval = setInterval(async () => {
            const queue = await getQueuedRequests();
            if (isMounted.current) setPendingCount(queue.length);
        }, 5000);

        return () => {
            isMounted.current = false;
            clearInterval(healthInterval);
            clearInterval(badgeInterval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (status === 'checking') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                <span className="sm:inline hidden">API</span>
            </div>
        );
    }

    if (status === 'connected') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-400 transition-colors">
                <span className="w-2 h-2 rounded-full bg-emerald-500 relative badge-ping" />
                <span className="sm:inline hidden">API</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 text-xs font-bold text-rose-400 transition-colors" title="Backend Server Disconnected">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="sm:inline hidden">API</span>
        </div>
    );
}

