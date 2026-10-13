import { useEffect, useState } from 'react'

let shownThisLaunch = false
/** 起動演出が終わる時刻（他の演出はこれを待つ） */
export let bootEndsAt = 0

function reduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 起動時に一度だけ流れるロード演出（タップで飛ばせる） */
export function Boot({ rankName, color }: { rankName: string; color: string }) {
  const [phase, setPhase] = useState<'on' | 'out' | 'off'>(() => (shownThisLaunch || reduced() ? 'off' : 'on'))

  // フェーズごとに次のフェーズだけを予約する（前のフェーズの片付けで消されないように）
  useEffect(() => {
    if (phase === 'on') {
      shownThisLaunch = true
      bootEndsAt = Date.now() + 1700
      const t = setTimeout(() => setPhase('out'), 1350)
      return () => clearTimeout(t)
    }
    if (phase === 'out') {
      const t = setTimeout(() => setPhase('off'), 350)
      return () => clearTimeout(t)
    }
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
