import { useRef, useState } from 'react'
import { IconBack, IconBell } from '../components/Icons'
import { formatJa } from '../lib/date'
import { DEFAULT_REMINDERS, MODES, MODE_ORDER } from '../lib/defaults'
import { REMINDER_DEFS, buildIcs, googleCalendarUrl } from '../lib/reminders'
import type { Reminders, XpRules } from '../lib/types'
import { getServerConfig, setLocalMode, signOut, syncNow, useCloud } from '../store/cloud'
import { exportJson, importJson, useData } from '../store/data'
import { updateConfig, useGame } from '../store/game'
import { openPage, useUI } from '../store/ui'

type NumKey = { [K in keyof XpRules]: XpRules[K] extends number ? K : never }[keyof XpRules]

const RULE_ROWS: { key: NumKey; label: string }[] = [
  { key: 'perfectBonus', label: 'PERFECT ボーナス' },
  { key: 'attackPer30', label: '攻め 30分あたり' },
  { key: 'defensePer30', label: '守り 30分あたり' },
  { key: 'contact', label: '人脈「連絡した」' },
  { key: 'review', label: '振り返り' },
  { key: 'streakEvery', label: '連続ボーナスの間隔（日）' },
  { key: 'streakBonus', label: '連続ボーナス' },
  { key: 'penaltyMissedQuest', label: '降格：未着手デイリー1つ' },
  { key: 'penaltyNoQuest', label: '降格：デイリー未設定の日' },
  { key: 'restDaysPerWeek', label: '休息日（週あたり回数）' },
  { key: 'startedPct', label: '着手したデイリーのXP（%）' },
  { key: 'challenge', label: '挑戦ログ1件' },
  { key: 'post', label: '挑戦を発信した' },
  { key: 'weekGoal', label: '週の目標1つ達成' },
  { key: 'monthGoal', label: '月の目標1つ達成' },
  { key: 'penaltyNoPlan', label: '降格：明日のクエストを前日に書かなかった' },
  { key: 'penaltyNoWeekPlan', label: '降格：来週の目標を日曜までに書かなかった' },
  { key: 'penaltyNoMonthPlan', label: '降格：来月の目標を月末までに書かなかった' },
  { key: 'comebackBonus', label: 'COMEBACK ボーナス（連続が切れたあと戻った日）' },
]

export function Settings() {
  const g = useGame()
  const cloud = useCloud()
  const outboxCount = useData((s) => Object.keys(s.outbox).length)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const rules = g.config.rules

  const setRule = (key: NumKey, v: string) => {
    const n = Math.max(0, Math.round(Number(v) || 0))
    updateConfig((c) => ({ ...c, rules: { ...c.rules, [key]: n } }))
  }
  const setQuestXp = (i: number, v: string) => {
    const n = Math.max(0, Math.round(Number(v) || 0))
    updateConfig((c) => {
      const quest = [...c.rules.quest] as XpRules['quest']
      quest[i] = n
      return { ...c, rules: { ...c.rules, quest } }
    })
  }
  const setGoalXp = (k: keyof XpRules['goal'], v: string) => {
    const n = Math.max(0, Math.round(Number(v) || 0))
    updateConfig((c) => ({ ...c, rules: { ...c.rules, goal: { ...c.rules.goal, [k]: n } } }))
  }

  const setReminder = (key: keyof Reminders, v: string) => {
    updateConfig((c) => ({ ...c, reminders: { ...c.reminders, [key]: v } }))
  }

  const downloadIcs = () => {
    const blob = new Blob([buildIcs(g.config.reminders)], { type: 'text/calendar;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'life-ranked-reminders.ics'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `life-ranked-${g.today}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const onImport = async (file: File) => {
    try {
      const n = importJson(await file.text())
      setMsg(`${n}件のデータを読み込みました`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '読み込みに失敗しました')
    }
  }

  const syncLabel =
    cloud.syncState === 'syncing' ? '同期中…'
      : cloud.syncState === 'error' ? 'エラー'
        : cloud.syncState === 'offline' ? 'オフライン'
          : cloud.lastSyncAt ? `同期済み ${new Date(cloud.lastSyncAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '待機中'

  return (
    <div className="fade-in">
      <div className="page-title">
        <button className="back" onClick={() => useUI.setState({ page: null })} aria-label="戻る"><IconBack /></button>
        <div><h1>SETTINGS</h1><div className="ja">設定</div></div>
      </div>

      <div className="set-group">
        <h3>MATCH MODE ・ 試合モード</h3>
        <div className="mode-pick">
          {MODE_ORDER.map((m) => {
            const def = MODES[m]
            return (
              <button
                key={m} className={`mode-card${g.config.mode === m ? ' on' : ''}`} aria-pressed={g.config.mode === m}
                onClick={() => updateConfig((c) => ({ ...c, mode: m }))}
              >
                <span className="mc-name">{def.name}</span>
                <span className="mc-ja">{def.ja}{m === 'standard' && <small>おすすめ</small>}</span>
                <span className="mc-desc">{def.desc}</span>
              </button>
            )
          })}
        </div>
        <p className="help" style={{ padding: '8px 2px' }}>
          続けることがいちばん大事。慣れるまでは STANDARD 以下で。変えると過去の減点も計算し直されます。
        </p>
      </div>

      <div className="set-group">
        <h3>REMINDERS ・ 通知</h3>
        <p className="help" style={{ padding: '2px 2px 6px' }}>
          アプリを閉じていても届くように、カレンダーの通知を使います。時刻を決めて、カレンダーに追加してください。
        </p>
        {REMINDER_DEFS.map((def) => {
          const time = g.config.reminders[def.key]
          return (
            <div key={def.key} className="rem-row">
              <span className="rt">{def.label}</span>
              {time ? (
                <input
                  className="input" type="time" value={time} aria-label={`${def.label}の時刻`}
                  onChange={(e) => setReminder(def.key, e.target.value)}
                />
              ) : (
                <button className="gcal" onClick={() => setReminder(def.key, DEFAULT_REMINDERS[def.key])}>オンにする</button>
              )}
              <span className="rs">{def.when}{time ? ` ${time}` : ' ・ 通知しない'}</span>
              {time && (
                <span className="rl">
                  <a className="gcal" href={googleCalendarUrl(def, time)} target="_blank" rel="noreferrer">Googleに追加</a>
                  <button className="gcal off" onClick={() => setReminder(def.key, '')}>OFF</button>
                </span>
              )}
            </div>
          )
        })}
        <div className="rem-actions">
          <button className="btn" onClick={downloadIcs}><IconBell size={16} /> まとめてカレンダーに追加（.ics）</button>
        </div>
        <p className="help" style={{ padding: '8px 2px' }}>
          .ics は iPhone のカレンダー・Google カレンダー・Outlook で開けます。「Google」は1つずつ Google カレンダーに追加します。
          時刻を変えたら、前の予定を消してから追加し直してください。
        </p>
      </div>

      <div className="set-group">
        <h3>ACCOUNT</h3>
        {cloud.auth === 'signedIn' ? (
          <>
            <div className="set-row">ログイン中<span className="v">{cloud.email}</span></div>
            <button className="set-row" onClick={() => void syncNow()}>
              同期<span className="v" style={cloud.syncState === 'error' ? { color: 'var(--danger)' } : undefined}>{syncLabel} ・ 今すぐ同期</span>
            </button>
            {cloud.syncError && <div className="err" style={{ padding: '8px 2px' }}>{cloud.syncError}</div>}
            <button
              className="set-row"
              style={{ color: 'var(--danger)' }}
              onClick={() => {
                const warn = outboxCount > 0 ? `\nまだ送信できていないデータが${outboxCount}件あります。ログアウトすると失われます。` : ''
                if (confirm(`ログアウトしますか？この端末のデータは消え、次回ログイン時にサーバーから復元されます。${warn}`)) void signOut()
              }}
            >
              ログアウト
            </button>
          </>
        ) : (
          <>
            <div className="set-row">この端末だけに保存中<span className="v">未ログイン</span></div>
            <button className="set-row" onClick={() => setLocalMode(false)} style={{ color: 'var(--rank)' }}>
              ログインして同期を始める<span className="v">›</span>
            </button>
            <p className="help" style={{ padding: '8px 2px' }}>ログインすると、この端末のデータがアカウントに引き継がれ、スマホとPCで同じデータを使えます。</p>
          </>
        )}
      </div>

      <div className="set-group">
        <h3>VISION</h3>
        <button className="set-row" onClick={() => openPage('vision')}>人生の目標を見る・編集<span className="v">›</span></button>
      </div>

      <div className="set-group">
        <h3>RANKS</h3>
        <button className="set-row" onClick={() => openPage('ranks', { rankEdit: true })}>ランク表・昇格条件を編集<span className="v">›</span></button>
      </div>

      <div className="set-group">
        <h3>GAME</h3>
        <div className="set-row">
          1日の切り替わり
          <span className="v">
            <select
              className="input" value={g.config.dayStartHour}
              onChange={(e) => updateConfig((c) => ({ ...c, dayStartHour: Number(e.target.value) }))}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </span>
        </div>
        <div className="set-row">
          攻め率の目標
          <span className="v">
            <select
              className="input" value={g.config.attackTargetPct}
              onChange={(e) => updateConfig((c) => ({ ...c, attackTargetPct: Number(e.target.value) }))}
            >
              {[20, 30, 40, 50, 60, 70, 80].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </span>
        </div>
        <p className="help" style={{ padding: '8px 2px' }}>
          降格ペナルティの計算開始日：{formatJa(g.startDate)}（初日と休息日は対象外）
        </p>
      </div>

      <div className="set-group">
        <h3>XP</h3>
        {(['★', '★★', '★★★'] as const).map((s, i) => (
          <div key={s} className="set-row">
            デイリー {s}
            <span className="v"><input className="input" type="number" inputMode="numeric" value={rules.quest[i]} onChange={(e) => setQuestXp(i, e.target.value)} /></span>
          </div>
        ))}
        {(['small', 'mid', 'main'] as const).map((k) => (
          <div key={k} className="set-row">
            {k === 'small' ? '小目標' : k === 'mid' ? '中目標' : '大目標'}の達成
            <span className="v"><input className="input" type="number" inputMode="numeric" value={rules.goal[k]} onChange={(e) => setGoalXp(k, e.target.value)} /></span>
          </div>
        ))}
        {RULE_ROWS.map(({ key, label }) => (
          <div key={key} className="set-row">
            {label}
            <span className="v"><input className="input" type="number" inputMode="numeric" value={rules[key]} onChange={(e) => setRule(key, e.target.value)} /></span>
          </div>
        ))}
        <p className="help" style={{ padding: '8px 2px' }}>
          デイリーと目標のXPは、登録したときの値で記録されます。ボーナスとペナルティは変更すると過去分にも反映されます。
        </p>
      </div>

      <div className="set-group">
        <h3>DATA</h3>
        <button className="set-row" onClick={download}>バックアップを書き出す（JSON）<span className="v">›</span></button>
        <button className="set-row" onClick={() => fileRef.current?.click()}>バックアップ・初期データを読み込む<span className="v">›</span></button>
        <input
          ref={fileRef} type="file" accept="application/json,.json" hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImport(f)
            e.target.value = ''
          }}
        />
        {msg && <div className="ok-msg" style={{ padding: '8px 2px' }}>{msg}</div>}
      </div>

      <div className="set-group">
        <h3>ABOUT</h3>
        <div className="set-row">LIFE RANKED<span className="v">v0.1</span></div>
        {getServerConfig() && !getServerConfig()?.fromEnv && cloud.auth !== 'signedIn' && (
          <button
            className="set-row"
            onClick={() => {
              if (confirm('サーバー設定（Supabase の URL / キー）を削除しますか？')) {
                localStorage.removeItem('lr-server')
                location.reload()
              }
            }}
          >
            サーバー設定をリセット<span className="v">›</span>
          </button>
        )}
      </div>
    </div>
  )
}
