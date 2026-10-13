import { useEffect, useState } from 'react'
import { intro } from '../lib/intro'

let shownThisLaunch = false

function reduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 起動時に一度だけ流れるロード演出（タップで飛ばせる） */
export function Boot({ rankName, color }: { rankName: string; color: string }) {
  const [phase, setPhase] = useState<'on' | 'out' | 'off'>(() => {
    if (shownThisLaunch || reduced()) return 'off'
    // 描画の時点で終了時刻を決めておく（後に続く演出がこれを見て待つ）
    intro.bootEndsAt = Date.now() + 1700
    return 'on'
  })

  // フェーズごとに次のフェーズだけを予約する（前のフェーズの片付けで消されないように）
  useEffect(() => {
    if (phase === 'on') {
      shownThisLaunch = true
      const t = setTimeout(() => setPhase('out'), 1350)
      return () => clearTimeout(t)
    }
    if (phase === 'out') {
      const t = setTimeout(() => setPhase('off'), 350)
      return () => clearTimeout(t)
    }
    if (phase === 'off') intro.bootEndsAt = Math.min(intro.bootEndsAt, Date.now())
  }, [phase])

  if (phase === 'off') return null
  return (
    <div className={`boot-seq${phase === 'out' ? ' out' : ''}`} onClick={() => setPhase('off')} style={{ ['--cut' as string]: color }}>
      <div className="cut-scan" />
      <div className="boot-logo">LIFE <b>RANKED</b></div>
      <div className="boot-lines">
        <div style={{ animationDelay: '.1s' }}>&gt; AUTHENTICATING OPERATOR<span>OK</span></div>
        <div style={{ animationDelay: '.35s' }}>&gt; LOADING PROFILE<span>OK</span></div>
        <div style={{ animationDelay: '.6s' }}>&gt; RANK DATA<span className="rk">{rankName}</span></div>
      </div>
      <div className="boot-bar"><div /></div>
    </div>
  )
}
