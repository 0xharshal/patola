import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

const THEME_COLOUR = '#8f1d21';
const BACKGROUND_COLOUR = '#f6f1e7';

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, nginx folder).
  base: './',
  plugins: [
    svelte(),
    // Installable app that works offline: a manifest plus a service worker that
    // pre-caches the built files. Updates are offered to the user (see src/app/pwa.ts).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon-64.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Patola Playground',
        short_name: 'Patola',
        description: 'Design Patan double-ikat patola patterns, sarees and wallpapers in your browser.',
        theme_color: THEME_COLOUR,
        background_color: BACKGROUND_COLOUR,
        display: 'standalone',
        start_url: '.',
        scope: '.',
        categories: ['education', 'design'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Every release is also published in its own folder (…/v1.2.0/), next to the
        // newest one at the site root. A navigation fallback would make the root's
        // offline copy answer for those folders too. Instead, pages are matched in
        // the cache ignoring the query (the design), so each copy only serves itself.
        navigateFallback: null,
        ignoreURLParametersMatching: [/.*/],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
