import { Link } from 'react-router-dom'
import { useMySubscription } from '../lib/api'
import { formatDate, useI18n } from '../lib/i18n'
import { ArrowRight, CrownIcon } from './Icons'
import { planName } from './Pricing'

/** "until 7 January 2031" style date (Kazakh gets the correct case ending) */
export const fmtLong = (iso: string) => formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric', until: true })

/** Shows which plan the student bought and until when (next to the name in the profile). */
export function SubscriptionBadge() {
  const { tr } = useI18n()
  const sub = useMySubscription()
  if (sub.isLoading) return null
  const s = sub.data
  const active = s && new Date(s.expires_at) > new Date()

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

/** Profile card: current plan + button to buy / renew (keeps the phone's bottom bar uncluttered). */
export function PlanCard() {
  const { tr } = useI18n()
  const sub = useMySubscription()
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
          <p className="text-lg font-extrabold leading-tight">{active ? planName(s.plan, tr) : tr('No active plan')}</p>
        </div>
      </div>
      <Link to="/app/plans" className="btn btn-primary !min-h-11 w-full !px-5 !py-2.5 text-sm sm:w-auto">
        {active ? tr('Renew plan') : tr('Buy a plan')} <ArrowRight className="h-4 w-4" />
      </Link>    </section>
  )
}