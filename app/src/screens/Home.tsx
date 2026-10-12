import { useMemo, useState } from 'react'
import { ChallengeSheet } from '../components/ChallengeSheet'
import { Check, IconAlert, IconBolt, IconChevron, IconClose, IconFlame, IconGear, IconMore, IconPlus } from '../components/Icons'
import { GoalSelect, MinutesPick, StarsPick, fmtMin } from '../components/forms'
import { RankHero } from '../components/RankHero'
import { Sheet } from '../components/Sheet'
import { formatDot, localDate } from '../lib/date'
import { MAX_DAILY_QUESTS } from '../lib/defaults'
import { attackPct, personStatus, startedXp } from '../lib/game'
import type { ActivityKind, DailyQuest, Stars, WithId } from '../lib/types'
import { useCloud } from '../store/cloud'
import {
  addQuest, deleteActivity, deleteQuest, editQuest, logActivity, saveReview, setConditionCleared, setRestDay,
  toggleQuest, toggleStarted, useGame, type Game,
} from '../store/game'
import { openPage, useUI } from '../store/ui'

export function Home() {
  const g = useGame()
  const [questSheet, setQuestSheet] = useState<{ quest?: WithId<DailyQuest> } | null>(null)
  const [timeFor, setTimeFor] = useState<WithId<DailyQuest> | null>(null)
  const [logKind, setLogKind] = useState<ActivityKind | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [showActs, setShowActs] = useState(false)
  const [challengeOpen, setChallengeOpen] = useState(false)

  const s = g.todayStat
  const pct = attackPct(s)
  const net = s.gain + s.loss
  const hour = new Date().getHours()
  const night = hour >= 18 || hour < g.config.dayStartHour
  const doneCount = g.todayQuests.filter((q) => q.done).length

  return (
    <div className="fade-in">
      <TopBar g={g} />
      <MissionStrip g={g} onChallenge={() => setChallengeOpen(true)} />
      <RankHero rank={g.rank} total={g.total} onClick={() => openPage('ranks')} />

      {g.rank.promotion && <PromotionPanel g={g} />}

      {g.isRestDay && (
        <div className="rest-banner">
          <b>REST DAY</b> 今日は休息日（ペナルティなし）
          <button onClick={() => setRestDay(false)}>取り消す</button>
        </div>
      )}

      <div className="strip">
        <div className={`stat xp${net < 0 ? ' neg' : ''}`}>
          <div className="v">{net >= 0 ? '+' : ''}{net}</div>
          <div className="l">今日の獲得XP</div>
        </div>
        <div className="stat">
          <div className="v">{doneCount}<small>/{g.todayQuests.length || MAX_DAILY_QUESTS}</small></div>
          <div className="l">クエスト達成</div>
        </div>
        <div className="stat atk">
          <div className="v">{pct ?? '--'}<small>%</small></div>
          <div className="l">攻め率</div>
        </div>
      </div>

      {/* TODAY'S QUESTS */}
      <section className="sec">
        <div className="sec-h">
          <span className="en">TODAY'S QUESTS</span><span className="ja">今日のクエスト</span>
          <span className="right"><b>{doneCount}</b>/{g.todayQuests.length || MAX_DAILY_QUESTS}</span>
        </div>
        {g.todayQuests.map((q) => (
          <QuestCard
            key={q.id}
            q={q}
            goalTitle={g.goals.find((x) => x.id === q.goalId)?.title}
            onToggle={() => {
              if (toggleQuest(q)) setTimeFor(q)
            }}
            onMore={() => setQuestSheet({ quest: q })}
            onStart={() => toggleStarted(q)}
            startedXp={startedXp(q, g.config.rules)}
          />
        ))}
        {g.todayQuests.length < MAX_DAILY_QUESTS && (
          <button className="slot" onClick={() => setQuestSheet({})}>
            <IconPlus size={16} /> クエストを追加（あと{MAX_DAILY_QUESTS - g.todayQuests.length}つ）
          </button>
        )}
        <div className={`perfect${g.todayQuests.length === MAX_DAILY_QUESTS && doneCount === MAX_DAILY_QUESTS ? ' got' : ''}`}>
          <b>PERFECT</b> 3つ全クリアでボーナス <span className="x">+{g.config.rules.perfectBonus} XP</span>
        </div>
        {!g.isRestDay && (
          <div className="warn-note">
            <IconAlert size={14} />
            {g.todayQuests.length === 0
              ? `未設定のまま日付が変わると −${g.config.rules.penaltyNoQuest}XP（不戦敗）`
              : `手をつけていないクエストは、日付が変わると1つにつき −${g.config.rules.penaltyMissedQuest}XP。途中でも「着手」を押せばペナルティなし`}
          </div>
        )}
      </section>

      {/* ATTACK / DEFENSE */}
      <section className="sec">
        <div className="sec-h"><span className="en">ATTACK / DEFENSE</span><span className="ja">攻めと守り</span></div>
        <div className="ratio">
          <div className="ratio-head">
            <div className="side a"><div className="lbl">攻め</div><div className="t">{fmtMinHud(s.attackMin)}</div></div>
            <div className="ratio-mid"><div className="pct">{pct ?? '--'}<small>%</small></div><div className="cap">攻め率</div></div>
            <div className="side d"><div className="lbl">守り</div><div className="t">{fmtMinHud(s.defenseMin)}</div></div>
          </div>
          <div className="rbar">
            <div className="a" style={{ width: `${pct ?? 0}%`, display: pct ? undefined : 'none' }} />
            <div className="d" />
            <div className="tgt" style={{ left: `${g.config.attackTargetPct}%` }} data-label={`目標 ${g.config.attackTargetPct}%`} />
          </div>
          <div className="ratio-foot">{ratioMessage(s.attackMin, s.defenseMin, g.config.attackTargetPct)}</div>
          {g.todayActivities.length > 0 && (
            <>
              <button className="toggle-link" onClick={() => setShowActs(!showActs)}>
                今日の記録 {g.todayActivities.length}件 <IconChevron size={14} open={showActs} />
              </button>
              {showActs && (
                <div className="acts">
                  {g.todayActivities.map((a) => (
                    <div key={a.id} className="act-row">
                      <span className={`k ${a.kind}`} />
                      <span className="t">{a.title}</span>
                      <span className="m">{fmtMin(a.minutes)}</span>
                      <span className="x">+{a.xp}</span>
                      <button className="del" aria-label="削除" onClick={() => confirm('この記録を削除しますか？') && deleteActivity(a.id)}>
                        <IconClose size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="log-btns">
          <button className="log-btn a" onClick={() => setLogKind('attack')}>＋ 攻めを記録 <small>目標に効く行動</small></button>
          <button className="log-btn d" onClick={() => setLogKind('defense')}>＋ 守りを記録 <small>こなす業務</small></button>
        </div>
      </section>

      {/* REVIEW */}
      <section className="sec">
        <div className="sec-h"><span className="en">DEBRIEF</span><span className="ja">今日の振り返り</span></div>
        <button className={`review-card${night && !g.todayReview ? ' night' : ''}`} onClick={() => setReviewOpen(true)}>
          <div style={{ minWidth: 0 }}>
            <div className="t">{g.todayReview ? '振り返り済み' : '1日を締めくくる'}</div>
            <div className="s" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.todayReview ? g.todayReview.comment || '（コメントなし）' : `一言書いて今日の戦績を確定 +${g.config.rules.review}XP`}
            </div>
          </div>
          <span className="go">{g.todayReview ? 'EDIT' : 'GO ›'}</span>
        </button>
      </section>

      <SquadAlerts g={g} />

      {!g.isRestDay && (
        <div className="rest-row">
          今日は休む？
          {g.restsLeft > 0 ? (
            <button onClick={() => confirm('今日を休息日にしますか？（ペナルティなし・連続日数も途切れません）') && setRestDay(true)}>
              休息日にする（今週あと{g.restsLeft}回）
            </button>
          ) : (
            <span>今週の休息日は使い切りました</span>
          )}
        </div>
      )}

      <QuestSheet g={g} state={questSheet} onClose={() => setQuestSheet(null)} />
      <TimeSheet quest={timeFor} onClose={() => setTimeFor(null)} />
      <LogSheet g={g} kind={logKind} onClose={() => setLogKind(null)} />
      <ReviewSheet g={g} open={reviewOpen} onClose={() => setReviewOpen(false)} />
      <ChallengeSheet g={g} target={challengeOpen ? 'new' : null} onClose={() => setChallengeOpen(false)} />
    </div>
  )
}

function fmtMinHud(m: number) {
  const h = Math.floor(m / 60)
  const r = m % 60
  return (
    <>
      {h}<small>h</small>{String(r).padStart(2, '0')}<small>m</small>
    </>
  )
}

function ratioMessage(atk: number, def: number, target: number) {
  if (atk + def === 0) return '今日の行動を記録しよう。目標に効く行動＝攻め、こなすだけの業務＝守り。'
  // atk / (atk + def + x) >= target → x = atk*(100-target)/target - def … 攻めを足す場合
  const needAtk = Math.ceil((target * (atk + def) - 100 * atk) / (100 - target))
  if (needAtk <= 0) return '攻め率は目標クリア。この調子で攻め続けろ。'
  return `目標まで、攻めをあと ${fmtMin(Math.ceil(needAtk / 15) * 15)}（守りの業務はXPがほぼ入らない）`
}

/** 「何のために頑張るのか」を毎日目に入れる */
function MissionStrip({ g, onChallenge }: { g: Game; onChallenge: () => void }) {
  const c = g.challenges
  const diff = c.today - c.yesterday
  return (
    <div className="mission-strip">
      <button className="body" onClick={() => openPage('vision')}>
        <div className="m">{g.vision?.mission || '人生の目標を書いて、毎日の行動とつなげよう'}</div>
        <div className="c">
          今日の挑戦<b>{c.today}</b>回 ・ 昨日 {c.yesterday}回
          {diff > 0 ? <span className="up"> ・ 昨日超え</span> : c.today > 0 && diff === 0 ? ' ・ 昨日に並んだ' : ` ・ 通算 ${c.total}回`}
        </div>
      </button>
      <button className="ms-add" onClick={onChallenge} aria-label="挑戦を記録">
        <IconBolt size={16} />挑戦
      </button>
    </div>
  )
}

function TopBar({ g }: { g: Game }) {
  const { syncState, auth } = useCloud()
  const dot = auth !== 'signedIn' ? '' : syncState === 'syncing' ? 'syncing' : syncState === 'error' ? 'error' : 'ok'
  return (
    <header className="top">
      <div>
        <div className="logo">LIFE <b>RANKED</b></div>
        <div className="date">{formatDot(g.today)}</div>
      </div>
      <div className="top-r">
        {g.streak > 0 && (
          <div className="streak" title="連続達成">
            <IconFlame /><span>{g.streak}</span><small>日連続</small>
          </div>
        )}
        <button className="icon-btn" style={{ position: 'relative' }} aria-label="設定" onClick={() => openPage('settings')}>
          <IconGear />
          {dot && <span className={`sync-dot ${dot}`} />}
        </button>
      </div>
    </header>
  )
}

interface QuestCardProps {
  q: WithId<DailyQuest>
  goalTitle?: string
  startedXp: number
  onToggle: () => void
  onStart: () => void
  onMore: () => void
}

function QuestCard({ q, goalTitle, startedXp, onToggle, onStart, onMore }: QuestCardProps) {
  const started = !q.done && !!q.started
  return (
    <div className={`quest${q.done ? ' done' : started ? ' started' : ''}`}>
      <button className="quest-main" onClick={onToggle} aria-pressed={q.done}>
        <Check on={q.done} half={started} />
        <span className="q-body">
          <span className="q-title">{q.title}</span>
          {goalTitle && <span className="q-link"><i>◆</i>{goalTitle}</span>}
        </span>
        <span className="q-xp">
          <span className="stars">{'★'.repeat(q.stars)}</span>
          <span className="x">+{started ? startedXp : q.xp}</span>
        </span>
      </button>
      {!q.done && (
        <button className={`q-start${started ? ' on' : ''}`} onClick={onStart} aria-pressed={started}>
          {started ? '着手済' : '着手'}
        </button>
      )}
      <button className="q-more" aria-label="編集" onClick={onMore}><IconMore size={18} /></button>
    </div>
  )
}

function PromotionPanel({ g }: { g: Game }) {
  const promo = g.rank.promotion!
  const target = promo.target
  return (
    <div className="promo">
      <div className="promo-h">
        <span className="en">PROMOTION MATCH</span>
        <span className="to" style={{ color: target.color }}>→ {target.name}</span>
      </div>
      <p>XPは足りている。残りの昇格条件をクリアしたら、自分でチェックを入れろ。</p>
      {target.conditions.map((c) => (
        <button
          key={c.id}
          className={`cond${c.cleared ? ' done' : ''}`}
          onClick={() => {
            if (c.cleared) setConditionCleared(target.id, c.id, false)
            else if (confirm(`「${c.text}」\n本当にクリアした？`)) setConditionCleared(target.id, c.id, true)
          }}
        >
          <Check on={c.cleared} />
          <span>{c.text}</span>
        </button>
      ))}
    </div>
  )
}

function SquadAlerts({ g }: { g: Game }) {
  const alerts = useMemo(() => {
    return g.persons
      .map((p) => {
        const st = personStatus(p, g.contacts.filter((c) => c.personId === p.id), g.today, localDate(p.createdAt))
        return { p, st }
      })
      .filter(({ st }) => st.overdue || st.actionDue)
      .sort((a, b) => b.st.urgency - a.st.urgency)
      .slice(0, 3)
  }, [g.persons, g.contacts, g.today])

  if (alerts.length === 0) return null
  return (
    <section className="sec">
      <div className="sec-h"><span className="en">SQUAD</span><span className="ja">連絡すべき人</span></div>
      {alerts.map(({ p, st }) => (
        <button key={p.id} className="contact" onClick={() => useUI.setState({ tab: 'squad', focusPerson: p.id, page: null })}>
          <div className="avatar">{p.name.slice(0, 1)}</div>
          <div className="c-body">
            <div className="c-name">{p.name}<span className="tag">{p.category}</span></div>
            <div className="c-next">{p.nextAction ? `次：${p.nextAction}` : st.lastDate ? '近況を聞いてみよう' : 'まだ連絡の記録がありません'}</div>
          </div>
          {st.actionDue ? (
            <div className="c-days due"><div className="n">{p.nextActionDue === g.today ? '今日' : '期限切れ'}</div><div className="u">期日</div></div>
          ) : (
            <div className="c-days warn"><div className="n">{st.daysSince}</div><div className="u">日 連絡なし</div></div>
          )}
        </button>
      ))}
    </section>
  )
}

// ---------- sheets ----------

function QuestSheet({ g, state, onClose }: { g: Game; state: { quest?: WithId<DailyQuest> } | null; onClose: () => void }) {
  const editing = state?.quest
  const [title, setTitle] = useState('')
  const [stars, setStars] = useState<Stars>(2)
  const [goalId, setGoalId] = useState('')
  const [lastKey, setLastKey] = useState<string | null>(null)

  const key = state ? editing?.id ?? 'new' : null
  if (key !== lastKey) {
    setLastKey(key)
    setTitle(editing?.title ?? '')
    setStars(editing?.stars ?? 2)
    setGoalId(editing?.goalId ?? '')
  }

  const submit = () => {
    if (!title.trim()) return
    if (editing) editQuest(editing.id, { title, stars, goalId })
    else addQuest({ title, stars, goalId })
    onClose()
  }

  return (
    <Sheet open={!!state} onClose={onClose} en={editing ? 'EDIT QUEST' : 'NEW QUEST'} ja={editing ? 'クエストを編集' : '今日のクエスト'}>
      <div className="field">
        <label>目標に効く行動</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：新規の代理店2社にアポ打診" autoFocus={!editing} />
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
      <button className="btn" disabled={!title.trim()} onClick={submit}>{editing ? '保存する' : 'クエストを受注'}</button>
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

function TimeSheet({ quest, onClose }: { quest: WithId<DailyQuest> | null; onClose: () => void }) {
  return (
    <Sheet open={!!quest} onClose={onClose} en="QUEST CLEAR" ja="かかった時間を攻めに記録">
      <p className="help" style={{ marginTop: -6, marginBottom: 12 }}>
        「{quest?.title}」にかけた時間を記録すると、攻め率とXPに反映されます。
      </p>
      <MinutesPick
        value={0}
        onChange={(m) => {
          if (quest) logActivity({ kind: 'attack', title: quest.title, minutes: m, goalId: quest.goalId, questId: quest.id })
          onClose()
        }}
      />
      <button className="btn ghost" style={{ marginTop: 14 }} onClick={onClose}>記録しない</button>
    </Sheet>
  )
}

function LogSheet({ g, kind, onClose }: { g: Game; kind: ActivityKind | null; onClose: () => void }) {
  const [k, setK] = useState<ActivityKind>('attack')
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [goalId, setGoalId] = useState('')
  const [lastKind, setLastKind] = useState<ActivityKind | null>(null)

  if (kind !== lastKind) {
    setLastKind(kind)
    if (kind) {
      setK(kind)
      setTitle('')
      setMinutes(30)
      setGoalId('')
    }
  }

  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (let i = g.activities.length - 1; i >= 0 && out.length < 8; i--) {
      const a = g.activities[i]
      if (a.kind !== k || seen.has(a.title)) continue
      seen.add(a.title)
      out.push(a.title)
    }
    return out
  }, [g.activities, k])

  const per30 = k === 'attack' ? g.config.rules.attackPer30 : g.config.rules.defensePer30
  const xp = Math.round((minutes / 30) * per30)

  return (
    <Sheet open={!!kind} onClose={onClose} en="LOG" ja="行動を記録">
      <div className="field">
        <div className="chips">
          <button className={`chip atk${k === 'attack' ? ' on' : ''}`} onClick={() => setK('attack')}>攻め（目標に効く）</button>
          <button className={`chip def${k === 'defense' ? ' on' : ''}`} onClick={() => setK('defense')}>守り（こなす業務）</button>
        </div>
      </div>
      <div className="field">
        <label>何をした？</label>
        <input
          className="input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={k === 'attack' ? '例：新規事業の企画書を書く' : '例：シフト調整・経費精算'}
        />
        {recent.length > 0 && (
          <div className="scroll-x" style={{ marginTop: 8 }}>
            <div className="chips">
              {recent.map((t) => <button key={t} className="chip" onClick={() => setTitle(t)}>{t}</button>)}
            </div>
          </div>
        )}
      </div>
      <div className="field">
        <label>時間</label>
        <MinutesPick value={minutes} onChange={setMinutes} />
      </div>
      {k === 'attack' && (
        <div className="field">
          <label>どの目標に効く？</label>
          <GoalSelect goals={g.goals} value={goalId} onChange={setGoalId} />
        </div>
      )}
      <button
        className={`btn${k === 'attack' ? ' atk' : ''}`}
        disabled={!title.trim()}
        onClick={() => {
          logActivity({ kind: k, title, minutes, goalId: k === 'attack' ? goalId : undefined })
          onClose()
        }}
      >
        記録する（+{xp} XP）
      </button>
    </Sheet>
  )
}

export function ReviewSheet({ g, open, onClose, date }: { g: Game; open: boolean; onClose: () => void; date?: string }) {
  const target = date ?? g.today
  const existing = g.reviews.find((r) => r.date === target)
  const [comment, setComment] = useState('')
  const [score, setScore] = useState<number | undefined>(undefined)
  const [lastOpen, setLastOpen] = useState(false)

  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setComment(existing?.comment ?? '')
      setScore(existing?.score)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} en="DEBRIEF" ja={target === g.today ? '今日の振り返り' : `${target} の振り返り`}>
      {target === g.today && <UnfinishedQuests g={g} />}
      <div className="field">
        <label>今日を一言で</label>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="例：アポは取れた。計画書は逃げた。明日は朝イチでやる。" />
      </div>
      <div className="field">
        <label>自己評価</label>
        <div className="score-pick">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={score === n ? 'on' : ''} onClick={() => setScore(score === n ? undefined : n)}>{n}</button>
          ))}
        </div>
      </div>
      <button
        className="btn"
        onClick={() => {
          saveReview(target, comment, score)
          onClose()
          if (target === g.today && !existing) useUI.setState({ matchResult: true })
        }}
      >
        {existing ? '保存する' : `戦績を確定する（+${g.config.rules.review} XP）`}
      </button>
    </Sheet>
  )
}

/** 完璧にできない日も、着手したことを記録する */
function UnfinishedQuests({ g }: { g: Game }) {
  const list = g.todayQuests.filter((q) => !q.done)
  if (list.length === 0) return null
  return (
    <div className="field">
      <label>終わっていないクエスト：手をつけたなら「着手」に（半分のXP・ペナルティなし）</label>
      {list.map((q) => (
        <div key={q.id} className="act-row">
          <span className="t">{q.title}</span>
          <button className={`q-start${q.started ? ' on' : ''}`} onClick={() => toggleStarted(q)} aria-pressed={!!q.started}>
            {q.started ? `着手済 +${startedXp(q, g.config.rules)}` : '着手した'}
          </button>
        </div>
      ))}
    </div>
  )
}
