import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'GeoBam — Learn the world',
        short_name: 'GeoBam',
        description: 'Learn countries and geography through focused, adaptive minigames that work offline.',
        lang: 'en',
        dir: 'ltr',
        categories: ['education', 'games'],
        prefer_related_applications: false,
        theme_color: '#fafaf7',
        background_color: '#fafaf7',
        display: 'standalone',
        id: '/',
        start_url: '/',
        scope: '/',
        shortcuts: [
          {
            name: 'Play Countries',
            short_name: 'Countries',
            description: 'Start a country identification round.',
            url: '/countries-quiz',
            icons: [
              {
                src: '/pwa-192.png',
                sizes: '192x192',
                type: 'image/png',
              },
            ],
          },
          {
            name: 'Play Capital Cities',
            short_name: 'Capitals',
            description: 'Start a capital city identification round.',
            url: '/capitals-quiz',
            icons: [
              {
                src: '/pwa-192.png',
                sizes: '192x192',
                type: 'image/png',
              },
            ],
          },
        ],
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{html,js,css,svg,png,json,webp,woff2}'],
        // Quiz chunks (and their vendor chunks) are lazy-loaded on demand, so
        // precaching them would force first-visit users who never open a quiz
        // to download ~1.4 MB of JavaScript on service worker install. They
        // are cached at runtime (see runtimeCaching) after their first load.
        globIgnores: [
          'wrangler.json',
          '.assetsignore',
          'assets/familiarity-*.js',
          'assets/*Quiz-*.js',
          'assets/three-*.js',
          'assets/topojson-client-*.js',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Hashed, immutable JS assets (entry + lazy chunks) — serve from
            // cache first so quizzes work offline after their first online load.
            //
            // Workbox's RegExpRoute matches this pattern against the *full
            // request URL*, not the pathname, so the pattern must not be
            // anchored with `^` — that would never match and the runtime
            // cache would silently stay empty. An unanchored `/assets/...`
            // pattern matches the path portion of any same-origin URL.
            urlPattern: /\/assets\/.*\.js$/,
            handler: 'CacheFirst',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2023',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/]three[\\/]/,
            },
            {
              name: 'topojson-client',
              test: /node_modules[\\/]topojson-client[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
