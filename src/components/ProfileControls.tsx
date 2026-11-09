import { useState } from 'react'
import { fmtDate, todayIso, useSatDates } from '../lib/satDates'
import { useI18n } from '../lib/i18n'

/** Range slider with a bubble that shows the exact score while the thumb is pressed or focused. */
export function RangeSlider({ value, onChange, min, max, step, format = String, hint, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: (v: number) => string; hint: string; label: string }) {
  const [active, setActive] = useState(false)
  const ratio = (value - min) / (max - min)
  return (
    <div className="select-none">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-muted">{hint}</span>
        <span className="text-2xl font-extrabold text-brand-700 tabular-nums">{format(value)}</span>
      </div>
      <div className="relative mt-5">
        <span
          aria-hidden
          className={`pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-lg bg-brand-700 px-2.5 py-1 text-sm font-extrabold tabular-nums text-white shadow-lg transition-[opacity,transform] duration-150 ${active ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}
          style={{ left: `calc(${ratio * 100}% + ${14 - ratio * 28}px)` }}
        >
          {format(value)}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-brand-700" />
        </span>
        <input
          type="range"
          className="score-range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          aria-valuetext={format(value)}
          style={{ '--p': `${ratio * 100}%` } as React.CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onPointerCancel={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs font-semibold text-muted">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

/** Only official College Board test dates can be chosen. */
export function ExamDatePicker({ value, current, onChange }: { value: string; current: string | null; onChange: (v: string) => void }) {
  const { tr } = useI18n()
  const q = useSatDates()
  const today = todayIso()
  const selected = value || current || 'none'
  const dates = (q.data?.dates ?? []).filter((d) => d.date >= today)

  return (
    <div className="space-y-2">
      {q.isLoading ? (
        <p className="text-sm text-muted">{tr('Loading official dates…')}</p>
      ) : (
        <>
          <ul className="space-y-2" role="radiogroup" aria-label="Official SAT test dates">
            {dates.map((d) => {
              const on = selected === d.date
              const closed = d.lateDeadline !== null && d.lateDeadline < today
              return (
                <li key={d.date}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange(d.date)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${on ? 'border-brand-600 bg-brand-50' : 'border-brand-100 bg-white hover:border-brand-300'}`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand-600' : 'border-brand-300'}`}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{fmtDate(d.date)}</span>
                      <span className="block text-xs text-muted">
                        {closed ? tr('Registration closed') : d.registrationDeadline ? tr('Register by {d}', { d: fmtDate(d.registrationDeadline, { day: 'numeric', month: 'short' }) }) : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
            <li>
              <button
                type="button"
                role="radio"
                aria-checked={selected === 'none'}
                onClick={() => onChange('none')}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold ${selected === 'none' ? 'border-brand-600 bg-brand-50' : 'border-brand-100 bg-white hover:border-brand-300'}`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected === 'none' ? 'border-brand-600' : 'border-brand-300'}`}>
                  {selected === 'none' && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                </span>
                {tr("I haven't picked a date yet")}
              </button>
            </li>
          </ul>
          <p className="text-xs text-muted">
            {q.data?.official ? tr('Official dates from College Board, updated automatically.') : tr('Could not reach College Board right now; showing the last known official dates.')}
          </p>
        </>
      )}
    </div>
  )
}
