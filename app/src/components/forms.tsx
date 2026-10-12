import { GOAL_LEVEL_LABEL } from '../lib/defaults'
import type { Goal, Stars, WithId, XpRules } from '../lib/types'

export const MINUTE_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240]

export function fmtMin(m: number) {
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}m`
  return r ? `${h}h${String(r).padStart(2, '0')}m` : `${h}h`
}

export function MinutesPick({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <div className="chips">
      {MINUTE_CHOICES.map((m) => (
        <button key={m} type="button" className={`chip${value === m ? ' on' : ''}`} onClick={() => onChange(m)}>
          {fmtMin(m)}
        </button>
      ))}
    </div>
  )
}

const STAR_LABEL = ['軽い', 'しっかり', '勝負どころ']

export function StarsPick({ value, onChange, rules }: { value: Stars; onChange: (s: Stars) => void; rules: XpRules }) {
  return (
    <div className="stars-pick">
      {([1, 2, 3] as Stars[]).map((s) => (
        <button key={s} type="button" className={value === s ? 'on' : ''} onClick={() => onChange(s)}>
          <div className="s">{'★'.repeat(s)}</div>
          <div className="x">+{rules.quest[s - 1]}</div>
          <div className="d">{STAR_LABEL[s - 1]}</div>
        </button>
      ))}
    </div>
  )
}

/** 未達成の目標をツリー順に並べたセレクト */
export function GoalSelect({ goals, value, onChange }: { goals: WithId<Goal>[]; value: string; onChange: (id: string) => void }) {
  const active = goals.filter((g) => !g.done)
  const ordered: { goal: WithId<Goal>; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const g of active.filter((x) => x.parentId === parentId)) {
      ordered.push({ goal: g, depth })
      walk(g.id, depth + 1)
    }
  }
  walk(null, 0)
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">紐づけない</option>
      {ordered.map(({ goal, depth }) => (
        <option key={goal.id} value={goal.id}>
          {'　'.repeat(depth)}
          {depth ? '└ ' : ''}[{GOAL_LEVEL_LABEL[goal.level]}] {goal.title}
        </option>
      ))}
    </select>
  )
}
