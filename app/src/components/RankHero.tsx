import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { RankState } from '../lib/game'
import { CountUp } from './CountUp'
import { Emblem } from './Emblem'

/** 上がっていく火の粉（ランクが上がるほど増える） */
function Embers({ count }: { count: number }) {
  return (
    <div className="embers" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${12 + ((i * 37) % 76)}%`,
            animationDelay: `${(i * 0.53) % 4}s`,
            animationDuration: `${3.2 + ((i * 0.7) % 2.4)}s`,
            ['--drift' as string]: `${((i * 13) % 30) - 15}px`,
          }}
        />
      ))}
    </div>
  )
}

export function RankHero({ rank, total, onClick }: { rank: RankState; total: number; onClick?: () => void }) {
  const { rank: r, ranks, index, division } = rank
  const divs = Array.from({ length: r.divisions > 1 ? r.divisions : 0 }, (_, i) => i)
  const full = !!rank.promotion
  const tier = ranks.length > 1 ? index / (ranks.length - 1) : 1

  // 同じ段階の中でゲージが伸びたら、伸びた分を光らせる
  const prev = useRef({ key: rank.tierKey, p: rank.progress })
  const [gain, setGain] = useState<{ from: number; to: number; id: number } | null>(null)
  useEffect(() => {
    const old = prev.current
    if (old.key === rank.tierKey && rank.progress > old.p + 0.001) {
      setGain({ from: old.p, to: rank.progress, id: Date.now() })
    }
    prev.current = { key: rank.tierKey, p: rank.progress }
  }, [rank.tierKey, rank.progress])

  // 指（マウス）の位置でエンブレムが傾き、光が反射する
  const tiltRef = useRef<HTMLDivElement>(null)
  const onMove = (e: PointerEvent) => {
    const el = tiltRef.current
    if (!el) return
    const b = el.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / (b.width * 0.9)))
    const y = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height / 2)) / (b.height * 0.9)))
    el.style.setProperty('--ry', `${x * 22}deg`)
    el.style.setProperty('--rx', `${-y * 18}deg`)
    el.style.setProperty('--gx', `${50 + x * 45}%`)
    el.style.setProperty('--gy', `${45 + y * 45}%`)
    el.classList.add('active')
  }
  const onLeave = () => {
    const el = tiltRef.current
    if (!el) return
    el.classList.remove('active')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  return (
    <section
      className="hero" onClick={onClick} role={onClick ? 'button' : undefined} aria-label="ランク表を開く"
      onPointerMove={onMove} onPointerLeave={onLeave} onPointerCancel={onLeave} onPointerUp={(e) => e.pointerType !== 'mouse' && onLeave()}
    >
      <div className="scan" />
      <Embers count={Math.round(5 + tier * 14)} />
      <div className="kicker">{full ? 'PROMOTION MATCH' : 'CURRENT RANK'}</div>
      <div className="tilt" ref={tiltRef}>
        <Emblem
          className="emblem float"
          color={r.color} index={index} total={ranks.length} division={division} divisions={r.divisions} size={150}
        />
      </div>
      <div className="rank-name">{rank.fullName}</div>
      <div className="divs" aria-label={`ディビジョン ${division + 1}/${r.divisions}`}>
        {divs.map((i) => (
          <span key={i} className={`div${i <= division ? ' on' : ''}${i === division ? ' cur' : ''}`} />
        ))}
      </div>

      {rank.next ? (
        <>
          <div className="gauge-head">
            <span>{rank.fullName}</span>
            <span className="xp">
              <CountUp value={Math.floor(rank.xpInDiv)} /> <small>/ {Math.round(rank.divSize).toLocaleString()} XP</small>
            </span>
            <span>{rank.next.name}</span>
          </div>
          <div className={`gauge${full ? ' full' : ''}`}>
            <div className="gauge-fill" style={{ width: `${Math.max(1.5, rank.progress * 100)}%` }} />
            {gain && (
              <div
                key={gain.id}
                className="gauge-gain"
                style={{ left: `${gain.from * 100}%`, width: `${(gain.to - gain.from) * 100}%` }}
                onAnimationEnd={() => setGain(null)}
              />
            )}
          </div>
          <div className="gauge-foot">
            {full ? (
              <>昇格条件をクリアすると <b>{rank.next.name}</b> へ昇格</>
            ) : (
              <>{rank.next.name} まであと<b><CountUp value={rank.next.xpNeeded} /></b>XP</>
            )}
            {' ・ '}総XP <span className="num"><CountUp value={total} /></span>
          </div>
        </>
      ) : (
        <div className="gauge-foot">最高ランク到達 ・ 総XP <span className="num"><CountUp value={total} /></span></div>
      )}
    </section>
  )
}
