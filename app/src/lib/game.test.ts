import { describe, expect, it } from 'vitest'
import { addDays, logicalToday, weekStart } from './date'
import { DEFAULT_CONFIG, DEFAULT_RANKS } from './defaults'
import {
  activityXp, buildLedger, challengesByDate, computeRank, peakRank, winRate, goalProgress, childrenMap, personStatus, summarize, weeklyStats,
  type GameData,
} from './game'
import type { DailyQuest, Goal, RankDef, WithId } from './types'

function quest(date: string, done: boolean, xp = 40, id = Math.random().toString(36)): WithId<DailyQuest> {
  return { id, date, title: 'q', stars: 2, xp, done, createdAt: 0 }
}

function game(partial: Partial<GameData>): GameData {
  return {
    config: DEFAULT_CONFIG,
    startDate: '2026-10-01',
    today: '2026-10-01',
    quests: [], activities: [], goals: [], contacts: [], reviews: [], challenges: [],
    rests: new Set(),
    ...partial,
  }
}

describe('date', () => {
  it('treats early morning as the previous day', () => {
    expect(logicalToday(new Date(2026, 9, 12, 3, 59), 4)).toBe('2026-10-11')
    expect(logicalToday(new Date(2026, 9, 12, 4, 0), 4)).toBe('2026-10-12')
  })
  it('finds Monday as week start', () => {
    expect(weekStart('2026-10-12')).toBe('2026-10-12') // Mon
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // Sun
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('ledger', () => {
  it('awards quest XP and PERFECT only when all 3 are done', () => {
    const d = '2026-10-01'
    const three = buildLedger(game({ quests: [quest(d, true), quest(d, true), quest(d, true)] }))
    expect(summarize(three.entries).total).toBe(40 * 3 + 30)
    const two = buildLedger(game({ quests: [quest(d, true), quest(d, true)] }))
    expect(summarize(two.entries).total).toBe(80)
  })

  it('penalises past days but not today or the start day', () => {
    const g = game({
      startDate: '2026-10-01',
      today: '2026-10-04',
      quests: [quest('2026-10-02', true, 100), quest('2026-10-02', false), quest('2026-10-03', false)],
    })
    const { entries } = buildLedger(g)
    const penalties = entries.filter((e) => e.kind === 'penalty')
    // 10/01 = 開始日（対象外）、10/02 = 未達1、10/03 = 未達1、10/04 = 今日（対象外）
    expect(penalties.map((p) => [p.date, p.amount])).toEqual([
      ['2026-10-02', -15],
      ['2026-10-03', -15],
    ])
  })

  it('charges the no-quest penalty and skips rest days', () => {
    const g = game({ startDate: '2026-10-01', today: '2026-10-04', rests: new Set(['2026-10-03']) })
    const penalties = buildLedger(g).entries.filter((e) => e.kind === 'penalty')
    expect(penalties.map((p) => p.date)).toEqual(['2026-10-02'])
    expect(penalties[0].amount).toBe(-50)
  })

  it('never lets the balance go below zero', () => {
    const g = game({ startDate: '2026-10-01', today: '2026-10-10', quests: [quest('2026-10-09', true, 40)] })
    // 10/02〜10/08 は不戦敗で -350 だが 0 で止まり、10/09 に +40
    expect(summarize(buildLedger(g).entries).total).toBe(40)
  })

  it('counts streaks, keeps them through rest days and pays the bonus every 7 days', () => {
    const quests = []
    for (let i = 0; i < 8; i++) {
      const d = addDays('2026-10-01', i)
      if (d !== '2026-10-04') quests.push(quest(d, true, 10))
    }
    const g = game({ today: '2026-10-08', quests, rests: new Set(['2026-10-04']) })
    const { entries, streak } = buildLedger(g)
    expect(streak).toBe(7)
    expect(entries.filter((e) => e.kind === 'streak').map((e) => e.date)).toEqual(['2026-10-08'])
  })

  it('does not break the streak while today is still in progress', () => {
    const g = game({ today: '2026-10-03', quests: [quest('2026-10-01', true), quest('2026-10-02', true)] })
    expect(buildLedger(g).streak).toBe(2)
  })

  it('computes activity XP from minutes', () => {
    expect(activityXp(90, 'attack', DEFAULT_CONFIG.rules)).toBe(30)
    expect(activityXp(60, 'defense', DEFAULT_CONFIG.rules)).toBe(4)
  })
})

describe('rank', () => {
  const ranks: RankDef[] = DEFAULT_RANKS.map((r) => ({ ...r, conditions: r.conditions.map((c) => ({ ...c })) }))

  it('places XP into rank and division', () => {
    const s = computeRank(0, ranks)
    expect(s.fullName).toBe('IRON III')
    expect(s.next).toEqual({ name: 'IRON II', xpNeeded: 100 })

    const b = computeRank(1400, ranks) // BRONZE 300〜1500, 400ずつ → BRONZE I は 1100〜
    expect(b.fullName).toBe('BRONZE I')
    expect(b.next).toEqual({ name: 'SILVER III', xpNeeded: 100 })
    expect(b.progress).toBe(0.75)
  })

  it('holds a promotion match until conditions are cleared', () => {
    const s = computeRank(5000, ranks)
    expect(s.fullName).toBe('SILVER I')
    expect(s.promotion?.target.name).toBe('GOLD')
    expect(s.progress).toBe(1)

    const cleared = ranks.map((r) => (r.id === 'gold' ? { ...r, conditions: r.conditions.map((c) => ({ ...c, cleared: true })) } : r))
    const g = computeRank(5000, cleared)
    expect(g.fullName).toBe('GOLD III')
    expect(g.promotion).toBeNull()
    expect(g.upcoming.map((c) => c.id)).toEqual(['platinum-1'])
  })

  it('demotes when XP drops', () => {
    const up = computeRank(1600, ranks)
    const down = computeRank(1450, ranks)
    expect(up.fullName).toBe('SILVER III')
    expect(down.fullName).toBe('BRONZE I')
    expect(down.tierKey).toBeLessThan(up.tierKey)
  })

  it('handles the top rank', () => {
    const all = ranks.map((r) => ({ ...r, conditions: r.conditions.map((c) => ({ ...c, cleared: true })) }))
    const s = computeRank(50000, all)
    expect(s.fullName).toBe('LEGEND')
    expect(s.next).toBeNull()
  })
})

describe('stats', () => {
  it('groups by week', () => {
    const quests = [quest('2026-10-12', true, 40), quest('2026-10-05', false)]
    const g = game({ startDate: '2026-10-05', today: '2026-10-13', quests })
    const weeks = weeklyStats('2026-10-13', 2, buildLedger(g).entries, quests, [])
    expect(weeks.map((w) => w.start)).toEqual(['2026-10-05', '2026-10-12'])
    expect(weeks[1].gain).toBe(40)
    expect(weeks[0].questsSet).toBe(1)
  })

  it('computes goal progress recursively', () => {
    const goals: WithId<Goal>[] = [
      { id: 'm', level: 'main', parentId: null, title: 'm', done: false, xp: 0, createdAt: 0 },
      { id: 'a', level: 'mid', parentId: 'm', title: 'a', done: true, xp: 0, createdAt: 0 },
      { id: 'b', level: 'mid', parentId: 'm', title: 'b', done: false, xp: 0, createdAt: 0 },
      { id: 'b1', level: 'small', parentId: 'b', title: 'b1', done: true, xp: 0, createdAt: 0 },
      { id: 'b2', level: 'small', parentId: 'b', title: 'b2', done: false, xp: 0, createdAt: 0 },
    ]
    expect(goalProgress(goals[0], childrenMap(goals))).toBe(0.75)
  })

  it('flags people who need contact', () => {
    const p = { name: 'x', category: '取引先' as const, alertDays: 30, createdAt: 0 }
    const s = personStatus(p, [{ personId: 'x', date: '2026-09-01', method: '電話', xp: 10, createdAt: 0 }], '2026-10-12', '2026-08-01')
    expect(s.daysSince).toBe(41)
    expect(s.overdue).toBe(true)
  })
})

describe('challenges', () => {
  it('counts done or started quests plus challenge logs', () => {
    const d = '2026-10-12'
    const started = { ...quest(d, false), started: true }
    const map = challengesByDate(
      [quest(d, true), started, quest(d, false), quest('2026-10-11', true)],
      [{ date: d }, { date: '2026-10-10' }],
    )
    expect(map.get(d)).toBe(3)
    expect(map.get('2026-10-11')).toBe(1)
    expect(map.get('2026-10-10')).toBe(1)
  })
})

describe('started quests', () => {
  it('earn half XP, avoid the penalty and keep the streak', () => {
    const g = game({
      startDate: '2026-10-01',
      today: '2026-10-04',
      quests: [
        quest('2026-10-02', true, 40),
        { ...quest('2026-10-03', false, 40), started: true },
        quest('2026-10-03', false, 40),
      ],
    })
    const { entries, streak } = buildLedger(g)
    expect(entries.find((e) => e.kind === 'started')?.amount).toBe(20)
    // 10/03: 着手1つはペナルティなし、未着手1つだけ -15
    expect(entries.filter((e) => e.kind === 'penalty').map((e) => [e.date, e.amount])).toEqual([['2026-10-03', -15]])
    expect(streak).toBe(2)
  })

  it('do not count toward PERFECT', () => {
    const d = '2026-10-01'
    const qs = [quest(d, true), quest(d, true), { ...quest(d, false), started: true }]
    expect(buildLedger(game({ quests: qs })).entries.some((e) => e.kind === 'perfect')).toBe(false)
  })
})

describe('challenge log', () => {
  it('pays for every attempt and again when it is posted', () => {
    const base = { title: '新規営業トーク', result: 'fail' as const, xp: 20, createdAt: 0 }
    const g = game({
      today: '2026-10-05',
      challenges: [
        { ...base, id: 'c1', date: '2026-10-02', post: 'posted', postedDate: '2026-10-04', postXp: 30 },
        { ...base, id: 'c2', date: '2026-10-03', post: 'idea' },
      ],
      rests: new Set(['2026-10-02', '2026-10-03', '2026-10-04']),
    })
    const { entries } = buildLedger(g)
    expect(entries.filter((e) => e.kind === 'challenge').length).toBe(2)
    expect(entries.filter((e) => e.kind === 'post').map((e) => [e.date, e.amount])).toEqual([['2026-10-04', 30]])
    expect(summarize(entries).total).toBe(70)
  })
})

describe('career', () => {
  it('tracks the best streak even after it breaks', () => {
    const quests = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'].map((d) => quest(d, true))
    const { streak, bestStreak } = buildLedger(game({ today: '2026-10-06', quests }))
    expect(bestStreak).toBe(3)
    expect(streak).toBe(1)
  })

  it('remembers the peak rank after a demotion', () => {
    const ranks = DEFAULT_RANKS.map((r) => ({ ...r, conditions: [] }))
    const entries = [
      { date: '2026-10-01', amount: 1600, kind: 'quest' as const, label: '' },
      { date: '2026-10-02', amount: -300, kind: 'penalty' as const, label: '' },
    ]
    expect(computeRank(summarize(entries).total, ranks).fullName).toBe('BRONZE I')
    expect(peakRank(entries, ranks).fullName).toBe('SILVER III')
  })

  it('computes win rate over past non-rest days', () => {
    const quests = [quest('2026-10-01', true), quest('2026-10-02', false), quest('2026-10-04', true)]
    expect(winRate(quests, new Set(['2026-10-03']), '2026-10-01', '2026-10-05')).toBe(67)
    expect(winRate([], new Set(), '2026-10-05', '2026-10-05')).toBeNull()
  })
})
