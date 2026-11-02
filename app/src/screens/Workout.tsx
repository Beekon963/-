import { useState } from 'react'
import { STATUS_LABEL, dayLabel } from '../components/GymCard'
import { IconBack, IconClose, IconPlus } from '../components/Icons'
import { NumField } from '../components/NumField'
import {
  LOAD_LABEL, PROGRESSION_TEXT, WEIGHT_UNIT, previousFor, progression, setText, setValid, targetLabel, workingSets,
} from '../lib/gym'
import type { GymLoad, GymSession, GymSessionExercise, GymSet, WithId } from '../lib/types'
import {
  addSet, copyWeight, finishWorkout, removeSet, setLoad, swapExercise, updateExercise, updateSet, useGym,
} from '../store/gym'
import { startRest } from '../store/rest'
import { openGym, useUI } from '../store/ui'

const LOADS: GymLoad[] = ['machine', 'dumbbell', 'barbell', 'bodyweight']
const RIR = [0, 1, 2, 3, 4]

export const GUIDE = [
  'あと2〜3回できる余力を残す',
  '最初に5分くらい軽い運動をする',
  '最初の種目は軽い重量でウォームアップする',
  'ウォームアップは本番のセットと分けて記録する（＋ウォームアップ）',
  '痛みが出た種目は中止して確認する',
]

function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** 最初に、まだ予定のセットが終わっていない種目を開く */
function firstOpen(s: GymSession | undefined) {
  if (!s) return 0
  const i = s.exercises.findIndex((e) => workingSets(e).length < e.plannedSets)
  return i < 0 ? 0 : i
}

export function Workout() {
  const id = useUI((s) => s.workoutId)
  const gym = useGym()
  const session = gym.sessions.find((s) => s.id === id)
  const [index, setIndex] = useState(() => firstOpen(session))
  // ガイドは初めてのトレーニングのときだけ開いておく
  const [guide, setGuide] = useState(() =>
    session?.status === 'active' && !gym.sessions.some((s) => s.id !== id && (s.status === 'done' || s.status === 'partial')))
  const [result, setResult] = useState<GymSession['status'] | null>(null)

  if (!session || !id) {
    return (
      <div className="fade-in">
        <div className="page-title">
          <button className="back" onClick={() => openGym()} aria-label="戻る"><IconBack /></button>
          <div><h1>WORKOUT</h1><div className="ja">トレーニング</div></div>
        </div>
        <div className="sec"><div className="empty">この記録は見つかりません（削除された可能性があります）</div></div>
      </div>
    )
  }

  if (result) return <ResultView session={session} status={result} />

  const editing = session.status !== 'active'
  const e = session.exercises[Math.min(index, session.exercises.length - 1)]
  const exIndex = session.exercises.indexOf(e)
  const elapsed = Math.max(0, Math.round((Date.now() - session.startedAt) / 60000))

  const finish = () => {
    const status = finishWorkout(id)
    if (status) setResult(status)
    else openGym('history')
  }

  return (
    <div className="fade-in workout">
      <div className="page-title">
        <button className="back" onClick={() => openGym(editing ? 'history' : 'week')} aria-label="戻る"><IconBack /></button>
        <div style={{ minWidth: 0 }}>
          <h1 className="wo-title">{session.menuName}</h1>
          <div className="ja">
            {dayLabel(session.date)} ・ {editing ? `${STATUS_LABEL[session.status]}の記録を編集` : `${elapsed}分経過 ・ 目安${session.minutes}分`}
            {session.intro && ' ・ 導入期間'}
          </div>
        </div>
        <button className="wo-finish right" onClick={finish}>{editing ? '保存' : '終了'}</button>
      </div>

      <div className="sec" style={{ marginBottom: 10 }}>
        <button className="toggle-link" onClick={() => setGuide(!guide)}>基本ガイド {guide ? '▲' : '▼'}</button>
        {guide && (
          <ul className="wo-guide">
            {GUIDE.map((t) => <li key={t}>{t}</li>)}
            {session.intro && <li>導入期間は各種目2セット（つらければ × で1セットに）</li>}
          </ul>
        )}
      </div>

      <div className="scroll-x wo-steps">
        <div className="chips">
          {session.exercises.map((x, i) => {
            const n = workingSets(x).length
            return (
              <button key={i} className={`chip${i === exIndex ? ' on' : ''}${n >= x.plannedSets ? ' ok' : ''}`} onClick={() => setIndex(i)}>
                {i + 1}. {x.name}{n >= x.plannedSets ? ' ✓' : n > 0 ? ` ${n}/${x.plannedSets}` : ''}
              </button>
            )
          })}
        </div>
      </div>

      <ExerciseCard key={`${exIndex}-${e.key}`} sessions={gym.sessions} session={{ ...session, id }} e={e} exIndex={exIndex} />

      <div className="sec wo-nav">
        <button className="btn ghost" disabled={exIndex === 0} onClick={() => { setIndex(exIndex - 1); window.scrollTo({ top: 0 }) }}>‹ 前の種目</button>
        {exIndex < session.exercises.length - 1 ? (
          <button className="btn" onClick={() => { setIndex(exIndex + 1); window.scrollTo({ top: 0 }) }}>次の種目 ›</button>
        ) : (
          <button className="btn" onClick={finish}>{editing ? '保存する' : 'トレーニングを終了'}</button>
        )}
      </div>
    </div>
  )
}

function ExerciseCard({ sessions, session, e, exIndex }: {
  sessions: WithId<GymSession>[]; session: WithId<GymSession>; e: GymSessionExercise; exIndex: number
}) {
  const id = session.id
  const prev = previousFor(sessions, session, e)
  const prevWeight = prev && e.load !== 'bodyweight' ? prev.sets[0]?.weight ?? null : null
  const [hint, setHint] = useState<number | null>(null)
  const prog = progression(session, e)
  let workNo = 0

  const toggleDone = (i: number, s: GymSet) => {
    if (s.done) {
      updateSet(id, exIndex, i, { done: false })
      return
    }
    if (!setValid(e, s)) {
      setHint(i)
      return
    }
    setHint(null)
    updateSet(id, exIndex, i, { done: true })
  }

  return (
    <div className="sec">
      <div className="wo-card">
        <div className="wo-name">{e.name}</div>
        <div className="wo-target">
          {targetLabel(e)} × {e.plannedSets}セット{session.intro ? '（導入期間）' : ''}
          {e.swappedFrom && <span className="wo-tag">{e.swappedFrom}から変更</span>}
        </div>

        <div className="chips wo-loads" role="radiogroup" aria-label="重量の条件">
          {LOADS.map((l) => (
            <button key={l} className={`chip${e.load === l ? ' on' : ''}`} aria-pressed={e.load === l} onClick={() => setLoad(id, exIndex, l)}>
              {LOAD_LABEL[l]}
            </button>
          ))}
        </div>
        {e.load === 'machine' && (
          <input
            className="input wo-machine" value={e.machine ?? ''} placeholder="機器名（任意・例：テクノジム）"
            onChange={(ev) => updateExercise(id, exIndex, (x) => ({ ...x, machine: ev.target.value }))}
          />
        )}
        {e.alt && (
          <button className="btn-sm wo-alt" onClick={() => swapExercise(id, exIndex)}>{e.alt.name}に変える</button>
        )}

        <div className="wo-prev">
          {prev ? (
            <>
              <div>
                <span className="wo-prev-k">前回 {dayLabel(prev.date)}</span>
                {prev.sets.map((s) => setText(e, s).replace(/^自重 × /, '')).join(' / ')}
              </div>
              {prevWeight != null && (
                <button className="btn-sm accent" onClick={() => copyWeight(id, exIndex, prevWeight)}>前回の重量をコピー</button>
              )}
            </>
          ) : (
            <span className="wo-prev-k">同じ条件の前回の記録はまだありません</span>
          )}
        </div>

        <div className="wset-h">
          <span />
          {e.load !== 'bodyweight' && <span>{WEIGHT_UNIT[e.load]}</span>}
          {e.kind === 'perSide' ? <><span>左（回）</span><span>右（回）</span></> : <span>{e.kind === 'seconds' ? '秒' : '回'}</span>}
          <span>完了</span>
        </div>
        {e.sets.map((s, i) => {
          if (!s.warmup) workNo++
          const no = s.warmup ? 'W' : String(workNo)
          const before = !s.warmup && prev ? prev.sets[workNo - 1] : undefined
          const cols = 2 + (e.load !== 'bodyweight' ? 1 : 0) + (e.kind === 'perSide' ? 2 : 1)
          return (
            <div key={i} className={`wset-wrap${s.done ? ' done' : ''}${s.warmup ? ' warm' : ''}`}>
              <div className="wset" style={{ gridTemplateColumns: `30px repeat(${cols - 2}, 1fr) 56px 26px` }}>
                <span className="ws-no">{no}</span>
                {e.load !== 'bodyweight' && (
                  <NumField decimal label={`${no}セット目の重量`} value={s.weight} placeholder={before?.weight != null ? String(before.weight) : 'kg'}
                    onChange={(v) => updateSet(id, exIndex, i, { weight: v })} />
                )}
                {e.kind === 'seconds' ? (
                  <NumField label={`${no}セット目の秒数`} value={s.seconds} placeholder={before?.seconds != null ? String(before.seconds) : '秒'}
                    onChange={(v) => updateSet(id, exIndex, i, { seconds: v })} />
                ) : e.kind === 'perSide' ? (
                  <>
                    <NumField label={`${no}セット目の左の回数`} value={s.repsL} placeholder={before?.repsL != null ? String(before.repsL) : '左'}
                      onChange={(v) => updateSet(id, exIndex, i, { repsL: v })} />
                    <NumField label={`${no}セット目の右の回数`} value={s.repsR} placeholder={before?.repsR != null ? String(before.repsR) : '右'}
                      onChange={(v) => updateSet(id, exIndex, i, { repsR: v })} />
                  </>
                ) : (
                  <NumField label={`${no}セット目の回数`} value={s.reps} placeholder={before?.reps != null ? String(before.reps) : '回'}
                    onChange={(v) => updateSet(id, exIndex, i, { reps: v })} />
                )}
                <button className="ws-check" aria-pressed={s.done} aria-label={`${no}セット目を完了`} onClick={() => toggleDone(i, s)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="4 12 10 18 20 6" /></svg>
                </button>
                <button className="ws-del" aria-label={`${no}セット目を削除`} onClick={() => removeSet(id, exIndex, i)}><IconClose size={14} /></button>
              </div>
              {before && <div className="ws-prev">前回 {setText(e, before)}</div>}
              {hint === i && !s.done && (
                <div className="ws-hint">{e.load === 'bodyweight' ? '' : '重量と'}{e.kind === 'seconds' ? '秒数' : '回数'}を入れてからチェック（自重なら上で「自重」）</div>
              )}
              {s.done && !s.warmup && (
                <div className="ws-after">
                  <span className="ws-rir-k">余力</span>
                  {RIR.map((r) => (
                    <button key={r} className={`ws-rir${s.rir === r ? ' on' : ''}`} onClick={() => updateSet(id, exIndex, i, { rir: s.rir === r ? null : r })}>
                      {r === 4 ? '4+' : r}
                    </button>
                  ))}
                  <button className="ws-rest" onClick={() => startRest(e.restSec, e.name)}>休憩 {mmss(e.restSec)}</button>
                </div>
              )}
            </div>
          )
        })}
        <div className="wset-add">
          <button className="btn-sm" onClick={() => addSet(id, exIndex)}><IconPlus size={14} /> セット</button>
          <button className="btn-sm" onClick={() => addSet(id, exIndex, true)}><IconPlus size={14} /> ウォームアップ</button>
        </div>

        {prog && <div className={`wo-prog ${prog}`}>{PROGRESSION_TEXT[prog]}</div>}

        <div className="field" style={{ marginTop: 14 }}>
          <label>メモ（任意）</label>
          <textarea className="input wo-note" value={e.note ?? ''} placeholder="フォーム・シートの位置など"
            onChange={(ev) => updateExercise(id, exIndex, (x) => ({ ...x, note: ev.target.value }))} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>痛み・違和感（任意）</label>
          <input className="input" value={e.pain ?? ''} placeholder="あれば中止して確認"
            onChange={(ev) => updateExercise(id, exIndex, (x) => ({ ...x, pain: ev.target.value }))} />
        </div>
      </div>
    </div>
  )
}

function ResultView({ session, status }: { session: WithId<GymSession>; status: GymSession['status'] }) {
  return (
    <div className="fade-in">
      <div className="page-title">
        <div><h1>{status === 'done' ? 'COMPLETE' : 'SAVED'}</h1><div className="ja">{session.menuName} ・ {STATUS_LABEL[status]}</div></div>
      </div>
      <div className="sec">
        {session.exercises.map((e, i) => {
          const sets = workingSets(e)
          const prog = progression(session, e)
          return (
            <div key={i} className="wr-row">
              <div className="wr-name">{e.name}<span>{sets.length}/{e.plannedSets}セット</span></div>
              {sets.length > 0 && <div className="wr-sets">{sets.map((s) => setText(e, s)).join(' / ')}</div>}
              {prog && <div className={`wo-prog ${prog}`}>{PROGRESSION_TEXT[prog]}</div>}
              {e.pain?.trim() && <div className="wr-pain">痛み・違和感：{e.pain}</div>}
            </div>
          )
        })}
        <button className="btn" style={{ marginTop: 16 }} onClick={() => openGym('history')}>記録を見る</button>
      </div>
    </div>
  )
}
