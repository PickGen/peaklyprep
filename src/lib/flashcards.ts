/**
 * Turns the text of a word list (a lesson with kind = 'word_list') into flashcards.
 * Understands the formats admins usually paste:
 *   | Word | Definition | Example |        (a table; columns are found by their header, otherwise 1st/2nd/3rd)
 *   - **abate** (v.) — to become less intense
 *   1. abate: to become less intense
 *   abate - to become less intense
 *   Example: The storm abated by morning.  (a line after a card becomes its example)
 */

export interface Flashcard {
  word: string
  /** part of speech, e.g. "v." or "adj." */
  pos?: string
  definition: string
  example?: string
}

const stripMd = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1$2')
    .replace(/<\/?(?:b|i|u|strong|em)>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

const WORD_HEAD = /^(word|term|vocab(ulary)?|слово|термин|сөз)$/i
const DEF_HEAD = /^(definition|meaning|translation|значение|определение|перевод|мағынасы|аудармасы)$/i
const EX_HEAD = /^(example|sentence|usage|пример|предложение|мысал)$/i
const EXAMPLE_LINE = /^(?:[-*•]\s*)?(?:\*\*|_)?(?:example|e\.g\.|ex\.|пример|мысал)(?:\*\*|_)?\s*[:—–-]\s*(.+)$/i
const POS = /^(.*?)\s*\(((?:[a-z]{1,5}\.?\s*\/?\s*)+)\)\s*$/i

function splitWord(raw: string): { word: string; pos?: string } {
  const w = stripMd(raw).replace(/[:—–-]+$/, '').trim()
  const m = w.match(POS)
  if (m && m[1]) return { word: m[1].trim(), pos: m[2].trim() }
  return { word: w }
}

function cells(row: string): string[] {
  const parts = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return parts.map((c) => c.trim())
}

function fromTable(lines: string[]): Flashcard[] {
  const rows = lines.filter((l) => l.trim().startsWith('|'))
  if (rows.length < 2) return []
  const isSep = (r: string) => /^\|?[\s:|-]+\|?$/.test(r.trim()) && r.includes('-')
  let wordCol = 0
  let defCol = 1
  let exCol = -1
  let body = rows
  const head = cells(rows[0]).map(stripMd)
  if (rows.length > 1 && isSep(rows[1])) {
    body = rows.slice(2)
    const w = head.findIndex((h) => WORD_HEAD.test(h))
    const d = head.findIndex((h) => DEF_HEAD.test(h))
    const e = head.findIndex((h) => EX_HEAD.test(h))
    if (w >= 0) wordCol = w
    if (d >= 0) defCol = d
    else defCol = wordCol === 0 ? 1 : 0
    exCol = e >= 0 ? e : head.length > 2 ? [0, 1, 2].find((i) => i !== wordCol && i !== defCol) ?? -1 : -1
  }
  const out: Flashcard[] = []
  for (const r of body) {
    if (isSep(r)) continue
    const c = cells(r)
    const { word, pos } = splitWord(c[wordCol] ?? '')
    const definition = stripMd(c[defCol] ?? '')
    if (!word || !definition) continue
    const example = exCol >= 0 ? stripMd(c[exCol] ?? '') : ''
    out.push({ word, ...(pos ? { pos } : {}), definition, ...(example ? { example } : {}) })
  }
  return out
}

// "word — definition", "word: definition", "word - definition" (word part is short and comes first)
const LINE = /^(?:[-*•]\s+|\d{1,3}[.)]\s+)?(.{1,60}?)\s*(?:\s[—–-]\s|:\s|\s[—–]|[—–]\s)\s*(.+)$/

function fromLines(lines: string[]): Flashcard[] {
  const out: Flashcard[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('|') || /^-{3,}$/.test(line)) continue
    const ex = line.match(EXAMPLE_LINE)
    if (ex) {
      const last = out[out.length - 1]
      if (last && !last.example) last.example = stripMd(ex[1])
      continue
    }
    const m = line.match(LINE)
    if (!m) {
      // an italic line right after a card is its example sentence
      const italic = line.match(/^(?:[-*•]\s+)?[*_](?![*_])(.+)[*_]$/)
      const last = out[out.length - 1]
      if (italic && last && !last.example) last.example = stripMd(italic[1])
      continue
    }
    const { word, pos } = splitWord(m[1])
    const definition = stripMd(m[2])
    // skip sentences that only look like "x - y" (too many words before the dash)
    if (!word || !definition || word.split(' ').length > 4 || /[.!?]$/.test(word)) continue
    out.push({ word, ...(pos ? { pos } : {}), definition })
  }
  return out
}

export function parseWordList(content: string): Flashcard[] {
  const lines = (content ?? '').replace(/\r\n?/g, '\n').split('\n')
  const table = fromTable(lines)
  const list = fromLines(lines)
  const all = table.length >= list.length ? [...table, ...list] : [...list, ...table]
  const seen = new Set<string>()
  return all.filter((c) => {
    const k = c.word.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
