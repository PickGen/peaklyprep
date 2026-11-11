import type { Section } from './types'

/**
 * SAT score forecast, separately for Reading & Writing and Math (200–800 each, total 400–1600).
 *
 * How it works:
 * 1. Attempts are grouped into "sittings": modules of one practice test (same `form_title`) count together,
 *    using the latest attempt of each module. A test without a form is its own sitting.
 * 2. The share of correct answers of a sitting is converted to a section score with a curve close to the
 *    published SAT conversion tables (it is not linear: the last few questions are worth more points).
 * 3. The three most recent sittings of a section are averaged, newer ones weigh more (3 : 2 : 1).
 * 4. The range (±) is wider when there is little data: one sitting ±60, two ±40, three or more ±30,
 *    +20 when none of the sittings had both modules.
 */

export interface ForecastAttempt {
  test_id: string
  score: number
  total: number
  created_at: string
  section: Section
  form_title: string | null
  module_no: number | null
}

export interface SectionForecast {
  score: number
  low: number
  high: number
  /** how many sittings the forecast is based on */
  basedOn: number
}

export interface Forecast {
  rw: SectionForecast | null
  math: SectionForecast | null
  total: { score: number; low: number; high: number } | null
}

/** [share correct, scaled score] — points between them are interpolated */
const CURVES: Record<Section, [number, number][]> = {
  'Reading & Writing': [
    [0, 200], [0.1, 280], [0.2, 350], [0.3, 410], [0.4, 460], [0.5, 510], [0.6, 560],
    [0.7, 610], [0.8, 660], [0.85, 690], [0.9, 720], [0.95, 760], [1, 800],
  ],
  Math: [
    [0, 200], [0.1, 300], [0.2, 370], [0.3, 430], [0.4, 480], [0.5, 530], [0.6, 580],
    [0.7, 630], [0.8, 680], [0.85, 710], [0.9, 740], [0.95, 770], [1, 800],
  ],
}

const round10 = (n: number) => Math.round(n / 10) * 10
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Share of correct answers (0–1) → section score 200–800, rounded to 10 like the real SAT. */
export function scaleScore(section: Section, share: number): number {
  const s = clamp(Number.isFinite(share) ? share : 0, 0, 1)
  const curve = CURVES[section]
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]
    if (s <= x1) {
      const [x0, y0] = curve[i - 1]
      return round10(y0 + ((s - x0) / (x1 - x0)) * (y1 - y0))
    }
  }
  return 800
}

interface Sitting {
  score: number
  total: number
  at: number
  modules: number
}

/** Groups the attempts of one section into sittings, newest first. */
export function sittings(attempts: ForecastAttempt[], section: Section): Sitting[] {
  const groups = new Map<string, Map<string, ForecastAttempt>>()
  for (const a of attempts) {
    if (a.section !== section || !(a.total > 0)) continue
    const key = a.form_title ? `form:${a.form_title}` : `test:${a.test_id}`
    const byTest = groups.get(key) ?? new Map<string, ForecastAttempt>()
    const prev = byTest.get(a.test_id)
    if (!prev || prev.created_at < a.created_at) byTest.set(a.test_id, a)
    groups.set(key, byTest)
  }
  return [...groups.values()]
    .map((byTest) => {
      const list = [...byTest.values()]
      return {
        score: list.reduce((s, a) => s + a.score, 0),
        total: list.reduce((s, a) => s + a.total, 0),
        at: Math.max(...list.map((a) => new Date(a.created_at).getTime())),
        modules: list.length,
      }
    })
    .sort((a, b) => b.at - a.at)
}

const WEIGHTS = [3, 2, 1]

export function forecastSection(attempts: ForecastAttempt[], section: Section): SectionForecast | null {
  const recent = sittings(attempts, section).slice(0, WEIGHTS.length)
  if (recent.length === 0) return null
  let sum = 0
  let weight = 0
  recent.forEach((s, i) => {
    sum += scaleScore(section, s.score / s.total) * WEIGHTS[i]
    weight += WEIGHTS[i]
  })
  const score = clamp(round10(sum / weight), 200, 800)
  const margin = (recent.length === 1 ? 60 : recent.length === 2 ? 40 : 30) + (recent.every((s) => s.modules < 2) ? 20 : 0)
  return { score, low: clamp(score - margin, 200, 800), high: clamp(score + margin, 200, 800), basedOn: recent.length }
}

export function forecast(attempts: ForecastAttempt[]): Forecast {
  const rw = forecastSection(attempts, 'Reading & Writing')
  const math = forecastSection(attempts, 'Math')
  return {
    rw,
    math,
    total: rw && math ? { score: rw.score + math.score, low: rw.low + math.low, high: rw.high + math.high } : null,
  }
}
