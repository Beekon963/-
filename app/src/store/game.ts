// レコードからゲーム状態を組み立てる＋画面から呼ぶ操作

import { useEffect, useMemo, useState } from 'react'
import { addDays, daysBetween, logicalToday, monthStart, nextMonthStart, weekStart, weekday } from '../lib/date'
import { DEFAULT_CONFIG, MAX_DAILY_QUESTS, MAX_PERIOD_GOALS, MODES } from '../lib/defaults'
import { activityXp, buildLedger, challengesByDate, computeRank, dayStat, peakRank, penaltyFor, startedXp, summarize, untouched, winRate } from '../lib/game'
import type {
  Activity, ActivityKind, Challenge, ChallengeResult, Config, Contact, ContactMethod, DailyQuest, Goal, GoalLevel, PeriodGoal,
  PeriodKind, Person, PostStatus, QuestKind, Rec, RecordMap, RecType, Review, Stars, Vision, WithId,
} from '../lib/types'
import { newId, patch, put, remove, useData } from './data'
import { toast } from './ui'

function mergeConfig(saved?: Partial<Config>): Config {
  if (!saved) return DEFAULT_CONFIG
  return {
    ...DEFAULT_CONFIG,
    ...saved,
    rules: { ...DEFAULT_CONFIG.rules, ...saved.rules, goal: { ...DEFAULT_CONFIG.rules.goal, ...saved.rules?.goal } },
    ranks: saved.ranks?.length ? saved.ranks : DEFAULT_CONFIG.ranks,
    mode: saved.mode ?? DEFAULT_CONFIG.mode,
    reminders: { ...DEFAULT_CONFIG.reminders, ...saved.reminders },
  }
}

type Lists = {
  [K in RecType]: WithId<RecordMap[K]>[]
}

function collectLists(records: Record<string, Rec>): Lists {
  const lists: Lists = {
    config: [], profile: [], goal: [], quest: [], activity: [], person: [], contact: [], review: [], rest: [], vision: [], challenge: [], pgoal: [],
  }
  for (const r of Object.values(records)) {
    if (r.deleted || !lists[r.type]) continue
    ;(lists[r.type] as unknown[]).push({ ...(r.data as object), id: r.id })
  }
  return lists
}

export function deriveGame(records: Record<string, Rec>, now: Date) {
  const config = mergeConfig(records.config && !records.config.deleted ? (records.config.data as Config) : undefined)
  const today = logicalToday(now, config.dayStartHour)
  const lists = collectLists(records)
  const profile = records.profile && !records.profile.deleted ? (records.profile.data as RecordMap['profile']) : null
  const startDate = profile?.startDate ?? today
  const rests = new Set(lists.rest.map((r) => r.date))
  const byCreated = <T extends { createdAt: number }>(a: T, b: T) => a.createdAt - b.createdAt

  const planSince = profile?.planSince ?? null
  const { entries, streak, bestStreak, autoRests, comebackReady } = buildLedger({
    config, startDate, today, rests, planSince,
    quests: lists.quest, activities: lists.activity, goals: lists.goal, contacts: lists.contact, reviews: lists.review,
    challenges: lists.challenge, periodGoals: lists.pgoal,
  })
  // 明日以降のクエストは「計画」なので、集計には今日までの分だけ使う
  const quests = lists.quest.filter((q) => q.date <= today)
  const createdDay = (ms: number) => logicalToday(new Date(ms), config.dayStartHour)
  const { total } = summarize(entries)
  const rank = computeRank(total, config.ranks)
  const todayStat = dayStat(today, entries, quests, lists.activity)

  const vision = records.vision && !records.vision.deleted ? (records.vision.data as Vision) : null
  const challengeMap = challengesByDate(quests, lists.challenge)
  let challengeTotal = 0
  for (const n of challengeMap.values()) challengeTotal += n

  const ws = weekStart(today)
  // 自分で決めた休息日と、保険で自動的に休息日になった日の両方
  const allRests = new Set([...rests, ...autoRests])
  const restsThisWeek = [...allRests].filter((d) => d >= ws && d <= addDays(ws, 6)).length
  const mode = MODES[config.mode] ?? MODES.standard
  const todayActive = quests.some((q) => q.date === today && !untouched(q)) || lists.challenge.some((c) => c.date === today)

  const tomorrow = addDays(today, 1)
  const ms = monthStart(today)
  const goalsOf = (period: PeriodKind, start: string) =>
    lists.pgoal.filter((p) => p.period === period && p.start === start).sort(byCreated)
  const todayQuests = lists.quest.filter((q) => q.date === today).sort(byCreated)
  // 計画ルールが今日の締め切りに効いているか（開始日と、ルール導入日の前は対象外）
  const enforced = !!planSince && today >= planSince && today > startDate && !rests.has(today)

  return {
    config,
    vision,
    career: {
      bestStreak,
      winRate: winRate(quests, allRests, startDate, today),
      peak: peakRank(entries, config.ranks),
      days: daysBetween(startDate, today) + 1,
      attackMin: lists.activity.reduce((m, a) => m + (a.kind === 'attack' ? a.minutes : 0), 0),
      posts: lists.challenge.filter((c) => c.post === 'posted').length,
    },
    challenges: {
      total: challengeTotal,
      today: challengeMap.get(today) ?? 0,
      yesterday: challengeMap.get(addDays(today, -1)) ?? 0,
    },
    today,
    startDate,
    hasProfile: !!profile,
    entries,
    total,
    streak,
    /** 今日、最低ライン（1つ着手 or 挑戦1回）を越えたか */
    todayActive,
    comebackReady,
    mode,
    /** モードをかけたあとの減点 */
    penalty: (n: number) => penaltyFor(n, mode),
    rank,
    todayStat,
    todayEntries: entries.filter((e) => e.date === today),
    todayQuests,
    /** 今日のクエストが前日までに書かれていたか */
    todayPlanned: todayQuests.some((q) => createdDay(q.createdAt) < today),
    tomorrow,
    tomorrowQuests: lists.quest.filter((q) => q.date === tomorrow).sort(byCreated),
    periods: {
      week: { start: ws, next: addDays(ws, 7), goals: goalsOf('week', ws), nextGoals: goalsOf('week', addDays(ws, 7)) },
      month: { start: ms, next: nextMonthStart(today), goals: goalsOf('month', ms), nextGoals: goalsOf('month', nextMonthStart(today)) },
    },
    plan: {
      enforced,
      /** 今日の締め切りを逃すと実際に XP が減る */
      penalized: enforced && mode.penalty > 0,
      /** 今日が来週・来月の目標の締め切り日か */
      weekDue: weekday(today) === 0,
      monthDue: tomorrow.endsWith('-01'),
    },
    todayActivities: lists.activity.filter((a) => a.date === today).sort(byCreated),
    todayReview: lists.review.find((r) => r.date === today) ?? null,
    isRestDay: rests.has(today),
    restDates: allRests,
    autoRests,
    /** 今週の休息日の残り（保険があるモードでは、何もできなかった日に自動で使われる） */
    restsLeft: Math.max(0, config.rules.restDaysPerWeek - restsThisWeek),
    quests,
    activities: lists.activity.sort(byCreated),
    goals: lists.goal.sort(byCreated),
    persons: lists.person.sort(byCreated),
    contacts: lists.contact.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1)),
    reviews: lists.review.sort((a, b) => (a.date < b.date ? 1 : -1)),
    /** 新しい順 */
    challengeLogs: lists.challenge.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
  }
}

export type Game = ReturnType<typeof deriveGame>

/** 計画を書かなかったときの減点の説明。dueToday = 締め切りが今日 */
export function penaltyNote(g: Game, n: number, dueToday = true) {
  if (g.mode.penalty === 0) return '減点なし（CASUAL）'
  if (dueToday && !g.plan.enforced) return '減点は明日から'
  return `書かないと −${g.penalty(n)}XP`
}

/** 1日の切り替わりに追従するための「今」 */
function useNow() {
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
  return now
}

export function useGame(): Game {
  const records = useData((s) => s.records)
  const now = useNow()
  // 分単位の now で毎回作り直さないよう、日付が変わったときだけ再計算する
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`
  return useMemo(() => deriveGame(records, now), [records, dayKey])
}

function current() {
  return deriveGame(useData.getState().records, new Date())
}

// ---------- 初期化 ----------

export function ensureProfile() {
  const g = current()
  if (!g.hasProfile) {
    put('profile', 'profile', { startDate: g.today, planSince: g.today })
    return
  }
  // すでに使っている人は、さかのぼって減点しないよう「明日から」ルールを始める
  const profile = useData.getState().records.profile?.data as RecordMap['profile'] | undefined
  if (profile && !profile.planSince) patch('profile', 'profile', { planSince: addDays(g.today, 1) })
}

// ---------- 設定 ----------

export function saveConfig(next: Config) {
  put('config', 'config', next)
}

export function updateConfig(fn: (c: Config) => Config) {
  saveConfig(fn(current().config))
}

// ---------- デイリー ----------

export interface QuestInput {
  title: string
  stars: Stars
  goalId?: string
  kind?: QuestKind
  /** 省略すると今日 */
  date?: string
}

export function addQuest(input: QuestInput) {
  const g = current()
  const date = input.date ?? g.today
  const count = Object.values(useData.getState().records).filter((r) => r.type === 'quest' && !r.deleted && (r.data as DailyQuest).date === date).length
  if (count >= MAX_DAILY_QUESTS) return
  const quest: DailyQuest = {
    date, title: input.title.trim(), stars: input.stars, goalId: input.goalId || undefined, kind: input.kind,
    xp: g.config.rules.quest[input.stars - 1], done: false, createdAt: Date.now(),
  }
  put('quest', newId(), quest)
}

export function editQuest(id: string, input: QuestInput) {
  const g = current()
  patch('quest', id, {
    title: input.title.trim(), stars: input.stars, goalId: input.goalId || undefined, kind: input.kind,
    xp: g.config.rules.quest[input.stars - 1],
  })
}

export function deleteQuest(id: string) {
  const linked = current().activities.filter((a) => a.questId === id).map((a) => a.id)
  remove(id, ...linked)
}

/** その日はじめての行動で、連続キープ・連続ボーナス・COMEBACK を知らせる */
function firstAction(g: Game) {
  if (g.todayActive) return
  const n = g.streak + 1
  const { rules } = g.config
  setTimeout(() => {
    if (g.comebackReady) toast(rules.comebackBonus, 'COMEBACK', 'おかえり。ここからまた積み上げる')
    else if (rules.streakEvery > 0 && n % rules.streakEvery === 0) toast(rules.streakBonus, 'STREAK', `${n}日連続ボーナス`)
    else toast(0, n > 1 ? 'STREAK' : 'MIN LINE', n > 1 ? `連続${n}日 キープ` : '今日の最低ラインをクリア')
  }, 700)
}

/** 戻り値 true = 達成にした */
export function toggleQuest(q: WithId<DailyQuest>) {
  const g = current()
  if (q.done) {
    patch('quest', q.id, { done: false })
    const linked = g.activities.filter((a) => a.questId === q.id).map((a) => a.id)
    if (linked.length) remove(...linked)
    toast(-q.xp, 'UNDO', q.title)
    return false
  }
  patch('quest', q.id, { done: true, started: false })
  if (q.date === g.today && !q.started) firstAction(g)
  const willBePerfect = g.todayQuests.length >= MAX_DAILY_QUESTS && g.todayQuests.every((x) => x.done || x.id === q.id)
  toast(q.xp, 'QUEST CLEAR', q.title)
  if (willBePerfect) setTimeout(() => toast(g.config.rules.perfectBonus, 'PERFECT', '3つ全クリア'), 450)
  return true
}

/** 着手（途中まで）を切り替える。達成済みには使わない */
export function toggleStarted(q: WithId<DailyQuest>) {
  if (q.done) return
  const g = current()
  const rules = g.config.rules
  patch('quest', q.id, { started: !q.started })
  if (!q.started && q.date === g.today) firstAction(g)
  toast(q.started ? -startedXp(q, rules) : startedXp(q, rules), q.started ? 'UNDO' : 'ENGAGED', q.title, 'atk')
}

/** 最近のクエスト（同じタイトルは新しいほう）。date の日にもうあるものは除く */
export function recentQuests(g: Game, date: string, limit = 6) {
  const taken = new Set([...g.quests, ...g.tomorrowQuests].filter((q) => q.date === date).map((q) => q.title))
  const seen = new Set<string>()
  const out: WithId<DailyQuest>[] = []
  for (const q of [...g.quests].sort((a, b) => b.createdAt - a.createdAt)) {
    if (seen.has(q.title) || taken.has(q.title)) continue
    seen.add(q.title)
    out.push(q)
    if (out.length >= limit) break
  }
  return out
}

export function untouchedToday() {
  return current().todayQuests.filter(untouched)
}

// ---------- 攻め・守り ----------

export function logActivity(input: { kind: ActivityKind; title: string; minutes: number; goalId?: string; questId?: string }) {
  const g = current()
  const xp = activityXp(input.minutes, input.kind, g.config.rules)
  const activity: Activity = {
    date: g.today, kind: input.kind, title: input.title.trim(), minutes: input.minutes,
    goalId: input.goalId || undefined, questId: input.questId, xp, createdAt: Date.now(),
  }
  put('activity', newId(), activity)
  if (xp) toast(xp, input.kind === 'attack' ? 'ATTACK' : 'DEFENSE', input.title, input.kind === 'attack' ? 'atk' : undefined)
}

export function deleteActivity(id: string) {
  remove(id)
}

// ---------- 休息日 ----------

export function setRestDay(on: boolean) {
  const g = current()
  const id = `rest-${g.today}`
  if (on) put('rest', id, { date: g.today })
  else remove(id)
}

// ---------- 振り返り ----------

export function saveReview(date: string, comment: string, score?: number) {
  const g = current()
  const existing = g.reviews.find((r) => r.date === date)
  const review: Review = {
    date, comment: comment.trim(), score, xp: existing?.xp ?? g.config.rules.review, createdAt: existing?.createdAt ?? Date.now(),
  }
  put('review', `review-${date}`, review)
  if (!existing) toast(review.xp, 'DEBRIEF', '今日の振り返り')
}

// ---------- 目標 ----------

export function addGoal(input: { level: GoalLevel; parentId: string | null; title: string; why?: string; deadline?: string }) {
  const g = current()
  const goal: Goal = {
    level: input.level, parentId: input.parentId, title: input.title.trim(), why: input.why?.trim() || undefined,
    deadline: input.deadline || undefined, done: false, xp: g.config.rules.goal[input.level], createdAt: Date.now(),
  }
  put('goal', newId(), goal)
}

export function editGoal(id: string, input: { title: string; why?: string; deadline?: string }) {
  patch('goal', id, { title: input.title.trim(), why: input.why?.trim() || undefined, deadline: input.deadline || undefined })
}

export function toggleGoal(goal: WithId<Goal>) {
  const g = current()
  if (goal.done) {
    patch('goal', goal.id, { done: false, doneDate: undefined })
    toast(-goal.xp, 'UNDO', goal.title)
  } else {
    patch('goal', goal.id, { done: true, doneDate: g.today })
    const label = goal.level === 'main' ? 'MAIN QUEST CLEAR' : goal.level === 'mid' ? 'MISSION CLEAR' : 'TASK CLEAR'
    toast(goal.xp, label, goal.title)
  }
}

export function deleteGoal(id: string) {
  const g = current()
  const ids: string[] = []
  const walk = (gid: string) => {
    ids.push(gid)
    for (const child of g.goals.filter((x) => x.parentId === gid)) walk(child.id)
  }
  walk(id)
  remove(...ids)
}

// ---------- 人脈 ----------

export function savePerson(id: string | null, input: Omit<Person, 'createdAt'>) {
  const existing = id ? current().persons.find((p) => p.id === id) : undefined
  const person: Person = {
    ...input,
    name: input.name.trim(),
    org: input.org?.trim() || undefined,
    memo: input.memo?.trim() || undefined,
    nextAction: input.nextAction?.trim() || undefined,
    nextActionDue: input.nextActionDue || undefined,
    createdAt: existing?.createdAt ?? Date.now(),
  }
  const pid = id ?? newId()
  put('person', pid, person)
  return pid
}

export function deletePerson(id: string) {
  const linked = current().contacts.filter((c) => c.personId === id).map((c) => c.id)
  remove(id, ...linked)
}

export function logContact(personId: string, method: ContactMethod, note?: string, clearNextAction = false) {
  const g = current()
  const contact: Contact = {
    personId, date: g.today, method, note: note?.trim() || undefined, xp: g.config.rules.contact, createdAt: Date.now(),
  }
  put('contact', newId(), contact)
  if (clearNextAction) patch('person', personId, { nextAction: undefined, nextActionDue: undefined })
  toast(contact.xp, 'CONTACT', g.persons.find((p) => p.id === personId)?.name)
}

export function deleteContact(id: string) {
  remove(id)
}

// ---------- ランク表 ----------

export function setConditionCleared(rankId: string, condId: string, cleared: boolean) {
  const g = current()
  saveConfig({
    ...g.config,
    ranks: g.config.ranks.map((r) =>
      r.id !== rankId
        ? r
        : {
            ...r,
            conditions: r.conditions.map((c) =>
              c.id === condId ? { ...c, cleared, clearedDate: cleared ? g.today : undefined } : c,
            ),
          },
    ),
  })
}

// ---------- 人生の目標 ----------

export function saveVision(vision: Vision) {
  put('vision', 'vision', vision)
}

// ---------- 挑戦ログ ----------

export interface ChallengeInput {
  title: string
  result: ChallengeResult
  learning?: string
  goalId?: string
  post: PostStatus
}

function postFields(prev: Challenge | undefined, post: PostStatus, today: string, postXp: number) {
  if (post !== 'posted') return { postedDate: undefined, postXp: undefined }
  if (prev?.post === 'posted' && prev.postedDate) return { postedDate: prev.postedDate, postXp: prev.postXp }
  return { postedDate: today, postXp }
}

export function saveChallenge(id: string | null, input: ChallengeInput) {
  const g = current()
  const prev = id ? g.challengeLogs.find((c) => c.id === id) : undefined
  const challenge: Challenge = {
    date: prev?.date ?? g.today,
    title: input.title.trim(),
    result: input.result,
    learning: input.learning?.trim() || undefined,
    goalId: input.goalId || undefined,
    post: input.post,
    ...postFields(prev, input.post, g.today, g.config.rules.post),
    xp: prev?.xp ?? g.config.rules.challenge,
    createdAt: prev?.createdAt ?? Date.now(),
  }
  put('challenge', id ?? newId(), challenge)
  if (!prev && challenge.date === g.today) firstAction(g)
  if (!prev) toast(challenge.xp, input.result === 'fail' ? 'NICE TRY' : 'CHALLENGE', challenge.title, 'atk')
  if (challenge.post === 'posted' && prev?.post !== 'posted') setTimeout(() => toast(challenge.postXp ?? 0, 'POSTED', challenge.title), prev ? 0 : 450)
}

export function setPostStatus(c: WithId<Challenge>, post: PostStatus) {
  const { id, ...data } = c
  saveChallenge(id, { ...data, post })
}

export function deleteChallenge(id: string) {
  remove(id)
}

// ---------- 週・月の目標 ----------

export function addPeriodGoal(input: { period: PeriodKind; start: string; title: string; goalId?: string }) {
  const g = current()
  const list = input.period === 'week'
    ? (input.start === g.periods.week.start ? g.periods.week.goals : g.periods.week.nextGoals)
    : (input.start === g.periods.month.start ? g.periods.month.goals : g.periods.month.nextGoals)
  if (list.length >= MAX_PERIOD_GOALS) return
  const goal: PeriodGoal = {
    period: input.period, start: input.start, title: input.title.trim(), goalId: input.goalId || undefined, done: false,
    xp: input.period === 'week' ? g.config.rules.weekGoal : g.config.rules.monthGoal, createdAt: Date.now(),
  }
  put('pgoal', newId(), goal)
}

export function editPeriodGoal(id: string, input: { title: string; goalId?: string }) {
  patch('pgoal', id, { title: input.title.trim(), goalId: input.goalId || undefined })
}

export function togglePeriodGoal(p: WithId<PeriodGoal>) {
  const g = current()
  if (p.start > g.today) return
  const label = p.period === 'week' ? 'WEEK GOAL' : 'MONTH GOAL'
  if (p.done) {
    patch('pgoal', p.id, { done: false, doneDate: undefined })
    toast(-p.xp, 'UNDO', p.title)
  } else {
    patch('pgoal', p.id, { done: true, doneDate: g.today })
    toast(p.xp, label, p.title)
  }
}

export function deletePeriodGoal(id: string) {
  remove(id)
}
