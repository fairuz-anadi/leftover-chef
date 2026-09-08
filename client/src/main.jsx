import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono'
// Inter carries no Bengali glyphs, so without this every ingredient name
// falls back to whatever the OS happens to have — which on a strange laptop
// is a coin flip. Bundled, so it still works with the network off.
import '@fontsource/noto-sans-bengali/400.css'
import '@fontsource/noto-sans-bengali/600.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
