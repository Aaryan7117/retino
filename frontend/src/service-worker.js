/**
 * service-worker.js - Section 8: Offline-First PWA
 * Strategy overview:
 * - Static assets / app shell -> Cache-first (precached via Workbox manifest injection)
 * - ONNX model & sample data -> Cache-first (StaleWhileRevalidate on first hit)
 * - FastAPI /api/* calls -> Network-first with IndexedDB fallback handled in the app
 * - Background Sync -> Queues failed POST requests for retry when online
 *
 * ISSUE 12: Bump APP_VERSION on redeploy so users get fresh caches and update banner.
 */
const APP_VERSION = "1.0.3";

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { BackgroundSyncPlugin } from "workbox-background-sync";

// --- Core: skip waiting and claim clients immediately (ISSUE 12) ---
self.skipWaiting();
clientsClaim();

// --- Precache (Workbox injects the manifest here at build time) ---
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// --- On activate: clear caches from previous version ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (name) =>
                !name.includes(APP_VERSION) && name.startsWith("retinascan-"),
            )
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

// --- App-Shell navigation (SPA catch-all) ---
// Return the cached index.html for all navigation requests so React Router works offline.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: `retinascan-navigation-${APP_VERSION}`,
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [200] })],
    }),
  ),
);

// --- Static assets: JS, CSS, fonts, icons ---
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font",
  new CacheFirst({
    cacheName: `retinascan-static-${APP_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// --- Images ---
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: `retinascan-images-${APP_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// --- ONNX model & WASM engine (cache-first after first download) ---
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/models/") || url.pathname.startsWith("/wasm/"),
  new CacheFirst({
    cacheName: `retinascan-models-${APP_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 3, maxAgeSeconds: 90 * 24 * 60 * 60 }),
    ],
  }),
);

// --- Sample data / demo cases ---
registerRoute(
  ({ url }) => url.pathname.startsWith("/sample-data/"),
  new StaleWhileRevalidate({
    cacheName: `retinascan-sample-data-${APP_VERSION}`,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// --- FastAPI backend: inference and report endpoints (network-first) ---
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: `retinascan-api-${APP_VERSION}`,
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
);

// ─── Background Sync: queue failed scan uploads ───────────────────────────────
const bgSyncPlugin = new BackgroundSyncPlugin("retinascan-sync-queue", {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
});

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") && request.method === "POST",
  new NetworkFirst({
    cacheName: `retinascan-api-post-${APP_VERSION}`,
    plugins: [bgSyncPlugin],
    fetchOptions: { credentials: "same-origin" },
  }),
  "POST",
);

// --- Message handler: skip waiting on demand ---
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
