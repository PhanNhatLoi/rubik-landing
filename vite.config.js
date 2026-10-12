import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `yarn dev:https` serves over HTTPS with a self-signed cert (from `yarn cert:dev`),
// so phones on the LAN can use the camera (getUserMedia needs a secure context).
function devHttps() {
  if (process.env.DEV_HTTPS !== '1') return undefined
  if (!fs.existsSync('.cert/key.pem') || !fs.existsSync('.cert/cert.pem')) {
    throw new Error('Missing .cert/key.pem or .cert/cert.pem — run `yarn cert:dev` first.')
  }
  return { key: fs.readFileSync('.cert/key.pem'), cert: fs.readFileSync('.cert/cert.pem') }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    https: devHttps()
  },
  // Pre-bundle up front so the first camera start doesn't trigger a dev reload.
  optimizeDeps: {
    include: ['@techstark/opencv-js']
  }
})
