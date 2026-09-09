import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg', 'maskable-icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Diario de Crecimiento Espiritual',
        short_name: 'Diario Espiritual',
        description: 'Seguimiento personal de oración, peticiones y lectura bíblica.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f7f4ed',
        theme_color: '#4d6647',
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}maskable-icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        cacheId: 'spiritual-growth-journal-shell',
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,json}']
      }
    })
  ]
});
