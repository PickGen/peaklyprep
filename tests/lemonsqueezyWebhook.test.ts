import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { GET, POST } from '../api/lemonsqueezy-webhook.ts'

const SECRET = 'test-signing-secret'
const USER = '0b0f6f0e-6c1c-4d9e-9a51-3a2f7b1c9d10'

interface Call {
  url: string
  headers: Record<string, string>
  args: Record<string, unknown>
}
let calls: Call[] = []
let answer: { status: number; body: unknown } = { status: 200, body: { result: 'granted' } }

// Supabase is replaced by a recorder: the tests only look at what the function would send to it.
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), headers: init?.headers as Record<string, string>, args: JSON.parse(String(init?.body)) })
  return new Response(JSON.stringify(answer.body), { status: answer.status })
}) as typeof fetch

beforeEach(() => {
  calls = []
  answer = { status: 200, body: { result: 'granted' } }
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.SUPABASE_URL = 'https://example.supabase.co/'
  delete process.env.LEMONSQUEEZY_ALLOW_TEST
})

function order(over: { event?: string; custom?: Record<string, string>; attributes?: Record<string, unknown> } = {}) {
  return {
    meta: { event_name: over.event ?? 'order_created', ...(over.custom ? { custom_data: over.custom } : {}) },
    data: {
      type: 'orders',
      id: '501',
      attributes: {
        order_number: 17,
        user_email: 'Student@Example.com',
        status: 'paid',
        subtotal_usd: 1500,
        discount_total_usd: 0,
        total_usd: 1500,
        refunded: false,
        test_mode: false,
        ...over.attributes,
      },
    },
  }
}

function send(payload: unknown, opts: { secret?: string; signature?: string } = {}) {
  const body = JSON.stringify(payload)
  const signature = opts.signature ?? createHmac('sha256', opts.secret ?? SECRET).update(body).digest('hex')
  return POST(new Request('https://www.peaklyprep.com/api/lemonsqueezy-webhook', { method: 'POST', headers: { 'x-signature': signature }, body }))
}

test('a request without the right signature is refused and nothing reaches the database', async () => {
  assert.equal((await send(order(), { signature: '' })).status, 401)
  assert.equal((await send(order(), { secret: 'someone-elses-secret' })).status, 401)
  assert.equal((await send(order(), { signature: 'not-hex' })).status, 401)
  assert.equal(calls.length, 0)
})

test('without the settings the function refuses to work', async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  assert.equal((await send(order())).status, 503)
  assert.equal(calls.length, 0)
  assert.equal((await GET().json()).configured, false)
})

test('a paid order opens the plan for the student who started the checkout', async () => {
  const res = await send(order({ custom: { user_id: USER, plan: '3m' } }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { result: 'granted' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/record_card_payment')
  assert.equal(calls[0].headers.authorization, 'Bearer service-key')
  assert.deepEqual(calls[0].args, {
    p_provider: 'lemonsqueezy',
    p_external_id: '501',
    p_user_id: USER,
    p_email: 'Student@Example.com',
    p_plan: '3m',
    p_amount_usd: 15,
    p_grant: true,
    p_note: 'Lemon Squeezy · заказ №17',
  })
})

test('the plan follows the money, not what the link claimed', async () => {
  // paid for one month, but the link was edited to say twelve
  await send(order({ custom: { user_id: USER, plan: '12m' }, attributes: { subtotal_usd: 700 } }))
  assert.equal(calls[0].args.p_plan, '1m')
  assert.equal(calls[0].args.p_grant, true)
  assert.equal(calls[0].args.p_amount_usd, 7)
  assert.match(String(calls[0].args.p_note), /выбран 12 мес, оплачен 1 мес/)
})

test('a discount lowers the earnings but not the plan', async () => {
  await send(order({ custom: { user_id: USER, plan: '12m' }, attributes: { subtotal_usd: 5000, discount_total_usd: 1000 } }))
  assert.equal(calls[0].args.p_plan, '12m')
  assert.equal(calls[0].args.p_amount_usd, 40)
})

test('a payment smaller than any plan waits for the admin instead of opening access', async () => {
  await send(order({ custom: { user_id: USER, plan: '6m' }, attributes: { subtotal_usd: 100 } }))
  assert.equal(calls[0].args.p_plan, '6m')
  assert.equal(calls[0].args.p_grant, false)
})

test('a link opened outside the site still works: the student is found by e-mail', async () => {
  await send(order({ custom: { user_id: 'not-a-uuid' } }))
  assert.equal(calls[0].args.p_user_id, null)
  assert.equal(calls[0].args.p_email, 'Student@Example.com')
  assert.equal(calls[0].args.p_plan, '3m')
})

test('a paid order with no matching student is reported as failed, so it can be re-sent', async () => {
  answer = { status: 200, body: { result: 'no_user' } }
  assert.equal((await send(order())).status, 422)
})

test('test-mode orders are ignored unless testing is switched on, and never count as money', async () => {
  const testOrder = order({ custom: { user_id: USER, plan: '3m' }, attributes: { test_mode: true } })
  const ignored = await send(testOrder)
  assert.equal(ignored.status, 200)
  assert.equal(calls.length, 0)

  process.env.LEMONSQUEEZY_ALLOW_TEST = 'true'
  assert.equal((await send(testOrder)).status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args.p_amount_usd, 0)
  assert.equal(calls[0].args.p_grant, true)
  assert.match(String(calls[0].args.p_note), /ТЕСТ/)
})

test('an unpaid order and other events change nothing', async () => {
  assert.equal((await send(order({ attributes: { status: 'pending' } }))).status, 200)
  assert.equal((await send(order({ event: 'subscription_created' }))).status, 200)
  assert.equal((await send({ meta: { event_name: 'order_created' }, data: { type: 'subscriptions', id: '1', attributes: {} } })).status, 200)
  assert.equal(calls.length, 0)
})

test('a full refund closes the access, a partial one only leaves a note', async () => {
  await send(order({ event: 'order_refunded', attributes: { status: 'refunded', refunded: true } }))
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/refund_card_payment')
  assert.deepEqual(calls[0].args, { p_provider: 'lemonsqueezy', p_external_id: '501', p_full: true, p_note: 'Возврат денег' })

  await send(order({ event: 'order_refunded', attributes: { status: 'partial_refund', refunded: false } }))
  assert.equal(calls[1].args.p_full, false)
})

test('a database failure answers 500, so the provider delivers the order again', async () => {
  answer = { status: 500, body: { message: 'boom' } }
  assert.equal((await send(order({ custom: { user_id: USER, plan: '3m' } }))).status, 500)
})
