// 筋トレ：レコードから状態を組み立てる＋画面から呼ぶ操作。
// 保存は他のデータと同じレコード方式（端末に保存し、ログイン中は自分のアカウントにだけ同期）。

import { useEffect, useMemo, useState } from 'react'
import {
  CLOSED_MESSAGE, DEFAULT_GYM_PLAN, finishStatus, inIntro, introOver, isClosed, jstDate, lastMachine, moveDay as planMove,
  nextTraining, overridesOf, plannedSetsFor, weekSummary, dayInfo,
} from '../lib/gym'
import type {
  BodyWeight, GymDay, GymExercise, GymMenu, GymPlan, GymSession, GymSessionExercise, GymSet, Rec, RecType, WithId,
} from '../lib/types'
import { newId, put, remove, useData } from './data'
import { offerUndo, openWorkout } from './ui'

export const GYM_PLAN_ID = 'gym-plan'

function listOf<T>(records: Record<string, Rec>, type: RecType) {
  const out: WithId<T>[] = []
  for (const r of Object.values(records)) if (r.type === type && !r.deleted) out.push({ ...(r.data as T), id: r.id })
  return out
}

function planOf(records: Record<string, Rec>): { plan: GymPlan; saved: boolean } {
  const rec = records[GYM_PLAN_ID]
  if (rec && !rec.deleted) return { plan: { ...DEFAULT_GYM_PLAN, ...(rec.data as GymPlan) }, saved: true }
  return { plan: DEFAULT_GYM_PLAN, saved: false }
}

export function deriveGym(records: Record<string, Rec>, now: Date) {
  const { plan, saved } = planOf(records)
  const today = jstDate(now)
  const days = listOf<GymDay>(records, 'gymDay')
  const overrides = overridesOf(days)
  const sessions = listOf<GymSession>(records, 'gymSession')
    .sort((a, b) => (a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1))
  const weights = listOf<BodyWeight>(records, 'bodyWeight').sort((a, b) => (a.date < b.date ? 1 : -1))
  const active = [...sessions].reverse().find((s) => s.status === 'active') ?? null
  return {
    plan,
    saved,
    today,
    overrides,
    days,
    sessions,
    weights,
    active,
    todayInfo: dayInfo(plan, overrides, sessions, today, today),
    week: weekSummary(plan, overrides, sessions, today, today),
    next: nextTraining(plan, overrides, today),
    intro: inIntro(plan, today),
    introOver: introOver(plan, today),
  }
}

export type Gym = ReturnType<typeof deriveGym>

export function useGym(): Gym {
  const records = useData((s) => s.records)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  const day = jstDate(now)
  return useMemo(() => deriveGym(records, now), [records, day])
}

function current() {
  return deriveGym(useData.getState().records, new Date())
}

function rec(id: string) {
  const r = useData.getState().records[id]
  return r && !r.deleted ? r : null
}

/** 変更前の内容を覚えておき、「元に戻す」で書き戻す */
function undoable(text: string, ids: string[], change: () => void) {
  const before = ids.map((id) => ({ id, rec: rec(id) }))
  change()
  offerUndo(text, () => {
    for (const { id, rec: r } of before) {
      if (r) put(r.type, id, r.data as never)
      else remove(id)
    }
  })
}

// ---------- メニュー ----------

/** 初期メニューを保存する（決まった id なので、何度呼んでも重複しない） */
export function ensurePlan(): GymPlan {
  const { plan, saved } = planOf(useData.getState().records)
  if (!saved) put('gymPlan', GYM_PLAN_ID, structuredClone(plan))
  return planOf(useData.getState().records).plan
}

export function updatePlan(fn: (p: GymPlan) => GymPlan) {
  put('gymPlan', GYM_PLAN_ID, fn(ensurePlan()))
}

export function updateMenu(menuId: string, fn: (m: GymMenu) => GymMenu) {
  updatePlan((p) => ({ ...p, menus: p.menus.map((m) => (m.id === menuId ? fn(m) : m)) }))
}

export function saveExercise(menuId: string, exercise: GymExercise) {
  updateMenu(menuId, (m) => {
    const i = m.exercises.findIndex((e) => e.id === exercise.id)
    const exercises = [...m.exercises]
    if (i >= 0) exercises[i] = exercise
    else exercises.push(exercise)
    return { ...m, exercises }
  })
}

export function moveExercise(menuId: string, index: number, dir: -1 | 1) {
  updateMenu(menuId, (m) => {
    const j = index + dir
    if (j < 0 || j >= m.exercises.length) return m
    const exercises = [...m.exercises]
    ;[exercises[index], exercises[j]] = [exercises[j], exercises[index]]
    return { ...m, exercises }
  })
}

export function deleteExercise(menuId: string, exId: string) {
  ensurePlan()
  undoable('種目を削除しました', [GYM_PLAN_ID], () =>
    updateMenu(menuId, (m) => ({ ...m, exercises: m.exercises.filter((e) => e.id !== exId) })))
}

export function newExercise(): GymExercise {
  return {
    id: newId(), key: '', name: '', kind: 'reps', load: 'machine', group: 'chest',
    targetMin: 8, targetMax: 12, sets: 3, introSets: 2, restSec: 120,
  }
}

/** 曜日ごとの予定。金曜日は休館日なので割り当てない */
export function setSchedule(wd: number, menuId: string | null) {
  if (wd === 5 && menuId) return CLOSED_MESSAGE
  updatePlan((p) => ({ ...p, schedule: p.schedule.map((m, i) => (i === wd ? menuId : m)) }))
  return null
}

// ---------- 予定の振替 ----------

/** 予定を別の日に振り替える（行き先に予定があれば入れ替え）。失敗したら理由を返す */
export function moveDay(from: string, to: string) {
  const g = current()
  const res = planMove(g.plan, g.overrides, from, to)
  if (!res.ok) return res.reason
  for (const c of res.changes) put('gymDay', `gymday-${c.date}`, c)
  return null
}

/** その週の振替をやめて、曜日どおりに戻す */
export function resetMoves(dates: string[]) {
  const ids = dates.map((d) => `gymday-${d}`).filter((id) => rec(id))
  if (ids.length) undoable('振替を元に戻しました', ids, () => remove(...ids))
}

// ---------- トレーニング ----------

function snapshot(e: GymExercise, plan: GymPlan, sessions: WithId<GymSession>[]): GymSessionExercise {
  const plannedSets = plannedSetsFor(e, plan.volume)
  return {
    exId: e.id, key: e.key || e.name, name: e.name, kind: e.kind, load: e.load, group: e.group,
    targetMin: e.targetMin, targetMax: e.targetMax, plannedSets, restSec: e.restSec,
    ...(e.alt ? { alt: e.alt } : {}),
    ...(e.load === 'machine' ? { machine: lastMachine(sessions, e.key || e.name, 'machine') } : {}),
    sets: Array.from({ length: plannedSets }, () => ({ done: false })),
  }
}

/** トレーニングを始める（同じ日の同じメニューが実施中なら、それを再開する） */
export function startWorkout(menuId: string) {
  const g = current()
  const resume = g.sessions.find((s) => s.status === 'active' && s.date === g.today && s.menuId === menuId)
  if (resume) {
    openWorkout(resume.id)
    return resume.id
  }
  let plan = ensurePlan()
  if (!plan.introStart) {
    plan = { ...plan, introStart: g.today }
    put('gymPlan', GYM_PLAN_ID, plan)
  }
  const menu = plan.menus.find((m) => m.id === menuId)
  if (!menu) return null
  const session: GymSession = {
    date: g.today, menuId, menuName: menu.name, minutes: menu.minutes, status: 'active',
    intro: inIntro(plan, g.today), startedAt: Date.now(),
    exercises: menu.exercises.map((e) => snapshot(e, plan, g.sessions)),
  }
  const id = newId()
  put('gymSession', id, session)
  openWorkout(id)
  return id
}

/** 今日の予定を見送る（失敗ではなく、見送りとして残す） */
export function skipToday(menu: GymMenu) {
  const g = current()
  const id = newId()
  const session: GymSession = {
    date: g.today, menuId: menu.id, menuName: menu.name, minutes: menu.minutes, status: 'skipped',
    intro: false, startedAt: Date.now(), exercises: [],
  }
  undoable('今日は見送りにしました', [id], () => put('gymSession', id, session))
}

function getSession(id: string) {
  const r = rec(id)
  return r && r.type === 'gymSession' ? (r.data as GymSession) : null
}

/** 入力のたびに保存する */
export function updateSession(id: string, fn: (s: GymSession) => GymSession) {
  const s = getSession(id)
  if (s) put('gymSession', id, fn(s))
}

export function updateExercise(id: string, index: number, fn: (e: GymSessionExercise) => GymSessionExercise) {
  updateSession(id, (s) => ({ ...s, exercises: s.exercises.map((e, i) => (i === index ? fn(e) : e)) }))
}

export function updateSet(id: string, exIndex: number, setIndex: number, partial: Partial<GymSet>) {
  updateExercise(id, exIndex, (e) => ({ ...e, sets: e.sets.map((x, i) => (i === setIndex ? { ...x, ...partial } : x)) }))
}

/** セットを足す。ウォームアップは本番セットより前に入れる */
export function addSet(id: string, exIndex: number, warmup = false) {
  updateExercise(id, exIndex, (e) => {
    if (!warmup) return { ...e, sets: [...e.sets, { done: false }] }
    const firstWork = e.sets.findIndex((x) => !x.warmup)
    const at = firstWork < 0 ? e.sets.length : firstWork
    return { ...e, sets: [...e.sets.slice(0, at), { warmup: true, done: false }, ...e.sets.slice(at)] }
  })
}

export function removeSet(id: string, exIndex: number, setIndex: number) {
  undoable('セットを削除しました', [id], () =>
    updateExercise(id, exIndex, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== setIndex) })))
}

/** 前回の重量を、重量が空の本番セットに入れる（回数と完了チェックは入れない） */
export function copyWeight(id: string, exIndex: number, weight: number) {
  updateExercise(id, exIndex, (e) => ({
    ...e, sets: e.sets.map((x) => (!x.warmup && (x.weight == null || Number.isNaN(x.weight)) ? { ...x, weight } : x)),
  }))
}

/** 置き換えできる種目に変える（もう一度押すと元に戻る） */
export function swapExercise(id: string, exIndex: number) {
  const g = current()
  updateExercise(id, exIndex, (e) => {
    if (!e.alt) return e
    const back = { name: e.name, load: e.load, key: e.key }
    const key = e.alt.key ?? e.alt.name
    return {
      ...e, name: e.alt.name, key, load: e.alt.load, alt: back,
      swappedFrom: e.swappedFrom ? undefined : e.name,
      machine: e.alt.load === 'machine' ? lastMachine(g.sessions, key, 'machine') : undefined,
    }
  })
}

/** 記録方式（マシン・ダンベル・バーベル・自重）を変える。条件が変わるので前回の比較先も変わる */
export function setLoad(id: string, exIndex: number, load: GymSessionExercise['load']) {
  const g = current()
  updateExercise(id, exIndex, (e) => ({
    ...e, load, machine: load === 'machine' ? e.machine ?? lastMachine(g.sessions, e.key, 'machine') : undefined,
  }))
}

/** 終了・保存。完了か一部実施かは記録から決める。何も記録していなければ消す（元に戻せる） */
export function finishWorkout(id: string): GymSession['status'] | null {
  const s = getSession(id)
  if (!s) return null
  const status = finishStatus(s)
  if (!status) {
    undoable('記録がないので削除しました', [id], () => remove(id))
    return null
  }
  put('gymSession', id, { ...s, status, endedAt: s.endedAt ?? Date.now() })
  return status
}

export function deleteSession(id: string) {
  undoable('トレーニングの記録を削除しました', [id], () => remove(id))
}

// ---------- 導入期間・タイマー ----------

export function setVolume(volume: GymPlan['volume']) {
  updatePlan((p) => ({ ...p, volume }))
}

export function setTimerPref(partial: Partial<GymPlan['timer']>) {
  updatePlan((p) => ({ ...p, timer: { ...p.timer, ...partial } }))
}

// ---------- 体重 ----------

export function saveWeight(date: string, kg: number) {
  if (!(kg > 0)) return
  const id = `bw-${date}`
  const prev = rec(id)?.data as BodyWeight | undefined
  put('bodyWeight', id, { date, kg: Math.round(kg * 10) / 10, createdAt: prev?.createdAt ?? Date.now() })
}

export function deleteWeight(id: string) {
  undoable('体重の記録を削除しました', [id], () => remove(id))
}

export { isClosed }
