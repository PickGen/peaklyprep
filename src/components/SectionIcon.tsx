import type { Section } from '../lib/types'
import { BookIcon, CalculatorIcon } from './Icons'

export const sectionTheme: Record<Section, { tile: string; chip: string; bar: string }> = {
  'Reading & Writing': { tile: 'bg-sky-100 text-sky-600', chip: 'bg-sky-100 text-sky-700', bar: 'from-sky-500 to-sky-400' },
  Math: { tile: 'bg-brand-100 text-brand-600', chip: 'bg-brand-100 text-brand-700', bar: 'from-brand-600 to-brand-400' },
}

/** Safe lookup: unknown section names (e.g. old data) fall back to Reading & Writing. */
export const themeOf = (section: string) => sectionTheme[section as Section] ?? sectionTheme['Reading & Writing']

export function SectionIcon({ section, className = 'h-6 w-6' }: { section: Section; className?: string }) {
  if (section === 'Math') return <CalculatorIcon className={className} />
  return <BookIcon className={`${className} !stroke-current`} />
}

/** Rounded tile with the section icon */
export function SectionTile({ section, size = 'h-12 w-12' }: { section: Section; size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl ${size} ${themeOf(section).tile}`}>
      <SectionIcon section={section} />
    </span>
  )
}
