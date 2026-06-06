// Lightweight inline SVG icons (stroke-based, currentColor). Avoids an icon
// dependency for the Phase-1 shell. 24×24 viewBox, 1.8 stroke.

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Svg>
);

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
);

export const PartyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21 9 8l7 7-13 6Z" />
    <path d="M14 5a3 3 0 0 1 3 3M18 3v.01M20 8h.01M16 12l5 5" />
  </Svg>
);

export const BagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 7h12l1 13H5L6 7Z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </Svg>
);

export const TrophyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M9 17h6M8 21h8M12 14v3" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const GiftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11h16v9H4v-9ZM3 7h18v4H3V7ZM12 7v13" />
    <path d="M12 7S10.5 3 8.5 4s.5 3 3.5 3M12 7s1.5-4 3.5-3-.5 3-3.5 3" />
  </Svg>
);

export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const ShuffleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5h4l10 14h4M17 5h4M3 19h4l3-4.2M14.5 9.2 17 5" />
    <path d="m19 3 2 2-2 2M19 17l2 2-2 2" />
  </Svg>
);

export const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </Svg>
);

export const VolumeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    <path d="M17 8a5 5 0 0 1 0 8" />
  </Svg>
);

export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5M12 17h.01" />
  </Svg>
);

export const LoginIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 4h4v16h-4M11 8l4 4-4 4M15 12H4" />
  </Svg>
);
