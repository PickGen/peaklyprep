import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '../../components/Layouts'
import { revenueStats } from '../../lib/adminStats'
import { useRevenueRows, useStudentCounts, useVisitStats } from '../../lib/api'

const DAYS = 30

const money = (v: number) => `$${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`
const num = (v: number) => v.toLocaleString('ru-RU')
/** '2026-11-13' -> '13 нояб.' */
const dayLabel = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const PLAN_LABEL: Record<string, string> = { '1m': '1 месяц', '3m': '3 месяца', '6m': '6 месяцев', '12m': '12 месяцев' }

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function Block({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
      {note && <p className="text-xs text-muted">{note}</p>}
    </section>
  )
}

/** One bar per day, oldest on the left. Hover (or long-press) a bar to see the day and its value. */
function Bars({ title, data, format }: { title: string; data: { day: string; value: number }[]; format: (v: number) => string }) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0)
  if (max === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="mt-3 text-sm text-muted">За этот период пока пусто.</p>
      </div>
    )
  }
  const best = data.reduce((a, b) => (b.value > a.value ? b : a))
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="text-xs text-muted">
          лучший день: {dayLabel(best.day)} — {format(best.value)}
        </span>
      </div>
      <div className="mt-4 flex h-32 items-end gap-0.5" role="img" aria-label={`${title}. Лучший день: ${dayLabel(best.day)}, ${format(best.value)}`}>
        {data.map((d) => (
          <div key={d.day} className="flex h-full flex-1 items-end" title={`${dayLabel(d.day)}: ${format(d.value)}`}>
            <div
              className={`w-full rounded-t ${d.value > 0 ? 'bg-gradient-to-t from-brand-600 to-brand-400' : 'bg-brand-100'}`}
              style={{ height: d.value > 0 ? `${Math.max((d.value / max) * 100, 3)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{dayLabel(data[0].day)}</span>
        <span>{dayLabel(data[data.length - 1].day)}</span>
      </div>
    </div>
  )
}

const tiles = 'grid grid-cols-2 gap-3 md:grid-cols-4'

export default function AdminStats() {
  const payments = useRevenueRows()
  const visits = useVisitStats(DAYS)
  const students = useStudentCounts()
  const revenue = useMemo(() => revenueStats(payments.data ?? [], Date.now(), DAYS), [payments.data])
  const busy = payments.isFetching || visits.isFetching || students.isFetching

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Статистика</h1>
        <button
          className="btn btn-ghost !min-h-10 !px-3 !py-2 text-sm"
          disabled={busy}
          onClick={() => {
            void payments.refetch()
            void visits.refetch()
            void students.refetch()
          }}
        >
          {busy ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>

      <Block title="Заработок" note="Считаются только одобренные заявки на оплату, по дню подачи заявки. Дни — по времени Алматы.">
        {payments.isLoading ? (
          <Spinner />
        ) : payments.isError ? (
          <p className="glass rounded-2xl p-4 text-sm text-red-700">Не удалось загрузить оплаты: {payments.error.message}</p>
        ) : (
          <>
            <div className={tiles}>
              <Tile label="Сегодня" value={money(revenue.today)} />
              <Tile label="7 дней" value={money(revenue.week)} />
              <Tile label="30 дней" value={money(revenue.month)} />
              <Tile label="За всё время" value={money(revenue.total)} hint={`оплат: ${num(revenue.paidCount)}`} />
            </div>
            {revenue.pendingCount > 0 && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Ждут проверки: {num(revenue.pendingCount)} на {money(revenue.pendingSum)} — в сумму выше не входят.{' '}
                <Link to="/admin/payments" className="font-semibold underline">
                  Открыть заявки
                </Link>
              </p>
            )}
            <Bars title={`Заработок по дням, ${DAYS} дней`} data={revenue.daily} format={money} />
            {revenue.byPlan.length > 0 && (
              <div className="glass overflow-x-auto rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Тариф</th>
                      <th className="px-4 py-3">Оплат</th>
                      <th className="px-4 py-3">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100">
                    {revenue.byPlan.map((p) => (
                      <tr key={p.plan}>
                        <td className="px-4 py-3 font-semibold">{PLAN_LABEL[p.plan] ?? p.plan}</td>
                        <td className="px-4 py-3">{num(p.count)}</td>
                        <td className="px-4 py-3">{money(p.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Block>

      <Block
        title="Посещения"
        note={
          visits.data
            ? `Посещение — человек открыл сайт; повторный заход считается снова, если прошло больше 30 минут. Администраторы не учитываются. ${
                visits.data.first_day ? `Счётчик работает с ${dayLabel(visits.data.first_day)}.` : 'Счётчик включён, заходов пока не было.'
              }`
            : undefined
        }
      >
        {visits.isLoading ? (
          <Spinner />
        ) : visits.isError || !visits.data ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Счётчик посещений ещё не включён.</p>
            <p className="mt-1">
              Запустите в Supabase (SQL Editor) файл <code>supabase/migrations/20260101000049_site_visits.sql</code> — после этого сайт начнёт считать заходы.
            </p>
            {visits.error && <p className="mt-1 text-xs opacity-80">Ответ базы: {visits.error.message}</p>}
          </div>
        ) : (
          <>
            <div className={tiles}>
              <Tile label="Сегодня" value={num(visits.data.today)} hint={`уникальных: ${num(visits.data.today_unique)}`} />
              <Tile label="7 дней" value={num(visits.data.week)} hint={`уникальных: ${num(visits.data.week_unique)}`} />
              <Tile label="30 дней" value={num(visits.data.month)} hint={`уникальных: ${num(visits.data.month_unique)}`} />
              <Tile label="За всё время" value={num(visits.data.total)} hint={`уникальных: ${num(visits.data.total_unique)}`} />
            </div>
            <Bars title={`Посещения по дням, ${DAYS} дней`} data={visits.data.daily.map((d) => ({ day: d.day, value: d.visits }))} format={num} />
          </>
        )}
      </Block>

      <Block title="Ученики">
        {students.isLoading ? (
          <Spinner />
        ) : students.isError || !students.data ? (
          <p className="glass rounded-2xl p-4 text-sm text-red-700">Не удалось загрузить учеников{students.error ? `: ${students.error.message}` : ''}</p>
        ) : (
          <div className={tiles}>
            <Tile label="Всего" value={num(students.data.total)} />
            <Tile label="Новых за 7 дней" value={num(students.data.week)} />
            <Tile label="Новых за 30 дней" value={num(students.data.month)} />
            <Tile label="С подпиской" value={num(students.data.subscribed)} hint="подписка ещё не истекла" />
          </div>
        )}
      </Block>
    </div>
  )
}
