// Vercel function: Lemon Squeezy calls it when an order is paid or refunded, and it opens (or closes)
// the student's access in Supabase. Address for the Lemon Squeezy webhook settings:
//   https://www.peaklyprep.com/api/lemonsqueezy-webhook      events: order_created, order_refunded
//
// Settings (Vercel -> Project -> Settings -> Environment Variables), all server-side only:
//   LEMONSQUEEZY_WEBHOOK_SECRET  the "signing secret" typed into the webhook form in Lemon Squeezy
//   SUPABASE_SERVICE_ROLE_KEY    Supabase -> Project Settings -> API keys -> service_role (never VITE_...)
//   SUPABASE_URL                 optional; VITE_SUPABASE_URL is used when it is missing
//   LEMONSQUEEZY_ALLOW_TEST      "true" only while testing: test-mode orders then open real access.
//                                Remove it before taking real payments.
//
// Every request must carry X-Signature = HMAC-SHA256(raw body, signing secret) in hex; anything else is
// refused, so nobody can open access by calling this address by hand.

declare const process: { env: Record<string, string | undefined> }

const PROVIDER = 'lemonsqueezy'

/** Plan prices in US cents; keep in sync with PLANS in src/components/Pricing.tsx. */
const PLAN_CENTS: Record<string, number> = { '1m': 700, '3m': 1500, '6m': 2500, '12m': 5000 }
const PLAN_LABEL: Record<string, string> = { '1m': '1 мес', '3m': '3 мес', '6m': '6 мес', '12m': '12 мес' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const env = (name: string) => (process.env[name] ?? '').trim()
const supabaseUrl = () => (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, '')

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function hmacHex(secret: string, text: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)))
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compares without stopping at the first different character, so timing tells an attacker nothing. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The plan is decided by the money that was paid, never by what the checkout link claimed. */
function planForPrice(cents: number): string | null {
  let best: string | null = null
  for (const [plan, price] of Object.entries(PLAN_CENTS)) {
    if (price <= cents && (best === null || price > PLAN_CENTS[best])) best = plan
  }
  return best
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

async function rpc(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${fn} answered ${res.status}: ${text.slice(0, 300)}`)
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

/** Open this address in a browser to see whether the settings are in place (no secrets are shown). */
export function GET(): Response {
  return reply(200, {
    ok: true,
    configured: Boolean(env('LEMONSQUEEZY_WEBHOOK_SECRET') && env('SUPABASE_SERVICE_ROLE_KEY') && supabaseUrl()),
    test_orders: env('LEMONSQUEEZY_ALLOW_TEST') === 'true' ? 'accepted' : 'ignored',
  })
}

export async function POST(request: Request): Promise<Response> {
  const secret = env('LEMONSQUEEZY_WEBHOOK_SECRET')
  if (!secret || !env('SUPABASE_SERVICE_ROLE_KEY') || !supabaseUrl()) {
    console.error('lemonsqueezy-webhook: environment variables are not set')
    return reply(503, { error: 'not configured' })
  }

  // The signature covers the body exactly as it was sent, so read it as text before parsing.
  const raw = await request.text()
  const signature = (request.headers.get('x-signature') ?? '').trim().toLowerCase()
  if (!signature || !sameText(signature, await hmacHex(secret, raw))) {
    return reply(401, { error: 'bad signature' })
  }

  let payload: any
  try {
    payload = JSON.parse(raw)
  } catch {
    return reply(400, { error: 'body is not JSON' })
  }

  const event = String(payload?.meta?.event_name ?? request.headers.get('x-event-name') ?? '')
  const order = payload?.data
  const a = order?.attributes
  if (order?.type !== 'orders' || !a || order.id === undefined || order.id === null) {
    return reply(200, { ignored: 'not an order event' })
  }

  const test = a.test_mode === true || payload?.meta?.test_mode === true
  if (test && env('LEMONSQUEEZY_ALLOW_TEST') !== 'true') {
    return reply(200, { ignored: 'test-mode order' })
  }

  const externalId = String(order.id)
  const orderLabel = `Lemon Squeezy · заказ №${a.order_number ?? externalId}${test ? ' · ТЕСТ' : ''}`

  try {
    if (event === 'order_created') {
      if (a.status !== 'paid') return reply(200, { ignored: `order status: ${String(a.status)}` })

      const custom = payload?.meta?.custom_data ?? {}
      const userId = typeof custom.user_id === 'string' && UUID.test(custom.user_id) ? custom.user_id : null
      const claimed = typeof custom.plan === 'string' && Object.prototype.hasOwnProperty.call(PLAN_CENTS, custom.plan) ? (custom.plan as string) : null

      // list price of what was bought, before discount and tax, in US cents
      const price = Number(a.subtotal_usd) || 0
      const received = Math.max(price - (Number(a.discount_total_usd) || 0), 0)
      const paidFor = planForPrice(price)
      const plan = paidFor ?? claimed ?? '1m'

      const notes = [orderLabel]
      if (!paidFor) notes.push(`оплачено ${dollars(price)} — меньше любого тарифа, доступ не открыт, проверьте вручную`)
      else if (claimed && claimed !== paidFor) notes.push(`на сайте выбран ${PLAN_LABEL[claimed]}, оплачен ${PLAN_LABEL[paidFor]}`)

      const result = await rpc('record_card_payment', {
        p_provider: PROVIDER,
        p_external_id: externalId,
        p_user_id: userId,
        p_email: typeof a.user_email === 'string' ? a.user_email : null,
        p_plan: plan,
        // a test order brings no money, so it must not show up in the earnings
        p_amount_usd: test ? 0 : received / 100,
        p_grant: Boolean(paidFor),
        p_note: notes.join(' · '),
      })

      if (result.result === 'no_user') {
        // Not 200 on purpose: the delivery then shows as failed in Lemon Squeezy and can be re-sent
        // from there once the student's account is sorted out.
        console.error(`lemonsqueezy-webhook: order ${externalId} is paid, but no student matches it`)
        return reply(422, { error: 'student not found' })
      }
      return reply(200, { result: result.result })
    }

    if (event === 'order_refunded') {
      const full = a.refunded === true || a.status === 'refunded'
      const result = await rpc('refund_card_payment', {
        p_provider: PROVIDER,
        p_external_id: externalId,
        p_full: full,
        p_note: full ? 'Возврат денег' : 'Частичный возврат',
      })
      return reply(200, { result: result.result })
    }

    return reply(200, { ignored: `event ${event}` })
  } catch (e) {
    // 500 makes Lemon Squeezy try again (three more times, with growing pauses)
    console.error('lemonsqueezy-webhook:', e instanceof Error ? e.message : e)
    return reply(500, { error: 'could not record the order' })
  }
}
