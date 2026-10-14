import { useState } from 'react'
import { formatShort } from '../lib/date'
import { MAX_DAILY_QUESTS } from '../lib/defaults'
import { addQuest, type Game } from '../store/game'
import { openQuests, type QuestView } from '../store/ui'
import { IconPlus } from './Icons'

type Tone = 'ok' | 'warn' | 'hot' | 'idle'

interface Row {
  view: QuestView
  en: string
  ja: string
  value: string
  progress?: number
  note: string
  tone: Tone
}

/** 明日・今週・今月の計画がどうなっているかを一目で（タップでクエストタブへ） */
export function Operations({ g }: { g: Game }) {
  const { rules } = g.config
  const { plan, periods } = g
  const tomorrowCount = g.tomorrowQuests.length
  const week = periods.week
  const month = periods.month
  const weekDone = week.goals.filter((p) => p.done).length
  const monthDone = month.goals.filter((p) => p.done).length
  const monthNum = Number(month.start.slice(5, 7))

  const rows: Row[] = [
    {
      view: 'tomorrow', en: 'NEXT ROUND', ja: '明日のクエスト',
      value: `${tomorrowCount}/${MAX_DAILY_QUESTS}`,
      note: tomorrowCount > 0
        ? '前日までに作戦を立てた'
        : plan.enforced ? `今日中に1つ以上書かないと −${rules.penaltyNoPlan}XP` : '前日までに書く（減点は明日から）',
      tone: tomorrowCount > 0 ? 'ok' : plan.enforced ? 'hot' : 'warn',
    },
    {
      view: 'week', en: `WEEK ${formatShort(week.start)}〜`, ja: '今週の目標',
      value: `${weekDone}/${week.goals.length}`,
      progress: week.goals.length ? weekDone / week.goals.length : 0,
      note: plan.weekDue
        ? week.nextGoals.length ? '来週の目標も書けている' : `来週の目標を今日中に（−${rules.penaltyNoWeekPlan}XP）`
        : week.goals.length === 0 ? '今週の目標が未設定' : `来週の目標は日曜までに（${week.nextGoals.length}/3）`,
      tone: plan.weekDue && !week.nextGoals.length ? (plan.enforced ? 'hot' : 'warn') : week.goals.length === 0 ? 'warn' : 'idle',
    },
    {
      view: 'month', en: `MONTH ${monthNum}月`, ja: '今月の目標',
      value: `${monthDone}/${month.goals.length}`,
      progress: month.goals.length ? monthDone / month.goals.length : 0,
      note: plan.monthDue
        ? month.nextGoals.length ? '来月の目標も書けている' : `来月の目標を今日中に（−${rules.penaltyNoMonthPlan}XP）`
        : month.goals.length === 0 ? '今月の目標が未設定' : `来月の目標は月末までに（${month.nextGoals.length}/3）`,
      tone: plan.monthDue && !month.nextGoals.length ? (plan.enforced ? 'hot' : 'warn') : month.goals.length === 0 ? 'warn' : 'idle',
    },
  ]

  return (
    <section className="sec">
      <div className="sec-h"><span className="en">OPERATIONS</span><span className="ja">明日・今週・今月の作戦</span></div>
      <div className="ops">
        {rows.map((r) => (
          <button key={r.view} className={`ops-row ${r.tone}`} onClick={() => openQuests(r.view)}>
            <div className="ops-main">
              <div className="ops-head">
                <span className="ops-en">{r.en}</span>
                <span className="ops-ja">{r.ja}</span>
              </div>
              <div className="ops-note">{r.note}</div>
            </div>
            {r.progress !== undefined && (
              <div className="ops-pips" aria-hidden="true">
                {Array.from({ length: 3 }, (_, i) => {
                  const total = r.view === 'week' ? week.goals.length : month.goals.length
                  const done = r.view === 'week' ? weekDone : monthDone
                  return <i key={i} className={i < done ? 'on' : i < total ? 'set' : ''} />
                })}
              </div>
            )}
            <span className="ops-val">{r.value}</span>
            <span className="ops-go">›</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** 夜の振り返りで、明日のクエストをその場で書く */
export function NextRoundPlanner({ g }: { g: Game }) {
  const [title, setTitle] = useState('')
  const list = g.tomorrowQuests
  const full = list.length >= MAX_DAILY_QUESTS
  const add = () => {
    if (!title.trim()) return
    addQuest({ title, stars: 2, date: g.tomorrow })
    setTitle('')
  }
  return (
    <div className="field next-round">
      <label>
        NEXT ROUND ・ 明日のクエスト {list.length}/{MAX_DAILY_QUESTS}
        {list.length === 0 && g.plan.enforced && <b> （書かないと −{g.config.rules.penaltyNoPlan}XP）</b>}
      </label>
      {list.map((q, i) => (
        <div key={q.id} className="nr-item">
          <span className="nr-letter">{'ABC'[i]}</span>
          <span className="t">{q.title}</span>
          {q.kind === 'challenge' && <span className="kind-tag">挑戦</span>}
        </div>
      ))}
      {!full && (
        <div className="row" style={{ marginTop: 6 }}>
          <input
            className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="明日やること・挑戦すること"
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn-sm accent" style={{ flex: '0 0 auto' }} onClick={add} disabled={!title.trim()} aria-label="追加">
            <IconPlus size={14} /> 追加
          </button>
        </div>
      )}
      <p className="help">難易度や目標との紐づけは、クエストタブの「明日」で変えられます。</p>
    </div>
  )
}
