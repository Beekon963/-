// 画面演出（React の外で DOM に直接パーティクルを出す）。動きを減らす設定の端末では何もしない

function reduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function layer() {
  let el = document.getElementById('fx-layer')
  if (!el) {
    el = document.createElement('div')
    el.id = 'fx-layer'
    document.body.appendChild(el)
  }
  return el
}

function spawn(className: string, x: number, y: number, vars: Record<string, string>, life: number) {
  const el = document.createElement('span')
  el.className = className
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
  layer().appendChild(el)
  setTimeout(() => el.remove(), life)
  return el
}

/** 弾ける火花＋広がる菱形リング */
export function burst(x: number, y: number, color: string, count = 18, spread = 1) {
  if (reduced()) return
  spawn('fx-ring', x, y, { '--c': color }, 700)
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const dist = (30 + Math.random() * 50) * spread
    const p = spawn('fx-p', x, y, {
      '--c': color,
      '--dx': `${Math.cos(ang) * dist}px`,
      '--dy': `${Math.sin(ang) * dist}px`,
      '--r': `${(ang * 180) / Math.PI}deg`,
    }, 900)
    p.style.animationDelay = `${Math.random() * 70}ms`
  }
}

/** 浮かび上がって消える数字 */
export function floatText(x: number, y: number, text: string, color: string) {
  if (reduced()) return
  spawn('fx-float', x, y, { '--c': color }, 1200).textContent = text
}

/** 要素に一度だけアニメーション用のクラスを付ける */
export function pulseClass(el: Element | null | undefined, className: string, ms = 700) {
  if (!el || reduced()) return
  el.classList.remove(className)
  void (el as HTMLElement).offsetWidth
  el.classList.add(className)
  setTimeout(() => el.classList.remove(className), ms)
}

export function centerOf(el: Element) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** 振動（対応端末のみ。iPhone の Web アプリは非対応なので何も起きない） */
export function buzz(pattern: number | number[]) {
  if (reduced() || typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* 失敗しても演出なので無視 */
  }
}
