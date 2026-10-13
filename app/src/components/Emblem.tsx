import { useId } from 'react'
import { alpha, mix } from '../lib/color'

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
  /** 光が走る・回るなどの動き（小さい表示では切る） */
  animated?: boolean
}

// 形の段階：六角 → 盾 → 刃付きの盾 → 翼の盾 → 結晶 → 宝石 → 翼の宝石 → 王冠と炎
const HEX = 'M70 14 L114 38 L114 94 L70 120 L26 94 L26 38 Z'
const SHIELD = 'M70 10 L110 28 L110 76 Q110 104 70 126 Q30 104 30 76 L30 28 Z'
const CRYSTAL = 'M70 6 L108 30 L108 88 L70 130 L32 88 L32 30 Z'
const GEM = 'M70 10 L118 60 L70 128 L22 60 Z'
const GEM_LOW = 'M70 20 L118 66 L70 130 L22 66 Z'

interface Shape {
  outer: string
  /** 内側の線を描くための縮小率 */
  inset: number
  chevronTops: number[]
  chevronScale: number
  facets?: string
}

function shapeFor(tier: number): Shape {
  switch (tier) {
    case 0:
      return { outer: HEX, inset: 0.8, chevronTops: [72, 56, 40], chevronScale: 0.9 }
    case 1:
    case 2:
    case 3:
      return { outer: SHIELD, inset: 0.8, chevronTops: [78, 61, 44], chevronScale: 1 }
    case 4:
      return { outer: CRYSTAL, inset: 0.78, chevronTops: [80, 63, 46], chevronScale: 0.95 }
    case 5:
    case 6:
      return {
        outer: GEM, inset: 0.74, chevronTops: [84, 70, 56], chevronScale: 0.72,
        facets: 'M22 60 L118 60 M70 10 L50 60 L70 128 M70 10 L90 60 L70 128',
      }
    default:
      return {
        outer: GEM_LOW, inset: 0.74, chevronTops: [88, 75, 62], chevronScale: 0.7,
        facets: 'M22 66 L118 66 M70 20 L50 66 L70 130 M70 20 L90 66 L70 130',
      }
  }
}

function chevron(top: number, scale: number) {
  const w = 22 * scale
  const h = 14 * scale
  const t = 10 * scale
  const b = 24 * scale
  return `M${70 - w} ${top + h} L70 ${top} L${70 + w} ${top + h} L${70 + w} ${top + b} L70 ${top + t} L${70 - w} ${top + b} Z`
}

export function Emblem({ color, index, total, division, divisions, size = 150, className, animated }: Props) {
  const uid = useId().replace(/:/g, '')
  const tier = total > 1 ? Math.round((index / (total - 1)) * 7) : 7
  const shape = shapeFor(tier)
  const hi = mix(color, '#ffffff', 0.62)
  const lo = mix(color, '#000000', 0.5)
  const move = animated ?? size >= 80
  const chevrons = divisions > 1 ? Math.min(division + 1, 3) : 3
  const g = `url(#g${uid})`
  const insetTf = `translate(70 68) scale(${shape.inset}) translate(-70 -68)`

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 140 140" aria-hidden="true" overflow="visible">
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset=".45" stopColor={color} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <radialGradient id={`f${uid}`} cx="50%" cy="42%" r="60%">
          <stop offset="0" stopColor={alpha(color, 0.42)} />
          <stop offset="1" stopColor={alpha(color, 0.04)} />
        </radialGradient>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`fl${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset=".3" stopColor={color} stopOpacity=".85" />
          <stop offset=".7" stopColor={hi} stopOpacity=".45" />
          <stop offset="1" stopColor={hi} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${uid}`}>
          <path d={shape.outer} />
        </clipPath>
      </defs>

      {/* 最上位：背後の炎 */}
      {tier >= 7 && (
        <g className={move ? 'em-flame' : undefined} style={{ transformOrigin: '70px 120px' }}>
          {[-40, -22, 0, 22, 40].map((dx) => {
            const cx = 70 + dx
            const base = 70 + dx * 0.35
            const tipX = 70 + dx * 1.35
            const tipY = -4 + Math.abs(dx) * 0.55
            return (
              <path
                key={dx}
                d={`M${base - 6} 118 Q${cx - 18} 70 ${tipX} ${tipY} Q${cx + 18} 70 ${base + 6} 118 Z`}
                fill={`url(#fl${uid})`}
                opacity={dx === 0 ? 0.95 : 0.75}
              />
            )
          })}
        </g>
      )}

      {/* 上位：回るリング */}
      {tier >= 6 && (
        <g className={move ? 'em-spin' : undefined} style={{ transformOrigin: '70px 68px' }}>
          <circle cx="70" cy="68" r="64" fill="none" stroke={color} strokeOpacity=".5" strokeWidth="1.2" strokeDasharray="2 7" />
          <circle cx="70" cy="68" r="58" fill="none" stroke={hi} strokeOpacity=".25" strokeWidth="0.8" />
        </g>
      )}

      {/* 翼 */}
      {tier >= 3 && (
        <g fill="none" stroke={g} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M28 52 L8 44 L18 62 L4 66 L22 78 L12 86 L32 90" />
          <path d="M112 52 L132 44 L122 62 L136 66 L118 78 L128 86 L108 90" />
          {tier >= 6 && (
            <>
              <path d="M26 38 L2 26 L12 46" opacity=".85" />
              <path d="M114 38 L138 26 L128 46" opacity=".85" />
            </>
          )}
        </g>
      )}

      {/* 刃 */}
      {tier === 2 && (
        <g fill={g}>
          <path d="M30 42 L14 52 L30 66 Z" />
          <path d="M110 42 L126 52 L110 66 Z" />
        </g>
      )}

      {/* 王冠 */}
      {tier >= 7 && <path d="M48 18 L52 2 L61 11 L70 -2 L79 11 L88 2 L92 18 Z" fill={g} stroke={hi} strokeWidth="0.8" />}

      {/* 本体 */}
      <path d={shape.outer} fill={`url(#f${uid})`} stroke={g} strokeWidth="3.6" strokeLinejoin="round" />
      <path d={shape.outer} fill="none" stroke={g} strokeWidth="1.1" opacity=".7" transform={insetTf} />
      {shape.facets && <path d={shape.facets} fill="none" stroke={hi} strokeWidth="0.8" opacity=".35" />}

      {/* ディビジョン（シェブロンの数） */}
      {shape.chevronTops.slice(0, chevrons).map((y, i) => (
        <path key={y} d={chevron(y, shape.chevronScale)} fill={g} opacity={1 - i * 0.08} />
      ))}

      {/* 星 */}
      {tier >= 5 && (
        <path
          d={tier >= 7
            ? 'M70 34 L72.6 40.2 L79.4 40.6 L74.2 44.9 L75.9 51.5 L70 47.9 L64.1 51.5 L65.8 44.9 L60.6 40.6 L67.4 40.2 Z'
            : 'M70 24 L72.6 30.2 L79.4 30.6 L74.2 34.9 L75.9 41.5 L70 37.9 L64.1 41.5 L65.8 34.9 L60.6 30.6 L67.4 30.2 Z'}
          fill={hi}
        />
      )}

      {/* 光が走る */}
      {move && (
        <g clipPath={`url(#c${uid})`}>
          <rect x="-40" y="-10" width="34" height="160" fill={`url(#s${uid})`} transform="skewX(-18)">
            <animateTransform attributeName="transform" type="translate" additive="sum" values="0 0; 200 0; 200 0" keyTimes="0; .35; 1" dur="4.2s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
    </svg>
  )
}
