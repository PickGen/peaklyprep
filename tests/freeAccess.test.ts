import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeFreeUntil, endOfDate, endOfDayAfter, parseFreeUntil } from '../src/lib/freeAccess.ts'
import { buildNotifications, planReminder } from '../src/lib/notifications.ts'

const now = new Date('2026-11-14T10:00:00Z')

test('the stored end date is read with or without the extra quotes', () => {
  assert.equal(parseFreeUntil('2026-11-21T18:59:59Z')?.toISOString(), '2026-11-21T18:59:59.000Z')
  assert.equal(parseFreeUntil('"2026-11-21T18:59:59.000Z"')?.toISOString(), '2026-11-21T18:59:59.000Z')
})

test('no value, an empty value or rubbish means no free period', () => {
  for (const raw of [null, undefined, '', '""', 'soon', 42, {}]) assert.equal(parseFreeUntil(raw), null)
})

test('the free period runs only until its end', () => {
  assert.ok(activeFreeUntil('2026-11-21T18:59:59Z', now))
  assert.equal(activeFreeUntil('2026-11-14T09:59:59Z', now), null)
  assert.equal(activeFreeUntil('', now), null)
})

test('"7 days" ends on the last second of the seventh day', () => {
  const end = new Date(endOfDayAfter(now, 7))
  const days = Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000)
  assert.equal(days, 7)
  assert.deepEqual([end.getHours(), end.getMinutes(), end.getSeconds()], [23, 59, 59])
  assert.ok(activeFreeUntil(endOfDayAfter(now, 7), now))
})

test('a date from the date field ends on the last second of that day', () => {
  const end = new Date(endOfDate('2026-11-21'))
  assert.deepEqual([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes()], [2026, 10, 21, 23, 59])
  assert.equal(endOfDate('21.11.2026'), '')
  assert.equal(endOfDate(''), '')
})

test('during the free period nobody is told that lessons are locked', () => {
  const ended = { expires_at: '2026-11-10T10:00:00Z' }
  const src = { now, isAdmin: false, subscription: ended, payments: [], news: [], examDate: null }
  assert.equal(buildNotifications(src)[0].title, 'Your plan has ended')
  assert.deepEqual(buildNotifications({ ...src, freeAccess: true }), [])
  assert.equal(planReminder(ended, now, false)?.kind, 'ended')
  assert.equal(planReminder(ended, now, false, true), null)
  // a plan that is still running keeps its "ends soon" reminder
  assert.equal(planReminder({ expires_at: '2026-11-16T10:00:00Z' }, now, false, true)?.kind, 'ending')
})
