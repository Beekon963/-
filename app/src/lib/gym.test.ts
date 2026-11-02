import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GYM_PLAN, CLOSED_MESSAGE, exerciseHistory, finishStatus, inIntro, introOver, jstDate, menuFor, moveDay, nextTraining,
  overridesOf, plannedSetsFor, previousFor, progression, setValid, weekSummary, weeklyWeights, workingSets,
} from './gym'
import type { GymSession, GymSessionExercise, GymSet, WithId } from './types'

const plan = DEFAULT_GYM_PLAN
const none = overridesOf([])

function sx(partial: Partial<GymSessionExercise> = {}): GymSessionExercise {
  return {
    exId: 'e1', key: 'チェストプレス', name: 'チェストプレス', kind: 'reps', load: 'machine', group: 'chest',
    targetMin: 8, targetMax: 12, plannedSets: 3, restSec: 120, sets: [], ...partial,
  }
}

const set = (weight: number | null, reps: number | null, rir: number | null = null, done = true): GymSet => ({ weight, reps, rir, done })

function session(id: string, date: string, exercises: GymSessionExercise[], partial: Partial<GymSession> = {}): WithId<GymSession> {
  return {
    id, date, menuId: 'upper-a', menuName: '上半身A', minutes: 60, status: 'done', intro: false,
    startedAt: Date.parse(`${date}T10:00:00Z`), exercises, ...partial,
  }
}

describe('gym schedule (Japan time)', () => {
  it('uses the Japan date whatever the device time zone is', () => {
    // UTC 11/2 15:30 = 日本時間 11/3(火) 0:30
    expect(jstDate(new Date('2026-11-02T15:30:00Z'))).toBe('2026-11-03')
    expect(jstDate(new Date('2026-11-02T14:59:00Z'))).toBe('2026-11-02')
  })

  it('maps the default week: Mon upper A … Sat lower B, rest on Wed/Fri/Sun', () => {
    const names = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
      .map((d) => menuFor(plan, none, d)?.name ?? null)
    expect(names).toEqual(['上半身A', '下半身A', null, '上半身B', null, '下半身B', null])
  })

  it('never assigns Friday automatically, even if the schedule says so', () => {
    const odd = { ...plan, schedule: plan.schedule.map((m, i) => (i === 5 ? 'upper-a' : m)) }
    expect(menuFor(odd, none, '2026-11-06')).toBeNull()
  })

  it('moves a plan, swaps with a planned day and refuses Friday', () => {
    expect(moveDay(plan, none, '2026-11-02', '2026-11-06')).toEqual({ ok: false, reason: CLOSED_MESSAGE })
    const toWed = moveDay(plan, none, '2026-11-02', '2026-11-04')
    expect(toWed).toEqual({ ok: true, changes: [{ date: '2026-11-04', menuId: 'upper-a' }, { date: '2026-11-02', menuId: null }] })
    const swap = moveDay(plan, none, '2026-11-02', '2026-11-03')
    expect(swap.ok && swap.changes).toEqual([{ date: '2026-11-03', menuId: 'upper-a' }, { date: '2026-11-02', menuId: 'lower-a' }])
    const moved = overridesOf(toWed.ok ? toWed.changes : [])
    expect(menuFor(plan, moved, '2026-11-02')).toBeNull()
    expect(menuFor(plan, moved, '2026-11-04')?.name).toBe('上半身A')
  })

  it('does not carry a missed day over to the next day', () => {
    const w = weekSummary(plan, none, [], '2026-11-03', '2026-11-03')
    expect(w.days[0].state).toBe('missed')
    expect(w.days[1].menu?.name).toBe('下半身A')
    expect(w.days[2].state).toBe('rest')
    expect(w.days[4].state).toBe('closed')
    expect(w.planned).toBe(4)
    expect(nextTraining(plan, none, '2026-11-03')?.date).toBe('2026-11-05')
  })
})

describe('gym records', () => {
  it('saves seconds, bodyweight, decimal weight and left/right reps', () => {
    expect(setValid({ kind: 'seconds', load: 'bodyweight' }, { seconds: 30, done: true })).toBe(true)
    expect(setValid({ kind: 'perSide', load: 'bodyweight' }, { repsL: 10, repsR: 9, done: true })).toBe(true)
    expect(setValid({ kind: 'perSide', load: 'bodyweight' }, { repsL: 10, done: true })).toBe(false)
    expect(setValid({ kind: 'reps', load: 'dumbbell' }, { weight: 7.5, reps: 10, done: true })).toBe(true)
    expect(setValid({ kind: 'reps', load: 'machine' }, { reps: 10, done: true })).toBe(false)
  })

  it('keeps unfinished, empty and warm-up sets out of the results', () => {
    const e = sx({
      sets: [
        { warmup: true, weight: 20, reps: 10, done: true },
        set(40, 12), set(40, 10, null, false), set(null, null),
      ],
    })
    expect(workingSets(e)).toHaveLength(1)
    expect(finishStatus({ exercises: [e] })).toBe('partial')
    expect(finishStatus({ exercises: [sx({ sets: [set(null, null), set(40, 8, null, false)] })] })).toBeNull()
    expect(finishStatus({ exercises: [sx({ plannedSets: 1, sets: [set(40, 8)] })] })).toBe('done')
  })

  it('compares only with the same exercise under the same conditions', () => {
    const old = session('s1', '2026-11-02', [sx({ machine: 'A社', sets: [set(40, 12)] })])
    const other = session('s2', '2026-11-05', [sx({ machine: 'B社', sets: [set(55, 10)] })])
    const dumbbell = session('s3', '2026-11-06', [sx({ load: 'dumbbell', sets: [set(16, 10)] })])
    const now = session('s4', '2026-11-09', [], { status: 'active' })
    const prev = previousFor([old, other, dumbbell, now], now, sx({ machine: 'A社' }))
    expect(prev?.date).toBe('2026-11-02')
    expect(prev?.sets[0].weight).toBe(40)
    expect(exerciseHistory([old, other, dumbbell], 'チェストプレス')).toHaveLength(3)
  })

  it('keeps past records as they were after the menu changes', () => {
    const before = session('s1', '2026-11-02', [sx({ name: 'チェストプレス', targetMax: 12, sets: [set(40, 12)] })])
    const edited = {
      ...plan,
      menus: plan.menus.map((m) => (m.id === 'upper-a' ? { ...m, exercises: m.exercises.slice(1) } : m)),
    }
    expect(menuFor(edited, none, '2026-11-09')?.exercises[0].name).toBe('ラットプルダウン')
    expect(before.exercises[0].name).toBe('チェストプレス')
    expect(exerciseHistory([before], 'チェストプレス')[0].rows[0].sets[0].reps).toBe(12)
  })

  it('uses two (or one) sets in the intro period and switches only when chosen', () => {
    const chest = plan.menus[0].exercises[0]
    expect(plannedSetsFor(chest, 'intro')).toBe(2)
    expect(plannedSetsFor({ ...chest, introSets: 1 }, 'intro')).toBe(1)
    expect(plannedSetsFor(chest, 'normal')).toBe(3)
    const started = { ...plan, introStart: '2026-11-02' }
    expect(inIntro(started, '2026-11-15')).toBe(true)
    expect(inIntro(started, '2026-11-16')).toBe(false)
    expect(introOver(started, '2026-11-16')).toBe(true)
    expect(introOver({ ...started, volume: 'normal' }, '2026-11-16')).toBe(false)
  })
})

describe('weight-up suggestion', () => {
  const base = { intro: false }
  const full = (rir: number | null) => sx({ sets: [set(40, 12, rir), set(40, 12, rir), set(40, 12, rir)] })

  it('suggests when every planned set hits the top of the range with 2+ reps in reserve', () => {
    expect(progression(base, full(2))).toBe('suggest')
  })

  it('only shows the achievement when reps in reserve are missing or below 2', () => {
    expect(progression(base, full(null))).toBe('achieved')
    expect(progression(base, full(1))).toBe('achieved')
  })

  it('stays silent otherwise', () => {
    expect(progression(base, sx({ sets: [set(40, 12, 3), set(40, 12, 3), set(40, 11, 3)] }))).toBeNull()
    expect(progression(base, sx({ sets: [set(40, 12, 3), set(40, 12, 3)] }))).toBeNull()
    expect(progression(base, sx({ sets: [set(40, 12, 3), set(42.5, 12, 3), set(40, 12, 3)] }))).toBeNull()
    expect(progression(base, { ...full(3), pain: '右肩に違和感' })).toBeNull()
    expect(progression({ intro: true }, full(3))).toBeNull()
    expect(progression(base, sx({ kind: 'seconds', load: 'bodyweight', sets: [{ seconds: 40, rir: 3, done: true }] }))).toBeNull()
    expect(progression(base, sx({ load: 'bodyweight', plannedSets: 1, sets: [set(null, 12, 3)] }))).toBeNull()
  })

  it('needs both sides at the top for left/right exercises', () => {
    const e = (r: number) => sx({ kind: 'perSide', load: 'dumbbell', plannedSets: 1, sets: [{ weight: 10, repsL: 12, repsR: r, rir: 2, done: true }] })
    expect(progression(base, e(12))).toBe('suggest')
    expect(progression(base, e(11))).toBeNull()
  })
})

describe('body weight', () => {
  it('averages each Monday-to-Sunday week', () => {
    const w = weeklyWeights([{ date: '2026-11-02', kg: 70.2 }, { date: '2026-11-08', kg: 69.6 }, { date: '2026-11-09', kg: 69.5 }], '2026-11-09', 2)
    expect(w).toEqual([{ start: '2026-11-02', avg: 69.9, count: 2 }, { start: '2026-11-09', avg: 69.5, count: 1 }])
  })
})
