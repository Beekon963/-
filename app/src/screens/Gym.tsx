import { useMemo, useState } from 'react'
import { STATUS_LABEL, dayLabel } from '../components/GymCard'
import { IconBack, IconChevron, IconClose, IconPlus } from '../components/Icons'
import { NumField } from '../components/NumField'
import { Sheet } from '../components/Sheet'
import { addDays, daysBetween, formatShort, weekday } from '../lib/date'
import {
  CLOSED_MESSAGE, GROUP_LABEL, INTRO_DAYS, KIND_LABEL, LOAD_LABEL, PROGRESSION_TEXT, REST_SEC, WEEKDAY_JA, exerciseHistory,
  isClosed, menuFor, monthGrid, plannedSetsFor, progression, recordedExercises, sessionsOn, setText, targetLabel, warmupSets,
  weeklyCounts, weeklyWeights, workingSets, type GymDayInfo,
} from '../lib/gym'
import type { GymExercise, GymGroup, GymKind, GymLoad, GymMenu } from '../lib/types'
import {
  deleteExercise, deleteSession, deleteWeight, moveDay, moveExercise, newExercise, resetMoves, saveExercise, saveWeight,
  setSchedule, setTimerPref, setVolume, startWorkout, updateMenu, useGym, type Gym as GymState,
} from '../store/gym'
import { setRestPrefs } from '../store/rest'
import { openWorkout, useUI, type GymView } from '../store/ui'
import { GUIDE } from './Workout'

const VIEWS: { id: GymView; label: string }[] = [
  { id: 'week', label: '今週' },
  { id: 'history', label: '履歴' },
  { id: 'menu', label: 'メニュー' },
  { id: 'weight', label: '体重' },
]

export function Gym() {
  const gym = useGym()
  const view = useUI((s) => s.gymView)
  return (
    <div className="fade-in">
      <div className="page-title">
        <button className="back" onClick={() => useUI.setState({ page: null })} aria-label="戻る"><IconBack /></button>
        <div><h1>TRAINING</h1><div className="ja">筋トレ</div></div>
      </div>
      <div className="seg" role="tablist">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} className={view === v.id ? 'on' : ''} onClick={() => useUI.setState({ gymView: v.id })}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'week' && <WeekView gym={gym} />}
      {view === 'history' && <HistoryView gym={gym} />}
      {view === 'menu' && <MenuView gym={gym} />}
      {view === 'weight' && <WeightView gym={gym} />}
    </div>
  )
}

// ---------- 今週 ----------

const STATE_LABEL: Record<GymDayInfo['state'], string> = {
  rest: '休養', closed: '休館日', planned: '予定', missed: '未実施', active: '実施中', done: '完了', partial: '一部実施', skipped: '見送り',
}

function WeekView({ gym }: { gym: GymState }) {
  const [moveFrom, setMoveFrom] = useState<string | null>(null)
  const [guide, setGuide] = useState(false)
  const { week, today, plan } = gym
  const moved = week.days.filter((d) => d.moved).map((d) => d.date)
  const introDay = plan.introStart ? daysBetween(plan.introStart, today) + 1 : null

  return (
    <>
      <div className="sec">
        {gym.introOver ? (
          <div className="gym-note">
            <b>導入期間が終わりました</b>
            通常のセット数に切り替えるかは自分で選べます。続けて導入期間のセット数でも大丈夫です。
            <button className="btn-sm accent" onClick={() => setVolume('normal')}>通常のセット数に切り替える</button>
          </div>
        ) : gym.intro && plan.volume === 'intro' ? (
          <div className="gym-note">
            <b>導入期間{introDay && introDay <= INTRO_DAYS ? ` ${introDay}/${INTRO_DAYS}日目` : '（初回から14日間）'}</b>
            各種目2セットから。つらければ1セットにしてOK（メニューで変えられます）。
          </div>
        ) : null}

        <div className="gw-sum">
          <div><b>{week.done}</b><span>完了</span></div>
          <div><b>{week.partial}</b><span>一部実施</span></div>
          <div><b>{week.planned}</b><span>今週の予定</span></div>
        </div>

        <div className="gw-days">
          {week.days.map((d) => {
            const isToday = d.date === today
            const canMove = d.menu && d.date >= today && !d.session
            return (
              <div key={d.date} className={`gw-day st-${d.state}${isToday ? ' today' : ''}`}>
                <div className="gw-date">
                  <b>{WEEKDAY_JA[weekday(d.date)]}</b>
                  <span>{formatShort(d.date)}</span>
                </div>
                <button
                  className="gw-body" disabled={!d.session}
                  onClick={() => d.session && (d.session.status === 'skipped' ? null : openWorkout(d.session.id))}
                >
                  <span className="gw-menu">{d.menu ? d.menu.name : isClosed(d.date) ? 'ジム休館日' : '休養日'}</span>
                  <span className="gw-state">
                    {STATE_LABEL[d.state]}{d.moved && ' ・ 振替'}{d.menu && ` ・ 目安${d.menu.minutes}分`}
                  </span>
                </button>
                <div className="gw-act">
                  {isToday && d.menu && !d.session && <button className="btn-sm accent" onClick={() => startWorkout(d.menu!.id)}>開始</button>}
                  {d.session?.status === 'active' && <button className="btn-sm accent" onClick={() => openWorkout(d.session!.id)}>再開</button>}
                  {canMove && <button className="btn-sm" onClick={() => setMoveFrom(d.date)}>振替</button>}
                </div>
              </div>
            )
          })}
        </div>
        {moved.length > 0 && (
          <button className="toggle-link" onClick={() => resetMoves(moved)}>今週の振替をやめて曜日どおりに戻す</button>
        )}
      </div>

      <div className="sec">
        <div className="sec-h"><span className="en">FREE</span><span className="ja">ほかのメニューで始める</span></div>
        <div className="chips">
          {plan.menus.map((m) => (
            <button key={m.id} className="chip" onClick={() => startWorkout(m.id)}>{m.name}（{m.minutes}分）</button>
          ))}
        </div>
      </div>

      <div className="sec">
        <button className="toggle-link" onClick={() => setGuide(!guide)}>基本ガイド <IconChevron size={14} open={guide} /></button>
        {guide && <ul className="wo-guide">{GUIDE.map((t) => <li key={t}>{t}</li>)}</ul>}
      </div>

      <MoveSheet gym={gym} from={moveFrom} onClose={() => setMoveFrom(null)} />
    </>
  )
}

function MoveSheet({ gym, from, onClose }: { gym: GymState; from: string | null; onClose: () => void }) {
  const [msg, setMsg] = useState('')
  const [last, setLast] = useState<string | null>(null)
  if (from !== last) {
    setLast(from)
    setMsg('')
  }
  const menu = from ? menuFor(gym.plan, gym.overrides, from) : null
  return (
    <Sheet open={!!from} onClose={onClose} en="MOVE" ja={from ? `${dayLabel(from)} ${menu?.name ?? ''}を振り替える` : ''}>
      {from && (
        <>
          <p className="help" style={{ marginTop: -6, marginBottom: 10 }}>予定のある日を選ぶと入れ替えます。できなかった日は翌日に自動で足されません。</p>
          <div className="gm-days">
            {gym.week.days.filter((d) => d.date >= gym.today && d.date !== from).map((d) => {
              const closed = isClosed(d.date)
              return (
                <button
                  key={d.date} className={`gm-day${closed ? ' closed' : ''}`} aria-disabled={closed}
                  onClick={() => {
                    const err = moveDay(from, d.date)
                    if (err) setMsg(err)
                    else onClose()
                  }}
                >
                  <b>{dayLabel(d.date)}</b>
                  <span>{closed ? CLOSED_MESSAGE : d.menu ? `${d.menu.name}と入れ替え` : '休養日に移す'}</span>
                </button>
              )
            })}
          </div>
          {msg && <div className="err">{msg}</div>}
        </>
      )}
    </Sheet>
  )
}

// ---------- 履歴 ----------

function HistoryView({ gym }: { gym: GymState }) {
  const [month, setMonth] = useState(gym.today.slice(0, 7))
  const [selected, setSelected] = useState(gym.today)
  const grid = useMemo(() => monthGrid(month), [month])
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const daySessions = sessionsOn(gym.sessions, selected)
  const weeks = weeklyCounts(gym.sessions, gym.today, 8)

  return (
    <>
      <div className="sec">
        <div className="cal-h">
          <button className="btn-sm" onClick={() => shift(-1)} aria-label="前の月">‹</button>
          <b>{Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月</b>
          <button className="btn-sm" onClick={() => shift(1)} aria-label="次の月">›</button>
        </div>
        <div className="cal">
          {['月', '火', '水', '木', '金', '土', '日'].map((w) => <div key={w} className="cal-w">{w}</div>)}
          {grid.flat().map((d, i) => {
            if (!d) return <div key={i} />
            const list = sessionsOn(gym.sessions, d)
            // 過ぎた日の「やらなかった予定」は印を付けない（失敗扱いにしない）
            const st = list.length ? list[list.length - 1].status : d >= gym.today && menuFor(gym.plan, gym.overrides, d) ? 'plan' : ''
            return (
              <button key={d} className={`cal-d ${st}${d === selected ? ' sel' : ''}${d === gym.today ? ' today' : ''}`} onClick={() => setSelected(d)}>
                <span>{Number(d.slice(8))}</span>
                <i />
              </button>
            )
          })}
        </div>
        <div className="cal-legend"><span className="done">完了</span><span className="partial">一部実施</span><span className="skipped">見送り</span><span className="plan">予定</span></div>
      </div>

      <div className="sec">
        <div className="sec-h"><span className="en">{dayLabel(selected)}</span><span className="ja">の記録</span></div>
        {daySessions.length === 0 && (
          <div className="empty">{menuFor(gym.plan, gym.overrides, selected) ? 'この日の記録はありません' : '休養日'}</div>
        )}
        {daySessions.map((s) => (
          <div key={s.id} className="hs-card">
            <div className="hs-h">
              <b>{s.menuName}</b>
              <span className={`hs-st ${s.status}`}>{STATUS_LABEL[s.status]}</span>
            </div>
            {s.exercises.map((e, i) => {
              const sets = workingSets(e)
              const warm = warmupSets(e)
              if (!sets.length && !warm.length && !e.note && !e.pain) return null
              const prog = progression(s, e)
              return (
                <div key={i} className="hs-ex">
                  <div className="hs-name">{e.name}<span>{LOAD_LABEL[e.load]}{e.machine ? `・${e.machine}` : ''} ・ {sets.length}/{e.plannedSets}セット</span></div>
                  {warm.length > 0 && <div className="hs-warm">W {warm.map((x) => setText(e, x)).join(' / ')}</div>}
                  {sets.length > 0 && <div className="hs-sets">{sets.map((x) => setText(e, x)).join(' / ')}</div>}
                  {e.note && <div className="hs-note">メモ：{e.note}</div>}
                  {e.pain && <div className="hs-pain">痛み・違和感：{e.pain}</div>}
                  {prog && <div className={`wo-prog ${prog}`}>{PROGRESSION_TEXT[prog]}</div>}
                </div>
              )
            })}
            <div className="hs-act">
              {s.status !== 'skipped' && <button className="btn-sm" onClick={() => openWorkout(s.id)}>{s.status === 'active' ? '再開' : '修正'}</button>}
              <button className="btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteSession(s.id)}>削除</button>
            </div>
          </div>
        ))}
      </div>

      <div className="sec">
        <div className="sec-h"><span className="en">WEEKS</span><span className="ja">週ごとの実施回数（月〜日）</span></div>
        <div className="hw-list">
          {weeks.slice().reverse().map((w) => (
            <div key={w.start} className="hw-row">
              <span>{formatShort(w.start)}〜{formatShort(addDays(w.start, 6))}</span>
              <b>完了 {w.done}</b>
              <span>{w.partial > 0 ? `一部実施 ${w.partial}` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <ProgressSection gym={gym} />
    </>
  )
}

function ProgressSection({ gym }: { gym: GymState }) {
  const exercises = useMemo(() => recordedExercises(gym.sessions), [gym.sessions])
  const [key, setKey] = useState('')
  const current = key || exercises[0]?.key || ''
  const groups = useMemo(() => (current ? exerciseHistory(gym.sessions, current) : []), [gym.sessions, current])
  return (
    <div className="sec">
      <div className="sec-h"><span className="en">PROGRESS</span><span className="ja">種目別の推移（同じ条件ごと）</span></div>
      {exercises.length === 0 ? (
        <div className="empty">記録すると、ここに種目ごとの重量と回数の推移が出ます</div>
      ) : (
        <>
          <select className="input" value={current} onChange={(e) => setKey(e.target.value)} aria-label="種目">
            {exercises.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
          {groups.map((g) => (
            <div key={g.label} className="pg-group">
              <div className="pg-label">{g.label}</div>
              {g.rows.map((r) => (
                <div key={r.sessionId} className="pg-row">
                  <span>{dayLabel(r.date)}</span>
                  <b>{r.sets.map((s) => setText(r.exercise, s).replace(/^自重 × /, '')).join(' / ')}</b>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ---------- メニュー ----------

function MenuView({ gym }: { gym: GymState }) {
  const { plan } = gym
  const [editing, setEditing] = useState<{ menuId: string; ex: GymExercise } | null>(null)
  const [msg, setMsg] = useState('')
  const notifyOk = typeof Notification !== 'undefined'

  return (
    <>
      <div className="set-group">
        <h3>SETS ・ セット数</h3>
        <div className="chips">
          <button className={`chip${plan.volume === 'intro' ? ' on' : ''}`} onClick={() => setVolume('intro')}>導入期間のセット数</button>
          <button className={`chip${plan.volume === 'normal' ? ' on' : ''}`} onClick={() => setVolume('normal')}>通常のセット数</button>
        </div>
        <p className="help">導入期間（初回から{INTRO_DAYS}日間）は2セット、必要なら1セット。切り替えは自分で選びます（自動で増えません）。変えた内容は次に始めるトレーニングから使います。</p>
      </div>

      <div className="set-group">
        <h3>SCHEDULE ・ 曜日の予定</h3>
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
          <div key={wd} className="set-row">
            {WEEKDAY_JA[wd]}曜日
            <span className="v">
              {wd === 5 ? (
                <span>ジム休館日</span>
              ) : (
                <select className="input" value={plan.schedule[wd] ?? ''} onChange={(e) => setMsg(setSchedule(wd, e.target.value || null) ?? '')}>
                  <option value="">休養</option>
                  {plan.menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
            </span>
          </div>
        ))}
        {msg && <div className="err">{msg}</div>}
      </div>

      {plan.menus.map((m) => <MenuBlock key={m.id} menu={m} volume={plan.volume} onEdit={(ex) => setEditing({ menuId: m.id, ex })} />)}

      <div className="set-group">
        <h3>TIMER ・ 休憩タイマー</h3>
        <button className="set-row" onClick={() => { setTimerPref({ sound: !plan.timer.sound }); setRestPrefs({ ...plan.timer, sound: !plan.timer.sound }) }}>
          終わったら音を鳴らす<span className="v">{plan.timer.sound ? 'オン' : 'オフ'}</span>
        </button>
        <button
          className="set-row"
          disabled={!notifyOk}
          onClick={async () => {
            if (plan.timer.notify) {
              setTimerPref({ notify: false })
              return
            }
            const res = await Notification.requestPermission().catch(() => 'denied' as const)
            if (res === 'granted') setTimerPref({ notify: true })
            else setMsg('通知は許可されていません。タイマーは画面の中で使えます')
          }}
        >
          アプリの外にいるときに通知<span className="v">{!notifyOk ? 'この端末では使えません' : plan.timer.notify ? 'オン' : 'オフ'}</span>
        </button>
        <p className="help">通知を許可しなくてもタイマーは使えます。iPhone はアプリを閉じている間は通知が届かないことがあります。戻ったときは終了時刻から残り時間を出し直します。</p>
      </div>

      <ExerciseSheet state={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function MenuBlock({ menu, volume, onEdit }: { menu: GymMenu; volume: 'intro' | 'normal'; onEdit: (ex: GymExercise) => void }) {
  return (
    <div className="set-group">
      <h3>MENU ・ {menu.name}</h3>
      <div className="mb-head">
        <input className="input" value={menu.name} aria-label="メニュー名" onChange={(e) => updateMenu(menu.id, (m) => ({ ...m, name: e.target.value }))} />
        <label className="mb-min">
          目安
          <NumField label="目安の時間（分）" value={menu.minutes} onChange={(v) => updateMenu(menu.id, (m) => ({ ...m, minutes: v ?? 0 }))} />
          分
        </label>
      </div>
      {menu.exercises.map((x, i) => (
        <div key={x.id} className="mb-ex">
          <button className="mb-body" onClick={() => onEdit(x)}>
            <b>{i + 1}. {x.name}</b>
            <span>
              {targetLabel(x)} × {x.sets}セット（導入{Math.min(x.introSets, x.sets)}）・ {LOAD_LABEL[x.load]} ・ 休憩{x.restSec}秒
              {volume === 'intro' && ` ・ 今は${plannedSetsFor(x, volume)}セット`}
              {x.alt && ` ・ ${x.alt.name}に置き換え可`}
            </span>
          </button>
          <div className="mb-move">
            <button aria-label="上へ" disabled={i === 0} onClick={() => moveExercise(menu.id, i, -1)}>▲</button>
            <button aria-label="下へ" disabled={i === menu.exercises.length - 1} onClick={() => moveExercise(menu.id, i, 1)}>▼</button>
          </div>
        </div>
      ))}
      <button className="set-row" style={{ color: 'var(--rank)' }} onClick={() => onEdit(newExercise())}>
        <IconPlus size={14} /> 種目を追加
      </button>
    </div>
  )
}

const KINDS: GymKind[] = ['reps', 'seconds', 'perSide']
const LOADS: GymLoad[] = ['machine', 'dumbbell', 'barbell', 'bodyweight']
const GROUPS: GymGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs', 'calves']

function ExerciseSheet({ state, onClose }: { state: { menuId: string; ex: GymExercise } | null; onClose: () => void }) {
  const [ex, setEx] = useState<GymExercise | null>(null)
  const [last, setLast] = useState<GymExercise | null>(null)
  const incoming = state?.ex ?? null
  if (incoming !== last) {
    setLast(incoming)
    setEx(incoming)
  }
  const isNew = !!state && !state.ex.name
  const set = (p: Partial<GymExercise>) => setEx((e) => (e ? { ...e, ...p } : e))
  return (
    <Sheet open={!!state} onClose={onClose} en={isNew ? 'NEW EXERCISE' : 'EDIT EXERCISE'} ja="種目">
      {state && ex && (
        <>
          <p className="help" style={{ marginTop: -6, marginBottom: 10 }}>変えた内容は次のトレーニングから。過去の記録は変わりません。</p>
          <div className="field">
            <label>種目名</label>
            <input className="input" value={ex.name} onChange={(e) => set({ name: e.target.value })} placeholder="例：ペックフライ" />
          </div>
          <div className="field">
            <label>記録のしかた</label>
            <div className="chips">{KINDS.map((k) => <button key={k} className={`chip${ex.kind === k ? ' on' : ''}`} onClick={() => set({ kind: k })}>{KIND_LABEL[k]}</button>)}</div>
          </div>
          <div className="field">
            <label>重量の条件</label>
            <div className="chips">{LOADS.map((l) => <button key={l} className={`chip${ex.load === l ? ' on' : ''}`} onClick={() => set({ load: l })}>{LOAD_LABEL[l]}</button>)}</div>
            <div className="help">ダンベルは片手あたり、マシンは表示重量で記録します。</div>
          </div>
          <div className="field">
            <label>部位（休憩の初期値：胸・背中・脚120秒、ほか90秒）</label>
            <div className="chips">{GROUPS.map((gr) => <button key={gr} className={`chip${ex.group === gr ? ' on' : ''}`} onClick={() => set({ group: gr, restSec: REST_SEC[gr] })}>{GROUP_LABEL[gr]}</button>)}</div>
          </div>
          <div className="ex-grid">
            <label>目標 下限<NumField label="目標の下限" value={ex.targetMin} onChange={(v) => set({ targetMin: v ?? 0 })} /></label>
            <label>目標 上限<NumField label="目標の上限" value={ex.targetMax} onChange={(v) => set({ targetMax: v ?? 0 })} /></label>
            <label>通常セット<NumField label="通常のセット数" value={ex.sets} onChange={(v) => set({ sets: v ?? 1 })} /></label>
            <label>休憩（秒）<NumField label="休憩の秒数" value={ex.restSec} onChange={(v) => set({ restSec: v ?? 0 })} /></label>
          </div>
          <div className="field">
            <label>導入期間のセット数</label>
            <div className="chips">
              {[2, 1].map((n) => <button key={n} className={`chip${ex.introSets === n ? ' on' : ''}`} onClick={() => set({ introSets: n })}>{n}セット</button>)}
            </div>
          </div>
          <div className="field">
            <label>置き換えできる種目（任意）</label>
            <input
              className="input" value={ex.alt?.name ?? ''} placeholder="例：ヒップスラスト"
              onChange={(e) => set({ alt: e.target.value ? { ...(ex.alt ?? { load: ex.load }), name: e.target.value } : undefined })}
            />
          </div>
          <button
            className="btn"
            disabled={!ex.name.trim() || ex.targetMin < 1 || ex.targetMax < ex.targetMin || ex.sets < 1}
            onClick={() => {
              saveExercise(state.menuId, {
                ...ex, name: ex.name.trim(), key: ex.key || ex.name.trim(),
                sets: Math.max(1, Math.round(ex.sets)), introSets: Math.min(ex.introSets, Math.max(1, Math.round(ex.sets))),
              })
              onClose()
            }}
          >
            保存する
          </button>
          {!isNew && (
            <button className="btn danger" style={{ marginTop: 8 }} onClick={() => { deleteExercise(state.menuId, ex.id); onClose() }}>
              この種目を削除
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}

// ---------- 体重 ----------

function WeightView({ gym }: { gym: GymState }) {
  const todayEntry = gym.weights.find((w) => w.date === gym.today)
  const [kg, setKg] = useState<number | null>(todayEntry?.kg ?? null)
  const weeks = weeklyWeights(gym.weights, gym.today, 8)
  return (
    <>
      <div className="sec">
        <div className="sec-h"><span className="en">BODY WEIGHT</span><span className="ja">体重（任意）</span></div>
        <div className="bw-in">
          <NumField decimal label="今日の体重（kg）" value={kg} placeholder={gym.weights[0] ? String(gym.weights[0].kg) : '00.0'} onChange={setKg} />
          <span>kg</span>
          <button className="btn" disabled={!kg} onClick={() => kg && saveWeight(gym.today, kg)}>{todayEntry ? '更新' : '記録'}</button>
        </div>
        <p className="help">記録は自分のアカウント（未ログインならこの端末）にだけ保存され、公開されません。</p>
      </div>
      <div className="sec">
        <div className="sec-h"><span className="en">WEEKLY</span><span className="ja">週の平均（月〜日）</span></div>
        <div className="hw-list">
          {weeks.slice().reverse().map((w) => (
            <div key={w.start} className="hw-row">
              <span>{formatShort(w.start)}〜{formatShort(addDays(w.start, 6))}</span>
              <b>{w.avg != null ? `${w.avg} kg` : '—'}</b>
              <span>{w.count ? `${w.count}回` : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="sec">
        <div className="sec-h"><span className="en">LOG</span><span className="ja">記録</span></div>
        {gym.weights.length === 0 && <div className="empty">まだ記録がありません</div>}
        {gym.weights.slice(0, 30).map((w) => (
          <div key={w.id} className="hw-row">
            <span>{dayLabel(w.date)}</span>
            <b>{w.kg} kg</b>
            <button className="ws-del" aria-label={`${dayLabel(w.date)}の体重を削除`} onClick={() => deleteWeight(w.id)}><IconClose size={14} /></button>
          </div>
        ))}
      </div>
    </>
  )
}
