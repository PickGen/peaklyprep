import type { ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'

/* Math reference sheet (standard geometry formulas), drawn as plain SVG so it works offline and scales on phones */

const stroke = { stroke: '#1a1a1a', strokeWidth: 1.5, fill: 'none', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const T = ({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily="'Times New Roman', Georgia, serif" fontStyle="italic" fontSize="14" fill="#1a1a1a">
    {children}
  </text>
)
const RightMark = ({ x, y, dx = 1, dy = -1 }: { x: number; y: number; dx?: 1 | -1; dy?: 1 | -1 }) => <path d={`M${x + 9 * dx} ${y} v${9 * dy} h${-9 * dx}`} {...stroke} strokeWidth={1.2} />

const Var = ({ children }: { children: ReactNode }) => <i>{children}</i>
const Frac = ({ a, b }: { a: ReactNode; b: ReactNode }) => (
  <span className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.85em] leading-tight">
    <span className="border-b border-current px-0.5">{a}</span>
    <span className="px-0.5">{b}</span>
  </span>
)

function Item({ children, formula, className = '' }: { children: ReactNode; formula?: ReactNode; className?: string }) {
  return (
    <figure className={`flex flex-col items-center text-center ${className}`}>
      <div className="flex h-28 items-end justify-center">{children}</div>
      {formula && <figcaption className="mt-3 font-serif text-[1.05rem] leading-7 text-ink">{formula}</figcaption>}
    </figure>
  )
}

export function ReferenceSheet() {
  const { tr } = useI18n()
  return (
    <div className="@container p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-x-4 gap-y-9 @md:grid-cols-3 @3xl:grid-cols-5">
        {/* circle */}
        <Item
          formula={
            <>
              <Var>A</Var> = π<Var>r</Var>²<br />
              <Var>C</Var> = 2π<Var>r</Var>
            </>
          }
        >
          <svg viewBox="0 0 120 110" className="h-full w-auto" role="img" aria-label="circle">
            <circle cx="60" cy="55" r="42" {...stroke} />
            <circle cx="60" cy="55" r="2.6" fill="#1a1a1a" />
            <path d="M60 55 H102" {...stroke} />
            <T x={82} y={49}>r</T>
          </svg>
        </Item>

        {/* rectangle */}
        <Item formula={<><Var>A</Var> = <Var>ℓw</Var></>}>
          <svg viewBox="0 0 130 110" className="h-full w-auto" role="img" aria-label="rectangle">
            <rect x="22" y="38" width="86" height="44" {...stroke} />
            <T x={65} y={30}>ℓ</T>
            <T x={118} y={64} anchor="start">w</T>
          </svg>
        </Item>

        {/* triangle */}
        <Item formula={<><Var>A</Var> = <Frac a="1" b="2" /><Var>bh</Var></>}>
          <svg viewBox="0 0 130 110" className="h-full w-auto" role="img" aria-label="triangle">
            <path d="M18 92 H116 L44 18 Z" {...stroke} />
            <path d="M44 18 V92" {...stroke} strokeDasharray="4 3" strokeWidth={1.2} />
            <RightMark x={44} y={92} dx={1} dy={-1} />
            <T x={56} y={58} anchor="start">h</T>
            <T x={80} y={106}>b</T>
          </svg>
        </Item>

        {/* right triangle */}
        <Item formula={<><Var>c</Var>² = <Var>a</Var>² + <Var>b</Var>²</>}>
          <svg viewBox="0 0 130 110" className="h-full w-auto" role="img" aria-label="right triangle">
            <path d="M24 18 V92 H112 Z" {...stroke} />
            <RightMark x={24} y={92} dx={1} dy={-1} />
            <T x={12} y={60}>b</T>
            <T x={68} y={106}>a</T>
            <T x={76} y={50} anchor="start">c</T>
          </svg>
        </Item>

        {/* special right triangles */}
        <Item className="col-span-2 @md:col-span-2 @3xl:col-span-1" formula={<span className="font-sans text-[0.8rem] font-bold">{tr('Special Right Triangles')}</span>}>
          <svg viewBox="0 0 230 120" className="h-full w-auto" role="img" aria-label="special right triangles">
            <path d="M10 100 H106 V44 Z" {...stroke} />
            <RightMark x={106} y={100} dx={-1} dy={-1} />
            <T x={40} y={72} anchor="end">2x</T>
            <T x={114} y={76} anchor="start">x</T>
            <T x={58} y={114}>x√3</T>
            <text x="30" y="96" fontSize="10" fontFamily="Arial, sans-serif" fill="#1a1a1a">30°</text>
            <text x="86" y="60" fontSize="10" fontFamily="Arial, sans-serif" fill="#1a1a1a" textAnchor="end">60°</text>
            <path d="M138 18 V100 H220 Z" {...stroke} />
            <RightMark x={138} y={100} dx={1} dy={-1} />
            <T x={132} y={62} anchor="end">s</T>
            <T x={178} y={114}>s</T>
            <T x={186} y={52} anchor="start">s√2</T>
            <text x="143" y="38" fontSize="10" fontFamily="Arial, sans-serif" fill="#1a1a1a">45°</text>
            <text x="192" y="95" fontSize="10" fontFamily="Arial, sans-serif" fill="#1a1a1a">45°</text>
          </svg>
        </Item>

        {/* rectangular solid */}
        <Item formula={<><Var>V</Var> = <Var>ℓwh</Var></>}>
          <svg viewBox="0 0 130 110" className="h-full w-auto" role="img" aria-label="rectangular solid">
            <path d="M14 46 H84 V92 H14 Z" {...stroke} />
            <path d="M14 46 L34 28 H104 L84 46" {...stroke} />
            <path d="M104 28 V74 L84 92" {...stroke} />
            <T x={48} y={106}>ℓ</T>
            <T x={104} y={96} anchor="start">w</T>
            <T x={112} y={56} anchor="start">h</T>
          </svg>
        </Item>

        {/* cylinder */}
        <Item formula={<><Var>V</Var> = π<Var>r</Var>²<Var>h</Var></>}>
          <svg viewBox="0 0 130 110" className="h-full w-auto" role="img" aria-label="cylinder">
            <ellipse cx="60" cy="26" rx="40" ry="12" {...stroke} />
            <path d="M20 26 V86 A40 12 0 0 0 100 86 V26" {...stroke} />
            <circle cx="60" cy="26" r="2.4" fill="#1a1a1a" />
            <path d="M60 26 L88 20" {...stroke} />
            <T x={76} y={17}>r</T>
            <T x={108} y={60} anchor="start">h</T>
          </svg>
        </Item>

        {/* sphere */}
        <Item formula={<><Var>V</Var> = <Frac a="4" b="3" />π<Var>r</Var>³</>}>
          <svg viewBox="0 0 120 110" className="h-full w-auto" role="img" aria-label="sphere">
            <circle cx="60" cy="55" r="44" {...stroke} />
            <path d="M16 55 A44 13 0 0 0 104 55" {...stroke} strokeDasharray="4 3" strokeWidth={1.2} />
            <path d="M16 55 A44 13 0 0 1 104 55" {...stroke} strokeWidth={1.2} />
            <circle cx="60" cy="55" r="2.4" fill="#1a1a1a" />
            <path d="M60 55 H92" {...stroke} />
            <T x={78} y={49}>r</T>
          </svg>
        </Item>

        {/* cone */}
        <Item formula={<><Var>V</Var> = <Frac a="1" b="3" />π<Var>r</Var>²<Var>h</Var></>}>
          <svg viewBox="0 0 120 110" className="h-full w-auto" role="img" aria-label="cone">
            <path d="M60 8 L16 90 M60 8 L104 90" {...stroke} />
            <path d="M16 90 A44 12 0 0 0 104 90" {...stroke} />
            <path d="M16 90 A44 12 0 0 1 104 90" {...stroke} strokeDasharray="4 3" strokeWidth={1.2} />
            <path d="M60 8 V90" {...stroke} strokeDasharray="4 3" strokeWidth={1.2} />
            <path d="M60 90 H104" {...stroke} strokeDasharray="4 3" strokeWidth={1.2} />
            <RightMark x={60} y={90} dx={1} dy={-1} />
            <T x={67} y={52} anchor="start">h</T>
            <T x={82} y={86}>r</T>
          </svg>
        </Item>

        {/* pyramid */}
        <Item formula={<><Var>V</Var> = <Frac a="1" b="3" /><Var>ℓwh</Var></>}>
          <svg viewBox="0 0 130 110" className="h-full w-auto" role="img" aria-label="pyramid">
            <path d="M20 86 L80 96 L112 76" {...stroke} />
            <path d="M20 86 L54 70 L112 76" {...stroke} strokeDasharray="4 3" strokeWidth={1.2} />
            <path d="M62 10 L20 86 M62 10 L80 96 M62 10 L112 76" {...stroke} />
            <path d="M62 10 L54 70" {...stroke} strokeDasharray="4 3" strokeWidth={1.2} />
            <T x={50} y={50} anchor="end">h</T>
            <T x={46} y={104}>ℓ</T>
            <T x={104} y={92} anchor="start">w</T>
          </svg>
        </Item>
      </div>

      <div className="mt-10 space-y-5 font-serif text-[1.02rem] leading-7 text-ink">
        <p>{tr('The number of degrees of arc in a circle is 360.')}</p>
        <p>{tr('The number of radians of arc in a circle is 2π.')}</p>
        <p>{tr('The sum of the measures in degrees of the angles of a triangle is 180.')}</p>
      </div>
    </div>
  )
}
