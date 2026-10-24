import { useState } from 'react'
import { burst, buzz, centerOf, floatText } from '../lib/fx'
import { MAX_DAILY_QUESTS, TASK_BOXES } from '../lib/defaults'
import type { Task, TaskBox, WithId } from '../lib/types'
import { addTask, deleteTask, editTask, taskToQuest, toggleTask, type Game } from '../store/game'
import { IconPlus } from './Icons'
import { Sheet } from './Sheet'

/** ホームで1マスに見せる件数 */
const PREVIEW = 4

const COLOR: Record<TaskBox, string> = {
  now: 'var(--danger)',
  key: 'var(--atk)',
  next: '#8fb3da',
  someday: 'var(--sub)',
}

// 完了のパーティクルは CSS 変数ではなく実際の色で出す
const BURST: Record<TaskBox, string> = { now: '#ff4655', key: '#ff8c1a', next: '#8fb3da', someday: '#8b95a5' }

const boxDef = (box: TaskBox) => TASK_BOXES.find((b) => b.box === box)!

function taskXp(g: Game, box: TaskBox) {
  return box === 'key' ? g.config.rules.taskKey : g.config.rules.taskOther
}

/** 完了のチェックと演出（ボードとマスの一覧で共通） */
function onCheck(g: Game, t: WithId<Task>, el: HTMLElement) {
  if (!toggleTask(t)) return
  const c = centerOf(el)
  burst(c.x, c.y, BURST[t.box], t.box === 'key' ? 16 : 8, t.box === 'key' ? 0.8 : 0.5)
  const xp = taskXp(g, t.box)
  if (xp) floatText(c.x + 24, c.y - 6, `+${xp}`, BURST[t.box])
  buzz(15)
}

function TaskItem({ g, t, onEdit }: { g: Game; t: WithId<Task>; onEdit: () => void }) {
  return (
    <div className={`titem${t.done ? ' done' : ''}`}>
      <button
        className="tc" aria-pressed={t.done} aria-label={t.done ? '未完了に戻す' : '完了にする'}
        onClick={(e) => onCheck(g, t, e.currentTarget)}
      >
        {t.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#07090d" strokeWidth="4"><polyline points="4 12 10 18 20 6" /></svg>}
      </button>
      <button className="tt" onClick={onEdit}>{t.title}</button>
    </div>
  )
}

/** Yondo のような4マス：今すぐ・大切・先に・いつか */
export function TaskBoard({ g }: { g: Game }) {
  const [openBox, setOpenBox] = useState<TaskBox | null>(null)
  const [editing, setEditing] = useState<WithId<Task> | null>(null)
  const openCount = Object.values(g.taskBoard).reduce((n, list) => n + list.filter((t) => !t.done).length, 0)

  return (
    <section className="sec">
      <div className="sec-h">
        <span className="en">TASK BOARD</span><span className="ja">タスク</span>
        <span className="right"><b>{openCount}</b>件</span>
      </div>
      <div className="tboard">
        {TASK_BOXES.map(({ box, en, ja }) => {
          const list = g.taskBoard[box]
          const open = list.filter((t) => !t.done).length
          const hidden = list.length - PREVIEW
          return (
            <div key={box} className={`tq tq-${box}`} style={{ ['--c' as string]: COLOR[box] }}>
              <button className="tq-h" onClick={() => setOpenBox(box)}>
                <span className="ja">{ja}</span>
                <span className="en">{en}</span>
                <span className="n">{open || ''}</span>
                <span className="tq-add" aria-label={`${ja}に追加`}><IconPlus size={12} /></span>
              </button>
              {list.slice(0, PREVIEW).map((t) => (
                <TaskItem key={t.id} g={g} t={t} onEdit={() => setEditing(t)} />
              ))}
              {hidden > 0 && <button className="tq-more" onClick={() => setOpenBox(box)}>ほか{hidden}件</button>}
              {list.length === 0 && (
                <button className="tq-empty" onClick={() => setOpenBox(box)}>
                  {box === 'key' ? '目標に近づくタスク' : 'タップで追加'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="tb-foot">
        完了で 大切 +{g.config.rules.taskKey}XP ・ ほか +{g.config.rules.taskOther}XP。「大切」を1つ終えると連続日数もつながる。減点はなし
      </p>
      <BoxSheet g={g} box={openBox} onClose={() => setOpenBox(null)} onEdit={setEditing} />
      <TaskEditSheet g={g} task={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

/** 1マスの全部のタスクと、続けて追加する入力欄 */
function BoxSheet({ g, box, onClose, onEdit }: {
  g: Game; box: TaskBox | null; onClose: () => void; onEdit: (t: WithId<Task>) => void
}) {
  const [title, setTitle] = useState('')
  const def = box ? boxDef(box) : null
  const list = box ? g.taskBoard[box] : []
  const add = () => {
    if (!box || !title.trim()) return
    addTask(title, box)
    setTitle('')
  }
  return (
    <Sheet open={!!box} onClose={onClose} en={def?.en ?? ''} ja={def?.ja}>
      {box && (
        <div className="tsheet" style={{ ['--c' as string]: COLOR[box] }}>
          <p className="help" style={{ marginTop: -6, marginBottom: 10 }}>
            {box === 'key' ? '目標に近づくタスク。' : ''}完了で +{taskXp(g, box)}XP{box === 'key' ? '・連続日数もつながる' : ''}
          </p>
          <div className="row">
            <input
              className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              placeholder={box === 'now' ? '例：日報の作成' : box === 'key' ? '例：新規の代理店に提案書を送る' : box === 'next' ? '例：テレアポ' : '例：SEOの勉強'}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && add()}
            />
            <button className="btn-sm accent" style={{ flex: '0 0 auto' }} onClick={add} disabled={!title.trim()}>
              <IconPlus size={14} /> 追加
            </button>
          </div>
          <div className="tlist">
            {list.length === 0 && <div className="empty" style={{ padding: '18px 0' }}>まだタスクがありません</div>}
            {list.map((t) => <TaskItem key={t.id} g={g} t={t} onEdit={() => onEdit(t)} />)}
          </div>
        </div>
      )}
    </Sheet>
  )
}

/** 名前の変更・別のマスへ移動・今日のクエストにする・削除 */
function TaskEditSheet({ g, task, onClose }: { g: Game; task: WithId<Task> | null; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [box, setBox] = useState<TaskBox>('now')
  const [lastId, setLastId] = useState<string | null>(null)
  const id = task?.id ?? null
  if (id !== lastId) {
    setLastId(id)
    if (task) {
      setTitle(task.title)
      setBox(task.box)
    }
  }
  const questsFull = g.todayQuests.length >= MAX_DAILY_QUESTS

  return (
    <Sheet open={!!task} onClose={onClose} en="EDIT TASK" ja="タスクを編集">
      {task && (
        <>
          <div className="field">
            <label>タスク</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>マス</label>
            <div className="chips tbox-pick">
              {TASK_BOXES.map((b) => (
                <button
                  key={b.box} className={`chip${box === b.box ? ' on' : ''}`} style={{ ['--c' as string]: COLOR[b.box] }}
                  onClick={() => setBox(b.box)}
                >
                  {b.ja}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn" disabled={!title.trim()}
            onClick={() => {
              editTask(task, { title, box })
              onClose()
            }}
          >
            保存する
          </button>
          {!task.done && (
            <button
              className="btn ghost" style={{ marginTop: 8 }} disabled={questsFull}
              onClick={() => {
                if (taskToQuest({ ...task, title: title.trim() || task.title })) onClose()
              }}
            >
              {questsFull ? '今日のクエストは3つ埋まっている' : '今日のクエストにする（A/B/C）'}
            </button>
          )}
          <button
            className="btn danger" style={{ marginTop: 8 }}
            onClick={() => {
              if (confirm('このタスクを削除しますか？')) {
                deleteTask(task.id)
                onClose()
              }
            }}
          >
            削除する
          </button>
        </>
      )}
    </Sheet>
  )
}
