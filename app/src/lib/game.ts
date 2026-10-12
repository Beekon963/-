// ゲームの計算はすべてここ。XPは記録から毎回計算する（XP自体は保存しない）

import { addDays, daysBetween, weekStart } from './date'
import { MAX_DAILY_QUESTS } from './defaults'
import type {
  Activity, Challenge, Config, Contact, DailyQuest, Goal, Person, RankCondition, RankDef, Review, WithId, XpRules,
} from './types'

export type XpKind =
  | 'quest' | 'started' | 'perfect' | 'activity' | 'goal' | 'contact' | 'review' | 'challenge' | 'post' | 'streak' | 'penalty'

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
  rests: Set<string>
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
 */
export function buildLedger(g: GameData) {
  const { rules } = g.config
  const entries: XpEntry[] = []
  const questsByDate = groupBy(g.quests, (q) => q.date)

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
  for (const c of g.challenges) {
    entries.push({ date: c.date, amount: c.xp, kind: 'challenge', label: `挑戦：${c.title}`, refId: c.id })
    if (c.post === 'posted' && c.postedDate && c.postXp) {
      entries.push({ date: c.postedDate, amount: c.postXp, kind: 'post', label: `発信：${c.title}`, refId: c.id })
    }
  }

  let streak = 0
  for (let d = g.startDate; d <= g.today; d = addDays(d, 1)) {
    const qs = questsByDate.get(d) ?? []
    const active = qs.some((q) => !untouched(q))
    const rest = g.rests.has(d)
    const past = d < g.today

    if (active) {
      streak++
      if (rules.streakEvery > 0 && streak % rules.streakEvery === 0) {
        entries.push({ date: d, amount: rules.streakBonus, kind: 'streak', label: `${streak}日連続ボーナス` })
      }
    } else if (past && !rest) {
      streak = 0
    }

    if (past && !rest && d !== g.startDate) {
      if (qs.length === 0) {
        entries.push({ date: d, amount: -rules.penaltyNoQuest, kind: 'penalty', label: 'デイリー未設定（不戦敗）' })
      } else {
        const missed = qs.filter(untouched).length
        if (missed > 0) {
          entries.push({
            date: d, amount: -missed * rules.penaltyMissedQuest, kind: 'penalty', label: `デイリー未着手 ×${missed}`,
          })
        }
      }
    }
  }

  return { entries, streak }
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
