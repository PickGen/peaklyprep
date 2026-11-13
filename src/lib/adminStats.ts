// Pure helpers for the admin "Statistics" page. No imports, so the unit tests can load this file directly.

/** Days are counted in Almaty time, like the weekly leaderboard and the visit counter in the database. */
export const STATS_TZ = 'Asia/Almaty'

type Moment = Date | string | number

const formatters = new Map<string, Intl.DateTimeFormat>()

/** 'YYYY-MM-DD' of a moment in the given time zone. */
export function dayKey(at: Moment, timeZone: string = STATS_TZ): string {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    formatters.set(timeZone, f)
  }
  const parts = f.formatToParts(new Date(at))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** The day `delta` days away from a 'YYYY-MM-DD' key. */
export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

/** The last `n` days ending today, oldest first. */
export function lastDays(n: number, now: Moment = Date.now(), timeZone: string = STATS_TZ): string[] {
  const today = dayKey(now, timeZone)
  return Array.from({ length: n }, (_, i) => shiftDay(today, i - (n - 1)))
}

export interface PaymentRow {
  amount_usd: number | string
  plan: string
  status: string
  created_at: string
}

export interface RevenueStats {
  /** approved payments, in dollars */
  total: number
  today: number
  /** the last 7 days including today */
  week: number
  /** the last 30 days including today */
  month: number
  paidCount: number
  /** requests that still wait for the admin; not part of the sums above */
  pendingCount: number
  pendingSum: number
  byPlan: { plan: string; count: number; sum: number }[]
  daily: { day: string; value: number }[]
}

const PLAN_ORDER = ['1m', '3m', '6m', '12m']

/**
 * Money earned = approved payment requests. A request has no "approved at" time, so it is dated by the day
 * the student sent it. Sums are added up in cents to avoid floating point drift.
 */
export function revenueStats(rows: readonly PaymentRow[], now: Moment = Date.now(), days = 30): RevenueStats {
  const cents = (v: number | string) => Math.round(Number(v) * 100) || 0
  const today = dayKey(now)
  const weekFrom = shiftDay(today, -6)
  const monthFrom = shiftDay(today, -29)
  const perDay = new Map<string, number>()
  const perPlan = new Map<string, { count: number; sum: number }>()
  let total = 0
  let todaySum = 0
  let week = 0
  let month = 0
  let paidCount = 0
  let pendingCount = 0
  let pendingSum = 0

  for (const r of rows) {
    const c = cents(r.amount_usd)
    if (r.status === 'pending') {
      pendingCount += 1
      pendingSum += c
      continue
    }
    if (r.status !== 'approved') continue
    const day = dayKey(r.created_at)
    paidCount += 1
    total += c
    // 'YYYY-MM-DD' keys compare correctly as plain strings
    if (day === today) todaySum += c
    if (day >= weekFrom && day <= today) week += c
    if (day >= monthFrom && day <= today) month += c
    perDay.set(day, (perDay.get(day) ?? 0) + c)
    const plan = perPlan.get(r.plan) ?? { count: 0, sum: 0 }
    plan.count += 1
    plan.sum += c
    perPlan.set(r.plan, plan)
  }

  const rank = (plan: string) => {
    const i = PLAN_ORDER.indexOf(plan)
    return i === -1 ? PLAN_ORDER.length : i
  }
  return {
    total: total / 100,
    today: todaySum / 100,
    week: week / 100,
    month: month / 100,
    paidCount,
    pendingCount,
    pendingSum: pendingSum / 100,
    byPlan: [...perPlan.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
      .map(([plan, v]) => ({ plan, count: v.count, sum: v.sum / 100 })),
    daily: lastDays(days, now).map((day) => ({ day, value: (perDay.get(day) ?? 0) / 100 })),
  }
}
