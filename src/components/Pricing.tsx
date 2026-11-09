import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useBuyPlan } from '../lib/api'
import { formatDate } from '../lib/i18n'
import { useI18n } from '../lib/i18n'
import { ArrowRight, CloseIcon } from './Icons'
import { Reveal } from './Reveal'

interface Plan {
  id: string
  months: number
  regular: number
  price: number
  best?: boolean
}

// Launch prices (USD, one upfront payment per period)
export const PLANS: Plan[] = [
  { id: '1m', months: 1, regular: 19, price: 13 },
  { id: '3m', months: 3, regular: 48, price: 33 },
  { id: '6m', months: 6, regular: 84, price: 60 },
  { id: '12m', months: 12, regular: 132, price: 96, best: true },
]

export const planName = (id: string, tr: (k: string, v?: Record<string, string | number>) => string) => {
  const months = PLANS.find((p) => p.id === id)?.months ?? 1
  return months === 1 ? tr('1 Month') : tr('{n} Months', { n: months })
}

const usd = (n: number) => `$${n}`
const perMonth = (p: Plan) => Math.round(p.price / p.months)

type Dlg = { plan: Plan; name: string; status: 'busy' | 'done' | 'unavailable'; until?: string }

function PlanDialog({ dlg, onClose }: { dlg: Dlg; onClose: () => void }) {
  const { tr } = useI18n()
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-extrabold">
            {dlg.status === 'done' ? tr('Plan activated') : dlg.status === 'busy' ? tr('Activating…') : tr('Online payment is coming soon')}
          </h3>
          <button onClick={onClose} aria-label={tr('Close')} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-brand-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {dlg.status === 'done' && (
          <>
            <p className="mt-3 text-sm text-muted">{tr('{plan} is active until {d}.', { plan: dlg.name, d: dlg.until ? formatDate(dlg.until, { day: 'numeric', month: 'long', year: 'numeric', until: true }) : '' })}</p>
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{tr('Test mode: no real payment was made.')}</p>
          </>
        )}
        {dlg.status === 'unavailable' && <p className="mt-3 text-sm text-muted">{tr('You chose {plan} for {price}. Payment is not connected yet; we will let you know when it opens.', { plan: dlg.name, price: usd(dlg.plan.price) })}</p>}
        <button className="btn btn-primary mt-5 w-full" onClick={onClose} disabled={dlg.status === 'busy'}>
          {tr('Close')}
        </button>
      </div>
    </div>
  )
}

export function Pricing({ embedded = false }: { embedded?: boolean }) {
  const { tr } = useI18n()
  const { session } = useAuth()
  const nav = useNavigate()
  const buy = useBuyPlan()
  const [dlg, setDlg] = useState<Dlg | null>(null)

  const name = (p: Plan) => (p.months === 1 ? tr('1 Month') : tr('{n} Months', { n: p.months }))
  const choose = async (p: Plan) => {
    if (!session) return nav('/register', { state: { plan: p.id } })
    setDlg({ plan: p, name: name(p), status: 'busy' })
    try {
      const res = await buy.mutateAsync(p.id as never)
      setDlg({ plan: p, name: name(p), status: 'done', until: res.expires_at })
    } catch {
      setDlg({ plan: p, name: name(p), status: 'unavailable' })
    }
  }

  return (
    <section id="pricing" className={`mx-auto max-w-6xl scroll-mt-6 ${embedded ? 'pb-10 pt-8' : 'px-5 pb-20 pt-4 md:px-10'}`}>
      <Reveal className="mx-auto max-w-xl text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-600">{tr('Launch pricing')}</p>
        <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">{tr('Invest in your next step.')}</h2>
        <p className="mt-3 text-sm text-muted sm:text-base">{tr('Simple SAT preparation plans. One payment for your chosen period.')}</p>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-5">
        {PLANS.map((p, i) => (
          <Reveal key={p.id} delay={i * 80}>
            <article
              className={`relative flex h-full flex-col rounded-3xl p-5 ${
                p.best ? 'border-2 border-brand-600 bg-[#faf8ff] shadow-[0_20px_44px_-24px_rgba(91,31,214,.55)]' : 'border border-[#e6e0f7] bg-white'
              }`}
            >
              {/* mobile: compact row layout */}
              <div className="md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xl font-extrabold">{name(p)}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {tr('Regular total')} <s className="ml-1">{usd(p.regular)}</s>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {p.best && <span className="mt-2 rounded-lg bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">{tr('Best value')}</span>}
                    <span className={`text-4xl font-extrabold leading-none tracking-tight ${p.best ? 'text-brand-600' : 'text-ink'}`}>{usd(p.price)}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3 text-sm">
                  <p className="text-muted">
                    <b className="text-ink">{tr('{p}/month', { p: usd(perMonth(p)) })}</b> · {tr('monthly equivalent')}
                  </p>
                  <p className="shrink-0 text-muted">
                    {tr('Total payment')} <b className="ml-1 text-ink">{usd(p.price)}</b>
                  </p>
                </div>
              </div>

              {/* desktop: stacked card */}
              <div className="hidden flex-1 flex-col md:flex">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="whitespace-nowrap text-[15px] font-bold">{name(p)}</h3>
                  {p.best && <span className="shrink-0 whitespace-nowrap rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">{tr('Best value')}</span>}
                </div>
                <p className="mt-4 text-xs text-muted">
                  {tr('Regular total')} <s className="ml-0.5">{usd(p.regular)}</s>
                </p>
                <p className={`mt-1 text-[2.6rem] font-extrabold leading-none tracking-tight ${p.best ? 'text-brand-600' : 'text-ink'}`}>{usd(p.price)}</p>
                <p className="mt-2 text-xs font-bold text-brand-600">{tr('Launch price')}</p>
                <p className="mt-4 text-xs text-muted">
                  <b className="text-ink">{tr('{p}/month', { p: usd(perMonth(p)) })}</b> · {tr('monthly equivalent')}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-brand-100 pt-4 text-xs text-muted">
                  <span>{tr('Total payment')}</span>
                  <b className="text-base text-ink">{usd(p.price)}</b>
                </div>
              </div>

              <button onClick={() => choose(p)} className={`btn mt-4 w-full ${p.best ? 'btn-primary' : 'btn-ghost'} !min-h-11 !py-2.5 text-sm md:mt-5`}>
                {tr('Choose plan')} <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted">{tr('All amounts in USD. Launch pricing shown as the full upfront payment, not a monthly charge.')}</p>

      {dlg && <PlanDialog dlg={dlg} onClose={() => setDlg(null)} />}
    </section>
  )
}
