import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import { CloseIcon } from '../Icons'
import { DesmosCalculator } from './DesmosCalculator'
import { ReferenceSheet } from './ReferenceSheet'

/** true when the viewport matches (e.g. "(min-width: 768px)") */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Drag handle: reports pointer movement in pixels along one axis (works with mouse and touch). */
export function ResizeHandle({ axis, onDelta, className, children, label }: { axis: 'x' | 'y'; onDelta: (d: number) => void; className?: string; children?: ReactNode; label: string }) {
  const last = useRef<number | null>(null)
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      className={`touch-none select-none ${className ?? ''}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = axis === 'x' ? e.clientX : e.clientY
      }}
      onPointerMove={(e) => {
        if (last.current === null) return
        const cur = axis === 'x' ? e.clientX : e.clientY
        onDelta(cur - last.current)
        last.current = cur
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    >
      {children}
    </div>
  )
}

/** Header button like the official app: icon over a label */
export function ToolButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} className="group flex min-w-[3rem] flex-col items-center text-[11px] font-bold text-ink/85">
      <span className={`grid h-7 w-8 place-items-center rounded-lg transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-white/80 text-brand-700 group-hover:bg-white'}`}>{icon}</span>
      <span className={`mt-0.5 border-b-2 ${active ? 'border-brand-600' : 'border-transparent'}`}>{label}</span>
    </button>
  )
}

const Expand = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </svg>
)
const Collapse = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10h-6V4M4 14h6v6M14 10l7-7M3 21l7-7" />
  </svg>
)

const barBtn = 'grid h-9 w-9 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15'

/* ---------------- Calculator (Desmos) ---------------- */
export function CalculatorPanel({
  open,
  desktop,
  mode,
  onMode,
  width,
  onWidth,
  sheetVh,
  onSheetVh,
  onClose,
}: {
  open: boolean
  desktop: boolean
  mode: 'graphing' | 'scientific'
  onMode: (m: 'graphing' | 'scientific') => void
  width: number
  onWidth: (w: number) => void
  sheetVh: number
  onSheetVh: (v: number) => void
  onClose: () => void
}) {
  const { tr } = useI18n()
  const [everOpen, setEverOpen] = useState(false)
  const [sciSeen, setSciSeen] = useState(false)
  useEffect(() => {
    if (open) setEverOpen(true)
  }, [open])
  useEffect(() => {
    if (mode === 'scientific') setSciSeen(true)
  }, [mode])

  const tabs = (
    <div className="flex gap-1 rounded-xl bg-white/10 p-1" role="tablist" aria-label={tr('Calculator')}>
      {(['graphing', 'scientific'] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => onMode(m)}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${mode === m ? 'bg-white text-ink' : 'text-white/85 hover:bg-white/10'}`}
        >
          {m === 'graphing' ? tr('Graphing') : tr('Scientific')}
        </button>
      ))}
    </div>
  )

  const body = (
    <div className="relative min-h-0 flex-1 bg-white">
      {everOpen && <DesmosCalculator mode="graphing" active={mode === 'graphing'} />}
      {sciSeen && <DesmosCalculator mode="scientific" active={mode === 'scientific'} />}
    </div>
  )

  if (desktop) {
    return (
      <aside className={`${open ? 'flex' : 'hidden'} relative flex-none flex-col border-r border-ink/15 bg-white`} style={{ width }} aria-label={tr('Calculator')}>
        <div className="flex items-center justify-between gap-2 bg-ink px-3 py-2">
          {tabs}
          <button className={barBtn} onClick={onClose} aria-label={tr('Close')}>
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {body}
        <ResizeHandle axis="x" label={tr('Drag to resize')} className="absolute -right-1.5 top-0 z-10 h-full w-3 cursor-col-resize after:absolute after:inset-y-0 after:left-1 after:w-1 after:rounded-full after:bg-brand-400/0 hover:after:bg-brand-400/70" onDelta={(d) => onWidth(Math.min(Math.max(width + d, 300), Math.round(window.innerWidth * 0.65)))} />
      </aside>
    )
  }

  // phone: bottom sheet that can be dragged taller / shorter; the question stays scrollable above it
  return (
    <div className={`${open ? 'flex' : 'hidden'} fixed inset-x-0 bottom-0 z-40 flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-24px_60px_-24px_rgba(20,17,46,.55)]`} style={{ height: `${sheetVh}dvh` }} aria-label={tr('Calculator')}>
      <ResizeHandle axis="y" label={tr('Drag to resize')} className="grid h-6 shrink-0 cursor-row-resize place-items-center bg-ink" onDelta={(d) => onSheetVh(Math.min(Math.max(sheetVh - (d / window.innerHeight) * 100, 28), 90))}>
        <span className="h-1.5 w-12 rounded-full bg-white/35" />
      </ResizeHandle>
      <div className="flex shrink-0 items-center justify-between gap-2 bg-ink px-3 pb-2">
        {tabs}
        <button className={barBtn} onClick={onClose} aria-label={tr('Close')}>
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
      {body}
    </div>
  )
}

/* ---------------- Reference sheet ---------------- */
export function ReferencePanel({
  open,
  desktop,
  expanded,
  onExpanded,
  width,
  onWidth,
  onClose,
}: {
  open: boolean
  desktop: boolean
  expanded: boolean
  onExpanded: (v: boolean) => void
  width: number
  onWidth: (w: number) => void
  onClose: () => void
}) {
  const { tr } = useI18n()
  const bar = (
    <div className="flex shrink-0 items-center justify-between bg-ink px-4 py-2.5 text-white">
      <h2 className="text-base font-extrabold">{tr('Reference')}</h2>
      <div className="flex items-center gap-1">
        {desktop && (
          <button className={barBtn} onClick={() => onExpanded(!expanded)} aria-label={expanded ? tr('Collapse') : tr('Expand')} title={expanded ? tr('Collapse') : tr('Expand')}>
            {expanded ? <Collapse /> : <Expand />}
          </button>
        )}
        <button className={barBtn} onClick={onClose} aria-label={tr('Close')}>
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )

  if (desktop) {
    return (
      <aside className={`${open ? 'flex' : 'hidden'} relative min-w-0 flex-col border-l border-ink/15 bg-white ${expanded ? 'flex-1' : 'flex-none'}`} style={expanded ? undefined : { width }} aria-label={tr('Reference')}>
        {bar}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ReferenceSheet />
        </div>
        {!expanded && (
          <ResizeHandle axis="x" label={tr('Drag to resize')} className="absolute -left-1.5 top-0 z-10 h-full w-3 cursor-col-resize after:absolute after:inset-y-0 after:left-1 after:w-1 after:rounded-full after:bg-brand-400/0 hover:after:bg-brand-400/70" onDelta={(d) => onWidth(Math.min(Math.max(width - d, 300), Math.round(window.innerWidth * 0.7)))} />
        )}
      </aside>
    )
  }

  return (
    <div className={`${open ? 'flex' : 'hidden'} fixed inset-0 z-[60] flex-col bg-white`} aria-label={tr('Reference')}>
      {bar}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <ReferenceSheet />
      </div>
    </div>
  )
}
