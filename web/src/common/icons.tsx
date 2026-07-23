// Inline SVG icons replacing @fortawesome/fontawesome-free. Each icon sits on
// the text baseline at 1em like the old <i class="fas fa-..."> tags, and
// inherits the text color through currentColor.

interface IconProps {
  className?: string;
}

const Svg = ({
  children,
  viewBox = "0 0 24 24",
  className = "",
  fill = "currentColor",
  stroke = "none",
}: IconProps & {
  children: React.ReactNode;
  viewBox?: string;
  fill?: string;
  stroke?: string;
}) => (
  <svg
    className={className}
    viewBox={viewBox}
    fill={fill}
    stroke={stroke}
    strokeWidth={stroke === "none" ? undefined : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      display: "inline-block",
      height: "1em",
      width: "1em",
      verticalAlign: "-0.125em",
    }}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const HeartIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </Svg>
);

export const PaperPlaneIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </Svg>
);

export const GithubIcon = ({ className }: IconProps) => (
  <Svg className={className} viewBox="0 0 16 16">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </Svg>
);

export const ShareIcon = ({ className }: IconProps) => (
  <Svg className={className} fill="none" stroke="currentColor">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </Svg>
);

export const LinkIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </Svg>
);

export const GridIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="3" width="5" height="5" rx="0.5" />
    <rect x="9.5" y="3" width="5" height="5" rx="0.5" />
    <rect x="16" y="3" width="5" height="5" rx="0.5" />
    <rect x="3" y="9.5" width="5" height="5" rx="0.5" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
    <rect x="16" y="9.5" width="5" height="5" rx="0.5" />
    <rect x="3" y="16" width="5" height="5" rx="0.5" />
    <rect x="9.5" y="16" width="5" height="5" rx="0.5" />
    <rect x="16" y="16" width="5" height="5" rx="0.5" />
  </Svg>
);

export const UserIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </Svg>
);

export const RobotIcon = ({ className }: IconProps) => (
  <Svg className={className} fill="none" stroke="currentColor">
    <rect x="5" y="8" width="14" height="11" rx="1.5" />
    <line x1="12" y1="8" x2="12" y2="4" />
    <circle cx="12" cy="3.5" r="1" />
    <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
    <path d="M9.5 16.5h5" />
    <line x1="3" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="21" y2="12" />
  </Svg>
);

export const GlassesIcon = ({ className }: IconProps) => (
  <Svg className={className} fill="none" stroke="currentColor">
    <circle cx="6.5" cy="14.5" r="3.5" />
    <circle cx="17.5" cy="14.5" r="3.5" />
    <path d="M10 14.5c0.6-1.2 3.4-1.2 4 0" />
    <path d="M3 14l1-5" />
    <path d="M21 14l-1-5" />
  </Svg>
);
