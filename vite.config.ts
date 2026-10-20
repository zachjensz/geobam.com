import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cloudflare } from '@cloudflare/vite-plugin'

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
        globIgnores: ['wrangler.json', '.assetsignore'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
    cloudflare(),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
