import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.svg', 'pwa-192.png', 'pwa-512.svg', 'pwa-512.png'],
      manifest: {
        name: 'Voice Transcription & AI Correction',
        short_name: 'Transcription',
        description: 'Швидке розпізнавання мови та AI-покращення тексту',
        lang: 'uk',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @ts-expect-error vitest config
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
