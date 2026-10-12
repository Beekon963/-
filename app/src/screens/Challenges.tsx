import { useMemo, useState } from 'react'
import { ChallengeSheet } from '../components/ChallengeSheet'
import { IconCopy, IconPlus } from '../components/Icons'
import { formatJa } from '../lib/date'
import { CHALLENGE_RESULT_LABEL } from '../lib/defaults'
import type { Challenge, WithId } from '../lib/types'
import { setPostStatus, useGame } from '../store/game'

type Filter = 'all' | 'success' | 'fail' | 'ongoing' | 'idea' | 'posted'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'success', label: '成功' },
  { id: 'fail', label: '失敗' },
  { id: 'ongoing', label: '途中' },
  { id: 'idea', label: '発信ネタ' },
  { id: 'posted', label: '発信済み' },
]

export function postDraft(c: Challenge, no: number) {
  return [
    `【挑戦 #${no}】${c.title}`,
    `結果：${CHALLENGE_RESULT_LABEL[c.result]}`,
    c.learning ? `学び：${c.learning}` : '',
    '',
    '#挑戦回数で人生は変わる',
  ].filter((line, i, all) => line || (i > 0 && all[i - 1])).join('\n')
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // クリップボードが使えない環境向け
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function Challenges() {
  const g = useGame()
  const [filter, setFilter] = useState<Filter>('all')
  const [sheet, setSheet] = useState<WithId<Challenge> | 'new' | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const logs = g.challengeLogs

  // 古い順の通し番号＝何回目の挑戦か
  const numbers = useMemo(() => {
    const map = new Map<string, number>()
    ;[...logs].reverse().forEach((c, i) => map.set(c.id, i + 1))
    return map
  }, [logs])

  const month = g.today.slice(0, 7)
  const thisMonth = logs.filter((c) => c.date.startsWith(month)).length
  const fails = logs.filter((c) => c.result === 'fail').length
  const ideas = logs.filter((c) => c.post === 'idea').length
  const list = logs.filter((c) =>
    filter === 'all' ? true : filter === 'idea' || filter === 'posted' ? c.post === filter : c.result === filter,
  )
  const goalTitle = (id?: string) => (id ? g.goals.find((x) => x.id === id)?.title : undefined)

  return (
    <div className="fade-in">
      <div className="page-title">
        <div>
          <h1>CHALLENGE</h1>
          <div className="ja">挑戦ログ ・ 成功も失敗も、1回の挑戦</div>
        </div>
        <button className="btn-sm accent right" onClick={() => setSheet('new')}><IconPlus size={14} /> 記録</button>
      </div>

      <div className="strip">
        <div className="stat xp"><div className="v">{logs.length}</div><div className="l">挑戦ログ 通算</div></div>
        <div className="stat"><div className="v">{thisMonth}</div><div className="l">今月</div></div>
        <div className="stat atk"><div className="v">{fails}</div><div className="l">失敗＝学んだ数</div></div>
      </div>

      <div className="sec">
        <div className="scroll-x" style={{ marginBottom: 12 }}>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.id} className={`chip${filter === f.id ? ' on' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}{f.id === 'idea' && ideas > 0 ? ` ${ideas}` : ''}
              </button>
            ))}
          </div>
        </div>

        {logs.length === 0 && (
          <div className="empty">
            <b>NO CHALLENGE YET</b>
            「やってみた」を1つ記録しよう。<br />うまくいかなくても、それは1回の挑戦。<br />学びはそのまま発信のネタになる。
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setSheet('new')}>挑戦を記録する</button>
          </div>
        )}
        {logs.length > 0 && list.length === 0 && <div className="empty">この条件の挑戦はまだありません</div>}

        {list.map((c) => {
          const no = numbers.get(c.id) ?? 0
          const goal = goalTitle(c.goalId)
          return (
            <div key={c.id} className="ch-item">
              <button className="ch-main" onClick={() => setSheet(c)}>
                <div className="ch-head">
                  <span className="ch-no">#{no}</span>
                  <span className="ch-date">{formatJa(c.date)}</span>
                  <span className={`ch-res res-${c.result}`}>{CHALLENGE_RESULT_LABEL[c.result]}</span>
                  {c.post === 'posted' && <span className="ch-post">発信済み</span>}
                  {c.post === 'idea' && <span className="ch-post idea">ネタ</span>}
                </div>
                <div className="ch-title">{c.title}</div>
                {c.learning && <div className="ch-learn">{c.learning}</div>}
                {goal && <div className="q-link" style={{ marginTop: 6 }}><i>◆</i>{goal}</div>}
              </button>
              <div className="ch-actions">
                {c.post === 'none' && (
                  <button className="btn-sm" onClick={() => setPostStatus(c, 'idea')}>ネタ帳に入れる</button>
                )}
                {c.post !== 'none' && (
                  <button
                    className="btn-sm"
                    onClick={async () => {
                      if (await copyText(postDraft(c, no))) {
                        setCopied(c.id)
                        setTimeout(() => setCopied((x) => (x === c.id ? null : x)), 1600)
                      }
                    }}
                  >
                    <IconCopy size={13} /> {copied === c.id ? 'コピーしました' : '投稿文をコピー'}
                  </button>
                )}
                {c.post === 'idea' && (
                  <button className="btn-sm accent" onClick={() => setPostStatus(c, 'posted')}>発信した +{g.config.rules.post}</button>
                )}
              </div>
            </div>
          )
        })}

        <p className="help" style={{ marginTop: 14 }}>
          挑戦ログ1件 +{g.config.rules.challenge} XP（結果に関係なく）・ 発信 +{g.config.rules.post} XP。
          ホームの「今日の挑戦」は、達成・着手したデイリーと挑戦ログの合計。
        </p>
      </div>

      <ChallengeSheet g={g} target={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}
