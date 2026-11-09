// Vercel serverless function: reads the official SAT test dates from College Board.
// The response is cached at the edge for 6 hours (then refreshed in the background),
// so changes College Board makes to its schedule show up in the app automatically.

const SOURCE = 'https://satsuite.collegeboard.org/sat/registration/dates-deadlines'

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

const pad = (n: number) => String(n).padStart(2, '0')

function toIso(text: string): string | null {
  const m = text
    .replace(/&nbsp;|&ndash;|&mdash;/g, ' ')
    .match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})/)
  if (!m) return null
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()]
  if (!month) return null
  return `${m[3]}-${pad(month)}-${pad(Number(m[2]))}`
}

export interface SatDate {
  date: string
  registrationDeadline: string | null
  lateDeadline: string | null
}

export function parseSatDates(html: string): SatDate[] {
  const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0]
  if (!table) return []
  const out: SatDate[] = []
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const th = row[1].match(/<th[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/i)?.[1]
    if (!th) continue
    const date = toIso(th)
    if (!date) continue
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => toIso(c[1]))
    out.push({ date, registrationDeadline: cells[0] ?? null, lateDeadline: cells[1] ?? null })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(_req: any, res: any) {
  try {
    const r = await fetch(SOURCE, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; PeaklyPrep/1.0; +https://peaklyprep.vercel.app)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error(`College Board responded ${r.status}`)
    const dates = parseSatDates(await r.text())
    if (dates.length === 0) throw new Error('No dates found on the official page')
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
    res.status(200).json({ source: SOURCE, fetchedAt: new Date().toISOString(), dates })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: e instanceof Error ? e.message : 'Could not load official dates' })
  }
}
