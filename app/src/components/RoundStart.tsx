import { useEffect, useState } from 'react'
import { addDays, daysBetween } from '../lib/date'
import { dayVerdict } from '../lib/game'
import { intro } from '../lib/intro'
import type { Game } from '../store/game'

const SEEN_KEY = 'lr-round-seen'

/** その日はじめて開いたときの「ROUND N」バナー。前日の結果と、今日越えるべき挑戦回数を出す */
export function RoundStart({ g }: { g: Game }) {
  const [info] = useState(() => {
    let seen: string | null = null
    try {
      seen = localStorage.getItem(SEEN_KEY)
    } catch {
      /* 読めなければ毎回出す */
    }
    if (seen === g.today) return null
    const start = Math.max(Date.now(), intro.bootEndsAt)
    intro.roundEndsAt = start + 2700
    const y = addDays(g.today, -1)
    const prev = y >= g.startDate
      ? {
          verdict: dayVerdict(g.quests.filter((q) => q.date === y), g.challenges.yesterday, g.restDates.has(y)),
          net: g.entries.filter((e) => e.date === y).reduce((sum, e) => sum + e.amount, 0),
          insured: g.autoRests.has(y),
        }
      : null
    return { start, prev, round: daysBetween(g.startDate, g.today) + 1 }
  })
  const [phase, setPhase] = useState<'wait' | 'in' | 'out' | 'off'>(info ? 'wait' : 'off')

  useEffect(() => {
    if (!info) return
    try {
      localStorage.setItem(SEEN_KEY, g.today)
    } catch {
      /* 保存できなくても表示はする */
    }
  }, [info, g.today])

  useEffect(() => {
    if (!info) return
    const next = { wait: 'in', in: 'out', out: 'off' } as const
    if (phase === 'off') {
      intro.roundEndsAt = Math.min(intro.roundEndsAt, Date.now())
      return
    }
    const delay = phase === 'wait' ? Math.max(0, info.start - Date.now()) : phase === 'in' ? 2300 : 380
    const t = setTimeout(() => setPhase(next[phase]), delay)
    return () => clearTimeout(t)
  }, [phase, info])

  if (!info || phase === 'wait' || phase === 'off') return null
  const rest = g.isRestDay
  const win = info.prev && info.prev.verdict !== 'DEFEAT'
  const goal = g.challenges.yesterday + 1

  return (
    <div className={`round-start${phase === 'out' ? ' out' : ''}${rest ? ' rest' : ''}`} onClick={() => setPhase('off')}>
      <div className="rs-band">
        <div className="rs-round">ROUND {info.round}</div>
        <div className="rs-phase">{rest ? 'REST DAY' : 'ATTACK'}</div>
      </div>
      {info.prev && (
        <div className="rs-prev">
          PREV ROUND<b className={win ? 'win' : 'lose'}>{info.prev.verdict}</b>
          <span className="xp">{info.prev.net >= 0 ? '+' : ''}{info.prev.net} XP</span>
        </div>
      )}
      {info.prev?.insured && <div className="rs-shield">SHIELD ・ 保険で休息日に。連続はつながっている</div>}
      {!rest && g.comebackReady && (
        <div className="rs-back">WELCOME BACK ・ 1つ着手で COMEBACK <b>+{g.config.rules.comebackBonus}</b> XP</div>
      )}
      {!rest && <div className="rs-goal">昨日より一つでも多く ・ 今日の挑戦 <b>{goal}</b>回以上</div>}
      {!rest && (
        <div className={`rs-plan${g.todayPlanned ? ' ok' : ''}`}>
          {g.todayPlanned ? `PLANNED ・ 前日に書いた作戦 ${g.todayQuests.length}つで戦う` : 'NO PLAN ・ まず今日のクエストを決めよう'}
        </div>
      )}
    </div>
  )
}
