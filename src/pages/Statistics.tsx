import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLessonProgress, useLessons, useMyAttempts } from '../lib/api'
import { formatDate, useI18n } from '../lib/i18n'
import { SECTIONS, type Attempt, type Section } from '../lib/types'
import { Reveal } from '../components/Reveal'
import { Spinner } from '../components/Layouts'
import { ChevronRight, GlassTile, GridIcon, MistakeIcon, PlayIcon } from '../components/Icons'
import { SectionIcon, SectionTile, themeOf } from '../components/SectionIcon'
import { ScoreForecast } from '../components/ScoreForecast'
import { useAuth } from '../lib/auth'

type Tab = 'Overview' | Section

const pctOf = (a: Attempt) => (a.total ? Math.round((a.score / a.total) * 100) : 0)

function EmptyState({ section }: { section: Section | null }) {
  const { tr } = useI18n()
  return (
    <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
      {/* hexagon tile with a tiny peak + flag */}
      <span className="grid h-24 w-24 place-items-center bg-gradient-to-br from-brand-100 to-brand-200 [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]">
        <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
          <path d="M6 40 L20 18 L27 28 L32 21 L42 40 Z" fill="#7f4cf0" />
          <path d="M20 18 L16 25 L19 24 L22 27 Z" fill="#fff" opacity=".9" />
          <path d="M20 18 V8" stroke="#3a1094" strokeWidth="2" strokeLinecap="round" />
          <path d="M20.5 8.5 L28 11 L20.5 14 Z" fill="#5b1fd6" />
        </svg>
      </span>
      <p className="mt-5 max-w-sm text-muted">{section ? tr('No {section} tests yet. Start your first one!', { section: tr(section) }) : tr('No practice tests yet. Start your first test!')}</p>
      <Link to="/app/practice" className="btn btn-primary mt-5">
        <PlayIcon className="h-5 w-5" /> {tr('Take a test')}
      </Link>
    </div>
  )
}

function ScoreChart({ attempts }: { attempts: Attempt[] }) {
  const { tr } = useI18n()
  const history = [...attempts].reverse().slice(-10)
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="font-bold">{tr('Score history')}</h2>
      <div className="mt-5 flex h-40 items-end gap-2 sm:gap-3">
        {history.map((a) => {
          const pct = pctOf(a)
          const sec = a.tests?.section
          return (
            <div key={a.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold text-brand-700">{pct}%</span>
              <div className={`w-full max-w-10 rounded-t-lg bg-gradient-to-t ${sec ? themeOf(sec).bar : 'from-brand-600 to-brand-400'}`} style={{ height: `${Math.max(pct, 4)}%` }} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Attempts({ attempts }: { attempts: Attempt[] }) {
  const { tr } = useI18n()
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="font-bold">{tr('Recent attempts')}</h2>
      <ul className="mt-2 divide-y divide-brand-100">
        {attempts.slice(0, 8).map((a) => (
          <li key={a.id}>
            <Link to={`/app/attempts/${a.id}`} className="flex items-center gap-3 rounded-xl py-3 transition-colors hover:bg-brand-50/70">
            {a.tests?.section && <SectionTile section={a.tests.section} size="h-10 w-10" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{a.tests?.title ?? tr('Practice test')}</p>
              <p className="text-xs text-muted">
                {a.tests ? tr(a.tests.section) : ''} · {formatDate(a.created_at, { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">
              {a.score}/{a.total} · {pctOf(a)}%
            </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function StatisticsPage() {
  const { tr } = useI18n()
  const { profile } = useAuth()
  const attemptsQ = useMyAttempts()
  const lessonsQ = useLessons()
  const doneQ = useLessonProgress()
  const [tab, setTab] = useState<Tab>('Overview')

  const data = useMemo(() => {
    const all = attemptsQ.data ?? []
    const published = (lessonsQ.data ?? []).filter((l) => l.published)
    const done = new Set(doneQ.data?.map((p) => p.lesson_id))
    const attempts = tab === 'Overview' ? all : all.filter((a) => a.tests?.section === tab)
    const lessons = tab === 'Overview' ? published : published.filter((l) => l.section === tab)
    const pcts = attempts.map(pctOf)
    return {
      attempts,
      lessonsDone: lessons.filter((l) => done.has(l.id)).length,
      lessonsTotal: lessons.length,
      avg: pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
      best: pcts.length ? Math.max(...pcts) : null,
    }
  }, [attemptsQ.data, lessonsQ.data, doneQ.data, tab])

  if (attemptsQ.isLoading || lessonsQ.isLoading) return <Spinner />

  const tabs: Tab[] = ['Overview', ...SECTIONS]
  const stats = [
    { label: 'Tests taken', value: String(data.attempts.length) },
    { label: 'Average score', value: data.avg === null ? '—' : `${data.avg}%` },
    { label: 'Best score', value: data.best === null ? '—' : `${data.best}%` },
    { label: 'Lessons completed', value: `${data.lessonsDone}/${data.lessonsTotal}` },
  ]

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-extrabold">{tr('Statistics')}</h1>
        <p className="mt-1 text-muted">{tr('Track your progress by skill')}</p>
      </Reveal>

      {/* skill tabs */}
      <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0" role="tablist" aria-label={tr('Statistics')}>
        <div className="flex w-max gap-2">
          {tabs.map((t) => {
            const on = tab === t
            return (
              <button
                key={t}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t)}
                className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-4 text-[15px] font-bold transition-all ${
                  on ? 'bg-gradient-to-b from-brand-500 to-brand-700 text-white' : 'glass !shadow-none text-muted hover:text-ink'
                }`}
              >
                {t === 'Overview' ? <GridIcon className="h-5 w-5" /> : <SectionIcon section={t} className="h-5 w-5" />}
                {tr(t)}
              </button>
            )
          })}
        </div>
      </div>

      <div key={tab} className="animate-[fadein_.3s_ease] space-y-6">
        {tab === 'Overview' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr]">
            <ScoreForecast target={profile?.target_score} />
            <Link to="/app/mistakes" className="glass group flex items-center gap-4 rounded-2xl p-4 transition-transform active:scale-[0.99] md:p-6 md:hover:-translate-y-0.5">
              <GlassTile className="h-12 w-12 !rounded-xl">
                <MistakeIcon className="h-7 w-7" />
              </GlassTile>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold">{tr('Mistake Bank')}</span>
                <span className="block text-sm text-muted">{tr('Every question you missed, in one place. Retry them until they stick.')}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink/80 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-4">
              <p className="text-2xl font-extrabold text-brand-700">{s.value}</p>
              <p className="mt-0.5 text-sm text-muted">{tr(s.label)}</p>
            </div>
          ))}
        </div>

        {data.attempts.length === 0 ? (
          <EmptyState section={tab === 'Overview' ? null : tab} />
        ) : (
          <>
            <ScoreChart attempts={data.attempts} />
            <Attempts attempts={data.attempts} />
          </>
        )}
      </div>
    </div>
  )
}
