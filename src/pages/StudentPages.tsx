import { useMemo, useState, type ReactNode } from 'react'
import { LANGS, formatDate, useI18n } from '../lib/i18n'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLessonProgress, useLessons, useMyAttempts, useNews, useTests, useUpdateProfile } from '../lib/api'
import { nameSchema, studyMinutesSchema, targetScoreSchema } from '../lib/schemas'
import { ExamDatePicker, RangeSlider } from '../components/ProfileControls'
import { fmtDate, todayIso, useSatDates } from '../lib/satDates'
import { Reveal } from '../components/Reveal'
import { BarsIcon, BookIcon, CalendarIcon, LayersIcon, CheckSquareIcon, MistakeIcon, ChevronRight, ClockIcon, EditIcon, GlassTile, GlobeIcon, LogoutIcon, MailIcon, NewsIcon, ShieldIcon, StarIcon, TargetIcon, UserIcon } from '../components/Icons'
import { Spinner } from '../components/Layouts'
import { DailyTasks } from '../components/DailyTasks'
import { PlanCard, PlanReminder, SubscriptionBadge } from '../components/SubscriptionBadge'
import { ScoreForecast, toForecastAttempts } from '../components/ScoreForecast'
import { forecast } from '../lib/score'

function useReadiness() {
  const lessons = useLessons()
  const tests = useTests()
  const done = useLessonProgress()
  const attempts = useMyAttempts()
  return useMemo(() => {
    const totalLessons = lessons.data?.length ?? 0
    const totalTests = tests.data?.length ?? 0
    const lessonsDone = done.data?.filter((p) => lessons.data?.some((l) => l.id === p.lesson_id)).length ?? 0
    const testsTaken = new Set(attempts.data?.map((a) => a.test_id) ?? []).size
    const denom = totalLessons + totalTests
    const percent = denom ? Math.min(100, Math.round(((lessonsDone + testsTaken) / denom) * 100)) : 0
    const predicted = forecast(toForecastAttempts(attempts.data ?? [])).total?.score ?? null
    return {
      predicted,
      loading: lessons.isLoading || tests.isLoading || done.isLoading || attempts.isLoading,
      percent,
      totalLessons,
      totalTests,
      lessonsDone,
      testsTaken,
      attempts: attempts.data ?? [],
    }
  }, [lessons, tests, done, attempts])
}

function Ridges() {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 w-full md:hidden" aria-hidden>
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a67dfa" stopOpacity=".5" />
          <stop offset="1" stopColor="#f6f2ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rfx" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" />
          <stop offset="0.82" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="rmask" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="120">
          <rect width="400" height="120" fill="url(#rfx)" />
        </mask>
      </defs>
      <g mask="url(#rmask)">
        <path d="M-20 80 L60 40 L110 66 L180 20 L250 62 L320 30 L420 70 V120 H-20Z" fill="url(#rg)" />
        <path d="M-20 100 L80 66 L150 90 L230 48 L310 86 L420 56 V120 H-20Z" fill="url(#rg)" opacity=".7" />
      </g>
    </svg>
  )
}

function GoalBanner({ predicted }: { predicted: number | null }) {
  const { tr } = useI18n()
  const { profile } = useAuth()
  if (!profile) return null
  const exam = profile.exam_date ? new Date(profile.exam_date + 'T00:00:00') : null
  const start = new Date(profile.created_at)
  const now = new Date()
  const daysLeft = exam ? Math.ceil((exam.getTime() - now.getTime()) / 86_400_000) : null
  const span = exam ? Math.max(exam.getTime() - start.getTime(), 1) : 1
  const progress = exam ? Math.min(Math.max((now.getTime() - start.getTime()) / span, 0.02), 1) : 0.02

  return (
    <section className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-6 text-white shadow-[0_24px_50px_-24px_rgba(74,20,184,.8)] md:block">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-72 rounded-full bg-brand-300/20 blur-3xl" />
      <div className="relative flex items-center gap-6">
        <span className="grid h-20 w-24 shrink-0 place-items-center rounded-[1.75rem] bg-white/95 shadow-lg">
          <img src="/logo.png" alt="" className="h-12 w-12 rounded-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-extrabold">
              {daysLeft === null ? tr('Exam date not chosen') : daysLeft > 0 ? tr('{n} days until the SAT', { n: daysLeft }) : daysLeft === 0 ? tr('SAT is today') : tr('SAT date has passed')}
            </h2>
            <Link to="/app/profile?edit=exam" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700">
              {exam ? formatDate(exam, { day: 'numeric', month: 'short', year: 'numeric' }) : tr('Choose date')}
            </Link>
          </div>
          <div className="relative mt-5 h-2.5 rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white/70" style={{ width: `${progress * 100}%` }} />
            <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-brand-600 shadow" style={{ left: `${progress * 100}%` }} />
            <span className="absolute left-0 top-5 text-[10px] font-bold uppercase tracking-wide text-white/80">{tr("Today")}</span>
          </div>
          <p className="mt-8 text-sm font-medium text-white/90">
            {predicted === null
              ? tr('Take a Reading & Writing and a Math test to see your projected total score.')
              : tr('Projected score: {s}', { s: predicted }) + (predicted < profile.target_score ? tr(' · {n} points to your goal', { n: profile.target_score - predicted }) : tr(' · you are on track for your goal'))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StarIcon className="h-14 w-14 drop-shadow" />
          <div>
            <p className="text-5xl font-extrabold leading-none">{profile.target_score}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/80">{tr("Goal")}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
function NavCard({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  const { tr } = useI18n()
  return (
    <Link to={to} className="glass group flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-transform active:scale-[0.99] md:hover:-translate-y-0.5">
      <GlassTile className="h-11 w-11 !rounded-xl">{icon}</GlassTile>
      <span className="flex-1 text-[17px] font-bold tracking-tight">{tr(label)}</span>
      <ChevronRight className="h-5 w-5 text-ink/80 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function HomePage() {
  const { tr } = useI18n()
  const { profile } = useAuth()
  const r = useReadiness()
  const first = profile?.full_name?.trim().split(/\s+/)[0] || tr('Student')

  return (
    <div className="relative">
      <Ridges />
      <Reveal>
        <h1 className="pt-8 text-[2rem] font-extrabold md:pt-0 md:text-4xl">{tr("Hi, {name}!", { name: first })}</h1>
      </Reveal>

      <PlanReminder className="mt-5 md:mt-6" />

      <Reveal delay={40} className="mt-6 hidden md:block">
        <GoalBanner predicted={r.predicted} />
      </Reveal>

      <div className="mt-5 grid grid-cols-1 gap-4 md:mt-6 md:grid-cols-[1.1fr_1fr] md:gap-6">
        <div className="space-y-4">
          <Reveal delay={80}>
            <section className="glass rounded-2xl p-4 md:p-6" aria-label="SAT Preparation progress">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[17px] font-bold">{tr("SAT Preparation")}</h2>
                <span className="text-[17px] font-bold">{r.loading ? '…' : `${r.percent}%`}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width] duration-1000 ease-out"
                  style={{ width: `${r.loading ? 0 : r.percent}%` }}
                />
              </div>
              <p className="mt-3 hidden text-sm text-muted md:block">
                {tr("{a}/{b} lessons · {c}/{d} practice tests", { a: r.lessonsDone, b: r.totalLessons, c: r.testsTaken, d: r.totalTests })}
              </p>
            </section>
          </Reveal>

          <Reveal delay={140}>
            <NavCard to="/app/learn" label="Lessons" icon={<BookIcon className="h-7 w-7" />} />
          </Reveal>
          <Reveal delay={170}>
            <NavCard to="/app/words" label="Word Lists" icon={<LayersIcon className="h-7 w-7" />} />
          </Reveal>
          <Reveal delay={200}>
            <NavCard to="/app/practice" label="Practice Tests" icon={<CheckSquareIcon className="h-7 w-7" />} />
          </Reveal>
          <Reveal delay={230}>
            <NavCard to="/app/mistakes" label="Mistake Bank" icon={<MistakeIcon className="h-7 w-7" />} />
          </Reveal>
          <Reveal delay={260}>
            <NavCard to="/app/progress" label="My Progress" icon={<BarsIcon className="h-7 w-7" />} />
          </Reveal>
          <Reveal delay={290}>
            <NavCard to="/app/leaderboard" label="Weekly leaderboard" icon={<StarIcon className="h-7 w-7" />} />
          </Reveal>
        </div>

        <div className="space-y-4 md:space-y-6">
        <Reveal delay={220}>
          <ScoreForecast target={profile?.target_score} />
        </Reveal>
        <Reveal delay={240}>
          <DailyTasks />
        </Reveal>
        <Reveal delay={280}>
          <NewsSection />
        </Reveal>
        <Reveal delay={200} className="hidden md:block">
          <section className="glass rounded-2xl p-6">
            <h2 className="text-lg font-bold">{tr("Recent activity")}</h2>
            {r.attempts.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{tr("No practice tests yet. Take your first one to see results here.")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-brand-100">
                {r.attempts.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-semibold">{a.tests?.title ?? tr('Practice test')}</span>
                    <span className="rounded-full bg-brand-100 px-3 py-1 font-bold text-brand-700">
                      {a.score}/{a.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>
        </div>
      </div>
    </div>
  )
}

function NewsSection() {
  const { tr } = useI18n()
  const news = useNews()
  const [open, setOpen] = useState<string | null>(null)
  const items = (news.data ?? []).filter((n) => n.published).slice(0, 5)
  return (
    <section className="glass rounded-2xl p-4 md:p-6" aria-label="News">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-600">
          <NewsIcon className="h-4 w-4" />
        </span>
        {tr("News")}
      </h2>
      {news.isLoading ? (
        <p className="mt-3 text-sm text-muted">{tr("Loading…")}</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{tr("No news yet.")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-brand-100">
          {items.map((n) => (
            <li key={n.id}>
              <button className="w-full py-3 text-left" onClick={() => setOpen(open === n.id ? null : n.id)} aria-expanded={open === n.id}>
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold leading-snug">{n.title}</span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(n.created_at, { day: 'numeric', month: 'short' })}</span>
                </span>
                <span className={`mt-1 block text-sm text-muted ${open === n.id ? '' : 'line-clamp-2'}`}>{n.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------- Profile ---------- */
function CardTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-3 text-xl font-extrabold">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-600">{icon}</span>
      {children}
    </h2>
  )
}

type EditorProps = { value: string; onChange: (v: string) => void }

function Row({
  icon,
  label,
  display,
  note,
  editor,
  onSave,
  startOpen = false,
  busy,
}: {
  icon: ReactNode
  label: string
  display: ReactNode
  note?: string
  editor?: (p: EditorProps) => ReactNode
  onSave?: (raw: string) => Promise<string | null>
  startOpen?: boolean
  busy?: boolean
}) {
  const { tr } = useI18n()
  const [open, setOpen] = useState(startOpen)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="border-b border-brand-100 py-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{tr(label)}</p>
          {open && editor ? (
            <div className="mt-2 space-y-2">
              {editor({ value: raw, onChange: setRaw })}
              {error && <p className="err">{tr(error)}</p>}
              <div className="flex gap-2">
                <button
                  className="btn btn-primary !min-h-9 !px-4 !py-1.5 text-sm"
                  disabled={busy}
                  onClick={async () => {
                    const msg = await onSave!(raw)
                    setError(msg)
                    if (!msg) setOpen(false)
                  }}
                >
                  {tr("Save")}
                </button>
                <button className="btn btn-ghost !min-h-9 !px-4 !py-1.5 text-sm" onClick={() => { setOpen(false); setError(null) }}>
                  {tr("Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-0.5 text-[15px] text-muted">{display}</div>
          )}
          {note && !open && <p className="mt-0.5 text-xs text-muted/80">{tr(note)}</p>}
        </div>
        {editor && !open && (
          <button
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-600"
            aria-label={`Edit ${label}`}
            onClick={() => {
              setRaw('')
              setOpen(true)
            }}
          >
            <EditIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

const studyPresets = [30, 60, 90, 120, 180, 240]

function fmtMinutes(m: number, tr: (k: string, v?: Record<string, string | number>) => string) {
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h && min) return tr('{h} h {m} min', { h, m: min })
  if (h) return tr('{h} h', { h })
  return tr('{m} min', { m: min })
}

export function ProfilePage() {
  const { profile, isAdmin, signOut } = useAuth()
  const { tr, lang, setLang } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const update = useUpdateProfile()
  const sat = useSatDates()
  if (!profile) return <Spinner />

  // Validates with Zod, saves, returns an error message (or null on success)
  async function save<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, raw: unknown, patch: (v: T) => Parameters<typeof update.mutateAsync>[0]) {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) return parsed.error?.issues[0]?.message ?? 'Invalid value'
    try {
      await update.mutateAsync(patch(parsed.data as T))
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save'
    }
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-extrabold">{tr('Profile')}</h1>
      </Reveal>
      <Reveal delay={40}>
        <PlanCard />
      </Reveal>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <section>
            <CardTitle icon={<UserIcon className="h-5 w-5" />}>{tr('Profile')}</CardTitle>
            <div className="glass rounded-3xl px-5 py-1">
              <Row
                icon={<UserIcon className="h-5 w-5" />}
                label="Name"
                display={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{profile.full_name || '—'}</span>
                    <SubscriptionBadge />
                  </span>
                }
                busy={update.isPending}
                editor={({ value, onChange }) => <input className="field" autoFocus value={value || profile.full_name || ''} onChange={(e) => onChange(e.target.value)} />}
                onSave={(raw) => save(nameSchema, raw || profile.full_name || '', (v: string) => ({ full_name: v }))}
              />
              <Row icon={<MailIcon className="h-5 w-5" />} label="Email" display={profile.email} note="Used to log in and can't be changed" />
              <Row
                icon={<TargetIcon className="h-5 w-5" />}
                label="Target SAT score"
                display={<span className="rounded-full bg-brand-100 px-3 py-1 font-bold text-brand-700">{profile.target_score}</span>}
                busy={update.isPending}
                editor={({ value, onChange }) => (
                  <RangeSlider
                    value={value ? Number(value) : profile.target_score}
                    onChange={(v) => onChange(String(v))}
                    min={400}
                    max={1600}
                    step={10}
                    hint={tr('Drag to set your goal')}
                    label={tr('Target SAT score')}
                  />
                )}
                onSave={(raw) => save(targetScoreSchema, raw || profile.target_score, (v: number) => ({ target_score: v }))}
              />
              <Row
                icon={<ClockIcon className="h-5 w-5" />}
                label="Daily study time"
                display={<span className="rounded-full bg-brand-100 px-3 py-1 font-bold text-brand-700">{fmtMinutes(profile.study_minutes, tr)}</span>}
                busy={update.isPending}
                editor={({ value, onChange }) => {
                  const cur = value ? Number(value) : profile.study_minutes
                  return (
                    <div className="space-y-4">
                      <RangeSlider
                        value={cur}
                        onChange={(v) => onChange(String(v))}
                        min={15}
                        max={480}
                        step={15}
                        format={(v) => fmtMinutes(v, tr)}
                        hint={tr('Drag to set your daily time')}
                        label={tr('Daily study time')}
                      />
                      <div>
                        <p className="mb-2 text-xs font-semibold text-muted">{tr('Quick pick')}</p>
                        <div className="flex flex-wrap gap-2">
                          {studyPresets.map((m) => (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={cur === m}
                              onClick={() => onChange(String(m))}
                              className={`min-h-10 rounded-full px-4 text-sm font-bold transition-colors ${cur === m ? 'bg-brand-600 text-white shadow-btn' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100'}`}
                            >
                              {fmtMinutes(m, tr)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                }}
                onSave={(raw) => save(studyMinutesSchema, raw || profile.study_minutes, (v: number) => ({ study_minutes: v }))}
              />
              <Row
                icon={<CalendarIcon className="h-5 w-5" />}
                label="SAT exam date"
                display={profile.exam_date ? fmtDate(profile.exam_date) : tr('Not set')}
                startOpen={params.get('edit') === 'exam'}
                busy={update.isPending}
                editor={({ value, onChange }) => <ExamDatePicker value={value} current={profile.exam_date} onChange={onChange} />}
                onSave={async (raw) => {
                  if (!raw) return 'Choose one of the official dates'
                  if (raw !== 'none' && !(sat.data?.dates ?? []).some((d) => d.date === raw && d.date >= todayIso())) return 'Choose one of the official dates'
                  try {
                    await update.mutateAsync({ exam_date: raw === 'none' ? null : raw })
                    return null
                  } catch (e) {
                    return e instanceof Error ? e.message : 'Could not save'
                  }
                }}
              />
              <div className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-semibold">{tr('Email updates')}</p>
                  <p className="text-xs text-muted">{tr('Get tips and reminders')}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={profile.email_updates}
                  aria-label={tr('Email updates')}
                  onClick={() => update.mutate({ email_updates: !profile.email_updates })}
                  className={`relative h-7 w-12 rounded-full transition-colors ${profile.email_updates ? 'bg-brand-600' : 'bg-brand-200'}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${profile.email_updates ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </section>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={60}>
            <section>
              <CardTitle icon={<GlobeIcon className="h-5 w-5" />}>{tr('Settings')}</CardTitle>
              <div className="glass rounded-3xl p-5">
                <p className="mb-3 text-sm font-semibold">{tr('Language')}</p>
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-brand-50 p-1.5" role="radiogroup" aria-label={tr('Language')}>
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      role="radio"
                      aria-checked={lang === l.code}
                      onClick={() => setLang(l.code)}
                      className={`min-h-11 rounded-xl px-2 text-sm font-bold transition-all ${lang === l.code ? 'bg-white text-brand-700 shadow-soft ring-1 ring-brand-200' : 'text-muted hover:text-ink'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </Reveal>

          <Reveal delay={120}>
            <section>
              <CardTitle icon={<MailIcon className="h-5 w-5" />}>{tr('Support')}</CardTitle>
              <div className="glass overflow-hidden rounded-3xl">
                <a href="mailto:support@peaklyprep.com" className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/60">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-600">
                    <MailIcon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{tr('Email')}</span>
                    <span className="block text-xs text-muted">support@peaklyprep.com</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </a>
                <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-brand-100 px-5 py-3 text-sm text-muted">
                  <Link to="/privacy" className="hover:text-brand-600">
                    {tr('Privacy Policy')}
                  </Link>
                  <Link to="/terms" className="hover:text-brand-600">
                    {tr('Terms of Use')}
                  </Link>
                </div>
              </div>
            </section>
          </Reveal>

          <Reveal delay={180} className="flex flex-col gap-3">
            {isAdmin && (
              <Link to="/admin" className="btn btn-ghost">
                <ShieldIcon className="h-5 w-5" /> {tr('Open admin panel')}
              </Link>
            )}
            <button
              className="btn btn-danger"
              onClick={async () => {
                await signOut()
                nav('/')
              }}
            >
              <LogoutIcon className="h-5 w-5" /> {tr('Log out')}
            </button>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
