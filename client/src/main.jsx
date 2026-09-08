import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@fontsource/ibm-plex-mono'
// Inter carries no Bengali glyphs, so without this every ingredient name
// falls back to whatever the OS happens to have — which on a strange laptop
// is a coin flip. Bundled, so it still works with the network off.
import '@fontsource/noto-sans-bengali/400.css'
import '@fontsource/noto-sans-bengali/600.css'
import './index.css'
import './landing.css'
import './app-shell.css'
import Root from './Root.jsx'
import { isNativeApp } from './api'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

/**
 * Install the service worker, which is what turns this from a page into
 * something you keep on a home screen.
 *
 * Production only, and browser only.
 *
 * In dev, Vite serves modules that must never be cached, and a worker left
 * registered by an earlier `npm run build` will happily serve a stale bundle
 * over the top of the one being edited — so dev actively tears any
 * registration down rather than merely skipping it.
 *
 * In the Android app it is pointless and slightly dangerous: every asset is
 * already inside the package, so there is nothing to cache for offline use,
 * and a worker sitting in front of the WebView's own origin is a way to serve
 * yesterday's bundle after an update with no obvious way to clear it.
 */
if ('serviceWorker' in navigator && !isNativeApp) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        // Not fatal: the app is perfectly usable uninstalled, and saying so in
        // the console beats a silent rejection nobody ever sees.
        console.warn('FridgeMama: offline support unavailable —', error.message)
      })
    })
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((r) => r.unregister()))
      .catch(() => {})
  }
}
