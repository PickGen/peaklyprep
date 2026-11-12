import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { useHasAccess, useLessonProgress, useLessons, useMyAttempts, useQuestionCounts, useTests } from '../lib/api'
import { lessonPath } from '../lib/types'
import { CheckRingIcon, ClipboardCheckIcon, ClipboardIcon, PlayRingIcon } from './Icons'

interface Task {
  key: string
  kind: 'lesson' | 'test'
  title: string
  minutes: number
  to: string
  done: boolean
}

const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

/**
 * Today's plan, built from the student's daily study time:
 * what was finished today (checked) + the next lessons / practice tests that still fit the time budget.
 */
function useDailyTasks(): { tasks: Task[]; loading: boolean; minutesLeft: number } {
  const { profile } = useAuth()
  const lessons = useLessons()
  const tests = useTests()
  const progress = useLessonProgress()
  const attempts = useMyAttempts()
  const counts = useQuestionCounts()

  return useMemo(() => {
    const loading = lessons.isLoading || tests.isLoading || progress.isLoading || attempts.isLoading
    const budget = profile?.study_minutes ?? 60
    const allLessons = (lessons.data ?? []).filter((l) => l.published)
    const allTests = (tests.data ?? []).filter((t) => t.published && (counts.data?.[t.id] ?? 0) > 0)

    const doneIds = new Set(progress.data?.map((p) => p.lesson_id))
    const doneTodayIds = new Set(progress.data?.filter((p) => sameDay(p.completed_at)).map((p) => p.lesson_id))
    const testsToday = new Set((attempts.data ?? []).filter((a) => sameDay(a.created_at)).map((a) => a.test_id))

    const done: Task[] = [
      ...allLessons.filter((l) => doneTodayIds.has(l.id)).map<Task>((l) => ({ key: `l${l.id}`, kind: 'lesson', title: l.title, minutes: l.duration_min, to: lessonPath(l), done: true })),
      ...allTests.filter((t) => testsToday.has(t.id)).map<Task>((t) => ({ key: `t${t.id}`, kind: 'test', title: t.title, minutes: t.duration_min, to: `/app/practice/${t.id}`, done: true })),
    ]

    // never-taken tests first, then the ones attempted longest ago
    const lastAttempt = new Map<string, number>()
    for (const a of attempts.data ?? []) lastAttempt.set(a.test_id, Math.max(lastAttempt.get(a.test_id) ?? 0, new Date(a.created_at).getTime()))
    const testQueue = allTests.filter((t) => !testsToday.has(t.id)).sort((a, b) => (lastAttempt.get(a.id) ?? 0) - (lastAttempt.get(b.id) ?? 0))
    const lessonQueue = allLessons.filter((l) => !doneIds.has(l.id))

    const spent = done.reduce((s, t) => s + t.minutes, 0)
    let left = Math.max(budget - spent, 0)
    const upcoming: Task[] = []
    const pattern: ('lesson' | 'test')[] = ['lesson', 'lesson', 'test', 'lesson', 'test']
    for (const kind of pattern) {
      const item = kind === 'lesson' ? lessonQueue.shift() : testQueue.shift()
      if (!item) continue
      const minutes = item.duration_min
      // always offer at least one task; after that respect the time budget
      if (upcoming.length > 0 && minutes > left) continue
      left -= minutes
      upcoming.push({
        key: `${kind[0]}${item.id}`,
        kind,
        title: item.title,
        minutes,
        to: kind === 'lesson' ? lessonPath(item) : `/app/practice/${item.id}`,
        done: false,
      })
    }
    return { tasks: [...done, ...upcoming], loading, minutesLeft: upcoming.reduce((s, t) => s + t.minutes, 0) }
  }, [profile?.study_minutes, lessons.data, lessons.isLoading, tests.data, tests.isLoading, progress.data, progress.isLoading, attempts.data, attempts.isLoading, counts.data])
}

export function DailyTasks() {
  const { tr } = useI18n()
  const { tasks, loading: tasksLoading, minutesLeft } = useDailyTasks()
  const access = useHasAccess()
  const loading = tasksLoading || access.loading
  const doneCount = tasks.filter((t) => t.done).length
  const firstOpen = tasks.findIndex((t) => !t.done)

  return (
    <section className="glass rounded-2xl p-4 md:p-6" aria-label={tr('Daily tasks')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">{tr('Daily tasks')}</h2>
        {!loading && tasks.length > 0 && <span className="text-xs font-semibold text-muted">{tr('{a}/{b} done · ~{m} min', { a: doneCount, b: tasks.length, m: minutesLeft })}</span>}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted">{tr('Loading…')}</p>
      ) : !access.active && tasks.length === 0 ? (
        <div className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm">
          <p className="font-semibold">🔒 {tr('Daily tasks open with a subscription')}</p>
          <Link to="/app/plans" className="mt-1 inline-block font-bold text-brand-700">{tr('Choose a plan →')}</Link>
        </div>
      ) : tasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{tr('No tasks yet')}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1">
            {tasks.map((t, i) => {
              const current = i === firstOpen
              const Icon = t.done ? CheckRingIcon : t.kind === 'lesson' ? PlayRingIcon : current ? ClipboardCheckIcon : ClipboardIcon
              return (
                <li key={t.key}>
                  <Link
                    to={t.to}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${current ? 'bg-brand-100/80 text-brand-800' : 'hover:bg-brand-50'} ${t.done ? 'text-muted' : ''}`}
                    aria-current={current ? 'step' : undefined}
                  >
                    <Icon className={`h-6 w-6 shrink-0 ${t.done ? 'text-green-600' : current ? 'text-brand-700' : 'text-ink'}`} />
                    <span className={`min-w-0 flex-1 truncate text-[15px] ${current ? 'font-bold' : 'font-medium'} ${t.done ? 'line-through decoration-muted/50' : ''}`}>{t.title}</span>
                    <span className="shrink-0 text-xs font-semibold text-muted">{tr('~{n} min', { n: t.minutes })}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {!access.active && (
            <p className="mt-3 text-xs font-semibold text-muted">
              🔓 {tr('Free mode')} · <Link to="/app/plans" className="text-brand-700">{tr('Choose a plan →')}</Link>
            </p>
          )}
          {firstOpen === -1 && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{tr('All tasks for today are done')}</p>}
        </>
      )}
    </section>
  )
}
