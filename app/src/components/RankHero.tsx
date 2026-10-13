import { useEffect, useRef, useState } from 'react'
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

  return (
    <section className="hero" onClick={onClick} role={onClick ? 'button' : undefined} aria-label="ランク表を開く">
      <div className="scan" />
      <Embers count={Math.round(5 + tier * 14)} />
      <div className="kicker">{full ? 'PROMOTION MATCH' : 'CURRENT RANK'}</div>
      <Emblem
        className="emblem float"
        color={r.color} index={index} total={ranks.length} division={division} divisions={r.divisions} size={150}
      />
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
