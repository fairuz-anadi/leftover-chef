import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Everything the client asks for is same-origin: the page, the bundles and
// `/api/...`. That is what lets a phone on the same WiFi install this and have
// it work with no CORS config, no API base URL to type and no second hostname
// to get wrong — it just talks to whatever served it, and this hop forwards
// the API half to Laravel.
const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  envDir: '..',
  plugins: [react(), tailwindcss()],
  server: {
    // Bound to every interface, not just loopback, so the phone at the stall
    // can reach it over the laptop's hotspot. Nothing here is authenticated,
    // which is fine on a private network and is the whole identity model
    // anyway — but it is a reason not to run this on a café's WiFi.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  // The demo serves the production build, because a service worker is only
  // registered there and an installable app is the point. Same proxy, so the
  // built client reaches the API exactly as the dev server does.
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
})
