import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCheckMistake, useHasAccess, useMistakeBank } from '../lib/api'
import { formatDate, useI18n } from '../lib/i18n'
import { SECTIONS, type MistakeItem, type Section } from '../lib/types'
import { Reveal } from '../components/Reveal'
import { Spinner } from '../components/Layouts'
import { CheckIcon, ChevronRight, PlayIcon } from '../components/Icons'
import { InlineText, PassageText } from '../components/PassageText'
import { SectionTile, themeOf } from '../components/SectionIcon'
import { Paywall } from './LearnPractice'

const PAGE = 10

function ChosenText({ m }: { m: MistakeItem }) {
  const { tr } = useI18n()
  if (m.chosen === null || m.chosen === undefined || m.chosen === '') return <>{tr('Skipped')}</>
  if (typeof m.chosen === 'number' && m.options.length) return <>{String.fromCharCode(65 + m.chosen)}</>
  return <>{String(m.chosen)}</>
}

function MistakeCard({ m, n, onFixed }: { m: MistakeItem; n: number; onFixed: (id: string) => void }) {
  const { tr } = useI18n()
  const check = useCheckMistake()
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [reveal, setReveal] = useState(false)
  const spr = m.options.length === 0
  const answer = spr ? typed.trim() : pick
  const ready = spr ? typed.trim() !== '' : pick !== null

  async function submit() {
    if (!ready || answer === null) return
    const r = await check.mutateAsync({ questionId: m.question_id, answer })
    setResult(r.correct ? 'correct' : 'wrong')
    if (r.correct) setTimeout(() => onFixed(m.question_id), 1600)
  }

  const showKey = reveal || result === 'correct'

  return (
    <article className={`glass overflow-hidden rounded-2xl transition-opacity ${result === 'correct' ? 'opacity-90 ring-2 ring-green-400' : ''}`}>
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <SectionTile section={m.section} size="h-10 w-10" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{m.test_title}</span>
          <span className="block text-xs text-muted">
            {tr('Question {n}', { n: m.position || n })} · {tr('Your answer')}: <ChosenText m={m} /> · {formatDate(m.attempted_at, { day: 'numeric', month: 'short' })}
          </span>
        </span>
        <ChevronRight className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-brand-100 p-4 pt-3">
          {m.passage && <PassageText text={m.passage} className="rounded-lg bg-brand-50 p-3 !text-sm !leading-6" />}
          {m.prompt && (
            <p className="mt-3 font-semibold whitespace-pre-line">
              <InlineText text={m.prompt} />
            </p>
          )}

          {spr ? (
            <div className="mt-3">
              <label htmlFor={`spr-${m.question_id}`} className="text-sm font-semibold text-muted">
                {tr('Your answer')}
              </label>
              <input
                id={`spr-${m.question_id}`}
                className="field mt-1 max-w-48 font-semibold"
                inputMode="decimal"
                maxLength={12}
                value={typed}
                disabled={result === 'correct'}
                onChange={(e) => {
                  setTyped(e.target.value.replace(/[^0-9./\-−, ]/g, ''))
                  setResult(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
              {showKey && (
                <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                  {tr('Correct answer')}: {(m.correct_answers ?? []).join(` ${tr('or')} `)}
                </p>
              )}
            </div>
          ) : (
            <ul className="mt-3 space-y-2" role="radiogroup" aria-label={tr('Answer choices')}>
              {m.options.map((o, i) => {
                const isKey = showKey && i === m.correct_index
                const isPick = pick === i
                return (
                  <li key={i}>
                    <button
                      role="radio"
                      aria-checked={isPick}
                      disabled={result === 'correct'}
                      onClick={() => {
                        setPick(i)
                        setResult(null)
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition-colors ${
                        isKey
                          ? 'bg-green-50 font-semibold text-green-800 ring-green-300'
                          : isPick && result === 'wrong'
                            ? 'bg-red-50 text-red-700 ring-red-300'
                            : isPick
                              ? 'bg-brand-50 font-semibold text-brand-800 ring-brand-400'
                              : 'bg-white/70 ring-brand-100 hover:bg-brand-50'
                      }`}
                    >
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${isPick ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'}`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <InlineText text={o} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {result === 'correct' && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-800" role="status">
              <CheckIcon className="h-4 w-4" /> {tr('Correct! This question leaves your mistake bank.')}
            </p>
          )}
          {result === 'wrong' && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="status">
              {tr('Not yet. Try again or show the answer.')}
            </p>
          )}
          {check.isError && <p className="err mt-2">{check.error.message}</p>}
          {showKey && m.explanation && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{m.explanation}</p>}

          {result !== 'correct' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary !min-h-11 flex-1 !py-2 text-sm sm:flex-none" disabled={!ready || check.isPending} onClick={submit}>
                {check.isPending ? tr('Checking…') : tr('Check answer')}
              </button>
              <button className="btn btn-ghost !min-h-11 flex-1 !py-2 text-sm sm:flex-none" onClick={() => setReveal((v) => !v)}>
                {reveal ? tr('Hide answer') : tr('Show answer')}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export default function MistakeBankPage() {
  const { tr } = useI18n()
  const access = useHasAccess()
  const bank = useMistakeBank(access.active)
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Section | 'All'>('All')
  const [shown, setShown] = useState(PAGE)
  const [fixed, setFixed] = useState<Set<string>>(new Set())

  const all = useMemo(() => (bank.data ?? []).filter((m) => !fixed.has(m.question_id)), [bank.data, fixed])
  const list = filter === 'All' ? all : all.filter((m) => m.section === filter)
  const bySection = SECTIONS.map((s) => ({ s, n: all.filter((m) => m.section === s).length }))

  if (access.loading) return <Spinner />
  if (!access.active) return <Paywall />

  return (
    <div className="space-y-6">
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-6 text-white shadow-[0_24px_50px_-24px_rgba(74,20,184,.8)]">
          <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h1 className="text-3xl font-extrabold">{tr('Mistake Bank')}</h1>
            <p className="mt-1 max-w-md text-sm text-white/85">{tr('Every question you missed, in one place. Retry them until they stick.')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold">{tr('{n} to fix', { n: all.length })}</span>
              {bySection.map(({ s, n }) => (
                <span key={s} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90">
                  {tr(s)}: {n}
                </span>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0" role="tablist">
        {(['All', ...SECTIONS] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={filter === s}
            onClick={() => {
              setFilter(s)
              setShown(PAGE)
            }}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${filter === s ? 'bg-brand-600 text-white' : 'glass !shadow-none text-muted'}`}
          >
            {tr(s)}
          </button>
        ))}
      </div>

      {bank.isLoading ? (
        <Spinner />
      ) : bank.isError ? (
        <p className="glass rounded-2xl p-6 text-sm text-red-700">{tr('Could not load the mistake bank.')} ({bank.error.message})</p>
      ) : list.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
          <span className={`grid h-16 w-16 place-items-center rounded-2xl ${themeOf('Math').tile}`}>
            <CheckIcon className="h-8 w-8" />
          </span>
          <p className="mt-4 max-w-sm font-semibold">
            {(bank.data ?? []).length === 0 && fixed.size === 0 ? tr('No mistakes yet. Questions you miss in practice tests will be collected here.') : tr('All mistakes here are fixed. Great work!')}
          </p>
          <Link to="/app/practice" className="btn btn-primary mt-5">
            <PlayIcon className="h-5 w-5" /> {tr('Take a test')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.slice(0, shown).map((m, i) => (
            <MistakeCard
              key={m.question_id}
              m={m}
              n={i + 1}
              onFixed={(id) => {
                setFixed((prev) => new Set(prev).add(id))
                qc.invalidateQueries({ queryKey: ['mistake_bank'] })
              }}
            />
          ))}
          {list.length > shown && (
            <button className="btn btn-ghost w-full" onClick={() => setShown((v) => v + PAGE)}>
              {tr('Show more ({n})', { n: list.length - shown })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
