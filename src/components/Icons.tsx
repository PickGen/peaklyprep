import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

/** Shared gradient + glass filters. Render once near the app root. */
export function IconDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id="ppStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a52f5" />
          <stop offset="1" stopColor="#4a14b8" />
        </linearGradient>
        <linearGradient id="ppFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a67dfa" />
          <stop offset="1" stopColor="#5b1fd6" />
        </linearGradient>
        <linearGradient id="ppGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9b0ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#7f4cf0" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="ppGlass2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6dbff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#a67dfa" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="ppShine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/* Gradient line icons (inherit size from className) */
export const BookIcon = (p: P) => (
  <svg {...base} stroke="url(#ppStroke)" {...p}>
    <path d="M12 6.5C10.4 5.3 8 4.8 4.5 5v12.5c3.5-.2 5.9.3 7.5 1.5 1.6-1.2 4-1.7 7.5-1.5V5c-3.5-.2-5.9.3-7.5 1.5Z" fill="url(#ppGlass2)" fillOpacity=".35" />
    <path d="M12 6.5V19" />
  </svg>
)
export const LayersIcon = (p: P) => (
  <svg {...base} stroke="url(#ppStroke)" {...p}>
    <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" fill="url(#ppGlass2)" fillOpacity=".45" />
    <path d="m3 12 9 4.5 9-4.5" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </svg>
)
export const CapIcon = (p: P) => (
  <svg {...base} stroke="url(#ppStroke)" {...p}>
    <path d="m12 4 10 5-10 5L2 9l10-5Z" fill="url(#ppGlass2)" fillOpacity=".45" />
    <path d="M6 11.5V16c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-4.5" />
    <path d="M22 9v5" />
  </svg>
)
export const CheckSquareIcon = (p: P) => (
  <svg {...base} stroke="url(#ppStroke)" {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="url(#ppGlass2)" fillOpacity=".3" />
    <path d="m8 12.3 2.8 2.8L16.2 9.5" />
  </svg>
)
export const BarsIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...p}>
    <rect x="3" y="13" width="5" height="8" rx="1.6" fill="url(#ppFill)" />
    <rect x="9.5" y="8" width="5" height="13" rx="1.6" fill="url(#ppFill)" />
    <rect x="16" y="3" width="5" height="18" rx="1.6" fill="url(#ppFill)" />
    <rect x="3" y="13" width="5" height="3" rx="1.4" fill="url(#ppShine)" opacity=".5" />
    <rect x="9.5" y="8" width="5" height="3" rx="1.4" fill="url(#ppShine)" opacity=".5" />
    <rect x="16" y="3" width="5" height="3" rx="1.4" fill="url(#ppShine)" opacity=".5" />
  </svg>
)

/* Plain currentColor icons for navigation / actions */
const plain = { ...base, stroke: 'currentColor' }
export const HomeIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...plain} {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M3.5 11 12 3.8 20.5 11v8a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-6v5.5H5A1.5 1.5 0 0 1 3.5 19v-8Z" />
  </svg>
)
export const UserIcon = (p: P) => (
  <svg {...plain} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
  </svg>
)
export const BellIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </svg>
)
export const ChevronRight = (p: P) => (
  <svg {...plain} strokeWidth={2} {...p}>
    <path d="m9 5.5 6.5 6.5L9 18.5" />
  </svg>
)
export const ArrowRight = (p: P) => (
  <svg {...plain} strokeWidth={2} {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
)
export const ArrowLeft = (p: P) => (
  <svg {...plain} strokeWidth={2} {...p}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </svg>
)
export const MenuIcon = (p: P) => (
  <svg {...plain} strokeWidth={2} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const CloseIcon = (p: P) => (
  <svg {...plain} strokeWidth={2} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const ClockIcon = (p: P) => (
  <svg {...plain} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
export const PlayIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </svg>
)
export const PlusIcon = (p: P) => (
  <svg {...plain} strokeWidth={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const EditIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
  </svg>
)
export const TrashIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5h6V7" />
  </svg>
)
export const LogoutIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </svg>
)
export const ShieldIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6l-7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
)
export const UsersIcon = (p: P) => (
  <svg {...plain} {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20c.6-3.2 3-5 6.5-5s5.9 1.8 6.5 5" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18 15.3c2 .6 3.2 2.2 3.5 4.7" />
  </svg>
)
export const ChartIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M4 20V5M4 20h16" />
    <path d="m8 15 3.5-4 3 2.5L19 7.5" />
  </svg>
)
export const FileIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
    <path d="M14 3.5V8h4M9 12.5h6M9 16h6" />
  </svg>
)
export const CalendarIcon = (p: P) => (
  <svg {...plain} {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)
export const TargetIcon = (p: P) => (
  <svg {...plain} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)
export const NewsIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v12.5H7A2 2 0 0 1 5 16.5V4.5Z" />
    <path d="M17.5 8.5H20v8.7a1.3 1.3 0 0 1-2.5 0M8.5 8.5h6M8.5 12h6M8.5 15h3" />
  </svg>
)
export const GlobeIcon = (p: P) => (
  <svg {...plain} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5Z" />
  </svg>
)
export const PenIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
    <path d="m14 7 3 3" />
  </svg>
)
export const CalculatorIcon = (p: P) => (
  <svg {...plain} {...p}>
    <rect x="5" y="3" width="14" height="18" rx="3" />
    <path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
  </svg>
)
export const GridIcon = (p: P) => (
  <svg {...plain} {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
  </svg>
)
export const PlayRingIcon = (p: P) => (
  <svg {...plain} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M10.2 8.8v6.4l5.2-3.2-5.2-3.2Z" fill="currentColor" stroke="none" />
  </svg>
)
export const CheckRingIcon = (p: P) => (
  <svg {...plain} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.3 2.5 2.5 4.9-5" />
  </svg>
)
export const ClipboardIcon = (p: P) => (
  <svg {...plain} {...p}>
    <rect x="5.5" y="4.5" width="13" height="16" rx="3" />
    <path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M9 11.5h6M9 15h4" />
  </svg>
)
export const ClipboardCheckIcon = (p: P) => (
  <svg {...plain} {...p}>
    <rect x="5.5" y="4.5" width="13" height="16" rx="3" />
    <path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M9 13l2.2 2.2L15.2 11" />
  </svg>
)
export const CrownIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="m4 8 4.2 3.6L12 5l3.8 6.6L20 8l-1.5 9.5h-13L4 8Z" />
    <path d="M6 20h12" />
  </svg>
)
export const MailIcon = (p: P) => (
  <svg {...plain} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="m4 8 8 5.5L20 8" />
  </svg>
)
export const ShieldLockIcon = (p: P) => (
  <svg {...plain} {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6l-7-3Z" />
  </svg>
)
export const StarIcon = (p: P) => (
  <svg viewBox="0 0 48 48" {...p}>
    <defs>
      <linearGradient id="starG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd666" />
        <stop offset="1" stopColor="#f5a524" />
      </linearGradient>
    </defs>
    <path d="M24 3.5c1 0 1.8.5 2.3 1.4l5.2 9.4 10.6 2c1.9.4 2.7 2.7 1.4 4.1l-7.4 7.9 1.4 10.7c.3 1.9-1.7 3.3-3.4 2.4L24 36.9l-9.8 4.5c-1.7.8-3.7-.5-3.4-2.4l1.4-10.7-7.4-7.9c-1.3-1.4-.5-3.7 1.4-4.1l10.6-2 5.2-9.4c.5-.9 1.3-1.4 2.3-1.4Z" fill="url(#starG)" />
    <path d="M24 3.5c1 0 1.8.5 2.3 1.4l3 5.4C25 9 18 11 13 17l-3.5.7c-1.9.4-2.7 2.7-1.4 4.1l1-.2 5.2-9.4c.5-.9 1.3-1.4 2.3-1.4Z" fill="#fff" opacity=".35" />
  </svg>
)
export const CheckIcon = (p: P) => (
  <svg {...plain} strokeWidth={2.4} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

/** Glass tile that frames a big gradient icon (3D / frosted look from the mockup) */
export function GlassTile({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl ${className}`}
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,.95), rgba(228,214,255,.65))',
        boxShadow:
          '0 1px 0 rgba(255,255,255,.95) inset, 0 -6px 14px -8px rgba(91,31,214,.25) inset, 0 12px 24px -12px rgba(91,31,214,.45)',
        border: '1px solid rgba(255,255,255,.9)',
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent" />
      <span className="relative">{children}</span>
    </span>
  )
}
