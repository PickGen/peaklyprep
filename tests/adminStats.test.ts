import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayKey, lastDays, revenueStats, shiftDay } from '../src/lib/adminStats.ts'

// 17:00 on 13 November 2026 in Almaty (UTC+5)
const NOW = '2026-11-13T12:00:00Z'

test('a day starts at midnight Almaty time, not UTC', () => {
  assert.equal(dayKey('2026-11-12T18:59:00Z'), '2026-11-12')
  assert.equal(dayKey('2026-11-12T19:30:00Z'), '2026-11-13')
  assert.equal(dayKey('2026-11-12T19:30:00Z', 'UTC'), '2026-11-12')
})

test('days shift across month and year borders', () => {
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28')
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01')
  assert.deepEqual(lastDays(3, NOW), ['2026-11-11', '2026-11-12', '2026-11-13'])
})

test('revenue counts approved requests only and splits them by period', () => {
  const row = (amount_usd: number | string, plan: string, status: string, created_at: string) => ({ amount_usd, plan, status, created_at })
  const s = revenueStats(
    [
      row(9.99, '1m', 'approved', '2026-11-13T05:00:00Z'), // today
      row('19.5', '3m', 'approved', '2026-11-12T19:30:00Z'), // already 13 November in Almaty
      row(30, '3m', 'approved', '2026-11-07T10:00:00Z'), // the first day of the 7-day window
      row(40, '12m', 'approved', '2026-11-06T10:00:00Z'), // one day too old for the week
      row(50, '1m', 'approved', '2026-10-15T00:00:00Z'), // the first day of the 30-day window
      row(60, '6m', 'approved', '2026-10-14T10:00:00Z'), // only in the total
      row(25, '1m', 'pending', '2026-11-13T06:00:00Z'),
      row(99, '1m', 'rejected', '2026-11-13T06:00:00Z'),
    ],
    NOW,
  )
  assert.equal(s.today, 29.49)
  assert.equal(s.week, 59.49)
  assert.equal(s.month, 149.49)
  assert.equal(s.total, 209.49)
  assert.equal(s.paidCount, 6)
  assert.equal(s.pendingCount, 1)
  assert.equal(s.pendingSum, 25)
  assert.deepEqual(s.byPlan, [
    { plan: '1m', count: 2, sum: 59.99 },
    { plan: '3m', count: 2, sum: 49.5 },
    { plan: '6m', count: 1, sum: 60 },
    { plan: '12m', count: 1, sum: 40 },
  ])
  assert.equal(s.daily.length, 30)
  assert.deepEqual(s.daily[0], { day: '2026-10-15', value: 50 })
  assert.deepEqual(s.daily[29], { day: '2026-11-13', value: 29.49 })
  assert.equal(s.daily.reduce((sum, d) => sum + Math.round(d.value * 100), 0), 14949)
})

test('no payments yet: everything is zero and the chart still has every day', () => {
  const s = revenueStats([], NOW, 7)
  assert.equal(s.total, 0)
  assert.deepEqual(s.byPlan, [])
  assert.deepEqual(s.daily.map((d) => d.value), [0, 0, 0, 0, 0, 0, 0])
})
