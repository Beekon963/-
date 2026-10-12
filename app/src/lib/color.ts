function parse(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(rgb: number[]) {
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
}

export function mix(a: string, b: string, t: number) {
  const x = parse(a)
  const y = parse(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

export function alpha(hex: string, a: number) {
  const [r, g, b] = parse(hex)
  return `rgba(${r},${g},${b},${a})`
}

/** ランク色からテーマ用の CSS 変数を作る */
export function rankVars(color: string): Record<string, string> {
  return {
    '--rank': color,
    '--rank-hi': mix(color, '#ffffff', 0.6),
    '--rank-lo': mix(color, '#000000', 0.42),
    '--rank-glow': alpha(color, 0.32),
  }
}
