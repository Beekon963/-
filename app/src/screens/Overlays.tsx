import { useEffect, useState } from 'react'
import { Emblem } from '../components/Emblem'
import { attackPct } from '../lib/game'
import { useCloud } from '../store/cloud'
import { useData } from '../store/data'
import { useGame, type Game } from '../store/game'
import { useUI } from '../store/ui'

const TIER_KEY = 'lr-last-tier'

/** ランクの上下を検知して演出を出す */
export function RankChange() {
  const g = useGame()
  const ready = useReady()
  const [shown, setShown] = useState<{ dir: 'up' | 'down'; from: string } | null>(null)

  useEffect(() => {
    if (!ready) return
    const raw = localStorage.getItem(TIER_KEY)
    const prev = raw ? (JSON.parse(raw) as { key: number; name: string }) : null
    localStorage.setItem(TIER_KEY, JSON.stringify({ key: g.rank.tierKey, name: g.rank.fullName }))
    if (!prev || prev.key === g.rank.tierKey) return
    setShown({ dir: g.rank.tierKey > prev.key ? 'up' : 'down', from: prev.name })
  }, [ready, g.rank.tierKey, g.rank.fullName])

  if (!shown) return null
  const r = g.rank
  const penalties = g.entries.filter((e) => e.kind === 'penalty').slice(-3).reverse()

  return (
    <div className={`overlay ${shown.dir}`} onClick={() => setShown(null)}>
      <div className="ov-kicker">{shown.dir === 'up' ? 'PROMOTED' : 'DEMOTED'}</div>
      <div className="ov-big">{shown.dir === 'up' ? 'RANK UP' : 'RANK DOWN'}</div>
      <Emblem className="ov-emblem" color={r.rank.color} index={r.index} total={r.ranks.length} division={r.division} divisions={r.rank.divisions} size={180} />
      <div className="ov-rank">{r.fullName}</div>
      <div className="ov-text">
        {shown.dir === 'up'
          ? `${shown.from} → ${r.fullName}。誰もくれないランクを、自分の行動で取った。`
          : `${shown.from} から降格。サボった分はランクに出る。今日の行動で取り返せ。`}
      </div>
      {shown.dir === 'down' && penalties.length > 0 && (
        <div className="ov-list">
          {penalties.map((p, i) => (
            <div key={i}><span>{p.date.slice(5).replace('-', '/')} {p.label}</span><span className="neg">{p.amount}</span></div>
          ))}
        </div>
      )}
      <button className="btn ov-btn">{shown.dir === 'up' ? '次のランクへ' : '取り返しに行く'}</button>
    </div>
  )
}

/** 同期の初回取り込みが終わるまでは、ランク変化の演出を出さない */
function useReady() {
  const loaded = useData((s) => s.loaded)
  const pulled = useData((s) => s.sync.lastPulledAt !== null)
  const { auth, localMode } = useCloud()
  return loaded && (auth === 'signedIn' ? pulled : localMode)
}

export function MatchResult() {
  const open = useUI((s) => s.matchResult)
  const g = useGame()
  if (!open) return null
  return <ResultView g={g} onClose={() => useUI.setState({ matchResult: false })} />
}

function ResultView({ g, onClose }: { g: Game; onClose: () => void }) {
  const s = g.todayStat
  const set = g.todayQuests.length
  const done = g.todayQuests.filter((q) => q.done).length
  const started = g.todayQuests.filter((q) => !q.done && q.started).length
  const verdict =
    set > 0 && done === set && set >= 3 ? 'PERFECT'
      : done > 0 ? 'VICTORY'
        : started > 0 || g.challenges.today > 0 ? 'NICE TRY'
          : g.isRestDay ? 'REST' : 'DEFEAT'
  const win = verdict !== 'DEFEAT'
  const net = s.gain + s.loss
  const pct = attackPct(s)

  return (
    <div className="overlay up" onClick={onClose}>
      <div className="result" onClick={(e) => e.stopPropagation()}>
        <div className="ov-kicker">MATCH RESULT</div>
        <div className={`result-verdict ${win ? 'win' : 'lose'}`}>{verdict}</div>
        <div className="sub" style={{ fontSize: 12 }}>{g.today.replace(/-/g, '.')}</div>
        <div className="result-grid">
          <div className="stat xp"><div className="v">{net >= 0 ? '+' : ''}{net}</div><div className="l">獲得XP</div></div>
          <div className="stat"><div className="v">{done}<small>/{set}</small></div><div className="l">クエスト達成{started ? `・着手${started}` : ''}</div></div>
          <div className="stat atk"><div className="v">{pct ?? '--'}<small>%</small></div><div className="l">攻め率</div></div>
          <div className="stat"><div className="v">{g.challenges.today}<small>回</small></div><div className="l">今日の挑戦（昨日 {g.challenges.yesterday}）</div></div>
        </div>
        {g.todayReview?.comment && <div className="result-comment">{g.todayReview.comment}</div>}
        <div className="gauge-head"><span>{g.rank.fullName}</span><span>{g.rank.next ? `→ ${g.rank.next.name}` : 'MAX'}</span></div>
        <div className="gauge"><div className="gauge-fill" style={{ width: `${Math.max(1.5, g.rank.progress * 100)}%` }} /></div>
        <div className="gauge-foot" style={{ marginBottom: 22 }}>
          {g.rank.next && !g.rank.promotion ? <>次のランクまであと<b>{g.rank.next.xpNeeded.toLocaleString()}</b>XP</> : g.rank.promotion ? '昇格戦：条件をクリアしよう' : '最高ランク'}
        </div>
        <button className="btn" onClick={onClose}>OK</button>
      </div>
    </div>
  )
}
