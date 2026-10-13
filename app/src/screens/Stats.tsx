import { useMemo, useState } from 'react'
import { CountUp } from '../components/CountUp'
import { Emblem } from '../components/Emblem'
import { IconChevron } from '../components/Icons'
import { formatJa, formatShort, addDays, weekStart } from '../lib/date'
import { achievementPct, attackPct, challengesByDate, weeklyStats, type WeekStat, type XpEntry } from '../lib/game'
import { useGame } from '../store/game'
import { ReviewSheet } from './Home'

const WEEKS = 8
const GAIN = '#4f8dff'
const LOSS = '#ff4655'
const ATK = '#e0730c'
const W = 340
const PLOT_H = 130
const AXIS_H = 20
const LEFT = 34

export function Stats() {
  const g = useGame()
  const [reviewDate, setReviewDate] = useState<string | null>(null)
  const [showAllLog, setShowAllLog] = useState(false)
  const weeks = useMemo(() => weeklyStats(g.today, WEEKS, g.entries, g.quests, g.activities), [g.today, g.entries, g.quests, g.activities])
  const weekChallenges = useMemo(() => {
    const map = new Map<string, number>()
    for (const [date, n] of challengesByDate(g.quests, g.challengeLogs)) {
      const ws = weekStart(date)
      map.set(ws, (map.get(ws) ?? 0) + n)
    }
    return map
  }, [g.quests, g.challengeLogs])
  const cur = weeks[weeks.length - 1]
  const curNet = cur.gain + cur.loss
  const ach = achievementPct(cur)
  const atk = attackPct(cur)

  const logDays = useMemo(() => {
    const from = addDays(g.today, -13)
    const map = new Map<string, XpEntry[]>()
    for (const e of g.entries) {
      if (e.date < from) continue
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [g.entries, g.today])

  return (
    <div className="fade-in">
      <section className="career">
        <div className="scan" />
        <div className="career-top">
          <Emblem
            color={g.rank.rank.color} index={g.rank.index} total={g.rank.ranks.length}
            division={g.rank.division} divisions={g.rank.rank.divisions} size={92}
          />
          <div>
            <div className="kicker">CAREER</div>
            <div className="career-rank">{g.rank.fullName}</div>
            <div className="career-sub"><CountUp value={g.total} /> XP ・ ROUND {g.career.days}</div>
          </div>
        </div>
        <div className="career-grid">
          <div><b>{g.career.winRate ?? '--'}<small>%</small></b><span>勝率（達成した日）</span></div>
          <div><b>{g.career.bestStreak}<small>日</small></b><span>最長連続</span></div>
          <div><b className="peak" style={{ color: g.career.peak.rank.color }}>{g.career.peak.fullName}</b><span>最高ランク</span></div>
          <div><b><CountUp value={g.challenges.total} /></b><span>通算の挑戦</span></div>
          <div><b>{Math.floor(g.career.attackMin / 60)}<small>h</small></b><span>攻めた時間</span></div>
          <div><b>{g.career.posts}</b><span>発信した挑戦</span></div>
        </div>
      </section>

      <div className="strip">
        <div className={`stat xp${curNet < 0 ? ' neg' : ''}`}><div className="v">{curNet >= 0 ? '+' : ''}{curNet}</div><div className="l">今週のXP</div></div>
        <div className="stat"><div className="v">{ach ?? '--'}<small>%</small></div><div className="l">今週の達成率</div></div>
        <div className="stat atk"><div className="v">{atk ?? '--'}<small>%</small></div><div className="l">今週の攻め率</div></div>
      </div>

      <section className="sec">
        <div className="sec-h"><span className="en">WEEKLY</span><span className="ja">週ごとの推移（直近{WEEKS}週）</span></div>
        <XpChart weeks={weeks} />
        <PctChart
          title="デイリー達成率" caption="達成したクエスト ÷ 設定したクエスト" color={GAIN}
          weeks={weeks} value={achievementPct}
        />
        <PctChart
          title="攻め率" caption="攻めの時間 ÷（攻め＋守りの時間）" color={ATK}
          weeks={weeks} value={attackPct} target={g.config.attackTargetPct}
        />
        <div className="chart-card">
          <h3>週ごとの数字</h3>
          <table className="week-table">
            <thead>
              <tr><th>週</th><th>獲得</th><th>減少</th><th>達成率</th><th>攻め率</th><th>挑戦</th></tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.start}>
                  <td>{formatShort(w.start)}〜</td>
                  <td>+{w.gain}</td>
                  <td className={w.loss ? 'neg' : ''}>{w.loss || 0}</td>
                  <td>{achievementPct(w) ?? '--'}%</td>
                  <td>{attackPct(w) ?? '--'}%</td>
                  <td>{weekChallenges.get(w.start) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="en">XP LOG</span><span className="ja">直近2週間のXP履歴</span></div>
        {logDays.length === 0 && <div className="empty">まだXPの記録がありません</div>}
        {(showAllLog ? logDays : logDays.slice(0, 4)).map(([date, list]) => {
          const net = list.reduce((s, e) => s + e.amount, 0)
          return (
            <div key={date} className="log-day">
              <h4><span>{formatJa(date)}</span><span style={{ color: net < 0 ? 'var(--danger)' : 'var(--rank)' }}>{net >= 0 ? '+' : ''}{net}</span></h4>
              {list.map((e, i) => (
                <div key={i} className="log-entry">
                  <span>{e.label}</span>
                  <span className={e.amount < 0 ? 'n' : 'p'}>{e.amount >= 0 ? '+' : ''}{e.amount}</span>
                </div>
              ))}
            </div>
          )
        })}
        {logDays.length > 4 && (
          <button className="toggle-link" onClick={() => setShowAllLog(!showAllLog)}>
            {showAllLog ? '閉じる' : 'もっと見る'} <IconChevron size={14} open={showAllLog} />
          </button>
        )}
      </section>

      <section className="sec">
        <div className="sec-h"><span className="en">DEBRIEFS</span><span className="ja">振り返り</span></div>
        {g.reviews.length === 0 && <div className="empty">ホームの「今日の振り返り」から1日を締めくくろう</div>}
        {g.reviews.map((r) => (
          <button key={r.id} className="review-item" onClick={() => setReviewDate(r.date)}>
            <div className="d">
              <span>{formatJa(r.date)}</span>
              {r.score && <span className="sc">{'★'.repeat(r.score)}</span>}
            </div>
            <div className="c">{r.comment || '（コメントなし）'}</div>
          </button>
        ))}
      </section>

      <ReviewSheet g={g} open={!!reviewDate} date={reviewDate ?? undefined} onClose={() => setReviewDate(null)} />
    </div>
  )
}

// ---------- charts ----------

/** 端が4pxの角丸・基線側は直角の棒 */
function barPath(x: number, base: number, end: number, w: number) {
  const h = Math.abs(end - base)
  if (h < 0.5) return ''
  const r = Math.min(4, h, w / 2)
  if (end < base) {
    return `M${x},${base} V${end + r} Q${x},${end} ${x + r},${end} H${x + w - r} Q${x + w},${end} ${x + w},${end + r} V${base} Z`
  }
  return `M${x},${base} V${end - r} Q${x},${end} ${x + r},${end} H${x + w - r} Q${x + w},${end} ${x + w},${end - r} V${base} Z`
}

function niceMax(v: number) {
  if (v <= 0) return 100
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

function compact(v: number) {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) % 1000 ? 1 : 0)}K` : String(v)
}

function columns(n: number) {
  const slot = (W - LEFT) / n
  const bw = Math.min(24, slot * 0.56)
  return { slot, bw, x: (i: number) => LEFT + i * slot + (slot - bw) / 2, cx: (i: number) => LEFT + i * slot + slot / 2 }
}

function XpChart({ weeks }: { weeks: WeekStat[] }) {
  const [sel, setSel] = useState<number | null>(null)
  const maxGain = niceMax(Math.max(...weeks.map((w) => w.gain)))
  const maxLoss = Math.max(...weeks.map((w) => -w.loss))
  const lossMax = maxLoss > 0 ? niceMax(maxLoss) : 0
  // 上下の比率で基線の位置を決める
  const span = maxGain + lossMax
  const baseY = (maxGain / span) * PLOT_H
  const y = (v: number) => baseY - (v / span) * PLOT_H
  const { slot, bw, x, cx } = columns(weeks.length)
  const last = weeks.length - 1
  const s = sel ?? last
  const w = weeks[s]

  return (
    <div className="chart-card chart">
      <h3>週間XP</h3>
      <div className="cap">獲得したXPと、ペナルティで失ったXP</div>
      <div className="legend">
        <span><i style={{ background: GAIN }} />獲得</span>
        <span><i style={{ background: LOSS }} />減少</span>
      </div>
      <svg viewBox={`0 0 ${W} ${PLOT_H + AXIS_H}`} role="img" aria-label="週間XPのグラフ">
        {[maxGain, maxGain / 2].map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={W} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
            <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8b95a5">{compact(t)}</text>
          </g>
        ))}
        {lossMax > 0 && y(-lossMax) - baseY >= 14 && (
          <g>
            <line x1={LEFT} x2={W} y1={y(-lossMax)} y2={y(-lossMax)} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
            <text x={LEFT - 6} y={y(-lossMax) + 4} textAnchor="end" fontSize="10" fill="#8b95a5">-{compact(lossMax)}</text>
          </g>
        )}
        <line x1={LEFT} x2={W} y1={baseY} y2={baseY} stroke="rgba(255,255,255,.22)" strokeWidth="1" />
        <text x={LEFT - 6} y={baseY + 4} textAnchor="end" fontSize="10" fill="#8b95a5">0</text>
        {weeks.map((wk, i) => (
          <g key={wk.start} onClick={() => setSel(i)} onPointerEnter={() => setSel(i)} className={`bar${s === i ? ' sel' : ''}`}>
            <rect x={LEFT + i * slot} y={0} width={slot} height={PLOT_H + AXIS_H} fill="transparent" />
            {wk.gain > 0 && <path d={barPath(x(i), baseY - 1, y(wk.gain), bw)} fill={GAIN} />}
            {wk.loss < 0 && <path d={barPath(x(i), baseY + 1, y(wk.loss), bw)} fill={LOSS} />}
            <text x={cx(i)} y={PLOT_H + 15} textAnchor="middle" fontSize="10" fill={i === s ? '#e9edf2' : '#5d6676'}>{formatShort(wk.start)}</text>
          </g>
        ))}
        {weeks[last].gain > 0 && (
          <text x={cx(last)} y={y(weeks[last].gain) - 5} textAnchor="middle" fontSize="11" fill="#e9edf2">+{weeks[last].gain}</text>
        )}
      </svg>
      <div className="chart-tip">
        {formatShort(w.start)}〜 の週：獲得 <b>+{w.gain}</b> ／ 減少 <b>{w.loss || 0}</b> ／ 合計 <b>{w.gain + w.loss}</b>
      </div>
    </div>
  )
}

function PctChart({
  title, caption, color, weeks, value, target,
}: { title: string; caption: string; color: string; weeks: WeekStat[]; value: (w: WeekStat) => number | null; target?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const y = (v: number) => PLOT_H - (v / 100) * PLOT_H
  const { slot, bw, x, cx } = columns(weeks.length)
  const last = weeks.length - 1
  const s = sel ?? last
  const sv = value(weeks[s])
  const lastV = value(weeks[last])

  return (
    <div className="chart-card chart">
      <h3>{title}</h3>
      <div className="cap">{caption}{target !== undefined && ` ・ 白い線＝目標 ${target}%`}</div>
      <svg viewBox={`0 0 ${W} ${PLOT_H + AXIS_H}`} role="img" aria-label={`${title}のグラフ`}>
        {[100, 50].map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={W} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
            <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8b95a5">{t}%</text>
          </g>
        ))}
        <line x1={LEFT} x2={W} y1={PLOT_H} y2={PLOT_H} stroke="rgba(255,255,255,.22)" strokeWidth="1" />
        {weeks.map((wk, i) => {
          const v = value(wk)
          return (
            <g key={wk.start} onClick={() => setSel(i)} onPointerEnter={() => setSel(i)} className={`bar${s === i ? ' sel' : ''}`}>
              <rect x={LEFT + i * slot} y={0} width={slot} height={PLOT_H + AXIS_H} fill="transparent" />
              {v !== null && <path d={barPath(x(i), PLOT_H, y(v), bw)} fill={color} />}
              <text x={cx(i)} y={PLOT_H + 15} textAnchor="middle" fontSize="10" fill={i === s ? '#e9edf2' : '#5d6676'}>{formatShort(wk.start)}</text>
            </g>
          )
        })}
        {target !== undefined && (
          <g pointerEvents="none">
            <line x1={LEFT} x2={W} y1={y(target)} y2={y(target)} stroke="#e9edf2" strokeWidth="1" opacity=".7" />
          </g>
        )}
        {lastV !== null && (
          <text x={cx(last)} y={y(lastV) - 5} textAnchor="middle" fontSize="11" fill="#e9edf2" pointerEvents="none">{lastV}%</text>
        )}
      </svg>
      <div className="chart-tip">{formatShort(weeks[s].start)}〜 の週：<b>{sv === null ? '記録なし' : `${sv}%`}</b></div>
    </div>
  )
}
