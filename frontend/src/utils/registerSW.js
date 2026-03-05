/**
 * registerSW.js  — Section 8
 * Registers the service worker using vite-plugin-pwa's virtual module.
 * This inherently handles dev server rewrites and MIME types.
 */
import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const updateSW = registerSW({
            onNeedRefresh() {
                // Dispatch event so App.jsx can show the update toast
                const detail = {
                    messageSkipWaiting: () => updateSW(true)
                };
                window.dispatchEvent(new CustomEvent('sw:update-available', { detail }));
            },
            onOfflineReady() {
                console.log('App is ready to work offline');
            },
            onRegisterError(err) {
                console.error('[SW] Registration failed:', err);
            }
        });
    }
}
