/**
 * Hero illustration redrawn from design.jpg: layered lavender mountain with a snow cap,
 * a stepped growth line hugging the left ridge up to the summit, a climber with a backpack,
 * a flag on the peak and the "SAT 1600" goal badge.
 */
export function MountainHero({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1280 880" className={className} style={{ overflow: 'visible' }} role="img" aria-label="A climber reaching the SAT 1600 peak">
      <defs>
        <linearGradient id="mtBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9d7af2" />
          <stop offset="0.45" stopColor="#b9a0f7" />
          <stop offset="1" stopColor="#efe8ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mtFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a785f4" />
          <stop offset="0.55" stopColor="#cdbcf9" stopOpacity=".8" />
          <stop offset="1" stopColor="#f3eeff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mtSnow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f0eaff" />
        </linearGradient>
        <linearGradient id="mtLine" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8a52f5" stopOpacity="0" />
          <stop offset="0.25" stopColor="#7a3df0" />
          <stop offset="1" stopColor="#5b1fd6" />
        </linearGradient>
        <linearGradient id="mtFlag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b1fd6" />
          <stop offset="1" stopColor="#7f4cf0" />
        </linearGradient>
        <linearGradient id="mtFadeX" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.1" stopColor="#fff" />
          <stop offset="0.86" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mtFadeY" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.7" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="mtMaskX" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="880">
          <rect width="1280" height="880" fill="url(#mtFadeX)" />
        </mask>
        <mask id="mtMaskY" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="880">
          <rect width="1280" height="880" fill="url(#mtFadeY)" />
        </mask>
      </defs>

      {/* mountains (edges dissolve into the page: no visible borders) */}
      <g mask="url(#mtMaskX)">
        <g mask="url(#mtMaskY)">
          {/* distant ridges */}
          <path d="M0 800 L250 645 L330 610 L420 595 L440 590 L200 780 Z" fill="#cdbcf9" opacity=".55" />
          <path d="M1130 468 L1200 450 L1290 500 V570 Z" fill="#cdbcf9" opacity=".6" />

          {/* main peak */}
          <path d="M810 238 L440 590 L120 800 V880 H1290 V610 Z" fill="url(#mtBody)" />
          {/* pale face right of the summit */}
          <path d="M816 242 L962 446 L872 402 L862 440 Z" fill="#f1ebff" opacity=".95" />
          {/* snow cap */}
          <path d="M810 238 L440 590 L600 490 L612 516 L606 484 L762 392 L860 440 L866 404 L800 335 Z" fill="url(#mtSnow)" />

          {/* front ridge */}
          <path d="M240 880 C430 720 690 610 850 586 C1010 592 1160 670 1290 742 V880 Z" fill="url(#mtFront)" />
        </g>
      </g>

      {/* growth line, stepped like the mockup */}
      <path className="draw" pathLength={900} d="M96 674 L323 507 L411 507 L523 397 L582 397 L676 294 L808 236" fill="none" stroke="url(#mtLine)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {[
        [323, 507],
        [411, 507],
        [523, 397],
        [582, 397],
        [676, 294],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="11" fill="#fff" stroke="#6a2de8" strokeWidth="5" />
      ))}

      {/* climber (traced from the mockup): purple backpack, forward stride, trekking pole, feet on the ridge line */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="M782 202 L783 238" stroke="#1b0f5c" strokeWidth="1.8" fill="none" />
        {/* back leg + shoe */}
        <path d="M755 215 L745.5 257" stroke="#1b0f5c" strokeWidth="8.5" fill="none" />
        <path d="M742 258.5 L753.5 259" stroke="#1b0f5c" strokeWidth="5" fill="none" />
        {/* front leg bent onto the slope + shoe */}
        <path d="M761 214 L774 221.5 L774.5 241" stroke="#1b0f5c" strokeWidth="8.5" fill="none" />
        <path d="M772 242.5 L783.5 243.5" stroke="#1b0f5c" strokeWidth="5" fill="none" />
        {/* backpack */}
        <rect x="738" y="181" width="19" height="32" rx="8.5" transform="rotate(-8 747 197)" fill="#9b6cf7" stroke="#5b1fd6" strokeWidth="1.4" />
        <path d="M744 179.5 L748 178.5" stroke="#5b1fd6" strokeWidth="2.4" fill="none" />
        {/* torso */}
        <path d="M757 186 L767.5 183.5 L770.5 197 L768.5 217.5 L752 218.5 L754 197 Z" fill="#1b0f5c" stroke="#1b0f5c" strokeWidth="2" />
        {/* arm holding the pole */}
        <path d="M767 188.5 L773 202.5 L782.5 203" stroke="#1b0f5c" strokeWidth="5" fill="none" />
        {/* head */}
        <ellipse cx="765.5" cy="176.5" rx="7" ry="7.6" fill="#1b0f5c" />
      </g>
      {/* flag planted on the summit */}
      <path d="M808 236 V124" stroke="#2a0f7a" strokeWidth="7" strokeLinecap="round" />
      <circle cx="807" cy="122" r="6" fill="#2a0f7a" />
      <path d="M813 126 C842 124 864 134 882 144 C862 150 836 152 813 162 Z" fill="url(#mtFlag)" />

      {/* goal badge + connector */}
      <path d="M931 118 L903 186 L840 201" fill="none" stroke="#b79cff" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="832" cy="202" r="5" fill="#8a52f5" />
      <rect x="889" y="49" width="231" height="68" rx="18" fill="#fff" stroke="#b79cff" strokeWidth="2.5" />
      <text x="1004" y="96" textAnchor="middle" fontSize="38" fontWeight="800" fill="#3a1094" fontFamily="'Plus Jakarta Sans Variable', sans-serif">
        SAT 1600
      </text>
    </svg>
  )
}
