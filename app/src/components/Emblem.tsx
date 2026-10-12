import { useId } from 'react'
import { mix, alpha } from '../lib/color'

interface Props {
  color: string
  /** ランクの位置（0 = 最下位） */
  index: number
  /** ランクの総数 */
  total: number
  /** 下から 0,1,2… */
  division: number
  divisions: number
  size?: number
  className?: string
}

/** ランクが上がるほど装飾（翼・星・王冠）が増えるエンブレム */
export function Emblem({ color, index, total, division, divisions, size = 150, className }: Props) {
  const uid = useId().replace(/:/g, '')
  const hi = mix(color, '#ffffff', 0.62)
  const lo = mix(color, '#000000', 0.5)
  const frac = total > 1 ? index / (total - 1) : 1
  const wings = frac >= 0.28
  const bigWings = frac >= 0.7
  const star = frac >= 0.55
  const crown = total > 1 && index === total - 1
  const chevrons = divisions > 1 ? division + 1 : 3
  const chevronTops = [76, 59, 42].slice(0, chevrons)

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 140 140" aria-hidden="true">
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset=".45" stopColor={color} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`f${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={alpha(color, 0.3)} />
          <stop offset="1" stopColor={alpha(color, 0.04)} />
        </linearGradient>
      </defs>
      {wings && (
        <g fill="none" stroke={`url(#g${uid})`} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M24 50 L8 44 L18 62 L6 64 L22 76 L14 82 L30 86" />
          <path d="M116 50 L132 44 L122 62 L134 64 L118 76 L126 82 L110 86" />
          {bigWings && (
            <>
              <path d="M24 36 L4 26 L14 46" opacity=".8" />
              <path d="M116 36 L136 26 L126 46" opacity=".8" />
            </>
          )}
        </g>
      )}
      {crown && (
        <path d="M50 14 L56 0 L63 10 L70 -2 L77 10 L84 0 L90 14 Z" transform="translate(0 4)" fill={`url(#g${uid})`} />
      )}
      <path
        d="M70 8 L112 28 L112 76 Q112 106 70 130 Q28 106 28 76 L28 28 Z"
        fill={`url(#f${uid})`} stroke={`url(#g${uid})`} strokeWidth="3.5" strokeLinejoin="round"
      />
      <path d="M70 20 L102 35 L102 75 Q102 98 70 117 Q38 98 38 75 L38 35 Z" fill="none" stroke={`url(#g${uid})`} strokeWidth="1.2" opacity=".7" />
      {chevronTops.map((y, i) => (
        <path
          key={y}
          d={`M48 ${y + 14} L70 ${y} L92 ${y + 14} L92 ${y + 24} L70 ${y + 10} L48 ${y + 24} Z`}
          fill={`url(#g${uid})`}
          opacity={1 - i * 0.08}
        />
      ))}
      {star && (
        <path d="M70 22 L72.8 28.6 L80 29 L74.5 33.6 L76.2 40.6 L70 36.8 L63.8 40.6 L65.5 33.6 L60 29 L67.2 28.6 Z" fill={hi} />
      )}
    </svg>
  )
}
