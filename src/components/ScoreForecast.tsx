import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMyAttempts } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { forecast, type Forecast, type ForecastAttempt, type SectionForecast } from '../lib/score'
import type { Attempt, Section } from '../lib/types'
import { SectionIcon } from './SectionIcon'
import { TargetIcon } from './Icons'

export function toForecastAttempts(attempts: Attempt[]): ForecastAttempt[] {
  return attempts
    .filter((a) => a.tests?.section)
    .map((a) => ({
      test_id: a.test_id,
      score: a.score,
      total: a.total,
      created_at: a.created_at,
      section: a.tests!.section,
      form_title: a.tests!.form_title ?? null,
      module_no: a.tests!.module_no ?? null,
    }))
}

export function useForecast(): { data: Forecast; loading: boolean } {
  const attempts = useMyAttempts()
  const data = useMemo(() => forecast(toForecastAttempts(attempts.data ?? [])), [attempts.data])
  return { data, loading: attempts.isLoading }
}

function SectionRow({ section, f }: { section: Section; f: SectionForecast | null }) {
  const { tr } = useI18n()
  const pct = f ? ((f.score - 200) / 600) * 100 : 0
  const lo = f ? ((f.low - 200) / 600) * 100 : 0
  const hi = f ? ((f.high - 200) / 600) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <SectionIcon section={section} className="h-5 w-5 shrink-0" />
          <span className="truncate">{tr(section)}</span>
        </span>
        {f ? (
          <span className="shrink-0 text-right">
            <span className="text-lg font-extrabold text-brand-700">{f.score}</span>
            <span className="ml-1 text-xs font-semibold text-muted">
              {f.low}–{f.high}
            </span>
          </span>
        ) : (
          <Link to="/app/practice" className="shrink-0 text-xs font-bold text-brand-600 hover:underline">
            {tr('Take a test')} ›
          </Link>
        )}
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-brand-100" aria-hidden>
        {f && (
          <>
            <div className="absolute inset-y-0 rounded-full bg-brand-200" style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 1)}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-600 to-brand-500" style={{ width: `${pct}%` }} />
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted/70">
        <span>200</span>
        <span>800</span>
      </div>
    </div>
  )
}

/** Projected SAT score: total + Reading & Writing + Math, each with its likely range. */
export function ScoreForecast({ target }: { target?: number }) {
  const { tr } = useI18n()
  const { data, loading } = useForecast()
  const none = !data.rw && !data.math
  const basedOn = (data.rw?.basedOn ?? 0) + (data.math?.basedOn ?? 0)
  return (
    <section className="glass rounded-2xl p-4 md:p-6" aria-label={tr('Score forecast')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-600">
            <TargetIcon className="h-4 w-4" />
          </span>
          {tr('Score forecast')}
        </h2>
        {data.total && (
          <div className="text-right">
            <p className="text-3xl font-extrabold leading-none text-gradient">{data.total.score}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted">
              {data.total.low}–{data.total.high}
            </p>
          </div>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-muted">{tr('Loading…')}</p>
      ) : none ? (
        <p className="mt-3 text-sm text-muted">{tr('Take your first practice test and your score projection will appear here.')}</p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            <SectionRow section="Reading & Writing" f={data.rw} />
            <SectionRow section="Math" f={data.math} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {!data.total
              ? tr('Take a test in the other section to see your total score.')
              : target && data.total.score < target
                ? tr('{n} points to your goal of {g}.', { n: target - data.total.score, g: target })
                : target
                  ? tr('You are on track for your goal of {g}.', { g: target })
                  : ''}{' '}
            {tr('Based on your last {n} practice tests; newer ones count more.', { n: basedOn })}
          </p>
        </>
      )}
    </section>
  )
}
