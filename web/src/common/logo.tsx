// The tici-taca-toey mark: a dark terminal tile with a glowing neon grid,
// an X and an O mid-game. Inline SVG so it is crisp at any size and always
// matches the theme. Mirrored as a static file in public/favicon.svg - keep
// the two in sync.

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo = ({ size = 36, className }: LogoProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 64 64"
    role="img"
    aria-label="tici-taca-toey"
  >
    <defs>
      <filter id="ttt-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect width="64" height="64" rx="8" fill="#050905" />
    <rect
      x="1.5"
      y="1.5"
      width="61"
      height="61"
      rx="7"
      fill="none"
      stroke="#1e3320"
      strokeWidth="2"
    />
    <g stroke="#00ff66" strokeWidth="2.5" filter="url(#ttt-glow)">
      <line x1="25" y1="10" x2="25" y2="54" />
      <line x1="41" y1="10" x2="41" y2="54" />
      <line x1="9" y1="25" x2="55" y2="25" />
      <line x1="9" y1="41" x2="55" y2="41" />
    </g>
    <g filter="url(#ttt-glow)">
      <path
        d="M12 12 L21 21 M21 12 L12 21"
        stroke="#00ff66"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="33"
        cy="33"
        r="5"
        fill="none"
        stroke="#00d2ff"
        strokeWidth="3"
      />
    </g>
    <rect x="45" y="46" width="7" height="3.5" fill="#00ff66">
      <animate
        attributeName="opacity"
        values="1;1;0;0"
        dur="1.2s"
        repeatCount="indefinite"
      />
    </rect>
  </svg>
);

export default Logo;
