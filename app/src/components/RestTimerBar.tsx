import { useEffect, useState } from 'react'
import { addRest, checkRestDone, stopRest, useRest } from '../store/rest'

function mmss(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 画面下の休憩タイマー（どの画面にいても出る） */
export function RestTimerBar() {
  const timer = useRest((s) => s.timer)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => {
      setNow(Date.now())
      checkRestDone()
    }, 250)
    return () => clearInterval(id)
  }, [timer])
  if (!timer) return null
  const left = (timer.endAt - now) / 1000
  const done = left <= 0
  const pct = Math.max(0, Math.min(1, left / timer.total))
  return (
    <div className={`rest-bar${done ? ' done' : ''}`} role="timer" aria-live={done ? 'assertive' : 'off'}>
      <div className="rb-fill" style={{ transform: `scaleX(${pct})` }} />
      <div className="rb-main">
        <span className="rb-k">{done ? '休憩終了' : 'REST'}</span>
        <span className="rb-t">{done ? '次のセットへ' : mmss(left)}</span>
        <span className="rb-l">{timer.label}</span>
      </div>
      {!done && <button className="rb-btn" onClick={() => addRest(-15)} aria-label="15秒減らす">−15</button>}
      <button className="rb-btn" onClick={() => addRest(15)} aria-label="15秒増やす">+15</button>
      <button className="rb-btn stop" onClick={stopRest}>{done ? '閉じる' : '止める'}</button>
    </div>
  )
}
