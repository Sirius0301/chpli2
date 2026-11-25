/**
 * Compact toolbar icons (N3): inline 16px SVGs, stroke-based, no text.
 * `currentColor` inherits the button colour so active/disabled states work.
 */
interface IconProps {
  className?: string;
}

const base = (className?: string) => ({
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true as const,
});

export const IconBold = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <text x="3" y="12.5" fontSize="13" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Georgia, serif">
      B
    </text>
  </svg>
);

export const IconLink = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 1 0-4.2-4.2l-1 1" />
    <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 1 0 4.2 4.2l1-1" />
  </svg>
);

export const IconInlineCode = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5.5 4.5 2.5 8l3 3.5" />
    <path d="M10.5 4.5 13.5 8l-3 3.5" />
  </svg>
);

export const IconCodeBlock = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
    <path d="M6 5.5 4 8l2 2.5" />
    <path d="M10 5.5 12 8l-2 2.5" />
  </svg>
);

export const IconTable = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
    <path d="M1.5 6.5h13M1.5 10h13M6 2.5v11M10.5 2.5v11" />
  </svg>
);

export const IconListUl = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5.5 4h9M5.5 8h9M5.5 12h9" />
    <circle cx="2.4" cy="4" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="2.4" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="2.4" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconListOl = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6.5 4h8M6.5 8h8M6.5 12h8" />
    <path d="M2.2 3.2c.6-.5 1.5-.4 1.5.4 0 .8-1.5 1-1.5 2" />
    <path d="M2 12h1.8M2 10.6c.5-.4 1.6-.4 1.6.5 0 .9-1.4.8-1.6 1.4l1.8.5" />
  </svg>
);

export const IconQuote = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2.5 3.5v9" />
    <path d="M5 5.5h8M5 8h6M5 10.5h8" />
  </svg>
);

export const IconTaskList = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="1.5" y="2.5" width="4" height="4" rx="1" />
    <path d="M2.5 4.4 3.4 5.3 4.8 3.7" />
    <path d="M7.5 4.5H14M7.5 11.5H14" />
    <rect x="1.5" y="9.5" width="4" height="4" rx="1" />
  </svg>
);

export const IconTex = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <text x="1.5" y="12.5" fontSize="13" fontStyle="italic" fill="currentColor" stroke="none" fontFamily="Georgia, serif">
      Σ
    </text>
  </svg>
);

export const IconToc = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2 3.5h12M2 7h8M2 10.5h10M2 13.5h6" />
  </svg>
);

export const IconSave = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2.5 2.5h8.5l2.5 2.5v8.5h-11z" />
    <path d="M5 2.5v3.5h5.5V2.5" />
    <rect x="5" y="9.5" width="6" height="4" />
  </svg>
);

export const IconFullscreen = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
  </svg>
);

export const IconImage = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
    <circle cx="5.3" cy="6.3" r="1.3" />
    <path d="M2.5 12l3.5-3.5 2.5 2.5 3-3 2.5 2.5" />
  </svg>
);

export const IconSplit = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
    <path d="M8 2.5v11" strokeDasharray="1.6 1.6" />
  </svg>
);

export const IconHistory = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2.5 8a5.5 5.5 0 1 1 1.6 3.9" />
    <path d="M2.5 13v-3.5H6" />
    <path d="M8 5.5V8l2 1.5" />
  </svg>
);

export const IconBacklinks = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6 3.5H3.5v9H6" />
    <path d="M10 3.5h2.5v9H10" />
    <path d="M12.5 8H6" />
  </svg>
);
