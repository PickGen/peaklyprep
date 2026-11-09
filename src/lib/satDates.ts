import { formatDate } from './i18n'
import { useQuery } from '@tanstack/react-query'

export interface SatDate {
  date: string // ISO yyyy-mm-dd
  registrationDeadline: string | null
  lateDeadline: string | null
}

export interface SatDatesResult {
  dates: SatDate[]
  /** true when the list was just read from the official College Board page */
  official: boolean
}

const CACHE_KEY = 'peakly.satDates'

// Last-resort list (College Board schedule at build time) used only if the live lookup and the local cache both fail.
const FALLBACK: SatDate[] = [
  { date: '2026-12-05', registrationDeadline: '2026-11-20', lateDeadline: '2026-11-24' },
  { date: '2027-03-06', registrationDeadline: '2027-02-19', lateDeadline: '2027-02-23' },
  { date: '2027-05-01', registrationDeadline: '2027-04-16', lateDeadline: '2027-04-20' },
  { date: '2027-06-05', registrationDeadline: '2027-05-21', lateDeadline: '2027-05-25' },
]

function readCache(): SatDate[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as SatDate[]) : null
  } catch {
    return null
  }
}

/** Official SAT dates, fetched from our /api/sat-dates function (which reads College Board and is cached ~6h). */
export function useSatDates() {
  return useQuery<SatDatesResult>({
    queryKey: ['sat-dates'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      try {
        const res = await fetch('/api/sat-dates')
        if (!res.ok) throw new Error(String(res.status))
        const body = (await res.json()) as { dates: SatDate[] }
        if (!Array.isArray(body.dates) || body.dates.length === 0) throw new Error('empty')
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(body.dates))
        } catch {
          /* storage unavailable */
        }
        return { dates: body.dates, official: true }
      } catch {
        return { dates: readCache() ?? FALLBACK, official: false }
      }
    },
  })
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) => formatDate(iso + 'T00:00:00', opts)
