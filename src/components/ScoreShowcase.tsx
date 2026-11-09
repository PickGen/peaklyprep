import { useEffect, useRef, useState } from 'react'
import { Reveal } from './Reveal'
import { useI18n } from '../lib/i18n'
import { ArrowLeft, ArrowRight, CloseIcon } from './Icons'

/**
 * Real score reports of PeaklyPrep students, cropped to one size (names and record numbers are cropped out).
 * To add or change one: put a 4:3 image into /public/scores and edit this list.
 */
const reports = [
  { src: '/scores/s1.jpg', w: 710, h: 532, total: 1580 },
  { src: '/scores/s2.jpg', w: 880, h: 660, total: 1500 },
  { src: '/scores/s3.jpg', w: 474, h: 355, total: 1580 },
  { src: '/scores/s4.jpg', w: 605, h: 454, total: 1500 },
]

export function ScoreShowcase() {
  const { tr } = useI18n()
  const [open, setOpen] = useState<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const drag = useRef({ active: false, moved: false, x: 0, left: 0 })

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const updateEdge = () => {
    const el = scroller.current
    if (!el) return
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft > el.scrollWidth - el.clientWidth - 4 })
  }
  useEffect(() => {
    updateEdge()
    window.addEventListener('resize', updateEdge)
    return () => window.removeEventListener('resize', updateEdge)
  }, [])

  const step = (dir: 1 | -1) => {
    const el = scroller.current
    const card = el?.querySelector<HTMLElement>('[data-card]')
    if (el && card) el.scrollBy({ left: dir * (card.offsetWidth + 24), behavior: 'smooth' })
  }

  // mouse drag-to-scroll for desktop (touch screens already swipe natively)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current
    if (e.pointerType !== 'mouse' || e.button !== 0 || !el) return
    drag.current = { active: true, moved: false, x: e.clientX, left: el.scrollLeft }
    el.style.scrollSnapType = 'none'
    const move = (ev: PointerEvent) => {
      const d = ev.clientX - drag.current.x
      if (Math.abs(d) > 5) drag.current.moved = true
      el.scrollLeft = drag.current.left - d
    }
    const up = () => {
      drag.current.active = false
      el.style.scrollSnapType = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const arrow = 'hidden h-11 w-11 place-items-center rounded-full bg-white text-brand-700 shadow-[0_10px_24px_-10px_rgba(74,20,184,.6)] ring-1 ring-brand-200/70 transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-35 md:grid'

  return (
    <section id="scores" className="mx-auto max-w-6xl scroll-mt-6 px-5 pb-20 pt-6 md:px-10">
      <Reveal className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          {tr("Aim for the")} <span className="text-gradient">{tr("top score")}</span>
        </h2>
        <p className="mt-3 text-muted">{tr("Lessons, timed practice and progress tracking built around one goal: 1580 and above.")}</p>
      </Reveal>

      <div
        ref={scroller}
        onScroll={updateEdge}
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault()
            e.stopPropagation()
            drag.current.moved = false
          }
        }}
        className="-mx-5 mt-10 flex cursor-grab snap-x snap-mandatory gap-4 md:snap-none overflow-x-auto px-5 pb-8 [scrollbar-width:none] active:cursor-grabbing md:mx-0 md:gap-6 md:px-1 md:pb-10 md:pt-4 [&::-webkit-scrollbar]:hidden"
      >
        {reports.map((r, i) => (
          <Reveal key={r.src} delay={i * 90} className="w-[82vw] max-w-[22rem] shrink-0 snap-start scroll-ml-5 md:w-[26rem] md:max-w-none md:scroll-ml-1">
            <button
              type="button"
              data-card
              onClick={() => setOpen(i)}
              aria-label={tr('SAT score report: {total}', { total: r.total })}
              className="group block aspect-[4/3] w-full overflow-hidden rounded-3xl bg-white shadow-[0_24px_50px_-28px_rgba(74,20,184,.6)] ring-1 ring-brand-200/70"
            >
              <img src={r.src} width={r.w} height={r.h} loading="lazy" decoding="async" alt={tr('SAT score report: {total}', { total: r.total })} className="pointer-events-none h-full w-full select-none object-cover object-top" draggable={false} />
            </button>
          </Reveal>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-center gap-4">
        <button className={arrow} onClick={() => step(-1)} disabled={edge.start} aria-label={tr('Previous')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-center text-xs text-muted">{tr("Real SAT results of PeaklyPrep students.")}</p>
        <button className={arrow} onClick={() => step(1)} disabled={edge.end} aria-label={tr('Next')}>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <button className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label={tr('Close')} onClick={() => setOpen(null)}>
            <CloseIcon className="h-6 w-6" />
          </button>
          <img src={reports[open].src} alt={tr('SAT score report: {total}', { total: reports[open].total })} className="max-h-[85dvh] max-w-full rounded-2xl bg-white object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  )
}
