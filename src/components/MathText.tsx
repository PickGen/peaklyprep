import type { ReactNode } from 'react'

/**
 * Tiny math renderer for question text written between dollar signs, e.g. "If $x = 7$, what is $x + 20$?"
 * Supports: ^ and _ (with {groups}), \frac{a}{b}, \sqrt{x}, \overline{AB}, \text{words}, \pi \theta \le \ge \neq \cdot \times \div \pm \infty \degree \ell \approx,
 * and \sin \cos \tan \log \ln. Latin letters are shown as italic variables, like the official test.
 */
const SYMBOLS: Record<string, string> = {
  pi: 'π',
  theta: 'θ',
  alpha: 'α',
  beta: 'β',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  cdot: '·',
  times: '×',
  div: '÷',
  pm: '±',
  infty: '∞',
  degree: '°',
  circ: '°',
  ell: 'ℓ',
  approx: '≈',
  angle: '∠',
  triangle: '△',
}
const FUNCS = new Set(['sin', 'cos', 'tan', 'log', 'ln'])

function group(s: string, i: number): [string, number] {
  if (s[i] === '{') {
    let depth = 0
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++
      else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1]
    }
    return [s.slice(i + 1), s.length]
  }
  return [s[i] ?? '', i + 1]
}

function parse(s: string, base = 'm'): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  let k = 0
  const key = () => `${base}${k++}`
  while (i < s.length) {
    const c = s[i]
    if (c === '\\') {
      let j = i + 1
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
      const name = s.slice(i + 1, j)
      if (name === 'frac') {
        const [a, ai] = group(s, j)
        const [b, bi] = group(s, ai)
        out.push(
          <span key={key()} className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.9em] leading-tight">
            <span className="border-b border-current px-0.5">{parse(a, key())}</span>
            <span className="px-0.5">{parse(b, key())}</span>
          </span>,
        )
        i = bi
      } else if (name === 'sqrt') {
        const [a, ai] = group(s, j)
        out.push(
          <span key={key()} className="whitespace-nowrap">
            √<span className="border-t border-current">{parse(a, key())}</span>
          </span>,
        )
        i = ai
      } else if (name === 'overline') {
        const [a, ai] = group(s, j)
        out.push(
          <span key={key()} className="border-t border-current">
            {parse(a, key())}
          </span>,
        )
        i = ai
      } else if (name === 'text') {
        const [a, ai] = group(s, j)
        out.push(<span key={key()}>{a}</span>)
        i = ai
      } else if (FUNCS.has(name)) {
        out.push(<span key={key()}>{name}</span>)
        i = j
      } else if (SYMBOLS[name]) {
        out.push(<span key={key()}>{SYMBOLS[name]}</span>)
        i = j
      } else {
        // unknown command or an escaped character such as \%
        out.push(<span key={key()}>{name || s[j] || ''}</span>)
        i = name ? j : j + 1
      }
    } else if (c === '^' || c === '_') {
      const [a, ai] = group(s, i + 1)
      out.push(c === '^' ? <sup key={key()}>{parse(a, key())}</sup> : <sub key={key()}>{parse(a, key())}</sub>)
      i = ai
    } else if (/[a-zA-Z]/.test(c)) {
      out.push(
        <i key={key()} className="pr-[0.04em]">
          {c}
        </i>,
      )
      i++
    } else if (c === '-') {
      out.push(<span key={key()}>−</span>)
      i++
    } else {
      out.push(<span key={key()}>{c}</span>)
      i++
    }
  }
  return out
}

export function MathText({ src }: { src: string }) {
  return <span className="font-serif text-[1.06em] lining-nums">{parse(src)}</span>
}
