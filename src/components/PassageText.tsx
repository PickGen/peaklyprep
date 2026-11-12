import { Fragment, type ReactNode } from 'react'
import { MathText } from './MathText'

/** <u>underline</u>, <i>italic</i> and **bold** inside a line of text */
export function InlineText({ text }: { text: string }) {
  // math is written between dollar signs: "If $x = 7$ ..." (a price like "$5 and $10" is left alone)
  // "\$" is a plain dollar sign (money): "a fee of \$17 per hour"
  const parts = text.split(/(\\\$|<u>[\s\S]*?<\/u>|<i>[\s\S]*?<\/i>|\*\*[\s\S]*?\*\*|\$(?=\S)[^$\n]*?\S\$(?!\d))/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p === '\\$') return <Fragment key={i}>$</Fragment>
        if (p.startsWith('<u>')) return <u key={i} className="underline decoration-2 underline-offset-4">{p.slice(3, -4)}</u>
        if (p.startsWith('<i>')) return <i key={i}>{p.slice(3, -4)}</i>
        if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
        if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) return <MathText key={i} src={p.slice(1, -1)} />
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

const isTable = (lines: string[]) => lines.length >= 2 && lines.every((l) => l.trim().startsWith('|'))
const isBullets = (lines: string[]) => lines.every((l) => l.trim().startsWith('- '))
const IMAGE = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/

/**
 * Renders a test passage. Blocks are separated by a blank line:
 *  - lines starting with "|"   -> table (first row = header)
 *  - lines starting with "- "  -> bullet list (student notes)
 *  - ![alt](https://…)         -> figure (graph, drawing)
 *  - anything else             -> paragraph (supports <u>, <i>, **bold**)
 */
export function PassageText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.split('\n'))
  return (
    <div className={`space-y-4 text-[1.05rem] leading-8 text-ink ${className}`}>
      {blocks.map((lines, i): ReactNode => {
        if (isTable(lines)) {
          const rows = lines.map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
          const [head, ...body] = rows
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[0.95rem] leading-6">
                <thead>
                  <tr>
                    {head.map((c, j) => (
                      <th key={j} className="border border-ink/60 bg-brand-50 px-3 py-2 font-bold">
                        <InlineText text={c} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r, k) => (
                    <tr key={k}>
                      {r.map((c, j) => (
                        <td key={j} className="border border-ink/60 px-3 py-2">
                          <InlineText text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        const img = lines.length === 1 ? lines[0].trim().match(IMAGE) : null
        if (img) {
          return (
            <figure key={i} className="flex justify-center">
              <img src={img[2]} alt={img[1] || 'Figure'} loading="lazy" className="max-h-96 max-w-full rounded-lg bg-white object-contain" />
            </figure>
          )
        }
        if (isBullets(lines)) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {lines.map((l, j) => (
                <li key={j}>
                  <InlineText text={l.trim().slice(2)} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="whitespace-pre-line">
            <InlineText text={lines.join('\n')} />
          </p>
        )
      })}
    </div>
  )
}
