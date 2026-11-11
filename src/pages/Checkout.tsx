import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAppSetting, useSubmitPaymentRequest, useMyPaymentRequests } from '../lib/api'
import { PLANS } from '../components/Pricing'
import { CrownIcon } from '../components/Icons'
import { Spinner } from '../components/Layouts'
import { Reveal } from '../components/Reveal'

const PLAN_USD: Record<string, number> = { '1m': 7, '3m': 15, '6m': 25, '12m': 50 }
const PLAN_LABEL: Record<string, string> = { '1m': '1 месяц', '3m': '3 месяца', '6m': '6 месяцев', '12m': '12 месяцев' }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <button onClick={copy} className="ml-2 text-brand-600 hover:text-brand-700 text-xs font-semibold transition-colors">
      {copied ? '✓ Скопировано' : 'Копировать'}
    </button>
  )
}

export default function CheckoutPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const plan = params.get('plan') ?? '1m'
  const amount = PLAN_USD[plan] ?? 7
  const label = PLAN_LABEL[plan] ?? '1 месяц'

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
      setErrorMsg('Файл больше 10 МБ. Прикрепите скриншот поменьше.')
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
        <p className="text-muted">Неверный план. <Link to="/app/plans" className="text-brand-600 font-semibold">Выбрать план</Link></p>
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
        setErrorMsg('Ошибка загрузки чека. Попробуйте снова или отправьте без чека.')
        return
      }
      receiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
    }

    try {
      await submit.mutateAsync({ plan: plan as '1m' | '3m' | '6m' | '12m', amount_usd: amount, receipt_url: receiptUrl })
      setStatus('done')
    } catch (e: unknown) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Ошибка отправки. Попробуйте снова.')
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
            <h2 className="text-xl font-extrabold">Заявка отправлена!</h2>
            <p className="mt-3 text-sm text-muted">Мы проверим оплату и активируем доступ в течение нескольких часов. Следите за статусом в разделе «Планы».</p>
            <Link to="/app/plans" className="btn btn-primary mt-6 w-full">Перейти к планам</Link>
          </div>
        </Reveal>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-6 px-4">
      <Reveal>
        <Link to="/app/plans" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          ← Назад
        </Link>

        <div className="glass rounded-3xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100">
              <CrownIcon className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-widest">Подписка</p>
              <p className="font-extrabold">Доступ к занятиям.</p>
            </div>
          </div>

          {/* Payment method */}
          <div className="mb-4 rounded-2xl border-2 border-brand-600 bg-brand-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-brand-700">
              <span>💳</span> Оплата банковской картой
            </div>
          </div>

          {/* Details */}
          <div className="mb-5 space-y-3 rounded-2xl bg-white border border-[#e6e0f7] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Получатель</span>
              <span className="font-bold">PeaklyPrep</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Номер карты</span>
              <span className="font-mono font-semibold">
                {cardSetting.isLoading ? '...' : cardNumber || '—'}
                {cardNumber && <CopyButton text={cardNumber.replace(/\s/g, '')} />}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Тариф</span>
              <span className="font-semibold">{label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Сумма</span>
              <span className="text-xl font-extrabold text-brand-600">${amount}</span>
            </div>
          </div>

          {/* Instructions */}
          <ol className="mb-5 space-y-1 text-xs text-muted list-decimal list-inside">
            <li>Переведите точную сумму на карту выше.</li>
            <li>Прикрепите скриншот чека (необязательно, но ускорит проверку).</li>
            <li>Нажмите «Отправить на проверку» — мы активируем доступ вручную.</li>
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
                <p className="text-sm font-semibold text-green-800">✓ Чек прикреплён</p>
                <p className="truncate text-xs text-muted">{receipt.name} · {Math.max(1, Math.round(receipt.size / 1024))} КБ</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
                <button type="button" onClick={() => fileRef.current?.click()} className="text-brand-600 hover:text-brand-700">Заменить</button>
                <button type="button" onClick={clearReceipt} className="text-muted hover:text-red-600">Убрать</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mb-5 w-full cursor-pointer rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 p-5 text-center hover:border-brand-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-2xl mb-1">📎</div>
              <p className="text-sm font-semibold text-brand-700">Прикрепить чек</p>
              <p className="text-xs text-muted">PDF, JPG или PNG</p>
            </button>
          )}

          {errorMsg && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{errorMsg}</p>}

          <button
            onClick={handleSubmit}
            disabled={status === 'uploading'}
            className="btn btn-primary w-full"
          >
            {status === 'uploading' ? <Spinner /> : <>Отправить на проверку →</>}
          </button>
        </div>
      </Reveal>
    </div>
  )
}
