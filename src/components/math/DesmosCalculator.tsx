import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'

interface DesmosInstance {
  resize: () => void
  destroy: () => void
}
interface DesmosApi {
  GraphingCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => DesmosInstance
  ScientificCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => DesmosInstance
}
declare global {
  interface Window {
    Desmos?: DesmosApi
  }
}

// The key below is Desmos' public demo key (development only). Request your own free key at
// https://www.desmos.com/api and set VITE_DESMOS_API_KEY before launching commercially.
const API_KEY = (import.meta.env.VITE_DESMOS_API_KEY as string | undefined) || 'dcb31709b452b1cf9dc26972add0fda6'

let loader: Promise<DesmosApi> | null = null
function loadDesmos(): Promise<DesmosApi> {
  if (window.Desmos) return Promise.resolve(window.Desmos)
  if (!loader) {
    loader = new Promise<DesmosApi>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = `https://www.desmos.com/api/v1.9/calculator.js?apiKey=${API_KEY}`
      s.async = true
      s.onload = () => (window.Desmos ? resolve(window.Desmos) : reject(new Error('Desmos missing')))
      s.onerror = () => {
        loader = null
        reject(new Error('Desmos failed to load'))
      }
      document.head.appendChild(s)
    })
  }
  return loader
}

/** One Desmos calculator that fills its (positioned) parent. Hidden calculators keep their state. */
export function DesmosCalculator({ mode, active }: { mode: 'graphing' | 'scientific'; active: boolean }) {
  const { tr } = useI18n()
  const host = useRef<HTMLDivElement>(null)
  const calc = useRef<DesmosInstance | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    loadDesmos()
      .then((D) => {
        if (cancelled || !host.current) return
        calc.current =
          mode === 'graphing'
            ? D.GraphingCalculator(host.current, { keypad: true, expressions: true, settingsMenu: true, zoomButtons: true, border: false })
            : D.ScientificCalculator(host.current, { keypad: true, border: false })
        setState('ready')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
      calc.current?.destroy()
      calc.current = null
    }
  }, [mode])

  // keep Desmos laid out when the panel is dragged / the window changes
  useEffect(() => {
    const el = host.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => calc.current?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (active) requestAnimationFrame(() => calc.current?.resize())
  }, [active])

  return (
    <div className="absolute inset-0" style={{ display: active ? 'block' : 'none' }}>
      <div ref={host} className="h-full w-full" />
      {state === 'loading' && <p className="absolute inset-0 grid place-items-center text-sm font-semibold text-muted">{tr('Loading calculator…')}</p>}
      {state === 'error' && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-semibold text-red-600">{tr('Could not load the calculator. Check your internet connection.')}</p>}
    </div>
  )
}
