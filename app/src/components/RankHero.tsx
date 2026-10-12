import type { RankState } from '../lib/game'
import { Emblem } from './Emblem'

export function RankHero({ rank, total, onClick }: { rank: RankState; total: number; onClick?: () => void }) {
  const { rank: r, ranks, index, division } = rank
  const divs = Array.from({ length: r.divisions > 1 ? r.divisions : 0 }, (_, i) => i)
  const full = !!rank.promotion

  return (
    <section className="hero" onClick={onClick} role={onClick ? 'button' : undefined} aria-label="ランク表を開く">
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
              {Math.floor(rank.xpInDiv).toLocaleString()} <small>/ {Math.round(rank.divSize).toLocaleString()} XP</small>
            </span>
            <span>{rank.next.name}</span>
          </div>
          <div className={`gauge${full ? ' full' : ''}`}>
            <div className="gauge-fill" style={{ width: `${Math.max(1.5, rank.progress * 100)}%` }} />
          </div>
          <div className="gauge-foot">
            {full ? (
              <>昇格条件をクリアすると <b>{rank.next.name}</b> へ昇格</>
            ) : (
              <>{rank.next.name} まであと<b>{rank.next.xpNeeded.toLocaleString()}</b>XP</>
            )}
            {' ・ '}総XP <span className="num">{total.toLocaleString()}</span>
          </div>
        </>
      ) : (
        <div className="gauge-foot">最高ランク到達 ・ 総XP <span className="num">{total.toLocaleString()}</span></div>
      )}
    </section>
  )
}
