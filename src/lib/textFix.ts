/**
 * Repairs "mojibake": UTF-8 text that was read with the wrong encoding somewhere before it was pasted
 * into the admin, e.g. "2x¬≤ вИТ 3x" (UTF-8 read as Mac Cyrillic) or "itâ€™s" (UTF-8 read as Windows-1252).
 *
 * Each garbled run is turned back into its bytes and decoded as UTF-8. A run is only replaced when those bytes
 * form one valid UTF-8 character from a script that SAT content actually uses (symbols, Latin, Greek,
 * Cyrillic, math letters), so ordinary text, including Russian, is left alone.
 */

// Windows-1251 is deliberately not included: all-caps Russian ("ПРИЁМ") would look like valid UTF-8 in it.
const CODECS = ['x-mac-cyrillic', 'windows-1252'] as const

let tables: Map<string, number>[] | null = null

function byteTables(): Map<string, number>[] {
  if (tables) return tables
  tables = []
  for (const label of CODECS) {
    try {
      const dec = new TextDecoder(label)
      const map = new Map<string, number>()
      for (let b = 0x80; b <= 0xff; b++) {
        const ch = dec.decode(new Uint8Array([b]))
        if (ch.length === 1 && ch !== '�' && !map.has(ch)) map.set(ch, b)
      }
      tables.push(map)
    } catch {
      /* this browser has no decoder for the codec; skip it */
    }
  }
  return tables
}

const utf8 = new TextDecoder('utf-8', { fatal: true })

function plausible(cp: number): boolean {
  return (
    (cp >= 0x00a0 && cp <= 0x024f) || // Latin-1 supplement, Latin extended (é, ², ½, ·, °)
    (cp >= 0x0370 && cp <= 0x04ff) || // Greek, Cyrillic (π, θ)
    (cp >= 0x2000 && cp <= 0x2bff) || // punctuation, super/subscripts, arrows, math operators, shapes (’ — − √ ≤ △)
    (cp >= 0x1d400 && cp <= 0x1d7ff) // math letters (𝑥)
  )
}

function seqLength(lead: number): number {
  if (lead >= 0xc2 && lead <= 0xdf) return 2
  if (lead >= 0xe0 && lead <= 0xef) return 3
  if (lead >= 0xf0 && lead <= 0xf4) return 4
  return 0
}

function fixWith(text: string, map: Map<string, number>): string {
  const chars = Array.from(text)
  let out = ''
  let i = 0
  while (i < chars.length) {
    const lead = map.get(chars[i])
    const len = lead === undefined ? 0 : seqLength(lead)
    if (len && i + len <= chars.length) {
      const bytes = [lead!]
      for (let k = 1; k < len; k++) {
        const b = map.get(chars[i + k])
        if (b === undefined || b < 0x80 || b > 0xbf) break
        bytes.push(b)
      }
      if (bytes.length === len) {
        try {
          const decoded = utf8.decode(new Uint8Array(bytes))
          const cp = decoded.codePointAt(0) ?? 0
          if (Array.from(decoded).length === 1 && plausible(cp)) {
            out += decoded
            i += len
            continue
          }
        } catch {
          /* not valid UTF-8: keep the original characters */
        }
      }
    }
    out += chars[i]
    i++
  }
  return out
}

/** Returns the text with garbled symbols repaired (unchanged if nothing looks garbled). */
export function fixGarbled(text: string): string {
  if (!text || /^[\x00-\x7f]*$/.test(text)) return text
  let out = text
  for (const map of byteTables()) out = fixWith(out, map)
  return out
}

export function hasGarbled(text: string | null | undefined): boolean {
  return Boolean(text) && fixGarbled(text!) !== text
}

/** Applies fixGarbled to every string inside a plain object / array (one level of nesting is enough here). */
export function fixGarbledDeep<T>(value: T): T {
  if (typeof value === 'string') return fixGarbled(value) as T
  if (Array.isArray(value)) return value.map((v) => fixGarbledDeep(v)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixGarbledDeep(v)])) as T
  }
  return value
}
