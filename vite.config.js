import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered manually in main.jsx (registerSW from 'virtual:pwa-register') so we can
      // add periodic update checks — an idle tab never re-checks on its own.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Flexachem Workshop',
        short_name: 'Workshop',
        description: 'Flexachem workshop job tracker',
        theme_color: '#0a1f3d',
        background_color: '#0a1f3d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // MUST be set explicitly. With injectRegister:false, vite-plugin-pwa does NOT apply
        // the autoUpdate defaults, and the emitted SW only skipped waiting on a SKIP_WAITING
        // message that the autoUpdate registration code never sends. The new SW parked in
        // "waiting" forever, the old one kept serving stale precached assets, and only a
        // cache-bypassing hard reload (Ctrl+Shift+R) showed a new deploy.
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // pdfjs worker chunk
        runtimeCaching: [
          {
            // Supabase REST reads: serve fast, fall back to cache offline.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 },
            },
          },
          {
            // Auth + storage (signed URLs) must never be cached.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/storage/')),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
