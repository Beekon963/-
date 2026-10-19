import { useState } from 'react'
import { formatJa } from '../lib/date'
import type { DailyQuest, QuestKind, Stars, WithId } from '../lib/types'
import { addQuest, deleteQuest, editQuest, recentQuests, type Game } from '../store/game'
import { GoalSelect, StarsPick } from './forms'
import { Sheet } from './Sheet'

/** state.date を渡すと、その日（明日など）のクエストとして登録する */
export type QuestSheetState = { quest?: WithId<DailyQuest>; date?: string } | null

export function QuestSheet({ g, state, onClose }: { g: Game; state: QuestSheetState; onClose: () => void }) {
  const editing = state?.quest
  const date = editing?.date ?? state?.date ?? g.today
  const [title, setTitle] = useState('')
  const [stars, setStars] = useState<Stars>(2)
  const [goalId, setGoalId] = useState('')
  const [kind, setKind] = useState<QuestKind>('task')
  const [lastKey, setLastKey] = useState<string | null>(null)

  const key = state ? editing?.id ?? `new-${date}` : null
  if (key !== lastKey) {
    setLastKey(key)
    setTitle(editing?.title ?? '')
    setStars(editing?.stars ?? 2)
    setGoalId(editing?.goalId ?? '')
    setKind(editing?.kind ?? 'task')
  }

  const submit = () => {
    if (!title.trim()) return
    if (editing) editQuest(editing.id, { title, stars, goalId, kind })
    else addQuest({ title, stars, goalId, kind, date })
    onClose()
  }

  const recent = editing ? [] : recentQuests(g, date)
  const isToday = date === g.today
  const when = isToday ? '今日' : date === g.tomorrow ? '明日' : formatJa(date)

  return (
    <Sheet open={!!state} onClose={onClose} en={editing ? 'EDIT QUEST' : isToday ? 'NEW QUEST' : 'NEXT ROUND'} ja={`${when}のクエスト`}>
      <div className="field">
        <label>種類</label>
        <div className="chips">
          <button className={`chip${kind === 'task' ? ' on' : ''}`} onClick={() => setKind('task')}>タスク（やること）</button>
          <button className={`chip atk${kind === 'challenge' ? ' on' : ''}`} onClick={() => setKind('challenge')}>挑戦（初めてのこと）</button>
        </div>
      </div>
      <div className="field">
        <label>目標に効く行動</label>
        <input
          className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!editing}
          placeholder={kind === 'challenge' ? '例：顔出しでショート動画を1本撮る' : '例：新規の代理店2社にアポ打診'}
        />
        {recent.length > 0 && (
          <div className="scroll-x" style={{ marginTop: 8 }}>
            <div className="chips">
              {recent.map((q) => (
                <button
                  key={q.id} className="chip"
                  onClick={() => {
                    setTitle(q.title)
                    setStars(q.stars)
                    setGoalId(q.goalId ?? '')
                    setKind(q.kind ?? 'task')
                  }}
                >
                  {q.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="field">
        <label>難易度</label>
        <StarsPick value={stars} onChange={setStars} rules={g.config.rules} />
      </div>
      <div className="field">
        <label>どの目標に効く？</label>
        <GoalSelect goals={g.goals} value={goalId} onChange={setGoalId} />
        {g.goals.length === 0 && <div className="help">クエストタブで大目標を登録すると、ここで紐づけられます。</div>}
      </div>
      <button className="btn" disabled={!title.trim()} onClick={submit}>{editing ? '保存する' : isToday ? 'クエストを受注' : `${when}の作戦に入れる`}</button>
      {editing && (
        <button
          className="btn danger"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm('このクエストを削除しますか？')) {
              deleteQuest(editing.id)
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
