import { Link } from 'react-router-dom'

export function Brand({ to = '/', size = 'md' }: { to?: string; size?: 'sm' | 'md' | 'lg' }) {
  const img = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const text = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="PeaklyPrep home">
      <img src="/logo.png" alt="" className={`${img} rounded-xl shadow-[0_8px_18px_-8px_rgba(91,31,214,.7)]`} />
      <span className={`${text} font-extrabold tracking-tight`}>
        Peakly<span className="text-brand-600">Prep</span>
      </span>
    </Link>
  )
}
