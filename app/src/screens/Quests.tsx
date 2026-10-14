import { useMemo, useState } from 'react'
import { GoalSelect } from '../components/forms'
import { Check, IconChevron, IconMore, IconPlus } from '../components/Icons'
import { QuestSheet, type QuestSheetState } from '../components/QuestSheet'
import { Sheet } from '../components/Sheet'
import { addDays, daysBetween, formatJa, formatShort } from '../lib/date'
import { GOAL_CHILD_LEVEL, GOAL_LEVEL_LABEL, MAX_DAILY_QUESTS, MAX_PERIOD_GOALS } from '../lib/defaults'
import { burst, centerOf } from '../lib/fx'
import { childrenMap, goalProgress } from '../lib/game'
import type { DailyQuest, Goal, GoalLevel, PeriodGoal, PeriodKind, WithId } from '../lib/types'
import {
  addGoal, addPeriodGoal, deleteGoal, deletePeriodGoal, editGoal, editPeriodGoal, toggleGoal, togglePeriodGoal, useGame, type Game,
} from '../store/game'
import { openPage, useUI, type QuestView } from '../store/ui'

type SheetState = { mode: 'add'; level: GoalLevel; parentId: string | null } | { mode: 'edit'; goal: WithId<Goal> } | null

const VIEWS: { id: QuestView; label: string; en: string; ja: string }[] = [
  { id: 'tomorrow', label: '明日', en: 'NEXT ROUND', ja: '明日のクエストは前日までに書く' },
  { id: 'week', label: '今週', en: 'WEEKLY', ja: '1週間の目標（月曜はじまり）' },
  { id: 'month', label: '今月', en: 'MONTHLY', ja: '1ヶ月の目標' },
  { id: 'life', label: '人生', en: 'MAIN QUEST', ja: '大目標 → 中目標 → 小目標に分解して攻略する' },
]

export function Quests() {
  const g = useGame()
  const view = useUI((s) => s.questView)
  const v = VIEWS.find((x) => x.id === view) ?? VIEWS[3]
  // 今日のうちにやるべき計画があるタブに印をつける
  const alert: Record<QuestView, boolean> = {
    tomorrow: g.tomorrowQuests.length === 0,
    week: (g.plan.weekDue && g.periods.week.nextGoals.length === 0) || g.periods.week.goals.length === 0,
    month: (g.plan.monthDue && g.periods.month.nextGoals.length === 0) || g.periods.month.goals.length === 0,
    life: false,
  }

  return (
    <div className="fade-in">
      <div className="page-title">
        <div>
          <h1>{v.en}</h1>
          <div className="ja">{v.ja}</div>
        </div>
      </div>
      <div className="seg" role="tablist">
        {VIEWS.map((x) => (
          <button key={x.id} role="tab" aria-selected={view === x.id} className={view === x.id ? 'on' : ''} onClick={() => useUI.setState({ questView: x.id })}>
            {x.label}
            {alert[x.id] && <i className="seg-dot" />}
          </button>
        ))}
      </div>
      {view === 'tomorrow' && <TomorrowView g={g} />}
      {view === 'week' && <PeriodView g={g} period="week" />}
      {view === 'month' && <PeriodView g={g} period="month" />}
      {view === 'life' && <LifeView g={g} />}
    </div>
  )
}

// ---------- 明日 ----------

function TomorrowView({ g }: { g: Game }) {
  const [sheet, setSheet] = useState<QuestSheetState>(null)
  const list = g.tomorrowQuests
  const { rules } = g.config
  const tone = list.length ? 'ok' : g.plan.enforced ? 'hot' : 'warn'
  return (
    <div className="sec">
      <div className={`plan-card ${tone}`}>
        <div className="pc-kicker">NEXT ROUND ・ {formatJa(g.tomorrow)}</div>
        <div className="pc-title">{list.length ? '明日の作戦は立っている' : '明日のクエストを書こう'}</div>
        <div className="pc-rule">
          日付が変わる（朝{g.config.dayStartHour}時）までに1つ以上書く。書かないと −{rules.penaltyNoPlan}XP
          {!g.plan.enforced && '（減点は明日から）'}
        </div>
      </div>
      {list.map((q, i) => (
        <PlannedQuest key={q.id} q={q} slot={i} goalTitle={g.goals.find((x) => x.id === q.goalId)?.title} onEdit={() => setSheet({ quest: q })} />
      ))}
      {list.length < MAX_DAILY_QUESTS && (
        <button className="slot" onClick={() => setSheet({ date: g.tomorrow })}>
          <IconPlus size={16} /> 明日のクエストを追加（あと{MAX_DAILY_QUESTS - list.length}つ）
        </button>
      )}
      <p className="help">明日になると、ここに書いたクエストがホームの OBJECTIVES に並びます。やることだけでなく「挑戦」も入れよう。夜の振り返りからも書けます。</p>
      <QuestSheet g={g} state={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

function PlannedQuest({ q, slot, goalTitle, onEdit }: { q: WithId<DailyQuest>; slot: number; goalTitle?: string; onEdit: () => void }) {
  const letter = 'ABC'[slot] ?? String(slot + 1)
  return (
    <div className="quest obj planned" data-obj={letter}>
      <button className="quest-main" onClick={onEdit}>
        <span className="obj-tile" aria-hidden="true"><span className="obj-letter">{letter}</span></span>
        <span className="q-body">
          <span className="obj-state">OBJ {letter} ・ PLANNED{q.kind === 'challenge' && <span className="kind-tag">挑戦</span>}</span>
          <span className="q-title">{q.title}</span>
          {goalTitle && <span className="q-link"><i>◆</i>{goalTitle}</span>}
        </span>
        <span className="q-xp"><span className="stars">{'★'.repeat(q.stars)}</span><span className="x">+{q.xp}</span></span>
      </button>
      <button className="q-more" aria-label="編集" onClick={onEdit}><IconMore size={18} /></button>
    </div>
  )
}

// ---------- 今週・今月 ----------

type PGSheet = { period: PeriodKind; start: string; goal?: WithId<PeriodGoal> } | null

function PeriodView({ g, period }: { g: Game; period: PeriodKind }) {
  const [sheet, setSheet] = useState<PGSheet>(null)
  const p = g.periods[period]
  const isWeek = period === 'week'
  const { rules } = g.config
  const range = (start: string) =>
    isWeek ? `${formatShort(start)}〜${formatShort(addDays(start, 6))}` : `${Number(start.slice(0, 4))}年${Number(start.slice(5, 7))}月`
  const deadline = addDays(p.next, -1)
  const due = isWeek ? g.plan.weekDue : g.plan.monthDue
  const penalty = isWeek ? rules.penaltyNoWeekPlan : rules.penaltyNoMonthPlan
  const xp = isWeek ? rules.weekGoal : rules.monthGoal
  const nextLabel = isWeek ? '来週' : '来月'
  const nextTone = p.nextGoals.length ? 'ok' : due ? (g.plan.enforced ? 'hot' : 'warn') : 'idle'

  return (
    <div className="sec">
      <PeriodBlock
        g={g} title={isWeek ? '今週の目標' : '今月の目標'} range={range(p.start)} goals={p.goals} current
        onAdd={() => setSheet({ period, start: p.start })} onEdit={(goal) => setSheet({ period, start: p.start, goal })}
      />
      <div className={`plan-card ${nextTone}`} style={{ marginTop: 18 }}>
        <div className="pc-kicker">{isWeek ? 'NEXT WEEK' : 'NEXT MONTH'} ・ 締め切り {formatJa(deadline)}</div>
        <div className="pc-title">{p.nextGoals.length ? `${nextLabel}の目標は書けている` : `${nextLabel}の目標を前日までに`}</div>
        <div className="pc-rule">
          {formatJa(deadline)}が終わるまでに1つ以上書く。書かないと −{penalty}XP
          {!g.plan.enforced && due && '（減点は明日から）'}
        </div>
      </div>
      <PeriodBlock
        g={g} title={`${nextLabel}の目標`} range={range(p.next)} goals={p.nextGoals}
        onAdd={() => setSheet({ period, start: p.next })} onEdit={(goal) => setSheet({ period, start: p.next, goal })}
      />
      <p className="help">達成すると1つ +{xp}XP（{isWeek ? '週' : '月'}が始まってからチェックできます）。目標は最大{MAX_PERIOD_GOALS}つ。</p>
      <PeriodGoalSheet g={g} state={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

function PeriodBlock({ g, title, range, goals, current, onAdd, onEdit }: {
  g: Game; title: string; range: string; goals: WithId<PeriodGoal>[]; current?: boolean
  onAdd: () => void; onEdit: (goal: WithId<PeriodGoal>) => void
}) {
  const done = goals.filter((x) => x.done).length
  return (
    <div className="pblock">
      <div className="pblock-h">
        <span className="t">{title}</span>
        <span className="r">{range}</span>
        {current && goals.length > 0 && <span className="n">{done}/{goals.length}</span>}
      </div>
      {current && goals.length > 0 && <div className="pbar" style={{ marginBottom: 8 }}><div style={{ width: `${(done / goals.length) * 100}%` }} /></div>}
      {goals.map((x) => (
        <div key={x.id} className={`g-row pg${x.done ? ' done' : ''}`}>
          {current ? (
            <button
              aria-label="達成"
              onClick={(e) => {
                if (!x.done) {
                  const c = centerOf(e.currentTarget)
                  burst(c.x, c.y, g.rank.rank.color, 16)
                }
                togglePeriodGoal(x)
              }}
            >
              <Check on={x.done} />
            </button>
          ) : (
            <span className="pg-dot" />
          )}
          <div className="t">
            {x.title}
            {x.goalId && <div className="q-link"><i>◆</i>{g.goals.find((y) => y.id === x.goalId)?.title}</div>}
          </div>
          <span className="mini" style={{ color: 'var(--rank)' }}>+{x.xp}</span>
          <button className="q-more" onClick={() => onEdit(x)} aria-label="編集"><IconMore size={16} /></button>
        </div>
      ))}
      {goals.length < MAX_PERIOD_GOALS && (
        <button className="slot" onClick={onAdd}><IconPlus size={15} /> {title}を追加（あと{MAX_PERIOD_GOALS - goals.length}つ）</button>
      )}
    </div>
  )
}

function PeriodGoalSheet({ g, state, onClose }: { g: Game; state: PGSheet; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [goalId, setGoalId] = useState('')
  const [lastKey, setLastKey] = useState<string | null>(null)
  const editing = state?.goal
  const key = state ? editing?.id ?? `new-${state.period}-${state.start}` : null
  if (key !== lastKey) {
    setLastKey(key)
    setTitle(editing?.title ?? '')
    setGoalId(editing?.goalId ?? '')
  }
  if (!state) return <Sheet open={false} onClose={onClose} en="">{null}</Sheet>
  const isWeek = state.period === 'week'
  const name = isWeek ? '週の目標' : '月の目標'

  return (
    <Sheet open onClose={onClose} en={isWeek ? 'WEEKLY' : 'MONTHLY'} ja={editing ? `${name}を編集` : `${name}を追加`}>
      <div className="field">
        <label>{name}</label>
        <input
          className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!editing}
          placeholder={isWeek ? '例：新規代理店に5件アポを取る' : '例：催事を月15現場まで増やす'}
        />
      </div>
      <div className="field">
        <label>どの目標につながる？</label>
        <GoalSelect goals={g.goals} value={goalId} onChange={setGoalId} />
      </div>
      <button
        className="btn" disabled={!title.trim()}
        onClick={() => {
          if (editing) editPeriodGoal(editing.id, { title, goalId })
          else addPeriodGoal({ period: state.period, start: state.start, title, goalId })
          onClose()
        }}
      >
        {editing ? '保存する' : '登録する'}
      </button>
      {editing && (
        <button
          className="btn danger" style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm(`「${editing.title}」を削除しますか？`)) {
              deletePeriodGoal(editing.id)
              onClose()
            }
          }}
        >
          削除する
        </button>
      )}
    </Sheet>
  )
}

// ---------- 人生（大中小の目標） ----------

function LifeView({ g }: { g: Game }) {
  const [sheet, setSheet] = useState<SheetState>(null)
  const [showCleared, setShowCleared] = useState(false)
  const kids = useMemo(() => childrenMap(g.goals), [g.goals])
  const mains = g.goals.filter((x) => x.level === 'main' && !x.parentId)
  const active = mains.filter((x) => !x.done)
  const cleared = mains.filter((x) => x.done)

  return (
    <div>
      <div className="sec">
        <div className="row-end">
          <button className="btn-sm accent" onClick={() => setSheet({ mode: 'add', level: 'main', parentId: null })}>
            <IconPlus size={14} /> 大目標
          </button>
        </div>
        <button className="mission-strip" style={{ width: '100%', margin: '0 0 12px' }} onClick={() => openPage('vision')}>
          <div className="body">
            <div className="m">{g.vision?.mission || '人生の目標（VISION）を書く'}</div>
            <div className="c">すべてのクエストは、ここにつながっている</div>
          </div>
          <span className="go">›</span>
        </button>
        {active.length === 0 && (
          <div className="empty">
            <b>NO MAIN QUEST</b>
            人生の大目標を登録しよう。<br />
            例：「年商3億の会社にする」「30歳までに〇〇」
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setSheet({ mode: 'add', level: 'main', parentId: null })}>
              大目標を登録する
            </button>
          </div>
        )}
        {active.map((m) => (
          <GoalCard key={m.id} goal={m} kids={kids} g={g} onSheet={setSheet} />
        ))}

        {cleared.length > 0 && (
          <>
            <button className="toggle-link" onClick={() => setShowCleared(!showCleared)} style={{ marginBottom: 8 }}>
              クリア済みの大目標 {cleared.length}件 <IconChevron size={14} open={showCleared} />
            </button>
            {showCleared && cleared.map((m) => <GoalCard key={m.id} goal={m} kids={kids} g={g} onSheet={setSheet} />)}
          </>
        )}

        <p className="help" style={{ marginTop: 14 }}>
          達成XP：小目標 +{g.config.rules.goal.small} ／ 中目標 +{g.config.rules.goal.mid} ／ 大目標 +{g.config.rules.goal.main}
        </p>
      </div>

      <GoalSheet state={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

function deadlineText(deadline: string | undefined, today: string) {
  if (!deadline) return null
  const d = daysBetween(today, deadline)
  return d < 0 ? `期限 ${-d}日超過` : d === 0 ? '期限 今日' : `残り${d}日`
}

function GoalCard({ goal, kids, g, onSheet }: { goal: WithId<Goal>; kids: Map<string, WithId<Goal>[]>; g: Game; onSheet: (s: SheetState) => void }) {
  const [open, setOpen] = useState(true)
  const mids = kids.get(goal.id) ?? []
  const pct = Math.round(goalProgress(goal, kids) * 100)
  const dl = deadlineText(goal.deadline, g.today)

  return (
    <div className="goal">
      <div className="goal-head">
        <button onClick={() => confirmToggle(goal)} aria-label="達成" style={{ marginTop: 2 }}><Check on={goal.done} /></button>
        <div className="body">
          <div className="lvl">MAIN QUEST</div>
          <div className="goal-title" style={goal.done ? { color: 'var(--sub)' } : undefined}>{goal.title}</div>
          {goal.why && <div className="goal-why">{goal.why}</div>}
          <div className="goal-meta">
            <span className="xp">+{goal.xp} XP</span>
            {dl && <span style={dl.includes('超過') ? { color: 'var(--danger)' } : undefined}>{dl}</span>}
            {goal.deadline && <span>{formatJa(goal.deadline)}まで</span>}
          </div>
        </div>
        <button className="q-more" onClick={() => onSheet({ mode: 'edit', goal })} aria-label="編集"><IconMore size={18} /></button>
      </div>
      <div className="goal-progress">
        <div className="pbar"><div style={{ width: `${pct}%` }} /></div>
        <span className="pct">{pct}%</span>
        <button className="q-more" onClick={() => setOpen(!open)} aria-label="開閉"><IconChevron size={16} open={open} /></button>
      </div>
      {open && (
        <div className="sub-goals">
          {mids.map((mid) => {
            const smalls = kids.get(mid.id) ?? []
            const mp = Math.round(goalProgress(mid, kids) * 100)
            return (
              <div key={mid.id}>
                <GoalRow goal={mid} extra={`${mp}%`} onSheet={onSheet} today={g.today} />
                {smalls.map((s) => <GoalRow key={s.id} goal={s} onSheet={onSheet} today={g.today} />)}
                {!mid.done && (
                  <button className="add-child small" onClick={() => onSheet({ mode: 'add', level: 'small', parentId: mid.id })}>
                    <IconPlus size={13} /> 小目標を追加
                  </button>
                )}
              </div>
            )
          })}
          {!goal.done && (
            <button className="add-child" onClick={() => onSheet({ mode: 'add', level: 'mid', parentId: goal.id })}>
              <IconPlus size={14} /> 中目標を追加
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function confirmToggle(goal: WithId<Goal>) {
  const label = GOAL_LEVEL_LABEL[goal.level]
  if (goal.done) {
    if (confirm(`${label}「${goal.title}」の達成を取り消しますか？（-${goal.xp}XP）`)) toggleGoal(goal)
  } else if (confirm(`${label}「${goal.title}」を達成にしますか？（+${goal.xp}XP）`)) {
    toggleGoal(goal)
  }
}

function GoalRow({ goal, extra, onSheet, today }: { goal: WithId<Goal>; extra?: string; onSheet: (s: SheetState) => void; today: string }) {
  const dl = deadlineText(goal.deadline, today)
  return (
    <div className={`g-row ${goal.level}${goal.done ? ' done' : ''}`}>
      <button onClick={() => confirmToggle(goal)} aria-label="達成"><Check on={goal.done} /></button>
      <div className="t">
        {goal.title}
        {dl && !goal.done && <div className="help" style={{ marginTop: 2, color: dl.includes('超過') ? 'var(--danger)' : undefined }}>{dl}</div>}
      </div>
      {extra && <span className="mini">{extra}</span>}
      <span className="mini" style={{ color: 'var(--rank)' }}>+{goal.xp}</span>
      <button className="q-more" onClick={() => onSheet({ mode: 'edit', goal })} aria-label="編集"><IconMore size={16} /></button>
    </div>
  )
}

function GoalSheet({ state, onClose }: { state: SheetState; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [deadline, setDeadline] = useState('')
  const [lastKey, setLastKey] = useState<string | null>(null)

  const editing = state?.mode === 'edit' ? state.goal : null
  const level: GoalLevel | null = state ? (state.mode === 'edit' ? state.goal.level : state.level) : null
  const key = state ? (editing ? editing.id : `new-${state.mode === 'add' ? state.parentId : ''}-${level}`) : null
  if (key !== lastKey) {
    setLastKey(key)
    setTitle(editing?.title ?? '')
    setWhy(editing?.why ?? '')
    setDeadline(editing?.deadline ?? '')
  }
  if (!state || !level) return <Sheet open={false} onClose={onClose} en="">{null}</Sheet>

  const label = GOAL_LEVEL_LABEL[level]
  const childLevel = GOAL_CHILD_LEVEL[level]
  const placeholder = level === 'main' ? '例：年商3億の会社にする' : level === 'mid' ? '例：催事を月20現場に拡大する' : '例：新規代理店を3社開拓する'

  return (
    <Sheet open onClose={onClose} en={editing ? 'EDIT' : 'NEW'} ja={editing ? `${label}を編集` : `${label}を追加`}>
      <div className="field">
        <label>{label}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} autoFocus={!editing} />
      </div>
      {level === 'main' && (
        <div className="field">
          <label>なぜ達成したい？（任意）</label>
          <textarea className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="ここが本気になれる理由になる" />
        </div>
      )}
      <div className="field">
        <label>期限（任意）</label>
        <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <button
        className="btn"
        disabled={!title.trim()}
        onClick={() => {
          if (editing) editGoal(editing.id, { title, why, deadline })
          else if (state.mode === 'add') addGoal({ level, parentId: state.parentId, title, why, deadline })
          onClose()
        }}
      >
        {editing ? '保存する' : '登録する'}
      </button>
      {editing && (
        <button
          className="btn danger"
          style={{ marginTop: 8 }}
          onClick={() => {
            const note = childLevel ? `（配下の${GOAL_LEVEL_LABEL[childLevel]}も削除されます）` : ''
            if (confirm(`「${editing.title}」を削除しますか？${note}`)) {
              deleteGoal(editing.id)
              onClose()
            }
          }}
        >
          削除する
        </button>
      )}
    </Sheet>
  )
}
