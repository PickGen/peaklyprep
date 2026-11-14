/**
 * Site-wide free period. The app_settings row `free_until` holds the moment it ends (ISO date-time).
 * While that moment is in the future every signed-in student has full access; the database applies the
 * same rule in has_active_subscription(). An empty or unreadable value means "no free period".
 */
export const FREE_UNTIL_KEY = 'free_until'

/** The stored value → the moment the free period ends (settings saved from the admin come back in extra quotes). */
export function parseFreeUntil(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null
  const s = raw.replace(/"/g, '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The end of the free period if it is running now, otherwise null. */
export function activeFreeUntil(raw: unknown, now: Date): Date | null {
  const d = parseFreeUntil(raw)
  return d && d.getTime() > now.getTime() ? d : null
}

/** The last second of the day that comes `days` days after `now` (local time), as stored in the setting. */
export function endOfDayAfter(now: Date, days: number): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59).toISOString()
}

/** "2026-11-21" from a date field → the last second of that day (local time); '' when it is not a date. */
export function endOfDate(input: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}
