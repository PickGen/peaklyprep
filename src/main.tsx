import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

registerSW({ immediate: true })

// Keep the layout fixed at 100%: block pinch-zoom and Ctrl + wheel / Ctrl +, -, 0 zooming
const stop = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', stop)
document.addEventListener('gesturechange', stop)
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
