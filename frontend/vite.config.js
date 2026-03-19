import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',   // Use our hand-crafted SW
      srcDir: 'src',
      filename: 'service-worker.js',
      registerType: 'autoUpdate',
      injectRegister: false,          // We handle registration manually
      injectManifest: {
        // Allow large ONNX / WASM assets without failing the build
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,onnx,mjs}'],
      },
      manifest: {
        name: 'RetinaScan AI',
        short_name: 'RetinaScan',
        description: 'AI-Powered Diabetic Retinopathy Screening for Rural Camps',
        start_url: '/',
        display: 'standalone',
        background_color: '#0F172A',
        theme_color: '#2E75B6',
        orientation: 'portrait',
        categories: ['health', 'medical'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New Scan',
            short_name: 'Scan',
            description: 'Start a new retinal scan',
            url: '/scan',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Camp Stats',
            short_name: 'Stats',
            description: 'View today\'s camp statistics',
            url: '/camp',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,onnx,wasm}'],
      },
      devOptions: {
        enabled: false,   // ← Disabled in dev so HMR updates are served fresh
        type: 'module',
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web'] // Vital fix: Stops Vite intercepting ONNX local WASM imports
  }
});

