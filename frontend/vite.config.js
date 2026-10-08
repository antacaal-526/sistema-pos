import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jsx}'],
      },
      manifest: {
        name: 'Terra Frutos Secos POS',
        short_name: 'TerraPOS',
        theme_color: '#0f172a',
        display: 'standalone'
      }
    })
  ]
})