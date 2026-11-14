import { Link } from 'react-router-dom'
import { useFreeAccess, useMySubscription } from '../lib/api'
import { useAuth } from '../lib/auth'
import { planReminder } from '../lib/notifications'
import { formatDate, useI18n } from '../lib/i18n'
import { ArrowRight, CrownIcon } from './Icons'
import { planName } from './Pricing'

/** "until 7 January 2031" style date (Kazakh gets the correct case ending) */
export const fmtLong = (iso: string | Date) => formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric', until: true })

/** Shows which plan the student bought and until when (next to the name in the profile). */
export function SubscriptionBadge() {
  const { tr } = useI18n()
  const sub = useMySubscription()
  const free = useFreeAccess()
  if (sub.isLoading) return null
  const s = sub.data
  const active = s && new Date(s.expires_at) > new Date()

  if (!active && free.until) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">🎁 {tr('Free until {d}', { d: fmtLong(free.until) })}</span>
  }
  if (!active) {
    return (
      <Link to="/app/plans" className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100">
        {tr('No active plan')} ›
      </Link>
    )
  }
  return (
    <span className="inline-flex max-w-full items-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-3 py-2 text-white shadow-btn">
      <CrownIcon className="h-5 w-5 shrink-0" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-extrabold">{planName(s.plan, tr)}</span>
        <span className="text-xs font-semibold text-white/85">{tr('Active until {d}', { d: fmtLong(s.expires_at) })}</span>
      </span>
    </span>  )
}

/** Home page: the whole site is free for everyone until the date set by the admin. */
export function FreeAccessBanner({ className = '' }: { className?: string }) {
  const { tr } = useI18n()
  const free = useFreeAccess()
  if (!free.until) return null
  return (
    <section role="status" className={`${className} flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-xl" aria-hidden="true">🎁</span>
      <div className="min-w-0">
        <p className="font-bold text-emerald-900">{tr('PeaklyPrep is free until {d}', { d: fmtLong(free.until) })}</p>
        <p className="text-sm text-emerald-800">{tr('All lessons and practice tests are open — no plan needed.')}</p>
      </div>
    </section>
  )
}

/** Home page reminder: the plan ends within 7 days, or ended less than 30 days ago. */
export function PlanReminder({ className = '' }: { className?: string }) {
  const { tr } = useI18n()
  const { isAdmin } = useAuth()
  const sub = useMySubscription()
  const free = useFreeAccess()
  const r = planReminder(sub.data ?? null, new Date(), isAdmin, Boolean(free.until))
  if (!r || !sub.data) return null
  const ended = r.kind === 'ended'
  return (
    <section
      role="status"
      className={`${className} flex flex-col gap-3 rounded-2xl p-4 ring-1 sm:flex-row sm:items-center ${ended ? 'bg-red-50 ring-red-200' : 'bg-amber-50 ring-amber-200'}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ended ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
          <CrownIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className={`font-bold ${ended ? 'text-red-800' : 'text-amber-900'}`}>
            {ended ? tr('Your plan has ended') : r.days <= 1 ? tr('Your plan ends tomorrow') : tr('Your plan ends in {n} days', { n: r.days })}
          </p>
          <p className={`text-sm ${ended ? 'text-red-700' : 'text-amber-800'}`}>
            {ended ? tr('Lessons and practice tests are locked. Choose a plan to continue.') : tr('Active until {d}', { d: fmtLong(sub.data.expires_at) }) + ' · ' + tr('Renew it to keep access to lessons and practice tests.')}
          </p>
        </div>
      </div>
      <Link to="/app/plans" className="btn btn-primary !min-h-11 w-full !px-5 !py-2.5 text-sm sm:w-auto">
        {ended ? tr('Buy a plan') : tr('Renew plan')} <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  )
}

/** Profile card: current plan + button to buy / renew (keeps the phone's bottom bar uncluttered). */
export function PlanCard() {
  const { tr } = useI18n()
  const sub = useMySubscription()
  const free = useFreeAccess()
  const s = sub.data
  const active = s && new Date(s.expires_at) > new Date()
  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-btn">
          <CrownIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{tr('Subscription')}</p>
          <p className="text-lg font-extrabold leading-tight">{active ? planName(s.plan, tr) : free.until ? tr('Free until {d}', { d: fmtLong(free.until) }) : tr('No active plan')}</p>
        </div>
      </div>
      <Link to="/app/plans" className="btn btn-primary !min-h-11 w-full !px-5 !py-2.5 text-sm sm:w-auto">
        {active ? tr('Renew plan') : tr('Buy a plan')} <ArrowRight className="h-4 w-4" />
      </Link>    </section>
  )
}