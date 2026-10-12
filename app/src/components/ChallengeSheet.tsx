import { useState } from 'react'
import { CHALLENGE_RESULT_LABEL } from '../lib/defaults'
import type { Challenge, ChallengeResult, PostStatus, WithId } from '../lib/types'
import { deleteChallenge, saveChallenge, type Game } from '../store/game'
import { GoalSelect } from './forms'
import { Sheet } from './Sheet'

const POST_LABEL: Record<PostStatus, string> = { none: '発信しない', idea: 'ネタ帳に入れる', posted: '発信した' }

/** target: null = 閉じる / 'new' = 新規 / それ以外 = 編集 */
export function ChallengeSheet({ g, target, onClose }: { g: Game; target: WithId<Challenge> | 'new' | null; onClose: () => void }) {
  const editing = target && target !== 'new' ? target : null
  const [title, setTitle] = useState('')
  const [result, setResult] = useState<ChallengeResult>('success')
  const [learning, setLearning] = useState('')
  const [goalId, setGoalId] = useState('')
  const [post, setPost] = useState<PostStatus>('idea')
  const [lastKey, setLastKey] = useState<string | null>(null)

  const key = target ? (editing ? editing.id : 'new') : null
  if (key !== lastKey) {
    setLastKey(key)
    setTitle(editing?.title ?? '')
    setResult(editing?.result ?? 'success')
    setLearning(editing?.learning ?? '')
    setGoalId(editing?.goalId ?? '')
    setPost(editing?.post ?? 'idea')
  }

  const rules = g.config.rules
  const gain = (editing ? 0 : rules.challenge) + (post === 'posted' && editing?.post !== 'posted' ? rules.post : 0)

  return (
    <Sheet open={!!target} onClose={onClose} en="CHALLENGE" ja={editing ? '挑戦ログを編集' : '挑戦を記録'}>
      <div className="field">
        <label>何に挑戦した？</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：初めて自分の顔出しで動画を撮った" autoFocus={!editing} />
      </div>
      <div className="field">
        <label>結果（失敗も1回の挑戦）</label>
        <div className="chips">
          {(Object.keys(CHALLENGE_RESULT_LABEL) as ChallengeResult[]).map((r) => (
            <button key={r} className={`chip res-${r}${result === r ? ' on' : ''}`} onClick={() => setResult(r)}>{CHALLENGE_RESULT_LABEL[r]}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>学び・気づき</label>
        <textarea className="input" value={learning} onChange={(e) => setLearning(e.target.value)} placeholder="次はこうする。やってみて分かったこと。" />
      </div>
      <div className="field">
        <label>どの目標につながる？</label>
        <GoalSelect goals={g.goals} value={goalId} onChange={setGoalId} />
      </div>
      <div className="field">
        <label>発信</label>
        <div className="chips">
          {(Object.keys(POST_LABEL) as PostStatus[]).map((p) => (
            <button key={p} className={`chip${post === p ? ' on' : ''}`} onClick={() => setPost(p)}>{POST_LABEL[p]}</button>
          ))}
        </div>
        <p className="help">ネタ帳に入れると、挑戦タブから投稿文をコピーできます。発信したら +{rules.post} XP。</p>
      </div>
      <button
        className="btn"
        disabled={!title.trim()}
        onClick={() => {
          saveChallenge(editing?.id ?? null, { title, result, learning, goalId, post })
          onClose()
        }}
      >
        {editing ? '保存する' : '記録する'}{gain > 0 ? `（+${gain} XP）` : ''}
      </button>
      {editing && (
        <button
          className="btn danger"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm('この挑戦ログを削除しますか？')) {
              deleteChallenge(editing.id)
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
