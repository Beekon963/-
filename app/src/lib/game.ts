// ゲームの計算はすべてここ。XPは記録から毎回計算する（XP自体は保存しない）

import { addDays, daysBetween, logicalToday, weekStart, weekday } from './date'
import { MAX_DAILY_QUESTS, MODES, type ModeDef } from './defaults'
import type {
  Activity, Challenge, Config, Contact, DailyQuest, Goal, PeriodGoal, Person, RankCondition, RankDef, Review, Task, WithId, XpRules,
} from './types'

export type XpKind =
  | 'quest' | 'started' | 'perfect' | 'activity' | 'goal' | 'pgoal' | 'contact' | 'review' | 'challenge' | 'post' | 'streak' | 'penalty'
  | 'comeback' | 'insurance' | 'task'

export interface XpEntry {
  date: string
  amount: number
  kind: XpKind
  label: string
  refId?: string
}

export interface GameData {
  config: Config
  startDate: string
  today: string
  quests: WithId<DailyQuest>[]
  activities: WithId<Activity>[]
  goals: WithId<Goal>[]
  contacts: WithId<Contact>[]
  reviews: WithId<Review>[]
  challenges: WithId<Challenge>[]
  periodGoals?: WithId<PeriodGoal>[]
  tasks?: WithId<Task>[]
  rests: Set<string>
  /** 「前日までに書く」ルールを始める日。null ならルールなし */
  planSince?: string | null
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

export function startedXp(q: Pick<DailyQuest, 'xp'>, rules: XpRules) {
  return Math.floor((q.xp * rules.startedPct) / 100)
}

/** 達成でも着手でもない＝手をつけていない */
export function untouched(q: Pick<DailyQuest, 'done' | 'started'>) {
  return !q.done && !q.started
}

export function activityXp(minutes: number, kind: Activity['kind'], rules: XpRules) {
  const per30 = kind === 'attack' ? rules.attackPer30 : rules.defensePer30
  return Math.round((minutes / 30) * per30)
}

/**
 * XP台帳を作る。降格ペナルティ（過去日のデイリー未着手・未設定）と
 * 連続日数ボーナスもここで決まる。開始日は猶予日としてペナルティ対象外。
 * 減点の重さと「保険」（何もできなかった日の自動休息）は試合モードで変わる。
 */
export function buildLedger(g: GameData) {
  const { rules } = g.config
  const mode = MODES[g.config.mode] ?? MODES.standard
  const entries: XpEntry[] = []
  const questsByDate = groupBy(g.quests, (q) => q.date)
  const challengeDays = new Set(g.challenges.map((c) => c.date))
  const doneTasks = (g.tasks ?? []).filter((t) => t.done && t.doneDate)
  // 「大切」（目標に近づくタスク）の完了だけは最低ラインに数える
  const keyTaskDays = new Set(doneTasks.filter((t) => t.box === 'key').map((t) => t.doneDate!))

  for (const q of g.quests) {
    if (q.done) entries.push({ date: q.date, amount: q.xp, kind: 'quest', label: q.title, refId: q.id })
    else if (q.started) {
      entries.push({ date: q.date, amount: startedXp(q, rules), kind: 'started', label: `着手：${q.title}`, refId: q.id })
    }
  }
  for (const [date, qs] of questsByDate) {
    if (qs.length >= MAX_DAILY_QUESTS && qs.every((q) => q.done)) {
      entries.push({ date, amount: rules.perfectBonus, kind: 'perfect', label: 'PERFECT ボーナス' })
    }
  }
  for (const a of g.activities) {
    if (a.xp) entries.push({ date: a.date, amount: a.xp, kind: 'activity', label: a.title, refId: a.id })
  }
  for (const goal of g.goals) {
    if (goal.done && goal.doneDate) {
      entries.push({ date: goal.doneDate, amount: goal.xp, kind: 'goal', label: goal.title, refId: goal.id })
    }
  }
  for (const c of g.contacts) {
    entries.push({ date: c.date, amount: c.xp, kind: 'contact', label: '連絡', refId: c.id })
  }
  for (const r of g.reviews) {
    entries.push({ date: r.date, amount: r.xp, kind: 'review', label: '振り返り', refId: r.id })
  }
  for (const p of g.periodGoals ?? []) {
    if (p.done && p.doneDate) {
      const label = `${p.period === 'week' ? '週' : '月'}の目標：${p.title}`
      entries.push({ date: p.doneDate, amount: p.xp, kind: 'pgoal', label, refId: p.id })
    }
  }
  for (const t of doneTasks) {
    if (t.xp) entries.push({ date: t.doneDate!, amount: t.xp, kind: 'task', label: `タスク：${t.title}`, refId: t.id })
  }
  for (const c of g.challenges) {
    entries.push({ date: c.date, amount: c.xp, kind: 'challenge', label: `挑戦：${c.title}`, refId: c.id })
    if (c.post === 'posted' && c.postedDate && c.postXp) {
      entries.push({ date: c.postedDate, amount: c.postXp, kind: 'post', label: `発信：${c.title}`, refId: c.id })
    }
  }

  // 自分で決めた休息日を先に数え、週の残りの枠を「保険」にする
  const restsPerWeek = new Map<string, number>()
  for (const d of g.rests) restsPerWeek.set(weekStart(d), (restsPerWeek.get(weekStart(d)) ?? 0) + 1)
  const autoRests = new Set<string>()

  let streak = 0
  let bestStreak = 0
  /** 連続が途切れたまま、まだ戻ってきていない */
  let broken = false
  let lastComeback: string | null = null
  const comebackOk = (d: string) => rules.comebackBonus > 0 && (!lastComeback || daysBetween(lastComeback, d) >= 7)

  for (let d = g.startDate; d <= g.today; d = addDays(d, 1)) {
    const qs = questsByDate.get(d) ?? []
    // 最低ライン：デイリーに1つ手をつける（着手でもいい）、挑戦を1回記録する、「大切」のタスクを1つ終える
    const active = qs.some((q) => !untouched(q)) || challengeDays.has(d) || keyTaskDays.has(d)
    const past = d < g.today
    let rest = g.rests.has(d)

    if (past && !active && !rest && d !== g.startDate && mode.insurance) {
      const w = weekStart(d)
      const used = restsPerWeek.get(w) ?? 0
      if (used < rules.restDaysPerWeek) {
        restsPerWeek.set(w, used + 1)
        autoRests.add(d)
        rest = true
        entries.push({ date: d, amount: 0, kind: 'insurance', label: '保険：自動で休息日（連続キープ）' })
      }
    }

    if (active) {
      if (broken && comebackOk(d)) {
        entries.push({ date: d, amount: rules.comebackBonus, kind: 'comeback', label: 'COMEBACK ボーナス' })
        lastComeback = d
      }
      broken = false
      streak++
      bestStreak = Math.max(bestStreak, streak)
      if (rules.streakEvery > 0 && streak % rules.streakEvery === 0) {
        entries.push({ date: d, amount: rules.streakBonus, kind: 'streak', label: `${streak}日連続ボーナス` })
      }
    } else if (past && !rest) {
      streak = 0
      if (d !== g.startDate) broken = true
    }

    if (past && !rest && d !== g.startDate) {
      const day: XpEntry[] = []
      if (qs.length === 0) {
        day.push({ date: d, amount: -rules.penaltyNoQuest, kind: 'penalty', label: 'デイリー未設定（不戦敗）' })
      } else {
        const missed = qs.filter(untouched).length
        if (missed > 0) {
          day.push({
            date: d, amount: -missed * rules.penaltyMissedQuest, kind: 'penalty', label: `デイリー未着手 ×${missed}`,
          })
        }
      }
      if (g.planSince && d >= g.planSince) day.push(...missedPlans(g, d, questsByDate))
      entries.push(...applyMode(day, mode))
    }
  }

  return {
    entries,
    streak,
    bestStreak,
    autoRests,
    /** 今日1つ手をつければ COMEBACK ボーナスがもらえる */
    comebackReady: broken && comebackOk(g.today),
  }
}

/** モードをかけたあとの減点（1日の上限も考える） */
export function penaltyFor(amount: number, mode: ModeDef) {
  const n = Math.round(amount * mode.penalty)
  return mode.cap === null ? n : Math.min(n, mode.cap)
}

/** その日の減点にモードの倍率と上限をかける */
export function applyMode(day: XpEntry[], mode: ModeDef): XpEntry[] {
  let room = mode.cap ?? Infinity
  const out: XpEntry[] = []
  for (const e of day) {
    const full = Math.round(-e.amount * mode.penalty)
    const amount = Math.min(room, full)
    if (amount <= 0) continue
    room -= amount
    out.push({ ...e, amount: -amount, label: amount < full ? `${e.label}（1日の上限）` : e.label })
  }
  return out
}

/** その日（d）のうちに書いておくべきだった「次の日・次の週・次の月」の計画 */
export function missedPlans(g: GameData, d: string, questsByDate: Map<string, DailyQuest[]>): XpEntry[] {
  const { rules, dayStartHour } = g.config
  const writtenBy = (createdAt: number) => logicalToday(new Date(createdAt), dayStartHour) <= d
  const out: XpEntry[] = []
  const next = addDays(d, 1)

  if (!(questsByDate.get(next) ?? []).some((q) => writtenBy(q.createdAt))) {
    out.push({ date: d, amount: -rules.penaltyNoPlan, kind: 'penalty', label: '明日のクエストを書かなかった' })
  }
  const planned = (period: PeriodGoal['period']) =>
    (g.periodGoals ?? []).some((p) => p.period === period && p.start === next && writtenBy(p.createdAt))
  // 週は月曜はじまり → 日曜日が来週の目標の締め切り
  if (weekday(d) === 0 && !planned('week')) {
    out.push({ date: d, amount: -rules.penaltyNoWeekPlan, kind: 'penalty', label: '来週の目標を書かなかった' })
  }
  if (next.endsWith('-01') && !planned('month')) {
    out.push({ date: d, amount: -rules.penaltyNoMonthPlan, kind: 'penalty', label: '来月の目標を書かなかった' })
  }
  return out
}

export interface DayXp {
  gain: number
  loss: number
}

/** 日ごとに集計し、残高は0を下回らない */
export function summarize(entries: XpEntry[]) {
  const daily = new Map<string, DayXp>()
  for (const e of entries) {
    const d = daily.get(e.date) ?? { gain: 0, loss: 0 }
    if (e.amount >= 0) d.gain += e.amount
    else d.loss += e.amount
    daily.set(e.date, d)
  }
  let total = 0
  for (const date of [...daily.keys()].sort()) {
    const d = daily.get(date)!
    total = Math.max(0, total + d.gain + d.loss)
  }
  return { total, daily }
}

// ---------- ランク ----------

const ROMAN = ['I', 'II', 'III', 'IV', 'V']

export function roman(n: number) {
  return ROMAN[n - 1] ?? String(n)
}

export function sortRanks(ranks: RankDef[]) {
  return [...ranks].sort((a, b) => a.minXp - b.minXp)
}

/** division は下から 0,1,2…。表示は III, II, I */
export function tierName(rank: RankDef, division: number) {
  return rank.divisions > 1 ? `${rank.name} ${roman(rank.divisions - division)}` : rank.name
}

export interface RankState {
  index: number
  rank: RankDef
  ranks: RankDef[]
  division: number
  fullName: string
  divStart: number
  divSize: number
  xpInDiv: number
  progress: number
  /** 次の段階（null = 最高ランク） */
  next: { name: string; xpNeeded: number } | null
  /** 昇格戦：XPは足りているが条件が残っている */
  promotion: { target: RankDef; pending: RankCondition[] } | null
  /** 次のランクの未クリア条件（XPが届く前から見せる） */
  upcoming: RankCondition[]
  /** 上下比較用 */
  tierKey: number
}

export function computeRank(total: number, rankDefs: RankDef[]): RankState {
  const ranks = sortRanks(rankDefs)
  let index = 0
  let blocked: RankDef | null = null
  for (let i = 1; i < ranks.length; i++) {
    const r = ranks[i]
    if (total < r.minXp) break
    if (r.conditions.some((c) => !c.cleared)) {
      blocked = r
      break
    }
    index = i
  }

  const rank = ranks[index]
  const nextRank = ranks[index + 1] ?? null
  const divisions = Math.max(1, rank.divisions)

  if (!nextRank) {
    return {
      index, rank, ranks, division: 0, fullName: tierName(rank, 0),
      divStart: rank.minXp, divSize: 0, xpInDiv: total - rank.minXp, progress: 1,
      next: null, promotion: null, upcoming: [], tierKey: index * 10,
    }
  }

  const divSize = (nextRank.minXp - rank.minXp) / divisions
  const upcoming = nextRank.conditions.filter((c) => !c.cleared)
  const nextFirstTier = tierName(nextRank, 0)

  if (blocked) {
    const division = divisions - 1
    return {
      index, rank, ranks, division, fullName: tierName(rank, division),
      divStart: rank.minXp + division * divSize, divSize, xpInDiv: divSize, progress: 1,
      next: { name: nextFirstTier, xpNeeded: 0 },
      promotion: { target: blocked, pending: upcoming }, upcoming, tierKey: index * 10 + division,
    }
  }

  const division = Math.min(Math.floor((total - rank.minXp) / divSize), divisions - 1)
  const divStart = rank.minXp + division * divSize
  const xpInDiv = total - divStart
  const nextName = division < divisions - 1 ? tierName(rank, division + 1) : nextFirstTier
  return {
    index, rank, ranks, division, fullName: tierName(rank, division),
    divStart, divSize, xpInDiv, progress: Math.min(1, xpInDiv / divSize),
    next: { name: nextName, xpNeeded: Math.ceil(divStart + divSize - total) },
    promotion: null, upcoming, tierKey: index * 10 + division,
  }
}

/** 過去いちばん高かったランク（日ごとの残高で判定。昇格条件は今の状態で見る） */
export function peakRank(entries: XpEntry[], ranks: RankDef[]) {
  const { daily } = summarize(entries)
  let balance = 0
  let best = computeRank(0, ranks)
  for (const date of [...daily.keys()].sort()) {
    const d = daily.get(date)!
    balance = Math.max(0, balance + d.gain + d.loss)
    const state = computeRank(balance, ranks)
    if (state.tierKey > best.tierKey) best = state
  }
  return best
}

/** 勝率：過去の日（休息日を除く）のうち、デイリーを1つ以上達成した日の割合 */
export function winRate(quests: DailyQuest[], rests: Set<string>, startDate: string, today: string) {
  const won = new Set(quests.filter((q) => q.done && q.date < today && q.date >= startDate).map((q) => q.date))
  let days = 0
  for (let d = startDate; d < today; d = addDays(d, 1)) if (!rests.has(d)) days++
  return days > 0 ? Math.round((won.size / days) * 100) : null
}

export type Verdict = 'PERFECT' | 'VICTORY' | 'NICE TRY' | 'REST' | 'DEFEAT'

/** その日の勝敗（試合結果の表示用） */
export function dayVerdict(quests: Pick<DailyQuest, 'done' | 'started'>[], challenges: number, rest: boolean): Verdict {
  const done = quests.filter((q) => q.done).length
  const started = quests.filter((q) => !q.done && q.started).length
  if (quests.length >= MAX_DAILY_QUESTS && done === quests.length) return 'PERFECT'
  if (done > 0) return 'VICTORY'
  if (started > 0 || challenges > 0) return 'NICE TRY'
  return rest ? 'REST' : 'DEFEAT'
}

// ---------- 集計 ----------

export interface PeriodStat {
  gain: number
  loss: number
  questsSet: number
  questsDone: number
  attackMin: number
  defenseMin: number
}

function emptyStat(): PeriodStat {
  return { gain: 0, loss: 0, questsSet: 0, questsDone: 0, attackMin: 0, defenseMin: 0 }
}

export function attackPct(s: Pick<PeriodStat, 'attackMin' | 'defenseMin'>) {
  const sum = s.attackMin + s.defenseMin
  return sum > 0 ? Math.round((s.attackMin / sum) * 100) : null
}

export function achievementPct(s: Pick<PeriodStat, 'questsSet' | 'questsDone'>) {
  return s.questsSet > 0 ? Math.round((s.questsDone / s.questsSet) * 100) : null
}

function collect(
  keyOf: (date: string) => string | null,
  entries: XpEntry[], quests: DailyQuest[], activities: Activity[],
) {
  const map = new Map<string, PeriodStat>()
  const get = (date: string) => {
    const k = keyOf(date)
    if (k === null) return null
    let s = map.get(k)
    if (!s) map.set(k, (s = emptyStat()))
    return s
  }
  for (const e of entries) {
    const s = get(e.date)
    if (!s) continue
    if (e.amount >= 0) s.gain += e.amount
    else s.loss += e.amount
  }
  for (const q of quests) {
    const s = get(q.date)
    if (!s) continue
    s.questsSet++
    if (q.done) s.questsDone++
  }
  for (const a of activities) {
    const s = get(a.date)
    if (!s) continue
    if (a.kind === 'attack') s.attackMin += a.minutes
    else s.defenseMin += a.minutes
  }
  return map
}

export function dayStat(date: string, entries: XpEntry[], quests: DailyQuest[], activities: Activity[]) {
  return collect((d) => (d === date ? d : null), entries, quests, activities).get(date) ?? emptyStat()
}

export interface WeekStat extends PeriodStat {
  start: string
}

/** 直近 weeks 週ぶん（古い順） */
export function weeklyStats(
  today: string, weeks: number, entries: XpEntry[], quests: DailyQuest[], activities: Activity[],
): WeekStat[] {
  const lastStart = weekStart(today)
  const firstStart = addDays(lastStart, -7 * (weeks - 1))
  const map = collect((d) => (d >= firstStart && d <= addDays(lastStart, 6) ? weekStart(d) : null), entries, quests, activities)
  const out: WeekStat[] = []
  for (let i = 0; i < weeks; i++) {
    const start = addDays(firstStart, 7 * i)
    out.push({ start, ...(map.get(start) ?? emptyStat()) })
  }
  return out
}

// ---------- 挑戦回数 ----------

/** 挑戦＝達成・着手したデイリー＋挑戦ログ */
export function challengesByDate(quests: DailyQuest[], logs: Pick<Challenge, 'date'>[]) {
  const map = new Map<string, number>()
  const add = (date: string) => map.set(date, (map.get(date) ?? 0) + 1)
  for (const q of quests) if (!untouched(q)) add(q.date)
  for (const c of logs) add(c.date)
  return map
}

// ---------- 目標 ----------

export function childrenMap(goals: WithId<Goal>[]) {
  return groupBy(goals.filter((g) => g.parentId), (g) => g.parentId!)
}

export function goalProgress(goal: WithId<Goal>, kids: Map<string, WithId<Goal>[]>): number {
  if (goal.done) return 1
  const list = kids.get(goal.id) ?? []
  if (list.length === 0) return 0
  return list.reduce((sum, k) => sum + goalProgress(k, kids), 0) / list.length
}

// ---------- 人脈 ----------

export interface PersonStatus {
  lastDate: string | null
  daysSince: number
  overdue: boolean
  actionDue: boolean
  /** 大きいほど優先 */
  urgency: number
}

export function personStatus(p: Person, contacts: Contact[], today: string, createdDate: string): PersonStatus {
  let lastDate: string | null = null
  for (const c of contacts) if (!lastDate || c.date > lastDate) lastDate = c.date
  const daysSince = daysBetween(lastDate ?? createdDate, today)
  const overdue = daysSince >= p.alertDays
  const actionDue = !!p.nextActionDue && p.nextActionDue <= today
  let urgency = daysSince / Math.max(1, p.alertDays)
  if (overdue) urgency += 10
  if (actionDue) urgency += 100 + daysBetween(p.nextActionDue!, today)
  return { lastDate, daysSince, overdue, actionDue, urgency }
}
