import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../lib/i18n'
import { shuffle, type Flashcard } from '../lib/flashcards'
import { CardsIcon, CheckIcon, CloseIcon, ShuffleIcon } from './Icons'

/* which words of a list the student already knows (per device; it is only a study aid) */
const storeKey = (listId: string) => `peakly.fc.${listId}`
function loadKnown(listId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storeKey(listId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}
function saveKnown(listId: string, known: Set<string>) {
  try {
    localStorage.setItem(storeKey(listId), JSON.stringify([...known]))
  } catch {
    /* storage unavailable */
  }
}

/** The card on the word list page: how many words are learned + a button that opens the study mode. */
export function FlashcardsLauncher({ listId, cards }: { listId: string; cards: Flashcard[] }) {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  const [known, setKnown] = useState(() => loadKnown(listId))
  const learned = cards.filter((c) => known.has(c.word.toLowerCase())).length
  const pct = cards.length ? Math.round((learned / cards.length) * 100) : 0

  return (
    <>
      <section className="glass flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center md:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100">
            <CardsIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{tr('Flashcards')}</p>
            <p className="text-sm text-muted">{tr('{a} of {b} words learned', { a: learned, b: cards.length })}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <button className="btn btn-primary w-full sm:w-auto" onClick={() => setOpen(true)}>
          {learned > 0 && learned < cards.length ? tr('Continue') : tr('Study flashcards')}
        </button>
      </section>
      {open && (
        <FlashcardStudy
          cards={cards}
          known={known}
          onChange={(k) => {
            setKnown(k)
            saveKnown(listId, k)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function FlashcardStudy({ cards, known, onChange, onClose }: { cards: Flashcard[]; known: Set<string>; onChange: (k: Set<string>) => void; onClose: () => void }) {
  const { tr } = useI18n()
  // start with the words not learned yet (all of them if the list is done)
  const firstDeck = () => {
    const left = cards.filter((c) => !known.has(c.word.toLowerCase()))
    return left.length ? left : cards
  }
  const [deck, setDeck] = useState<Flashcard[]>(firstDeck)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [learning, setLearning] = useState<Flashcard[]>([])
  const [defFirst, setDefFirst] = useState(false)
  const [drag, setDrag] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const done = i >= deck.length
  const card = deck[i]
  const roundKnown = useMemo(() => deck.slice(0, i).filter((c) => !learning.includes(c)).length, [deck, i, learning])

  function answer(knows: boolean) {
    if (!card) return
    const k = new Set(known)
    const w = card.word.toLowerCase()
    if (knows) k.add(w)
    else {
      k.delete(w)
      setLearning((l) => [...l, card])
    }
    onChange(k)
    setFlipped(false)
    setDrag(0)
    setI((n) => n + 1)
  }

  function restart(next: Flashcard[]) {
    setDeck(next)
    setI(0)
    setLearning([])
    setFlipped(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (done) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
      if (e.key === 'ArrowRight') answer(true)
      if (e.key === 'ArrowLeft') answer(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  })

  const front = (c: Flashcard) => (defFirst ? <p className="text-xl font-semibold leading-relaxed md:text-2xl">{c.definition}</p> : <Word c={c} />)
  const back = (c: Flashcard) =>
    defFirst ? (
      <div>
        <Word c={c} />
        {c.example && <p className="mt-4 text-base italic text-muted">“{c.example}”</p>}
      </div>
    ) : (
      <div>
        <p className="text-xl font-semibold leading-relaxed md:text-2xl">{c.definition}</p>
        {c.example && <p className="mt-4 text-base italic text-muted">“{c.example}”</p>}
      </div>
    )

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#f6f2ff]" role="dialog" aria-modal="true" aria-label={tr('Flashcards')}>
      <header className="safe-top flex items-center justify-between gap-3 border-b border-brand-100 bg-white/80 px-4 py-3 backdrop-blur">
        <button className="grid h-11 w-11 place-items-center rounded-full hover:bg-brand-50" onClick={onClose} aria-label={tr('Close')}>
          <CloseIcon className="h-6 w-6" />
        </button>
        <p className="text-sm font-bold">{done ? tr('Round complete') : `${i + 1} / ${deck.length}`}</p>
        <div className="flex items-center gap-1">
          <button
            className={`h-11 rounded-full px-3 text-xs font-bold ${defFirst ? 'bg-brand-600 text-white' : 'text-muted hover:bg-brand-50'}`}
            onClick={() => {
              setDefFirst((v) => !v)
              setFlipped(false)
            }}
            aria-pressed={defFirst}
            title={tr('Show the definition first')}
          >
            {tr('Def. first')}
          </button>
          <button className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-brand-50" onClick={() => restart(shuffle(deck))} aria-label={tr('Shuffle')}>
            <ShuffleIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="h-1.5 bg-brand-100" aria-hidden>
        <div className="h-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width]" style={{ width: `${deck.length ? (Math.min(i, deck.length) / deck.length) * 100 : 0}%` }} />
      </div>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6">
        {done ? (
          <div className="w-full max-w-md text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-green-100 text-green-700">
              <CheckIcon className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold">{tr('You know {a} of {b}', { a: roundKnown, b: deck.length })}</h2>
            <p className="mt-1 text-muted">{learning.length ? tr('{n} words still need practice.', { n: learning.length }) : tr('Every word in this round is learned.')}</p>
            <div className="mt-6 flex flex-col gap-3">
              {learning.length > 0 && (
                <button className="btn btn-primary" onClick={() => restart(shuffle(learning))}>
                  {tr('Practice {n} words again', { n: learning.length })}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => restart(shuffle(cards))}>
                {tr('Study all {n} words', { n: cards.length })}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                {tr('Back to the list')}
              </button>
            </div>
          </div>
        ) : (
          card && (
            <div className="w-full max-w-xl">
              <button
                key={`${i}-${defFirst}`}
                className="relative block min-h-[min(22rem,52dvh)] w-full touch-pan-y select-none rounded-3xl bg-white p-6 text-center shadow-[0_24px_50px_-28px_rgba(74,20,184,.6)] ring-1 ring-brand-100 transition-transform duration-150 md:p-10"
                style={{ transform: `translateX(${drag}px) rotate(${drag / 30}deg)` }}
                onClick={() => Math.abs(drag) < 6 && setFlipped((f) => !f)}
                onPointerDown={(e) => {
                  start.current = { x: e.clientX, y: e.clientY }
                }}
                onPointerMove={(e) => {
                  if (!start.current) return
                  const dx = e.clientX - start.current.x
                  if (Math.abs(dx) > Math.abs(e.clientY - start.current.y)) setDrag(dx)
                }}
                onPointerUp={() => {
                  start.current = null
                  if (drag > 90) answer(true)
                  else if (drag < -90) answer(false)
                  else setTimeout(() => setDrag(0), 0)
                }}
                onPointerCancel={() => {
                  start.current = null
                  setDrag(0)
                }}
                aria-label={flipped ? tr('Hide the answer') : tr('Show the answer')}
              >
                <span className="absolute left-4 top-4 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">
                  {flipped ? tr(defFirst ? 'Word' : 'Definition') : tr(defFirst ? 'Definition' : 'Word')}
                </span>
                {drag > 30 && <span className="absolute right-4 top-4 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">{tr('I know it')}</span>}
                {drag < -30 && <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{tr('Still learning')}</span>}
                <span className="flex min-h-[min(18rem,42dvh)] flex-col items-center justify-center">{flipped ? back(card) : front(card)}</span>
                <span className="absolute inset-x-0 bottom-4 text-xs font-semibold text-muted">{flipped ? '' : tr('Tap the card to flip it')}</span>
              </button>
            </div>
          )
        )}
      </main>

      {!done && (
        <footer className="safe-bottom border-t border-brand-100 bg-white/80 px-4 pb-3 pt-3 backdrop-blur">
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
            <button className="btn min-h-12 bg-amber-100 text-amber-900 hover:bg-amber-200" onClick={() => answer(false)}>
              {tr('Still learning')}
            </button>
            <button className="btn btn-primary min-h-12" onClick={() => answer(true)}>
              <CheckIcon className="h-5 w-5" /> {tr('I know it')}
            </button>
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted md:block">{tr('Space: flip · ←: still learning · →: I know it')}</p>
        </footer>
      )}
    </div>,
    document.body,
  )
}

function Word({ c }: { c: Flashcard }) {
  return (
    <div>
      <p className="break-words text-4xl font-extrabold tracking-tight text-brand-800 md:text-5xl">{c.word}</p>
      {c.pos && <p className="mt-2 text-base font-semibold italic text-muted">{c.pos}</p>}
    </div>
  )
}
