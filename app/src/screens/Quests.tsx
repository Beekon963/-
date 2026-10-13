import { useMemo, useState } from 'react'
import { Check, IconChevron, IconMore, IconPlus } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { daysBetween, formatJa } from '../lib/date'
import { GOAL_CHILD_LEVEL, GOAL_LEVEL_LABEL } from '../lib/defaults'
import { childrenMap, goalProgress } from '../lib/game'
import type { Goal, GoalLevel, WithId } from '../lib/types'
import { addGoal, deleteGoal, editGoal, toggleGoal, useGame, type Game } from '../store/game'
import { openPage } from '../store/ui'

type SheetState = { mode: 'add'; level: GoalLevel; parentId: string | null } | { mode: 'edit'; goal: WithId<Goal> } | null

export function Quests() {
  const g = useGame()
  const [sheet, setSheet] = useState<SheetState>(null)
  const [showCleared, setShowCleared] = useState(false)
  const kids = useMemo(() => childrenMap(g.goals), [g.goals])
  const mains = g.goals.filter((x) => x.level === 'main' && !x.parentId)
  const active = mains.filter((x) => !x.done)
  const cleared = mains.filter((x) => x.done)

  return (
    <div className="fade-in">
      <div className="page-title">
        <div>
          <h1>MAIN QUEST</h1>
          <div className="ja">大目標 → 中目標 → 小目標に分解して攻略する</div>
        </div>
        <button className="btn-sm accent right" onClick={() => setSheet({ mode: 'add', level: 'main', parentId: null })}>
          <IconPlus size={14} /> 大目標
        </button>
      </div>

      <div className="sec">
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
