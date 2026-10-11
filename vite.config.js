import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  // Pre-bundle up front so the first camera start doesn't trigger a dev reload.
  optimizeDeps: {
    include: ['@techstark/opencv-js']
  }
})
