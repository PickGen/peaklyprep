import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildNotifications, planReminder, type NotificationSources } from '../src/lib/notifications.ts'

const now = new Date('2026-11-12T10:00:00Z')
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString()
const base = (p: Partial<NotificationSources> = {}): NotificationSources => ({ now, isAdmin: false, subscription: null, payments: [], news: [], examDate: null, ...p })

test('nothing to say → empty list', () => {
  assert.deepEqual(buildNotifications(base()), [])
})

test('plan ending: reminders 7, 3 and 1 day before with different keys', () => {
  const k = (d: number) => buildNotifications(base({ subscription: { expires_at: inDays(d) } }))[0]
  assert.equal(buildNotifications(base({ subscription: { expires_at: inDays(20) } })).length, 0)
  const a = k(6.5)
  const b = k(2.5)
  const c = k(0.5)
  assert.equal(a.title, 'Your plan ends in {n} days')
  assert.equal(a.vars?.n, 7)
  assert.equal(c.title, 'Your plan ends tomorrow')
  assert.equal(new Set([a.key, b.key, c.key]).size, 3)
  assert.equal(a.link, '/app/plans')
})

test('plan ended: shown for 30 days, then gone', () => {
  assert.equal(buildNotifications(base({ subscription: { expires_at: inDays(-2) } }))[0].title, 'Your plan has ended')
  assert.equal(buildNotifications(base({ subscription: { expires_at: inDays(-40) } })).length, 0)
})

test('admins get no plan reminders but see pending payments', () => {
  const list = buildNotifications(base({ isAdmin: true, subscription: { expires_at: inDays(2) }, pendingPayments: [{ id: 'p1', created_at: inDays(-1) }, { id: 'p2', created_at: inDays(-0.1) }] }))
  assert.equal(list.length, 1)
  assert.equal(list[0].vars?.n, 2)
  assert.equal(list[0].key, 'admin-pending-p2')
})

test('payment decisions: approved and rejected, pending ignored, admin note shown as written', () => {
  const list = buildNotifications(
    base({
      payments: [
        { id: 'a', status: 'approved', admin_note: null, created_at: inDays(-1) },
        { id: 'b', status: 'rejected', admin_note: 'Сумма не совпадает', created_at: inDays(-2) },
        { id: 'c', status: 'pending', admin_note: null, created_at: inDays(-0.5) },
      ],
    }),
  )
  assert.deepEqual(list.map((n) => n.key), ['pay-a-approved', 'pay-b-rejected'])
  assert.equal(list[1].body, 'Сумма не совпадает')
  assert.equal(list[1].raw, true)
})

test('news: only published, last 30 days, newest first, at most 5', () => {
  const news = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, title: `T${i}`, body: 'b', published: i !== 0, created_at: inDays(-i) }))
  news.push({ id: 'old', title: 'old', body: 'b', published: true, created_at: inDays(-45) })
  const list = buildNotifications(base({ news }))
  assert.deepEqual(list.map((n) => n.key), ['news-n1', 'news-n2', 'news-n3', 'news-n4', 'news-n5'])
})

test('exam reminder: a week before and the day before', () => {
  const day = (d: number) => inDays(d).slice(0, 10)
  assert.equal(buildNotifications(base({ examDate: day(5) }))[0].title, 'The SAT is in {n} days')
  assert.equal(buildNotifications(base({ examDate: day(1) }))[0].title, 'The SAT is tomorrow')
  assert.equal(buildNotifications(base({ examDate: day(20) })).length, 0)
  assert.equal(buildNotifications(base({ examDate: day(-3) })).length, 0)
})

test('planReminder for the home page', () => {
  assert.equal(planReminder(null, now, false), null)
  assert.equal(planReminder({ expires_at: inDays(30) }, now, false), null)
  assert.deepEqual(planReminder({ expires_at: inDays(3) }, now, false), { kind: 'ending', days: 3 })
  assert.deepEqual(planReminder({ expires_at: inDays(-1) }, now, false), { kind: 'ended', days: 0 })
  assert.equal(planReminder({ expires_at: inDays(3) }, now, true), null)
})
