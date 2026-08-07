import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Nexus | by Snipes Systems',
        short_name: 'Nexus',
        description: 'Nexus by Snipes Systems — communication, work, and organization in one place.',
        // Installed launches carry this query param so App.jsx skips the
        // marketing homepage and goes straight to sign-in / the workspace.
        start_url: '/?src=pwa',
        scope: '/',
        display: 'standalone',
        background_color: '#0f0d0b',
        theme_color: '#0f0d0b',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // Source art dropped in public/ for icon generation, not used at
        // runtime — too big to precache and not worth serving offline.
        globIgnores: ['**/Nexus Logo.png'],
      },
    }),
  ],
})
