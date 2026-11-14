import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAppSetting, useSubmitPaymentRequest, useMyPaymentRequests } from '../lib/api'
import { PLANS, planName } from '../components/Pricing'
import { useI18n } from '../lib/i18n'
import { CrownIcon } from '../components/Icons'
import { Spinner } from '../components/Layouts'
import { Reveal } from '../components/Reveal'

const PLAN_USD: Record<string, number> = { '1m': 7, '3m': 15, '6m': 25, '12m': 50 }

function CopyButton({ text }: { text: string }) {
  const { tr } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <button onClick={copy} className="ml-2 text-brand-600 hover:text-brand-700 text-xs font-semibold transition-colors">
      {copied ? '✓ ' + tr('Copied') : tr('Copy')}
    </button>
  )
}

export default function CheckoutPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { tr } = useI18n()
  const { session } = useAuth()
  const plan = params.get('plan') ?? '1m'
  const amount = PLAN_USD[plan] ?? 7
  const label = planName(plan, tr)

  const cardSetting = useAppSetting('card_number')
  const cardNumber = (cardSetting.data ?? '').replace(/"/g, '')

  const submit = useSubmitPaymentRequest()
  const myRequests = useMyPaymentRequests()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const preview = useMemo(() => (receipt && receipt.type.startsWith('image/') ? URL.createObjectURL(receipt) : null), [receipt])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function pickReceipt(file: File | undefined) {
    setErrorMsg('')
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setReceipt(null)
      if (fileRef.current) fileRef.current.value = ''
      setErrorMsg(tr('The file is larger than 10 MB. Attach a smaller screenshot.'))
      return
    }
    setReceipt(file)
  }

  function clearReceipt() {
    setReceipt(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const hasPending = myRequests.data?.some((r) => r.status === 'pending' && r.plan === plan)

  if (!PLANS.find((p) => p.id === plan)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted">{tr('This plan does not exist.')} <Link to="/app/plans" className="text-brand-600 font-semibold">{tr('Choose a plan →')}</Link></p>
      </div>
    )
  }

  async function handleSubmit() {
    if (!session) return nav('/login')
    setStatus('uploading')
    setErrorMsg('')

    let receiptUrl: string | null = null
    const file = receipt

    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file)
      if (uploadError) {
        setStatus('error')
        setErrorMsg(tr('Could not upload the receipt. Try again or send without it.'))
        return
      }
      receiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
    }

    try {
      await submit.mutateAsync({ plan: plan as '1m' | '3m' | '6m' | '12m', amount_usd: amount, receipt_url: receiptUrl })
      setStatus('done')
    } catch (e: unknown) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : tr('Could not send the request. Please try again.'))
    }
  }

  if (status === 'done' || hasPending) {
    return (
      <div className="mx-auto max-w-md py-10">
        <Reveal>
          <div className="glass rounded-3xl p-8 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-green-100">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-extrabold">{tr('Request sent!')}</h2>
            <p className="mt-3 text-sm text-muted">{tr('We will check the payment and activate your access within a few hours. You can follow the status on the Plans page.')}</p>
            <Link to="/app/plans" className="btn btn-primary mt-6 w-full">{tr('Go to plans')}</Link>
          </div>
        </Reveal>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-6 px-4">
      <Reveal>
        <Link to="/app/plans" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          ← {tr('Back')}
        </Link>

        <div className="glass rounded-3xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100">
              <CrownIcon className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-widest">{tr('Subscription')}</p>
              <p className="font-extrabold">{tr('Access to lessons and practice tests')}</p>
            </div>
          </div>

          {/* Payment method */}
          <div className="mb-4 rounded-2xl border-2 border-brand-600 bg-brand-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-brand-700">
              <span>💳</span> {tr('Payment by bank card')}
            </div>
          </div>

          {/* Details */}
          <div className="mb-5 space-y-3 rounded-2xl bg-white border border-[#e6e0f7] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{tr('Recipient')}</span>
              <span className="font-bold">PeaklyPrep</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{tr('Card number')}</span>
              <span className="font-mono font-semibold">
                {cardSetting.isLoading ? '...' : cardNumber || '—'}
                {cardNumber && <CopyButton text={cardNumber.replace(/\s/g, '')} />}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{tr('Plan')}</span>
              <span className="font-semibold">{label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{tr('Amount')}</span>
              <span className="text-xl font-extrabold text-brand-600">${amount}</span>
            </div>
          </div>

          {/* Instructions */}
          <ol className="mb-5 space-y-1 text-xs text-muted list-decimal list-inside">
            <li>{tr('Transfer the exact amount to the card above.')}</li>
            <li>{tr('Attach a screenshot of the receipt (optional, but it speeds up the check).')}</li>
            <li>{tr('Press the Send for review button — we will activate your access manually.')}</li>
          </ol>

          {/* Receipt upload */}
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => pickReceipt(e.target.files?.[0])} />
          {receipt ? (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border-2 border-green-300 bg-green-50 p-4">
              {preview ? (
                <img src={preview} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-white text-2xl">📄</div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold text-green-800">✓ {tr('Receipt attached')}</p>
                <p className="truncate text-xs text-muted">{receipt.name} · {Math.max(1, Math.round(receipt.size / 1024))} KB</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
                <button type="button" onClick={() => fileRef.current?.click()} className="text-brand-600 hover:text-brand-700">{tr('Replace')}</button>
                <button type="button" onClick={clearReceipt} className="text-muted hover:text-red-600">{tr('Remove')}</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mb-5 w-full cursor-pointer rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 p-5 text-center hover:border-brand-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-2xl mb-1">📎</div>
              <p className="text-sm font-semibold text-brand-700">{tr('Attach receipt')}</p>
              <p className="text-xs text-muted">{tr('PDF, JPG or PNG')}</p>
            </button>
          )}

          {errorMsg && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{errorMsg}</p>}

          <button
            onClick={handleSubmit}
            disabled={status === 'uploading'}
            className="btn btn-primary w-full"
          >
            {status === 'uploading' ? <Spinner /> : <>{tr('Send for review')} →</>}
          </button>
        </div>
      </Reveal>
    </div>
  )
}
