/**
 * The notification list for the bell, built from data the app already has:
 * subscription end (reminders 7, 3 and 1 day before, and when it has ended), payment decisions,
 * news posts, the SAT exam date, and for admins the payments waiting for review.
 * Each notification has a stable `key`; the database remembers which keys a user has read.
 * `title` / `body` are English UI strings (translated with tr() and `vars`) unless `raw` is set (news text).
 */

export type NotificationTone = 'info' | 'warning' | 'success' | 'danger'

export interface AppNotification {
  key: string
  title: string
  body?: string
  vars?: Record<string, string | number>
  /** news posts are shown as written, not translated */
  raw?: boolean
  date: string
  link?: string
  tone: NotificationTone
  icon: 'crown' | 'check' | 'news' | 'calendar' | 'alert' | 'card'
}

export interface NotificationSources {
  now: Date
  isAdmin: boolean
  subscription: { expires_at: string } | null
  payments: { id: string; status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string }[]
  news: { id: string; title: string; body: string; published: boolean; created_at: string }[]
  examDate: string | null
  /** admins only: payment requests waiting for a decision */
  pendingPayments?: { id: string; created_at: string }[]
  /** the site-wide free period is running: nothing is locked, so "your plan has ended" is not shown */
  freeAccess?: boolean
}

const DAY = 86_400_000

export function daysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY)
}

export function buildNotifications(s: NotificationSources): AppNotification[] {
  const out: AppNotification[] = []
  const now = s.now.getTime()

  // subscription: reminders 7 / 3 / 1 days before the end, then "ended" for 30 days
  if (s.subscription && !s.isAdmin) {
    const exp = new Date(s.subscription.expires_at).getTime()
    const left = Math.ceil((exp - now) / DAY)
    const day = s.subscription.expires_at.slice(0, 10)
    if (exp > now && left <= 7) {
      const step = left <= 1 ? 1 : left <= 3 ? 3 : 7
      out.push({
        key: `sub-ending-${day}-${step}`,
        title: left <= 1 ? 'Your plan ends tomorrow' : 'Your plan ends in {n} days',
        body: 'Renew it to keep access to lessons and practice tests.',
        vars: { n: left },
        date: new Date(Math.min(now, exp - step * DAY)).toISOString(),
        link: '/app/plans',
        tone: 'warning',
        icon: 'crown',
      })
    } else if (exp <= now && now - exp < 30 * DAY && !s.freeAccess) {
      out.push({
        key: `sub-ended-${day}`,
        title: 'Your plan has ended',
        body: 'Lessons and practice tests are locked. Choose a plan to continue.',
        date: new Date(exp).toISOString(),
        link: '/app/plans',
        tone: 'danger',
        icon: 'crown',
      })
    }
  }

  // payment decisions from the last 60 days
  for (const p of s.payments) {
    if (p.status === 'pending' || now - new Date(p.created_at).getTime() > 60 * DAY) continue
    out.push(
      p.status === 'approved'
        ? { key: `pay-${p.id}-approved`, title: 'Payment approved', body: 'Your plan is active. Happy studying!', date: p.created_at, link: '/app/plans', tone: 'success', icon: 'check' }
        : { key: `pay-${p.id}-rejected`, title: 'Payment was not accepted', body: p.admin_note || 'Check the receipt and try again, or contact support.', raw: Boolean(p.admin_note), date: p.created_at, link: '/app/plans', tone: 'danger', icon: 'card' },
    )
  }

  // admins: payments waiting for review
  if (s.isAdmin && s.pendingPayments && s.pendingPayments.length > 0) {
    const newest = [...s.pendingPayments].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    out.push({
      key: `admin-pending-${newest.id}`,
      title: 'Payments waiting for review: {n}',
      body: 'Open Payments to approve or reject them.',
      vars: { n: s.pendingPayments.length },
      date: newest.created_at,
      link: '/admin/payments',
      tone: 'info',
      icon: 'card',
    })
  }

  // exam date: a week before, and the day before
  if (s.examDate) {
    const left = daysUntil(s.examDate + 'T00:00:00', s.now)
    if (left >= 0 && left <= 7) {
      out.push({
        key: `exam-${s.examDate}-${left <= 1 ? 1 : 7}`,
        title: left === 0 ? 'The SAT is today. Good luck!' : left === 1 ? 'The SAT is tomorrow' : 'The SAT is in {n} days',
        body: left <= 1 ? 'Get some rest and check your admission ticket.' : 'A good time for a full practice test.',
        vars: { n: left },
        date: s.now.toISOString(),
        link: left <= 1 ? undefined : '/app/practice',
        tone: 'info',
        icon: 'calendar',
      })
    }
  }

  // the five newest news posts from the last 30 days
  s.news
    .filter((n) => n.published && now - new Date(n.created_at).getTime() <= 30 * DAY)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .forEach((n) => out.push({ key: `news-${n.id}`, title: n.title, body: n.body, raw: true, date: n.created_at, link: '/app', tone: 'info', icon: 'news' }))

  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** The plan reminder shown on the home page (null when there is nothing to remind about). */
export function planReminder(sub: { expires_at: string } | null, now: Date, isAdmin: boolean, freeAccess = false): { kind: 'ending' | 'ended'; days: number } | null {
  if (!sub || isAdmin) return null
  const left = daysUntil(sub.expires_at, now)
  const exp = new Date(sub.expires_at).getTime()
  if (exp > now.getTime()) return left <= 7 ? { kind: 'ending', days: Math.max(left, 1) } : null
  // while the whole site is free nothing is locked, so there is nothing to remind about
  return !freeAccess && now.getTime() - exp < 30 * DAY ? { kind: 'ended', days: 0 } : null
}
