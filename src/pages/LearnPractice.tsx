import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatDate, useI18n } from '../lib/i18n'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAttemptReview, useDeleteAttempts, useLesson, useLessonProgress, useLessons, useHasAccess, useMyAttempts, useQuestionCounts, useQuestions, useSubmitAttempt, useTest, useTests, useToggleLessonDone } from '../lib/api'
import { SECTIONS, lessonKind, lessonPath, videoFirst, type AttemptResult, type LessonKind, type Section, type Test } from '../lib/types'
import { useAuth } from '../lib/auth'
import { Reveal } from '../components/Reveal'
import { ArrowLeft, CalculatorIcon, CheckIcon, ClockIcon, CloseIcon, FileIcon, PlayIcon, TrashIcon } from '../components/Icons'
import { CalculatorPanel, ReferencePanel, ToolButton, useMediaQuery } from '../components/math/MathTools'
import { Spinner } from '../components/Layouts'
import { InlineText, OptionText, PassageText } from '../components/PassageText'
import { SectionTile, themeOf } from '../components/SectionIcon'
import { FlashcardsLauncher } from '../components/Flashcards'
import { parseWordList } from '../lib/flashcards'

/** Shown to students without a subscription on lists that still have free items. */
function FreeModeBanner() {
  const { tr } = useI18n()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
      <p className="text-sm font-semibold text-brand-800">🔓 {tr('Free mode: some items are open, the rest need a subscription.')}</p>
      <Link to="/app/plans" className="text-sm font-bold text-brand-700 hover:text-brand-800">{tr('Choose a plan →')}</Link>
    </div>
  )
}

const freeChip = 'rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800'

export function Paywall() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-5">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-2xl font-extrabold mb-2">Нужна подписка</h2>
      <p className="text-muted text-sm mb-6 max-w-xs">Оплатите доступ, и мы активируем его вручную в течение нескольких часов.</p>
      <Link to="/app/plans" className="btn btn-primary">Выбрать план →</Link>
    </div>
  )
}


const sectionStyle: Record<Section, string> = {
  'Reading & Writing': 'bg-sky-100 text-sky-700',
  Math: 'bg-brand-100 text-brand-700',
}

export function SectionBadge({ section }: { section: Section }) {
  const { tr } = useI18n()
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sectionStyle[section] ?? sectionStyle['Reading & Writing']}`}>{tr(section)}</span>
}

function Filter({ value, onChange }: { value: Section | 'All'; onChange: (v: Section | 'All') => void }) {
  const { tr } = useI18n()
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
      {(['All', ...SECTIONS] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${value === s ? 'bg-brand-600 text-white' : 'glass !shadow-none text-muted'}`}
        >
          {tr(s)}
        </button>
      ))}
    </div>
  )
}

/* ---------- Lessons ---------- */
function PlayCircle({ done }: { done?: boolean }) {
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition-transform group-hover:scale-105 ${done ? 'bg-green-500 shadow-[0_8px_18px_-8px_rgba(34,197,94,.8)]' : 'bg-gradient-to-b from-brand-500 to-brand-700 shadow-btn'}`}>
      {done ? <CheckIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
    </span>
  )
}

const listText: Record<LessonKind, { title: string; blurb: string; allDone: string; empty: string; badge: string }> = {
  lesson: {
    title: 'Your learning path',
    blurb: 'Short lessons that build the skills tested on the SAT.',
    allDone: 'All lessons completed',
    empty: 'No lessons here yet.',
    badge: 'Lesson',
  },
  word_list: {
    title: 'Word Lists',
    blurb: 'SAT vocabulary, list by list.',
    allDone: 'All word lists completed',
    empty: 'No word lists here yet.',
    badge: 'Word list',
  },
}

export const LearnPage = () => <LessonList kind="lesson" />
export const WordListsPage = () => <LessonList kind="word_list" />

function LessonList({ kind }: { kind: LessonKind }) {
  const { tr } = useI18n()
  const text = listText[kind]
  const { loading: subLoading, active } = useHasAccess()
  const lessons = useLessons()
  const progress = useLessonProgress()
  const [filter, setFilter] = useState<Section | 'All'>('All')
  const done = new Set(progress.data?.map((p) => p.lesson_id))
  // video lessons lead the list, the "Continue" button and every section
  const published = videoFirst((lessons.data ?? []).filter((l) => l.published && lessonKind(l) === kind))
  const remaining = published.filter((l) => !done.has(l.id))
  const doneCount = published.length - remaining.length
  const minLeft = remaining.reduce((s, l) => s + l.duration_min, 0)
  const next = remaining[0]
  const pct = published.length ? Math.round((doneCount / published.length) * 100) : 0
  const groups = SECTIONS.filter((s) => filter === 'All' || s === filter)
    .map((s) => ({ section: s, items: published.filter((l) => l.section === s) }))
    .filter((g) => g.items.length > 0)

  if (subLoading) return <Spinner />
  // without a subscription the server only returns free items; with none of them, show the paywall
  if (!active && !lessons.isLoading && published.length === 0) return <Paywall />

  return (
    <div className="space-y-6">
      {!active && <FreeModeBanner />}
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-6 text-white shadow-[0_24px_50px_-24px_rgba(74,20,184,.8)]">
          <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-64 rounded-full bg-brand-300/20 blur-3xl" />
          <div className="relative">
            <h1 className="text-3xl font-extrabold">{tr(text.title)}</h1>
            <p className="mt-1 font-semibold text-white/90">{tr('{a}/{b} done · ~{m} min', { a: doneCount, b: published.length, m: minLeft })}</p>
            <p className="mt-1 max-w-md text-sm text-white/80">{tr(text.blurb)}</p>
            <div className="mt-4 h-2.5 max-w-md overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            {next ? (
              <Link to={lessonPath(next)} className="btn mt-5 bg-white !px-6 text-brand-700 shadow-lg hover:bg-brand-50">
                <PlayIcon className="h-5 w-5" /> {doneCount > 0 ? tr('Continue') : tr('Start')}
              </Link>
            ) : (
              published.length > 0 && (
                <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold">
                  <CheckIcon className="h-4 w-4" /> {tr(text.allDone)}
                </p>
              )
            )}
          </div>
        </section>
      </Reveal>

      <Filter value={filter} onChange={setFilter} />

      {lessons.isLoading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-muted">{tr(text.empty)}</p>
      ) : (
        groups.map((g) => {
          const d = g.items.filter((l) => done.has(l.id)).length
          const mins = g.items.filter((l) => !done.has(l.id)).reduce((s, l) => s + l.duration_min, 0)
          return (
            <section key={g.section} className="space-y-3">
              <Reveal>
                <div className="flex items-center gap-3">
                  <SectionTile section={g.section} size="h-10 w-10" />
                  <div>
                    <h2 className="text-xl font-extrabold leading-tight">{tr(g.section)}</h2>
                    <p className="text-sm font-semibold text-muted">{tr('{a}/{b} done · ~{m} min', { a: d, b: g.items.length, m: mins })}</p>
                  </div>
                </div>
              </Reveal>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {g.items.map((l, i) => {
                  const isDone = done.has(l.id)
                  return (
                    <Reveal key={l.id} delay={(i % 4) * 60}>
                      <Link
                        to={lessonPath(l)}
                        className="group flex h-full items-center gap-4 rounded-3xl bg-brand-50/70 p-4 ring-1 ring-brand-100 transition-all hover:bg-white hover:shadow-soft active:scale-[0.99]"
                      >
                        <SectionTile section={l.section} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold leading-snug">{l.title}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isDone ? 'bg-green-100 text-green-700' : themeOf(l.section).chip}`}>{isDone ? tr('Completed') : tr(text.badge)}</span>
                            {!active && l.is_free && <span className={freeChip}>{tr('Free')}</span>}
                          </div>
                          <p className="line-clamp-1 text-sm text-muted">{l.summary}</p>
                          <p className="mt-0.5 text-xs font-semibold text-muted">{tr('~{n} min', { n: l.duration_min })}</p>
                        </div>
                        <PlayCircle done={isDone} />
                      </Link>
                    </Reveal>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
/** A link straight to a video file (uploaded to Supabase Storage, or any .mp4/.webm/.mov) plays in our own player */
function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || url.includes('/storage/v1/object/public/lesson-videos/')
}

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

function inlineFormat(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>
    return p
  })
}

export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="prose-lesson">
      {blocks.map((b, i) => {
        const trimmed = b.trim()
        if (!trimmed || trimmed === '---') return <hr key={i} className="my-4 border-brand-100" />
        const lines = trimmed.split('\n')

        // Table: lines starting with |
        if (lines.length >= 2 && lines[0].startsWith('|')) {
          const cells = (row: string) =>
            row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim())
          const header = cells(lines[0])
          const body = lines.slice(2).filter(l => !l.match(/^\|[-| :]+\|$/))
          return (
            <div key={i} className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-brand-50">
                    {header.map((h, j) => <th key={j} className="border border-brand-200 px-3 py-2 text-left font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, j) => (
                    <tr key={j} className={j % 2 === 0 ? '' : 'bg-gray-50'}>
                      {cells(row).map((c, k) => <td key={k} className="border border-brand-200 px-3 py-2">{inlineFormat(c)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        // Lists
        if (lines.every(l => l.startsWith('- ') || l.startsWith('* '))) {
          return (
            <ul key={i} className="list-disc pl-6 my-2 space-y-1">
              {lines.map((l, j) => <li key={j}>{inlineFormat(l.slice(2))}</li>)}
            </ul>
          )
        }

        if (trimmed.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-5 mb-2">{inlineFormat(trimmed.slice(4))}</h3>
        if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-extrabold mt-6 mb-2">{inlineFormat(trimmed.slice(3))}</h2>
        if (trimmed.startsWith('# ')) return <h1 key={i} className="text-2xl font-extrabold mt-6 mb-3">{inlineFormat(trimmed.slice(2))}</h1>

        return <p key={i} className="my-2 leading-relaxed">{inlineFormat(trimmed)}</p>
      })}
    </div>
  )
}

export function LessonPage() {
  const { tr } = useI18n()
  const { id } = useParams()
  const lesson = useLesson(id)
  const progress = useLessonProgress()
  const toggle = useToggleLessonDone()
  const access = useHasAccess()
  if (access.loading || lesson.isLoading) return <Spinner />
  // a paid lesson is not returned at all without a subscription
  if (!lesson.data) return access.active ? <p className="glass rounded-2xl p-6">{tr("Lesson not found.")}</p> : <Paywall />
  if (!access.active && !lesson.data.is_free) return <Paywall />
  const l = lesson.data
  const isDone = progress.data?.some((p) => p.lesson_id === l.id) ?? false
  const embed = l.video_url ? youtubeEmbed(l.video_url) : null
  const isWordList = lessonKind(l) === 'word_list'
  const cards = isWordList ? parseWordList(l.content) : []

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <Link to={isWordList ? '/app/words' : '/app/learn'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
        <ArrowLeft className="h-4 w-4" /> {tr(isWordList ? 'All word lists' : 'All lessons')}
      </Link>
      <Reveal>
        <div className="flex items-center gap-2">
          <SectionBadge section={l.section} />
          <span className="flex items-center gap-1 text-xs text-muted">
            <ClockIcon className="h-3.5 w-3.5" /> {tr("{n} min", { n: l.duration_min })}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-extrabold">{l.title}</h1>
        <p className="mt-1 text-muted">{l.summary}</p>
      </Reveal>
      {embed && (
        <div className="aspect-video overflow-hidden rounded-2xl shadow-soft">
          <iframe src={embed} title={l.title} className="h-full w-full" allowFullScreen loading="lazy" />
        </div>
      )}
      {l.video_url && !embed && isVideoFile(l.video_url) && (
        <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-soft">
          <video src={l.video_url} controls playsInline preload="metadata" className="h-full w-full" controlsList="nodownload">
            <a href={l.video_url}>{tr('Watch video')}</a>
          </video>
        </div>
      )}
      {l.video_url && !embed && !isVideoFile(l.video_url) && (
        <a href={l.video_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
          <PlayIcon className="h-5 w-5" /> {tr("Watch video")}
        </a>
      )}
      {isWordList && cards.length >= 2 && <FlashcardsLauncher listId={l.id} cards={cards} />}
      <div className="glass rounded-2xl p-5 md:p-7">
        <RichText text={l.content} />
      </div>
      <button
        className={`btn w-full sm:w-auto ${isDone ? 'btn-ghost' : 'btn-primary'}`}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ lessonId: l.id, done: !isDone })}
      >
        {isDone ? (
          <>
            <CheckIcon className="h-5 w-5 text-green-600" /> {tr("Completed — mark as not done")}
          </>
        ) : (
          tr('Mark as completed')
        )}
      </button>
    </article>
  )
}

/* ---------- Practice ---------- */
function ModuleDialog({ form, modules, counts, best, onClose }: { form: string; modules: Test[]; counts: Record<string, number>; best: Map<string, number>; onClose: () => void }) {
  const { tr } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const ready = modules.filter((m) => (counts[m.id] ?? 0) > 0)
  const all = ready.length >= 2
  const totalQ = ready.reduce((s, m) => s + (counts[m.id] ?? 0), 0)
  const totalMin = ready.reduce((s, m) => s + m.duration_min, 0)

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 backdrop-blur-sm sm:place-items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={tr('Select Module to Practice')} className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold">{tr('Select Module to Practice')}</h2>
            <p className="mt-1 text-sm text-muted">{tr('Choose which module to practice from {form}', { form })}</p>
          </div>
          <button onClick={onClose} aria-label={tr('Close')} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-brand-50 hover:text-ink">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {all && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-4 text-white shadow-[0_18px_40px_-20px_rgba(74,20,184,.8)]">
              <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <h3 className="text-lg font-extrabold">{tr('Start both modules')}</h3>
                <p className="mt-0.5 text-sm text-white/85">{tr('Both modules in one session, one after another')}</p>
                <p className="mt-1 text-xs font-semibold text-white/80">{tr('{q} questions · ~{m} min', { q: totalQ, m: totalMin })}</p>
                <Link
                  to={`/app/practice/${ready[0].id}?then=${ready.slice(1).map((m) => m.id).join(',')}`}
                  className="btn mt-3 w-full bg-white text-brand-700 shadow-lg hover:bg-brand-50"
                >
                  <PlayIcon className="h-5 w-5" /> {tr('Start both modules')}
                </Link>
              </div>
            </div>
          )}

          {modules.map((m, i) => {
            const n = counts[m.id] ?? 0
            const no = m.module_no ?? i + 1
            return (
              <div key={m.id} className="rounded-2xl bg-brand-50/70 p-4 ring-1 ring-brand-100">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">{tr('Module {n}', { n: no })}</h3>
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">{tr('{n} questions', { n })}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {tr('~{n} min', { n: m.duration_min })}
                  {best.has(m.id) && <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-brand-700">{tr('Best: {p}%', { p: best.get(m.id) ?? 0 })}</span>}
                </p>
                {n > 0 ? (
                  <Link to={`/app/practice/${m.id}`} className="btn btn-primary mt-3 w-full">
                    {tr('Start Module {n}', { n: no })}
                  </Link>
                ) : (
                  <p className="mt-3 text-center text-sm font-semibold text-muted">{tr('Coming soon')}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function PracticePage() {
  const { tr } = useI18n()
  const { loading: subLoading, active } = useHasAccess()
  const tests = useTests()
  const counts = useQuestionCounts()
  const attempts = useMyAttempts()
  const [filter, setFilter] = useState<Section | 'All'>('All')
  const [openForm, setOpenForm] = useState<string | null>(null)
  const best = new Map<string, number>()
  for (const a of attempts.data ?? []) {
    const pct = a.total ? Math.round((a.score / a.total) * 100) : 0
    best.set(a.test_id, Math.max(best.get(a.test_id) ?? 0, pct))
  }
  const locked = (t: Test) => !active && !t.is_free
  // without a subscription, free tests come first
  const list = (tests.data ?? [])
    .filter((x) => x.published && (filter === 'All' || x.section === filter))
    .sort((a, b) => Number(locked(a)) - Number(locked(b)))

  // tests sharing a form_title are the modules of one full practice test
  const forms = new Map<string, Test[]>()
  const singles: Test[] = []
  for (const x of list) {
    if (x.form_title) forms.set(x.form_title, [...(forms.get(x.form_title) ?? []), x])
    else singles.push(x)
  }
  for (const mods of forms.values()) mods.sort((a, b) => (a.module_no ?? 0) - (b.module_no ?? 0))
  const c = counts.data ?? {}
  const empty = forms.size === 0 && singles.length === 0

  if (subLoading) return <Spinner />

  return (
    <div className="space-y-5">
      <Reveal>
        <h1 className="text-3xl font-extrabold">{tr('Practice Tests')}</h1>
      </Reveal>
      {!active && <FreeModeBanner />}
      <Filter value={filter} onChange={setFilter} />
      {tests.isLoading ? (
        <Spinner />
      ) : empty ? (
        <p className="glass rounded-2xl p-6 text-muted">{tr('No tests here yet.')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...forms.entries()].map(([title, mods], i) => {
            const q = mods.reduce((s, m) => s + (c[m.id] ?? 0), 0)
            const min = mods.reduce((s, m) => s + m.duration_min, 0)
            const formLocked = mods.every(locked)
            return (
              <Reveal key={title} delay={(i % 4) * 60}>
                <article className="glass flex h-full flex-col rounded-3xl p-5">
                  <div className="flex items-center gap-3">
                    <SectionTile section={mods[0].section} size="h-11 w-11" />
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-extrabold leading-tight">{title}</h2>
                      <p className="text-sm text-muted">
                        {tr(mods[0].section)}
                        {!active && !formLocked && <span className={`ml-2 ${freeChip}`}>{tr('Free')}</span>}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-2.5 text-[15px] text-muted">
                    <li className="flex items-center gap-3">
                      <FileIcon className="h-5 w-5 shrink-0 text-ink" /> {tr('Modules: {n}', { n: mods.length })}
                    </li>
                    <li className="flex items-center gap-3">
                      <ClockIcon className="h-5 w-5 shrink-0 text-ink" /> {formLocked ? tr('~{n} min', { n: min }) : tr('{q} questions · ~{m} min', { q, m: min })}
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckIcon className="h-5 w-5 shrink-0 text-ink" /> {tr('Full exam with multiple modules')}
                    </li>
                  </ul>
                  {formLocked ? (
                    <Link to="/app/plans" className="btn btn-ghost mt-6 w-full">🔒 {tr('With subscription')}</Link>
                  ) : (
                    <button className="btn btn-primary mt-6 w-full" onClick={() => setOpenForm(title)}>
                      {tr('Choose module')}
                    </button>
                  )}
                </article>
              </Reveal>
            )
          })}

          {singles.map((x, i) => {
            const n = c[x.id] ?? 0
            const body = (
              <>
                <SectionTile section={x.section} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold leading-snug">{x.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${themeOf(x.section).chip}`}>{tr('Full practice')}</span>
                    {!active && x.is_free && <span className={freeChip}>{tr('Free')}</span>}
                  </div>
                  <p className="line-clamp-1 text-sm text-muted">{x.description}</p>
                  <p className="mt-0.5 text-xs font-semibold text-muted">
                    {tr('~{n} min', { n: x.duration_min })}
                    {!locked(x) && <> · {tr('{n} questions', { n })}</>}
                    {best.has(x.id) && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-brand-700">{tr('Best: {p}%', { p: best.get(x.id) ?? 0 })}</span>}
                  </p>
                </div>
              </>
            )
            return (
              <Reveal key={x.id} delay={((forms.size + i) % 4) * 60}>
                {locked(x) ? (
                  <Link
                    to="/app/plans"
                    aria-label={`${tr('With subscription')}: ${x.title}`}
                    className="flex h-full items-center gap-4 rounded-3xl bg-brand-50/50 p-4 ring-1 ring-brand-100 transition-all hover:bg-white"
                  >
                    {body}
                    <span className="shrink-0 text-xs font-bold text-muted">🔒 {tr('With subscription')}</span>
                  </Link>
                ) : n > 0 ? (
                  <Link
                    to={`/app/practice/${x.id}`}
                    aria-label={`${best.has(x.id) ? tr('Retake') : tr('Start')}: ${x.title}`}
                    className="group flex h-full items-center gap-4 rounded-3xl bg-brand-50/70 p-4 ring-1 ring-brand-100 transition-all hover:bg-white hover:shadow-soft active:scale-[0.99]"
                  >
                    {body}
                    <PlayCircle />
                  </Link>
                ) : (
                  <div className="flex h-full items-center gap-4 rounded-3xl bg-brand-50/50 p-4 opacity-70 ring-1 ring-brand-100">
                    {body}
                    <span className="text-xs font-bold text-muted">{tr('Coming soon')}</span>
                  </div>
                )}
              </Reveal>
            )
          })}
        </div>
      )}

      <AttemptHistory />

      {openForm && forms.get(openForm) && <ModuleDialog form={openForm} modules={forms.get(openForm)!} counts={c} best={best} onClose={() => setOpenForm(null)} />}
    </div>
  )
}

function fmt(sec: number) {
  const s = Math.max(sec, 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const Bookmark = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M6.5 4h11v16.5L12 16.5 6.5 20.5V4Z" />
  </svg>
)

interface PrevModule {
  attemptId: string
  title: string
  module: number | null
  score: number
  total: number
}

/** Keyed by test id so moving from Module 1 to Module 2 starts with a clean player */
export function TestRunnerPage() {
  const { id } = useParams()
  const access = useHasAccess()
  const test = useTest(id)
  if (access.loading || test.isLoading) return <Spinner />
  if (!access.active && !test.data?.is_free) return <Paywall />
  return <TestRunnerInner key={id} />
}

function TestRunnerInner() {
  const { tr } = useI18n()
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const thenIds = (params.get('then') ?? '').split(',').filter(Boolean)
  const nextId = thenIds[0]
  const prev: PrevModule[] = (loc.state as { prev?: PrevModule[] } | null)?.prev ?? []
  const { profile } = useAuth()
  const test = useTest(id)
  const questions = useQuestions(id)
  const submit = useSubmitAttempt()
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [crossed, setCrossed] = useState<Record<string, number[]>>({})
  const [elimMode, setElimMode] = useState(false)
  // directions start collapsed to leave the whole screen to the question
  const [directions, setDirections] = useState(false)
  const [hideTimer, setHideTimer] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const finished = useRef(false)

  // math tools (Desmos calculator on the left, reference sheet on the right; bottom sheet / full screen on phones)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcMode, setCalcMode] = useState<'graphing' | 'scientific'>('graphing')
  const [calcW, setCalcW] = useState(440)
  const [sheetVh, setSheetVh] = useState(46)
  const [refOpen, setRefOpen] = useState(false)
  const [refExpanded, setRefExpanded] = useState(false)
  const [refW, setRefW] = useState(400)

  const qs = questions.data ?? []
  const total = test.data ? test.data.duration_min * 60 : null

  useEffect(() => {
    if (total !== null && left === null) setLeft(total)
  }, [total, left])

  const answersRef = useRef(answers)
  answersRef.current = answers

  // the mouse wheel scrolls the question page from anywhere (header, footer, margins), not only while hovering it
  const bodyRef = useRef<HTMLDivElement>(null)
  const forwardWheel = (e: React.WheelEvent) => {
    const el = bodyRef.current
    const t = e.target as HTMLElement
    if (!el || el.contains(t) || t.closest('aside,[aria-label=Calculator],[aria-label=Reference],[role=dialog]')) return
    el.scrollBy({ top: e.deltaY })
  }

  async function finish() {
    if (finished.current || !test.data) return
    finished.current = true
    try {
      const res = await submit.mutateAsync({ testId: test.data.id, answers: answersRef.current })
      if (nextId) {
        // full-test mode: no results between modules, go straight to the next one
        const entry: PrevModule = { attemptId: res.attempt_id, title: test.data.title, module: test.data.module_no, score: res.score, total: res.total }
        nav(`/app/practice/${nextId}${thenIds.length > 1 ? `?then=${thenIds.slice(1).join(',')}` : ''}`, { replace: true, state: { prev: [...prev, entry] } })
        return
      }
      setResult(res)
    } catch {
      finished.current = false
    }
  }

  useEffect(() => {
    if (left === null || result) return
    if (left <= 0) {
      if (Object.keys(answersRef.current).length > 0) void finish()
      return
    }
    const t = setTimeout(() => setLeft((v) => (v === null ? v : v - 1)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, result])

  if (test.isLoading || questions.isLoading) return <Spinner full />
  if (!test.data || qs.length === 0) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="glass rounded-2xl p-6">{tr("This test has no questions yet.")}</p>
        <Link to="/app/practice" className="btn btn-primary mt-4">
          {tr("Back to tests")}
        </Link>
      </div>
    )
  }

  if (result) {
    return (
      <div className="min-h-dvh px-5 py-8">
        <ResultView
          result={result}
          questions={qs}
          answers={answers}
          title={test.data.title}
          onRetry={() => {
            finished.current = false
            setResult(null)
            setAnswers({})
            setMarked(new Set())
            setCrossed({})
            setIdx(0)
            setLeft(total)
          }}
          onExit={() => nav('/app/practice')}
          prev={prev}
        />
      </div>
    )
  }

  const q = qs[idx]
  const answered = Object.keys(answers).length
  const last = idx === qs.length - 1
  const hasPassage = Boolean(q.passage)
  const isSpr = q.options.length === 0 // student-produced response: the student types the answer
  const isMath = test.data.section === 'Math'
  const split = hasPassage && !isMath // reading passages scroll separately from the questions; math scrolls as one page
  const refCovering = isMath && isDesktop && refOpen && refExpanded
  const isMarked = marked.has(q.id)

  const toggleMark = () =>
    setMarked((m) => {
      const n = new Set(m)
      if (n.has(q.id)) n.delete(q.id)
      else n.add(q.id)
      return n
    })
  const toggleCross = (i: number) =>
    setCrossed((c) => {
      const cur = c[q.id] ?? []
      return { ...c, [q.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] }
    })

  return (
    <div className="flex h-dvh flex-col" onWheel={forwardWheel}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white/55 backdrop-blur-xl">        {/* header */}
        <div className="shrink-0 bg-brand-100/80 px-4 py-3 sm:px-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="min-w-0">
              <Link to="/app/practice" className="mb-0.5 block truncate text-[11px] font-bold text-brand-600 hover:underline">
                ‹ {tr("Practice Tests")}
              </Link>
              <h1 className="truncate text-sm font-extrabold sm:text-base">{test.data.title}</h1>
              <button className="mt-0.5 flex items-center gap-1 text-xs font-bold text-ink/80" onClick={() => setDirections((v) => !v)} aria-expanded={directions}>
                {tr("Directions")} <span className={`transition-transform ${directions ? '' : 'rotate-180'}`}>⌃</span>
              </button>
            </div>
            <div className="text-center">
              <p className="text-base font-extrabold tabular-nums sm:text-lg">{hideTimer ? '••:••' : fmt(left ?? 0)}</p>
              <button className="mt-0.5 rounded-full border border-ink/70 px-3 text-[11px] font-bold" onClick={() => setHideTimer((v) => !v)}>
                {hideTimer ? tr('Show') : tr('Hide')}
              </button>
            </div>
            <div className="flex items-start justify-end gap-1.5 sm:gap-4">
              {isMath && (
                <>
                  <ToolButton icon={<CalculatorIcon className="h-5 w-5" />} label={tr('Calculator')} active={calcOpen} onClick={() => setCalcOpen((v) => !v)} />
                  <ToolButton icon={<span className="font-serif text-[0.95rem] font-bold italic leading-none">x²</span>} label={tr('Reference')} active={refOpen} onClick={() => setRefOpen((v) => !v)} />
                </>
              )}
              <button className="flex min-w-[3rem] flex-col items-center text-[11px] font-bold text-ink/80" onClick={() => setNavOpen(true)}>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-brand-700">☰</span>
                {tr("Questions")}
              </button>
            </div>
          </div>
          {directions && (
            <p className="mt-3 rounded-xl bg-white/70 px-4 py-2.5 text-sm text-muted">
              {tr("Choose the best answer for each question. Use Mark for Review to flag a question and the ABC button to cross out answers you have ruled out. The test is scored when you finish or when time runs out.")}
            </p>
          )}
        </div>
        <div className="shrink-0 border-y-2 border-dashed border-brand-300/70 bg-brand-900 py-1 text-center text-[11px] font-bold tracking-[0.25em] text-white">{tr("PRACTICE TEST")}</div>

        {/* body: [calculator] [question] [reference] */}
        <div className="flex min-h-0 flex-1">
          {isMath && <CalculatorPanel open={calcOpen} desktop={isDesktop} mode={calcMode} onMode={setCalcMode} width={calcW} onWidth={setCalcW} sheetVh={sheetVh} onSheetVh={setSheetVh} onClose={() => setCalcOpen(false)} />}
          <div ref={bodyRef} className={`@container min-w-0 flex-1 overflow-y-auto overscroll-contain ${refCovering ? 'hidden' : ''}`} style={{ paddingBottom: isMath && calcOpen && !isDesktop ? `${sheetVh}dvh` : undefined }}>
          <div className={`grid min-h-full gap-0 ${split ? '@3xl:h-full' : ''} ${hasPassage ? '@3xl:grid-cols-2' : ''}`}>
          {hasPassage && (
            <section className={`border-brand-100 p-5 sm:p-8 lg:px-10 @3xl:border-r-4 ${split ? '@3xl:h-full @3xl:overflow-y-auto' : ''}`}>
              <PassageText text={q.passage ?? ''} />
            </section>
          )}
          <section key={q.id} className={`animate-[fadein_.3s_ease] p-5 sm:p-8 lg:px-10 ${split ? '@3xl:h-full @3xl:overflow-y-auto' : ''} ${hasPassage ? '' : isMath ? 'mx-auto w-full max-w-4xl' : 'mx-auto w-full max-w-3xl'}`}>
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-1.5">
              <div className="flex items-center gap-3">
                <span className="grid h-8 min-w-8 place-items-center rounded-md bg-ink px-2 text-sm font-extrabold text-white">{idx + 1}</span>
                <button className={`flex items-center gap-1.5 text-xs font-bold ${isMarked ? 'text-brand-700' : 'text-ink/80'}`} onClick={toggleMark} aria-pressed={isMarked}>
                  <Bookmark filled={isMarked} /> {tr("Mark for Review")}
                </button>
              </div>
              {!isSpr && (
                <button
                  className={`rounded-md px-2 py-1 text-[11px] font-extrabold tracking-wide ${elimMode ? 'bg-brand-600 text-white' : 'bg-white text-brand-700 ring-1 ring-brand-200'}`}
                  onClick={() => setElimMode((v) => !v)}
                  aria-pressed={elimMode}
                  title={tr("Cross out answer choices")}
                >
                  ABC
                </button>
              )}
            </div>
            <div className="mt-1 border-b-2 border-dashed border-brand-200" />

            {q.prompt && (
              <p className="mt-5 text-[1.05rem] font-semibold leading-7 whitespace-pre-line">
                <InlineText text={q.prompt} />
              </p>
            )}
            {isSpr && (
              <div className="mt-5">
                <label htmlFor="spr" className="text-base font-extrabold">
                  {tr('Student-Produced Response')}
                </label>
                <input
                  id="spr"
                  key={q.id}
                  className="mt-3 w-full rounded-xl border-2 border-ink/70 bg-white px-4 py-3.5 text-lg font-semibold outline-none transition-colors focus:border-brand-600 focus:shadow-[0_0_0_3px_rgba(127,76,240,.15)]"
                  placeholder={tr('Enter your answer…')}
                  value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                  maxLength={12}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9./\-−,\s]/g, '')
                    setAnswers((a) => {
                      const n = { ...a }
                      if (v.trim() === '') delete n[q.id]
                      else n[q.id] = v
                      return n
                    })
                  }}
                />
                <p className="mt-2 text-xs text-muted">{tr('Enter a number, a fraction like 3/4, or a decimal. Negative answers start with a minus sign.')}</p>
              </div>
            )}
            <ul className={`mt-5 space-y-3 ${isSpr ? 'hidden' : ''}`} role="radiogroup" aria-label={tr("Answer choices")}>
              {q.options.map((opt, i) => {
                const picked = answers[q.id] === i
                const struck = (crossed[q.id] ?? []).includes(i)
                return (
                  <li key={i} className="flex items-center gap-3">
                    <button
                      role="radio"
                      aria-checked={picked}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                      className={`flex min-h-14 flex-1 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                        picked ? 'border-brand-600 bg-brand-50 shadow-[0_0_0_3px_rgba(127,76,240,.15)]' : 'border-ink/70 bg-white hover:border-brand-400'
                      } ${struck ? 'opacity-50' : ''}`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${picked ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink'}`}>{String.fromCharCode(65 + i)}</span>
                      <span className={`min-w-0 font-medium ${struck ? 'line-through' : ''}`}>
                        <OptionText text={opt} />
                      </span>
                    </button>
                    {elimMode && (
                      <button
                        onClick={() => toggleCross(i)}
                        aria-label={`Cross out option ${String.fromCharCode(65 + i)}`}
                        aria-pressed={struck}
                        className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold ${struck ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink'}`}
                      >
                        {String.fromCharCode(65 + i)}
                        <span className="absolute -inset-x-1.5 top-1/2 h-0.5 bg-current" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
          </div>
          </div>
          {isMath && <ReferencePanel open={refOpen} desktop={isDesktop} expanded={refExpanded} onExpanded={setRefExpanded} width={refW} onWidth={setRefW} onClose={() => { setRefOpen(false); setRefExpanded(false) }} />}
        </div>

        {/* footer */}
        <div className="shrink-0 border-t-2 border-dashed border-brand-300/70 bg-brand-100/80 px-4 py-3 sm:px-6">
          {submit.error && <p className="err mb-2 text-center">{(submit.error as Error).message}</p>}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <span className="truncate text-sm font-bold">{profile?.full_name || profile?.email}</span>
            <button className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white" onClick={() => setNavOpen(true)}>
              {tr("Question {a} of {b}", { a: idx + 1, b: qs.length })} <span className="ml-1">⌃</span>
            </button>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost !min-h-10 !px-4 !py-2 text-sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                {tr("Back")}
              </button>
              {last ? (
                <button className="btn btn-primary !min-h-10 !px-5 !py-2 text-sm" disabled={submit.isPending || answered === 0} onClick={() => void finish()}>
                  {submit.isPending ? tr('Scoring…') : tr('Finish')}
                </button>
              ) : (
                <button className="btn btn-primary !min-h-10 !px-5 !py-2 text-sm" onClick={() => setIdx((i) => i + 1)}>
                  {tr("Next")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* question navigator */}
      {navOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" onClick={() => setNavOpen(false)}>
          <div className="glass w-full max-w-xl rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Question navigator">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{test.data.title}</h2>
              <button className="text-sm font-semibold text-muted" onClick={() => setNavOpen(false)}>
                {tr("Close")}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-muted">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-600" /> {tr("Answered")}</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-dashed border-brand-400" /> {tr("Unanswered")}</span>
              <span className="flex items-center gap-1.5"><Bookmark filled /> {tr("For review")}</span>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-2.5 sm:grid-cols-8">
              {qs.map((item, n) => {
                const done = answers[item.id] !== undefined
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIdx(n)
                      setNavOpen(false)
                    }}
                    className={`relative grid h-11 place-items-center rounded-lg text-sm font-bold ${
                      done ? 'bg-brand-600 text-white' : 'border-2 border-dashed border-brand-400 text-brand-700'
                    } ${n === idx ? 'ring-2 ring-ink ring-offset-2' : ''}`}
                  >
                    {n + 1}
                    {marked.has(item.id) && <span className="absolute -right-1 -top-1 text-brand-700"><Bookmark filled /></span>}
                  </button>
                )
              })}
            </div>
            <button className="btn btn-primary mt-5 w-full" disabled={submit.isPending || answered === 0} onClick={() => { setNavOpen(false); void finish() }}>
              {tr("Finish test ({a}/{b} answered)", { a: answered, b: qs.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
function ResultView({ result, questions, answers, title, onRetry, onExit, prev, subtitle }: { result: AttemptResult; questions: { id: string; passage?: string | null; prompt: string; options: string[] }[]; answers: Record<string, number | string>; title: string; onRetry: () => void; onExit: () => void; prev?: PrevModule[]; subtitle?: string }): ReactNode {
  const { tr } = useI18n()
  const prevList = prev ?? []
  const fullScore = prevList.reduce((s, p) => s + p.score, 0) + result.score
  const fullTotal = prevList.reduce((s, p) => s + p.total, 0) + result.total
  const full = prevList.length > 0
  const pct = (full ? fullTotal : result.total) ? Math.round(((full ? fullScore : result.score) / (full ? fullTotal : result.total)) * 100) : 0
  const review = new Map(result.review.map((r) => [r.question_id, r]))
  const [onlyWrong, setOnlyWrong] = useState(false)
  const wrongCount = questions.filter((q) => review.get(q.id) && !review.get(q.id)!.correct).length
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="glass rounded-3xl p-7 text-center">
        <p className="text-sm font-semibold text-muted">{full ? tr('Full test result') : title}</p>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        <p className="mt-2 text-6xl font-extrabold text-gradient">{pct}%</p>
        <p className="mt-2 font-semibold">
          {tr("{s} of {t} correct", full ? { s: fullScore, t: fullTotal } : { s: result.score, t: result.total })}
        </p>
        {full && (
          <ul className="mx-auto mt-4 max-w-sm divide-y divide-brand-100 rounded-2xl bg-white/70 text-left text-sm">
            {prevList.map((p, i) => (
              <li key={p.attemptId}>
                <Link to={`/app/attempts/${p.attemptId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-50">
                  <span className="font-bold">{tr('Module {n}', { n: p.module ?? i + 1 })}</span>
                  <span className="font-semibold text-brand-700">
                    {p.score}/{p.total} · {tr('Review mistakes')} ›
                  </span>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-bold">{tr('Module {n}', { n: prevList.length + 1 })}</span>
              <span className="font-semibold text-brand-700">
                {result.score}/{result.total}
              </span>
            </li>
          </ul>
        )}
        <div className="mt-5 flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={onRetry}>
            {tr("Retake")}
          </button>
          <button className="btn btn-primary flex-1" onClick={onExit}>
            {tr("All tests")}
          </button>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{tr("Review")}</h2>
        <button
          role="switch"
          aria-checked={onlyWrong}
          onClick={() => setOnlyWrong((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${onlyWrong ? 'bg-brand-600 text-white' : 'bg-white/85 text-muted ring-1 ring-brand-100'}`}
        >
          {tr("Only mistakes")} ({wrongCount})
        </button>
      </div>
      {onlyWrong && wrongCount === 0 && <p className="glass rounded-2xl p-5 text-center font-semibold text-green-700">{tr("No mistakes in this attempt")}</p>}
      {questions.map((q, n) => {
        const r = review.get(q.id)
        const chosen = answers[q.id]
        const ok = Boolean(r?.correct)
        const spr = q.options.length === 0
        if (onlyWrong && ok) return null
        return (
          <article key={q.id} className="glass rounded-2xl p-5">
            <p className="text-sm font-bold text-muted">
              {tr("Question {n}", { n: n + 1 })} · <span className={ok ? 'text-green-600' : 'text-red-600'}>{ok ? tr('Correct') : chosen === undefined ? tr('Skipped') : tr('Incorrect')}</span>
            </p>
            {q.passage && <PassageText text={q.passage} className="mt-2 rounded-lg bg-brand-50 p-3 !text-sm !leading-6" />}
            {q.prompt && (
              <p className="mt-2 font-semibold whitespace-pre-line">
                <InlineText text={q.prompt} />
              </p>
            )}
            {spr && (
              <div className="mt-3 space-y-1.5 text-sm">
                <p className={`rounded-lg px-3 py-2 ${ok ? 'bg-green-50 font-semibold text-green-800' : 'bg-red-50 text-red-700'}`}>
                  {tr('Your answer')}: {chosen === undefined || chosen === '' ? '—' : String(chosen)}
                </p>
                {!ok && (
                  <p className="rounded-lg bg-green-50 px-3 py-2 font-semibold text-green-800">
                    {tr('Correct answer')}: {(r?.correct_answers ?? []).join(` ${tr('or')} `)}
                  </p>
                )}
              </div>
            )}
            <ul className="mt-3 space-y-1.5 text-sm">
              {q.options.map((o, i) => (
                <li key={i} className={`rounded-lg px-3 py-2 ${i === r?.correct_index ? 'bg-green-50 font-semibold text-green-800' : i === chosen ? 'bg-red-50 text-red-700' : 'text-muted'}`}>
                  <span className="flex gap-1.5">
                    {String.fromCharCode(65 + i)}. <OptionText text={o} />
                  </span>
                </li>
              ))}
            </ul>
            {r?.explanation && <p className="mt-3 whitespace-pre-line rounded-lg bg-brand-50 p-3 text-sm text-brand-900"><InlineText text={r.explanation} /></p>}
          </article>
        )
      })}
    </div>
  )
}

/* ---------- Attempt history ---------- */
export function AttemptHistory({ limit = 10 }: { limit?: number }) {
  const { tr } = useI18n()
  const attempts = useMyAttempts()
  const del = useDeleteAttempts()
  const all = attempts.data ?? []
  const list = all.slice(0, limit)
  if (attempts.isLoading) return null
  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{tr('Attempt history')}</h2>
        {all.length > 1 && (
          <button
            className="text-sm font-bold text-red-600 hover:underline disabled:opacity-50"
            disabled={del.isPending}
            onClick={() => window.confirm(tr('Delete all {n} attempts? This cannot be undone.', { n: all.length })) && del.mutate(all.map((a) => a.id))}
          >
            {tr('Clear history')}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{tr('No attempts yet')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-brand-100">
          {list.map((a) => {
            const pct = a.total ? Math.round((a.score / a.total) * 100) : 0
            return (
              <li key={a.id} className="flex items-center gap-1">
                <Link to={`/app/attempts/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-3 transition-colors hover:bg-brand-50/70">
                  {a.tests?.section && <SectionTile section={a.tests.section} size="h-10 w-10" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.tests?.title ?? tr('Practice test')}</p>
                    <p className="text-xs text-muted">{formatDate(a.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">
                    {a.score}/{a.total} · {pct}%
                  </span>
                  <span className="hidden text-sm font-bold text-brand-600 sm:inline">{tr('Review mistakes')} ›</span>
                </Link>
                <button
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={tr('Delete attempt')}
                  title={tr('Delete attempt')}
                  disabled={del.isPending}
                  onClick={() => window.confirm(tr('Delete this attempt? This cannot be undone.')) && del.mutate([a.id])}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function AttemptReviewPage() {
  const { id } = useParams()
  const { tr } = useI18n()
  const nav = useNavigate()
  const attempts = useMyAttempts()
  const attempt = attempts.data?.find((a) => a.id === id)
  const review = useAttemptReview(id)
  const questions = useQuestions(attempt?.test_id)

  if (attempts.isLoading || review.isLoading || (attempt && questions.isLoading)) return <Spinner />
  if (!attempt || !review.data) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="glass rounded-2xl p-6">{tr('Attempt not found')}</p>
        <Link to="/app/practice" className="btn btn-primary">
          {tr('All tests')}
        </Link>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <Link to="/app/practice" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
        <ArrowLeft className="h-4 w-4" /> {tr('Attempt history')}
      </Link>
      <ResultView
        result={review.data}
        questions={questions.data ?? []}
        answers={attempt.answers ?? {}}
        title={attempt.tests?.title ?? tr('Practice test')}
        subtitle={tr('Taken on {d}', { d: formatDate(attempt.created_at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}
        onRetry={() => nav(`/app/practice/${attempt.test_id}`)}
        onExit={() => nav('/app/practice')}
      />
    </div>
  )
}
