import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...rest }: P) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...rest,
  }
}

export const IconHome = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 1v5M12 18v5M1 12h5M18 12h5" /></svg>
)
export const IconFlag = (p: P) => <svg {...base(p)}><path d="M5 22V3h11l-2 4 2 4H5" /></svg>
export const IconUsers = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14c2.8 0 5 1.8 5 4.5" /></svg>
)
export const IconBolt = (p: P) => <svg {...base(p)}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
export const IconCopy = (p: P) => <svg {...base(p)}><rect x="9" y="9" width="12" height="12" rx="1" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
export const IconChart = (p: P) => <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
export const IconGear = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const IconPlus = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
export const IconClose = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const IconBack = (p: P) => <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
export const IconMore = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
)
export const IconChevron = (p: P & { open?: boolean }) => {
  const { open, ...rest } = p
  return <svg {...base(rest)} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
}
export const IconEdit = (p: P) => <svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
export const IconFlame = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#ff8a3d">
    <path d="M12 2c1 3.5-1.5 5.5-1.5 8 0 1.4 1 2.5 2.3 2.5 1.7 0 2.7-1.5 2.2-3.8C17.7 10.6 19 13 19 15.5 19 19.6 15.9 22 12 22s-7-2.4-7-6.5C5 10 10.5 7.5 12 2z" />
  </svg>
)
export const IconLock = (p: P) => <svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
export const IconShield = (p: P) => <svg {...base(p)}><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" /></svg>
export const IconBell = (p: P) => <svg {...base(p)}><path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4l2-2zM10 21h4" /></svg>
export const IconAlert = (p: P) => <svg {...base(p)}><path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.5" /></svg>

export function Check({ on, half }: { on: boolean; half?: boolean }) {
  return (
    <span className={`check${on ? ' on' : half ? ' half' : ''}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#07090d" strokeWidth="4"><polyline points="4 12 10 18 20 6" /></svg>
    </span>
  )
}
