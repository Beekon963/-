// 起動時の演出の順番：ロード → ラウンド開始 → ランク変化。後の演出は前の演出が終わるのを待つ
export const intro = { bootEndsAt: 0, roundEndsAt: 0 }

export function introUntil() {
  return Math.max(intro.bootEndsAt, intro.roundEndsAt)
}

/** 演出が全部終わったら cb を呼ぶ（途中でタップして飛ばされても追従する） */
export function afterIntro(cb: () => void) {
  let timer: ReturnType<typeof setTimeout>
  const tick = () => {
    const wait = introUntil() - Date.now()
    if (wait > 30) timer = setTimeout(tick, Math.min(wait, 300))
    else cb()
  }
  timer = setTimeout(tick, 30)
  return () => clearTimeout(timer)
}
