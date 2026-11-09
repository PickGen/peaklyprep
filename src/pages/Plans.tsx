import { useMySubscription } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { Reveal } from '../components/Reveal'
import { CrownIcon } from '../components/Icons'
import { Pricing, planName } from '../components/Pricing'
import { fmtLong } from '../components/SubscriptionBadge'

export default function PlansPage() {
  const { tr } = useI18n()
  const sub = useMySubscription()
  const s = sub.data
  const active = s && new Date(s.expires_at) > new Date()
  const daysLeft = active ? Math.max(Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / 86_400_000), 0) : 0

  return (
    <div className="space-y-2">
      <Reveal>
        <h1 className="text-3xl font-extrabold">{tr('Plans')}</h1>
      </Reveal>

      <Reveal delay={60}>
        <section className="glass mt-4 flex items-center gap-4 rounded-3xl p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-btn">
            <CrownIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">{tr('Current plan')}</p>
            {active ? (
              <>
                <p className="text-xl font-extrabold">{planName(s.plan, tr)}</p>
                <p className="text-sm text-muted">{tr('Active until {d}', { d: fmtLong(s.expires_at) })}</p>
                <p className="text-sm font-semibold text-brand-700">{tr('{n} days left', { n: daysLeft })}</p>
              </>
            ) : (
              <p className="text-lg font-bold text-muted">{tr('No active plan')}</p>
            )}
          </div>
        </section>
      </Reveal>

      <Pricing embedded />
    </div>
  )
}
