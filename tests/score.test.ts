import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forecast, forecastSection, scaleScore, sittings, type ForecastAttempt } from '../src/lib/score.ts'

const at = (day: number) => new Date(Date.UTC(2026, 9, day, 12)).toISOString()
const rw = (p: Partial<ForecastAttempt>): ForecastAttempt => ({ test_id: 't1', score: 20, total: 27, created_at: at(1), section: 'Reading & Writing', form_title: null, module_no: null, ...p })
const math = (p: Partial<ForecastAttempt>): ForecastAttempt => ({ ...rw(p), section: 'Math', ...p })

test('scaleScore: ends of the scale and rounding to 10', () => {
  assert.equal(scaleScore('Math', 0), 200)
  assert.equal(scaleScore('Math', 1), 800)
  assert.equal(scaleScore('Reading & Writing', 1), 800)
  assert.equal(scaleScore('Reading & Writing', 0.5), 510)
  for (let s = 0; s <= 1; s += 0.037) assert.equal(scaleScore('Math', s) % 10, 0)
})

test('scaleScore: never decreases and stays inside 200–800', () => {
  for (const section of ['Math', 'Reading & Writing'] as const) {
    let prev = 0
    for (let i = 0; i <= 100; i++) {
      const v = scaleScore(section, i / 100)
      assert.ok(v >= prev, `${section} ${i}%`)
      assert.ok(v >= 200 && v <= 800)
      prev = v
    }
  }
  assert.equal(scaleScore('Math', -1), 200)
  assert.equal(scaleScore('Math', 7), 800)
  assert.equal(scaleScore('Math', Number.NaN), 200)
})

test('sittings: modules of one practice test count together, latest try of each module', () => {
  const list = sittings(
    [
      rw({ test_id: 'm1', form_title: 'PeaklyTest 3 — Reading & Writing', module_no: 1, score: 10, created_at: at(1) }),
      rw({ test_id: 'm1', form_title: 'PeaklyTest 3 — Reading & Writing', module_no: 1, score: 20, created_at: at(2) }),
      rw({ test_id: 'm2', form_title: 'PeaklyTest 3 — Reading & Writing', module_no: 2, score: 15, created_at: at(3) }),
      rw({ test_id: 'solo', score: 5, created_at: at(4) }),
      math({ test_id: 'x', created_at: at(5) }),
    ],
    'Reading & Writing',
  )
  assert.equal(list.length, 2)
  assert.deepEqual({ score: list[0].score, total: list[0].total, modules: list[0].modules }, { score: 5, total: 27, modules: 1 })
  assert.deepEqual({ score: list[1].score, total: list[1].total, modules: list[1].modules }, { score: 35, total: 54, modules: 2 })
})

test('forecastSection: no data → null; a perfect test → 800', () => {
  assert.equal(forecastSection([], 'Math'), null)
  const f = forecastSection([math({ score: 22, total: 22 })], 'Math')!
  assert.equal(f.score, 800)
  assert.equal(f.high, 800)
  assert.equal(f.basedOn, 1)
})

test('forecastSection: the range narrows with more tests', () => {
  const one = forecastSection([rw({ score: 18 })], 'Reading & Writing')!
  const three = forecastSection([rw({ test_id: 'a', score: 18, created_at: at(1) }), rw({ test_id: 'b', score: 18, created_at: at(2) }), rw({ test_id: 'c', score: 18, created_at: at(3) })], 'Reading & Writing')!
  assert.ok(one.high - one.low > three.high - three.low)
  assert.equal(one.score, three.score)
})

test('forecastSection: newer tests weigh more', () => {
  const improving = forecastSection([rw({ test_id: 'a', score: 9, created_at: at(1) }), rw({ test_id: 'b', score: 27, created_at: at(9) })], 'Reading & Writing')!
  const declining = forecastSection([rw({ test_id: 'a', score: 27, created_at: at(1) }), rw({ test_id: 'b', score: 9, created_at: at(9) })], 'Reading & Writing')!
  assert.ok(improving.score > declining.score)
})

test('forecast: total only when both sections exist, and it is their sum', () => {
  assert.equal(forecast([rw({})]).total, null)
  const f = forecast([rw({ score: 27 }), math({ test_id: 'm', score: 11, total: 22 })])
  assert.ok(f.rw && f.math && f.total)
  assert.equal(f.total!.score, f.rw!.score + f.math!.score)
  assert.ok(f.total!.score >= 400 && f.total!.score <= 1600)
})

test('forecast: attempts with total 0 are ignored', () => {
  assert.equal(forecast([rw({ score: 0, total: 0 })]).rw, null)
})
