import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CountUp } from '../components/CountUp'
import { Emblem } from '../components/Emblem'
import { burst, buzz } from '../lib/fx'
import { afterIntro } from '../lib/intro'
import { attackPct, computeRank, dayVerdict, untouched } from '../lib/game'
import { useCloud } from '../store/cloud'
import { useData } from '../store/data'
import { useGame, type Game } from '../store/game'
import { useUI } from '../store/ui'

const TIER_KEY = 'lr-last-tier'

/** ランクの上下を検知してカットシーンを出す */
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
    const next = { dir: g.rank.tierKey > prev.key ? ('up' as const) : ('down' as const), from: prev.name }
    // 起動時の演出の最中なら、終わってから出す
    return afterIntro(() => setShown(next))
  }, [ready, g.rank.tierKey, g.rank.fullName])

  if (!shown) return null
  return createPortal(
    shown.dir === 'up'
      ? <PromotedCut g={g} from={shown.from} onClose={() => setShown(null)} />
      : <DemotedCut g={g} from={shown.from} onClose={() => setShown(null)} />,
    document.body,
  )
}

/** 同期の初回取り込みが終わるまでは、ランク変化などの演出を出さない */
export function useReady() {
  const loaded = useData((s) => s.loaded)
  const pulled = useData((s) => s.sync.lastPulledAt !== null)
  const { auth, localMode } = useCloud()
  return loaded && (auth === 'signedIn' ? pulled : localMode)
}

function PromotedCut({ g, from, onClose }: { g: Game; from: string; onClose: () => void }) {
  const r = g.rank
  const emblemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // エンブレムが着地した瞬間に火花
    buzz([30, 60, 90])
    const timers = [650, 900].map((ms, i) =>
      setTimeout(() => {
        const el = emblemRef.current
        if (!el) return
        const b = el.getBoundingClientRect()
        burst(b.left + b.width / 2, b.top + b.height / 2, i ? '#ffffff' : r.rank.color, i ? 18 : 36, i ? 1.2 : 2)
      }, ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [r.rank.color])

  return (
    <div className="cut up" onClick={onClose} style={{ ['--cut' as string]: r.rank.color }}>
      <div className="cut-rays" />
      <div className="cut-scan" />
      <div className="cut-line" />
      <div className="cut-flash" />
      <div className="cut-kicker">PROMOTED</div>
      <div className="cut-title">RANK UP</div>
      <div className="cut-emblem" ref={emblemRef}>
        <Emblem color={r.rank.color} index={r.index} total={r.ranks.length} division={r.division} divisions={r.rank.divisions} size={200} animated />
      </div>
      <div className="cut-rank">{r.fullName}</div>
      <div className="cut-from"><span>{from}</span><b>▶</b><span>{r.fullName}</span></div>
      <p className="cut-text">誰もくれないランクを、自分の行動で取った。</p>
      <button className="btn cut-btn">次のランクへ</button>
    </div>
  )
}

function DemotedCut({ g, from, onClose }: { g: Game; from: string; onClose: () => void }) {
  const r = g.rank
  useEffect(() => buzz([140, 80, 140]), [])
  const penalties = g.entries.filter((e) => e.kind === 'penalty').slice(-3).reverse()
  return (
    <div className="cut down" onClick={onClose}>
      <div className="cut-scan heavy" />
      <div className="cut-kicker glitch" data-text="SIGNAL LOST">SIGNAL LOST</div>
      <div className="cut-title glitch" data-text="DEMOTED">DEMOTED</div>
      <div className="cut-emblem glitchy">
        <Emblem color={r.rank.color} index={r.index} total={r.ranks.length} division={r.division} divisions={r.rank.divisions} size={180} animated={false} />
      </div>
      <div className="cut-rank solid glitch" data-text={r.fullName}>{r.fullName}</div>
      <div className="cut-from"><span>{from}</span><b>▼</b><span>{r.fullName}</span></div>
      <p className="cut-text">サボった分はランクに出る。今日の行動で取り返せ。</p>
      {penalties.length > 0 && (
        <div className="cut-list">
          {penalties.map((p, i) => (
            <div key={i}><span>{p.date.slice(5).replace('-', '/')} {p.label}</span><b>{p.amount}</b></div>
          ))}
        </div>
      )}
      <button className="btn danger cut-btn">取り返しに行く</button>
    </div>
  )
}

// ---------- MATCH RESULT ----------

export function MatchResult() {
  const open = useUI((s) => s.matchResult)
  const g = useGame()
  if (!open) return null
  return createPortal(<ResultView g={g} onClose={() => useUI.setState({ matchResult: false })} />, document.body)
}

function ResultView({ g, onClose }: { g: Game; onClose: () => void }) {
  const s = g.todayStat
  const set = g.todayQuests.length
  const done = g.todayQuests.filter((q) => q.done).length
  const started = g.todayQuests.filter((q) => !q.done && q.started).length
  const missed = g.todayQuests.filter(untouched).length
  const verdict = dayVerdict(g.todayQuests, g.challenges.today, g.isRestDay)
  const win = verdict !== 'DEFEAT'
  const net = s.gain + s.loss
  const pct = attackPct(s)

  // 今朝の位置から今の位置までゲージを伸ばす
  const r = g.rank
  const startState = computeRank(Math.max(0, g.total - net), g.config.ranks)
  const sameTier = startState.tierKey === r.tierKey
  const fromPct = sameTier ? startState.progress * 100 : 0
  const toPct = Math.max(1.5, r.progress * 100)
  const [barPct, setBarPct] = useState(fromPct)
  useEffect(() => {
    const t = setTimeout(() => setBarPct(toPct), 1100)
    return () => clearTimeout(t)
  }, [toPct])

  // その日いちばん XP を稼いだ行動（ボーナス類は除く）
  const mvp = g.todayEntries
    .filter((e) => e.amount > 0 && !['perfect', 'streak', 'review'].includes(e.kind))
    .reduce<(typeof g.todayEntries)[number] | null>((best, e) => (!best || e.amount > best.amount ? e : best), null)

  const rows: [string, ReactNode][] = [
    ['獲得XP', <CountUp key="xp" value={net} from={0} delay={500} signed />],
    ['クエスト', <>{done}<small>/{set}</small>{started > 0 && <small className="tag-started">着手{started}</small>}</>],
    ['攻め率', pct === null ? '--' : <><CountUp key="pct" value={pct} from={0} delay={760} />%</>],
    ['今日の挑戦', <><CountUp key="ch" value={g.challenges.today} from={0} delay={880} /><small>回 ・ 昨日 {g.challenges.yesterday}</small></>],
  ]

  return (
    <div className={`cut result-cut ${win ? 'win' : 'lose'}`} onClick={onClose} style={{ ['--cut' as string]: win ? r.rank.color : '#ff4655' }}>
      <div className="cut-scan" />
      <div className="mr" onClick={(e) => e.stopPropagation()}>
        <div className="cut-kicker">MATCH RESULT ・ {g.today.replace(/-/g, '.')}</div>
        <div className="mr-band"><div className="mr-verdict">{verdict}</div></div>
        <div className="mr-score">
          <div><b>{done}</b><span>CLEAR</span></div>
          <i>:</i>
          <div><b>{missed}</b><span>MISS</span></div>
        </div>
        <div className="mr-rows">
          {rows.map(([label, value], i) => (
            <div key={label} className="mr-row" style={{ animationDelay: `${0.45 + i * 0.12}s` }}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </div>
        {mvp && (
          <div className="mr-mvp">
            <span className="mvp-tag">MVP</span>
            <span className="mvp-label">{mvp.label}</span>
            <b>+{mvp.amount}</b>
          </div>
        )}
        {g.todayReview?.comment && <div className="result-comment">{g.todayReview.comment}</div>}
        <div className="mr-rank">
          <Emblem color={r.rank.color} index={r.index} total={r.ranks.length} division={r.division} divisions={r.rank.divisions} size={54} animated={false} />
          <div className="mr-rank-body">
            <div className="gauge-head">
              <span>{r.fullName}</span>
              <span className="mr-gain">{net >= 0 ? '+' : ''}{net} XP</span>
              <span>{r.next ? r.next.name : 'MAX'}</span>
            </div>
            <div className="gauge">
              <div className="gauge-fill" style={{ width: `${barPct}%`, transition: 'width 1.2s cubic-bezier(.2,.8,.2,1)' }} />
            </div>
          </div>
        </div>
        <div className="gauge-foot" style={{ marginBottom: 20 }}>
          {!sameTier && net > 0 ? <b>今日ランクが上がった</b> : r.next && !r.promotion ? <>次のランクまであと<b>{r.next.xpNeeded.toLocaleString()}</b>XP</> : r.promotion ? '昇格戦：条件をクリアしよう' : '最高ランク'}
        </div>
        <button className="btn" onClick={onClose}>CONTINUE</button>
      </div>
    </div>
  )
}
