// 筋トレの計算はすべてここ（日付は日本時間・週は月曜はじまり）

import { addDays, daysBetween, weekStart, weekday } from './date'
import type {
  BodyWeight, GymDay, GymExercise, GymGroup, GymKind, GymLoad, GymMenu, GymPlan, GymSession, GymSessionExercise, GymSet,
  WithId,
} from './types'

const JST_MS = 9 * 3_600_000

/** 日本時間の日付（端末のタイムゾーンに関係なく） */
export function jstDate(now: Date | number = Date.now()) {
  const ms = typeof now === 'number' ? now : now.getTime()
  return new Date(ms + JST_MS).toISOString().slice(0, 10)
}

export const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土']
/** 金曜日はジムの休館日 */
export const CLOSED_WEEKDAY = 5
export const CLOSED_MESSAGE = 'ジム休館日です'
export const INTRO_DAYS = 14

export function isClosed(date: string) {
  return weekday(date) === CLOSED_WEEKDAY
}

// ---------- 初期メニュー ----------

export const REST_SEC: Record<GymGroup, number> = {
  chest: 120, back: 120, legs: 120, shoulders: 90, arms: 90, abs: 90, calves: 90,
}

export const GROUP_LABEL: Record<GymGroup, string> = {
  chest: '胸', back: '背中', legs: '脚', shoulders: '肩', arms: '腕', abs: '腹筋', calves: 'カーフ',
}

export const LOAD_LABEL: Record<GymLoad, string> = {
  machine: 'マシン', dumbbell: 'ダンベル', barbell: 'バーベル', bodyweight: '自重',
}

/** 重量欄の単位（ダンベルは片手あたり、マシンは表示重量） */
export const WEIGHT_UNIT: Record<GymLoad, string> = {
  machine: 'kg（表示重量）', dumbbell: 'kg（片手）', barbell: 'kg（合計）', bodyweight: '',
}

export const KIND_LABEL: Record<GymKind, string> = { reps: '回数', seconds: '秒数', perSide: '左右の回数' }

function ex(
  id: string, name: string, min: number, max: number, sets: number, load: GymLoad, group: GymGroup,
  opts: { kind?: GymKind; alt?: GymExercise['alt'] } = {},
): GymExercise {
  return {
    id, key: name, name, kind: opts.kind ?? 'reps', load, group, targetMin: min, targetMax: max,
    sets, introSets: Math.min(2, sets), restSec: REST_SEC[group], ...(opts.alt ? { alt: opts.alt } : {}),
  }
}

export const DEFAULT_GYM_PLAN: GymPlan = {
  menus: [
    {
      id: 'upper-a', name: '上半身A', minutes: 60,
      exercises: [
        ex('upper-a-1', 'チェストプレス', 8, 12, 3, 'machine', 'chest'),
        ex('upper-a-2', 'ラットプルダウン', 8, 12, 3, 'machine', 'back'),
        ex('upper-a-3', 'インクラインダンベルプレス', 8, 12, 2, 'dumbbell', 'chest'),
        ex('upper-a-4', 'シーテッドロー', 10, 12, 2, 'machine', 'back'),
        ex('upper-a-5', 'サイドレイズ', 12, 20, 3, 'dumbbell', 'shoulders'),
        ex('upper-a-6', 'ケーブルプレスダウン', 10, 15, 2, 'machine', 'arms'),
        ex('upper-a-7', 'ダンベルカール', 10, 15, 2, 'dumbbell', 'arms'),
      ],
    },
    {
      id: 'lower-a', name: '下半身A', minutes: 50,
      exercises: [
        ex('lower-a-1', 'レッグプレス', 8, 12, 3, 'machine', 'legs'),
        ex('lower-a-2', 'ダンベル・ルーマニアンデッドリフト', 8, 12, 2, 'dumbbell', 'legs', {
          alt: { name: 'ヒップスラスト', load: 'barbell' },
        }),
        ex('lower-a-3', 'レッグカール', 10, 15, 3, 'machine', 'legs'),
        ex('lower-a-4', 'カーフレイズ', 12, 20, 3, 'machine', 'calves'),
        ex('lower-a-5', 'プランク', 20, 40, 3, 'bodyweight', 'abs', { kind: 'seconds' }),
      ],
    },
    {
      id: 'upper-b', name: '上半身B', minutes: 60,
      exercises: [
        ex('upper-b-1', 'ラットプルダウン', 8, 12, 3, 'machine', 'back'),
        ex('upper-b-2', 'インクラインダンベルプレス', 8, 12, 3, 'dumbbell', 'chest'),
        ex('upper-b-3', 'シーテッドロー', 10, 12, 2, 'machine', 'back'),
        ex('upper-b-4', 'チェストプレス', 10, 12, 2, 'machine', 'chest'),
        ex('upper-b-5', 'サイドレイズ', 12, 20, 3, 'dumbbell', 'shoulders'),
        ex('upper-b-6', 'ハンマーカール', 10, 15, 2, 'dumbbell', 'arms'),
        ex('upper-b-7', 'ケーブルプレスダウン', 10, 15, 2, 'machine', 'arms'),
      ],
    },
    {
      id: 'lower-b', name: '下半身B', minutes: 50,
      exercises: [
        ex('lower-b-1', 'レッグプレス', 10, 12, 3, 'machine', 'legs'),
        // 自重から始められるよう、初期値は自重（ダンベルに切り替えられる）
        ex('lower-b-2', 'ブルガリアンスクワット', 8, 12, 2, 'bodyweight', 'legs', { kind: 'perSide' }),
        ex('lower-b-3', 'ヒップスラスト', 8, 12, 3, 'barbell', 'legs'),
        ex('lower-b-4', 'レッグカール', 10, 15, 2, 'machine', 'legs'),
        ex('lower-b-5', 'カーフレイズ', 12, 20, 2, 'machine', 'calves'),
        ex('lower-b-6', 'クランチ', 10, 15, 2, 'bodyweight', 'abs'),
      ],
    },
  ],
  // 日・月・火・水・木・金・土（金曜は休館日なので割り当てない）
  schedule: [null, 'upper-a', 'lower-a', null, 'upper-b', null, 'lower-b'],
  volume: 'intro',
  timer: { sound: true, notify: false },
}

export function targetLabel(e: Pick<GymExercise, 'kind' | 'targetMin' | 'targetMax'>) {
  const range = e.targetMin === e.targetMax ? `${e.targetMin}` : `${e.targetMin}〜${e.targetMax}`
  return e.kind === 'seconds' ? `${range}秒` : e.kind === 'perSide' ? `左右${range}回` : `${range}回`
}

// ---------- 予定 ----------

export type Overrides = Map<string, string | null>

export function overridesOf(days: GymDay[]): Overrides {
  return new Map(days.map((d) => [d.date, d.menuId]))
}

/** その日のメニュー。振替があれば振替を、なければ曜日の予定を使う（金曜は自動で割り当てない） */
export function menuFor(plan: GymPlan, overrides: Overrides, date: string): GymMenu | null {
  const id = overrides.has(date) ? overrides.get(date)! : isClosed(date) ? null : plan.schedule[weekday(date)] ?? null
  return id ? plan.menus.find((m) => m.id === id) ?? null : null
}

/** 予定の振替。行き先に予定があれば入れ替える。金曜日には振り替えない */
export function moveDay(plan: GymPlan, overrides: Overrides, from: string, to: string):
  { ok: true; changes: GymDay[] } | { ok: false; reason: string } {
  if (isClosed(to)) return { ok: false, reason: CLOSED_MESSAGE }
  if (from === to) return { ok: false, reason: '同じ日です' }
  const moving = menuFor(plan, overrides, from)
  if (!moving) return { ok: false, reason: '振り替える予定がありません' }
  const there = menuFor(plan, overrides, to)
  return { ok: true, changes: [{ date: to, menuId: moving.id }, { date: from, menuId: there?.id ?? null }] }
}

export function weekDates(date: string) {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 導入期間（初めて始めた日から14日間）か。まだ一度も始めていなければ、次に始める日から導入期間 */
export function inIntro(plan: GymPlan, date: string) {
  if (!plan.introStart) return true
  const d = daysBetween(plan.introStart, date)
  return d >= 0 && d < INTRO_DAYS
}

/** 導入期間が終わったが、まだ通常のセット数に切り替えていない */
export function introOver(plan: GymPlan, date: string) {
  return !!plan.introStart && plan.volume === 'intro' && daysBetween(plan.introStart, date) >= INTRO_DAYS
}

export function plannedSetsFor(e: GymExercise, volume: GymPlan['volume']) {
  return volume === 'intro' ? Math.max(1, Math.min(e.introSets, e.sets)) : e.sets
}

// ---------- 記録 ----------

const pos = (n: number | null | undefined) => typeof n === 'number' && Number.isFinite(n) && n > 0

/** 入力がそろったセットか（重量は自重なら不要） */
export function setValid(e: Pick<GymSessionExercise, 'kind' | 'load'>, s: GymSet) {
  const amount = e.kind === 'seconds' ? pos(s.seconds) : e.kind === 'perSide' ? pos(s.repsL) && pos(s.repsR) : pos(s.reps)
  return amount && (e.load === 'bodyweight' || pos(s.weight))
}

/** 実績に数える本番セット（完了チェック済み・入力がそろっている・ウォームアップ以外） */
export function workingSets(e: GymSessionExercise) {
  return e.sets.filter((s) => !s.warmup && s.done && setValid(e, s))
}

export function warmupSets(e: GymSessionExercise) {
  return e.sets.filter((s) => s.warmup && s.done && setValid(e, s))
}

/** 終了したときの状態。何も記録していなければ null */
export function finishStatus(s: Pick<GymSession, 'exercises'>): 'done' | 'partial' | null {
  let any = false
  let all = true
  for (const e of s.exercises) {
    const n = workingSets(e).length
    if (n > 0) any = true
    if (n < e.plannedSets) all = false
  }
  if (!any) return null
  return all ? 'done' : 'partial'
}

/** 同じ条件か（種目・記録のしかた・重量の条件・マシンの機器名）。違う条件の重量は比べない */
export function conditionKey(e: Pick<GymSessionExercise, 'key' | 'kind' | 'load' | 'machine'>) {
  return [e.key, e.kind, e.load, e.load === 'machine' ? (e.machine ?? '').trim() : ''].join('|')
}

export function conditionLabel(e: Pick<GymSessionExercise, 'load' | 'machine'>) {
  const m = e.load === 'machine' && e.machine?.trim() ? `・${e.machine.trim()}` : ''
  return `${LOAD_LABEL[e.load]}${m}`
}

function sessionOrder(a: Pick<GymSession, 'date' | 'startedAt'>, b: Pick<GymSession, 'date' | 'startedAt'>) {
  return a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1
}

/** 同じ種目・同じ条件の前回の記録 */
export function previousFor(sessions: WithId<GymSession>[], current: WithId<GymSession>, e: GymSessionExercise) {
  const key = conditionKey(e)
  const before = sessions
    .filter((s) => s.id !== current.id && (s.status === 'done' || s.status === 'partial') && sessionOrder(s, current) < 0)
    .sort(sessionOrder)
  for (let i = before.length - 1; i >= 0; i--) {
    const found = before[i].exercises.find((x) => conditionKey(x) === key && workingSets(x).length > 0)
    if (found) return { date: before[i].date, exercise: found, sets: workingSets(found) }
  }
  return null
}

/** 同じ種目の前回の機器名（同じ重量の条件のもの） */
export function lastMachine(sessions: WithId<GymSession>[], key: string, load: GymLoad) {
  const list = [...sessions].sort(sessionOrder).reverse()
  for (const s of list) {
    const found = s.exercises.find((x) => x.key === key && x.load === load && x.machine?.trim())
    if (found) return found.machine
  }
  return undefined
}

export function setText(e: Pick<GymSessionExercise, 'kind' | 'load'>, s: GymSet) {
  const amount = e.kind === 'seconds' ? `${s.seconds ?? '-'}秒`
    : e.kind === 'perSide' ? `左${s.repsL ?? '-'}・右${s.repsR ?? '-'}回` : `${s.reps ?? '-'}回`
  const w = e.load === 'bodyweight' ? '自重' : `${s.weight ?? '-'}kg`
  return `${w} × ${amount}`
}

export type Progression = 'suggest' | 'achieved' | null

/**
 * 重量アップの提案。同じ重量・同じ条件で、予定の本番セットをすべて目標回数の上限まで達成し、
 * 余力が全セット2回以上・痛みの記録なしのときだけ 'suggest'。余力の入力がなければ 'achieved'（達成の表示だけ）。
 * 導入期間・秒数の種目・自重は対象外。
 */
export function progression(s: Pick<GymSession, 'intro'>, e: GymSessionExercise): Progression {
  if (s.intro || e.kind === 'seconds' || e.load === 'bodyweight' || e.plannedSets < 1) return null
  const sets = workingSets(e).slice(0, e.plannedSets)
  if (sets.length < e.plannedSets) return null
  const w = sets[0].weight
  if (!sets.every((x) => x.weight === w)) return null
  const reachedMax = sets.every((x) =>
    e.kind === 'perSide' ? (x.repsL ?? 0) >= e.targetMax && (x.repsR ?? 0) >= e.targetMax : (x.reps ?? 0) >= e.targetMax)
  if (!reachedMax || e.pain?.trim()) return null
  if (sets.some((x) => x.rir == null)) return 'achieved'
  return sets.every((x) => (x.rir ?? 0) >= 2) ? 'suggest' : 'achieved'
}

export const PROGRESSION_TEXT: Record<'suggest' | 'achieved', string> = {
  suggest: '次回、最小単位の重量アップを検討できます',
  achieved: '目標回数の上限を達成',
}

// ---------- 週・カレンダー ----------

export type DayState = 'rest' | 'closed' | 'planned' | 'missed' | 'active' | 'done' | 'partial' | 'skipped'

export interface GymDayInfo {
  date: string
  menu: GymMenu | null
  moved: boolean
  /** その日の最新の記録 */
  session: WithId<GymSession> | null
  state: DayState
}

export function sessionsOn(sessions: WithId<GymSession>[], date: string) {
  return sessions.filter((s) => s.date === date).sort(sessionOrder)
}

export function dayInfo(plan: GymPlan, overrides: Overrides, sessions: WithId<GymSession>[], date: string, today: string): GymDayInfo {
  const menu = menuFor(plan, overrides, date)
  const list = sessionsOn(sessions, date)
  const session = list[list.length - 1] ?? null
  let state: DayState
  if (session) state = session.status
  else if (menu) state = date < today ? 'missed' : 'planned'
  else state = isClosed(date) ? 'closed' : 'rest'
  return { date, menu, moved: overrides.has(date), session, state }
}

/** 月〜日の予定と実施回数。完了と一部実施は分けて数える */
export function weekSummary(plan: GymPlan, overrides: Overrides, sessions: WithId<GymSession>[], date: string, today: string) {
  const days = weekDates(date).map((d) => dayInfo(plan, overrides, sessions, d, today))
  const inWeek = sessions.filter((s) => s.date >= days[0].date && s.date <= days[6].date)
  return {
    days,
    planned: days.filter((d) => d.menu).length,
    done: inWeek.filter((s) => s.status === 'done').length,
    partial: inWeek.filter((s) => s.status === 'partial').length,
  }
}

/** 今日より後で、次にトレーニングの予定がある日 */
export function nextTraining(plan: GymPlan, overrides: Overrides, today: string) {
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i)
    const menu = menuFor(plan, overrides, date)
    if (menu) return { date, menu }
  }
  return null
}

/** カレンダー用：その月を月曜はじまりの週に分ける（月の外は null） */
export function monthGrid(month: string) {
  const first = `${month}-01`
  const weeks: (string | null)[][] = []
  let d = weekStart(first)
  while (true) {
    const row = Array.from({ length: 7 }, (_, i) => addDays(d, i))
    weeks.push(row.map((x) => (x.slice(0, 7) === month ? x : null)))
    d = addDays(d, 7)
    if (d.slice(0, 7) !== month) break
  }
  return weeks
}

/** 週ごとの実施回数（古い順） */
export function weeklyCounts(sessions: WithId<GymSession>[], today: string, weeks: number) {
  const last = weekStart(today)
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(last, -7 * (weeks - 1 - i))
    const end = addDays(start, 6)
    const list = sessions.filter((s) => s.date >= start && s.date <= end)
    return {
      start,
      done: list.filter((s) => s.status === 'done').length,
      partial: list.filter((s) => s.status === 'partial').length,
    }
  })
}

// ---------- 推移 ----------

/** 種目ごと・条件ごとの記録（新しい順）。条件が違うものは別のグループにする */
export function exerciseHistory(sessions: WithId<GymSession>[], key: string) {
  const groups = new Map<string, { label: string; rows: { date: string; sessionId: string; sets: GymSet[]; exercise: GymSessionExercise }[] }>()
  for (const s of [...sessions].sort(sessionOrder).reverse()) {
    if (s.status !== 'done' && s.status !== 'partial') continue
    for (const e of s.exercises) {
      if (e.key !== key) continue
      const sets = workingSets(e)
      if (!sets.length) continue
      const ck = conditionKey(e)
      const g = groups.get(ck) ?? { label: `${conditionLabel(e)}・${KIND_LABEL[e.kind]}`, rows: [] }
      g.rows.push({ date: s.date, sessionId: s.id, sets, exercise: e })
      groups.set(ck, g)
    }
  }
  return [...groups.values()]
}

/** 記録のある種目（名前つき） */
export function recordedExercises(sessions: WithId<GymSession>[]) {
  const map = new Map<string, string>()
  for (const s of [...sessions].sort(sessionOrder)) {
    if (s.status !== 'done' && s.status !== 'partial') continue
    for (const e of s.exercises) if (workingSets(e).length) map.set(e.key, e.name)
  }
  return [...map.entries()].map(([key, name]) => ({ key, name }))
}

// ---------- 体重 ----------

/** 週ごとの平均体重（古い順。記録がない週は null） */
export function weeklyWeights(entries: Pick<BodyWeight, 'date' | 'kg'>[], today: string, weeks: number) {
  const last = weekStart(today)
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(last, -7 * (weeks - 1 - i))
    const end = addDays(start, 6)
    const list = entries.filter((e) => e.date >= start && e.date <= end)
    const avg = list.length ? Math.round((list.reduce((sum, e) => sum + e.kg, 0) / list.length) * 10) / 10 : null
    return { start, avg, count: list.length }
  })
}
