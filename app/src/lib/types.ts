export type Stars = 1 | 2 | 3
export type GoalLevel = 'main' | 'mid' | 'small'
export type ActivityKind = 'attack' | 'defense'
export type PersonCategory = '社員' | '取引先' | '仲間' | '家族' | 'その他'
export type ContactMethod = '会った' | '電話' | 'LINE' | 'メール' | 'その他'

/** 昇格条件（自己申告でクリアにする） */
export interface RankCondition {
  id: string
  text: string
  cleared: boolean
  clearedDate?: string
}

export interface RankDef {
  id: string
  name: string
  color: string
  /** このランクに到達するのに必要な累計XP */
  minXp: number
  /** III → II → I のような段階数 */
  divisions: number
  /** このランクへの昇格条件 */
  conditions: RankCondition[]
}

export interface XpRules {
  /** デイリー ★1/★2/★3 */
  quest: [number, number, number]
  perfectBonus: number
  attackPer30: number
  defensePer30: number
  goal: Record<GoalLevel, number>
  contact: number
  review: number
  streakEvery: number
  streakBonus: number
  /** 設定したデイリーを達成できなかった数 × これ だけXPが減る */
  penaltyMissedQuest: number
  /** デイリーを1つも設定しなかった日に減るXP */
  penaltyNoQuest: number
  restDaysPerWeek: number
  /** 着手したデイリーに入るXPの割合（%） */
  startedPct: number
  /** 挑戦ログ1件 */
  challenge: number
  /** 挑戦を発信した */
  post: number
}

export interface Config {
  ranks: RankDef[]
  rules: XpRules
  /** この時刻より前は前日扱い */
  dayStartHour: number
  attackTargetPct: number
}

export interface Profile {
  /** 降格ペナルティの計算を始める日 */
  startDate: string
}

export interface Goal {
  level: GoalLevel
  parentId: string | null
  title: string
  why?: string
  deadline?: string
  done: boolean
  doneDate?: string
  xp: number
  createdAt: number
}

export interface DailyQuest {
  date: string
  title: string
  goalId?: string
  stars: Stars
  xp: number
  done: boolean
  /** 着手した（途中まで）。XPは一部、ペナルティなし */
  started?: boolean
  createdAt: number
}

export interface Activity {
  date: string
  kind: ActivityKind
  title: string
  minutes: number
  goalId?: string
  questId?: string
  xp: number
  createdAt: number
}

export interface Person {
  name: string
  category: PersonCategory
  org?: string
  memo?: string
  nextAction?: string
  nextActionDue?: string
  /** この日数連絡がないと警告 */
  alertDays: number
  createdAt: number
}

export interface Contact {
  personId: string
  date: string
  method: ContactMethod
  note?: string
  xp: number
  createdAt: number
}

export interface Review {
  date: string
  comment: string
  score?: number
  xp: number
  createdAt: number
}

export type ChallengeResult = 'success' | 'fail' | 'ongoing'
/** none = 発信しない / idea = 発信ネタ帳 / posted = 発信済み */
export type PostStatus = 'none' | 'idea' | 'posted'

/** 挑戦ログ：成功でも失敗でも「やってみた」を残す */
export interface Challenge {
  date: string
  title: string
  result: ChallengeResult
  learning?: string
  goalId?: string
  post: PostStatus
  postedDate?: string
  xp: number
  postXp?: number
  createdAt: number
}

export interface RestDay {
  date: string
}

export interface VisionValue {
  name: string
  text: string
  /** いちばん大切にする価値観 */
  core?: boolean
}

export interface VisionMilestone {
  year: number
  age?: number
  title: string
  text?: string
}

/** 人生の目標（「何のために頑張るのか」） */
export interface Vision {
  mission: string
  statement?: string
  why?: string
  values: VisionValue[]
  milestones: VisionMilestone[]
  dream?: string
  dailyRule?: string
  purpose?: string
}

export interface RecordMap {
  config: Config
  profile: Profile
  goal: Goal
  quest: DailyQuest
  activity: Activity
  person: Person
  contact: Contact
  review: Review
  rest: RestDay
  vision: Vision
  challenge: Challenge
}

export type RecType = keyof RecordMap

export interface Rec<T extends RecType = RecType> {
  id: string
  type: T
  data: RecordMap[T]
  /** 端末側の更新時刻（ms） */
  updatedAt: number
  deleted?: boolean
}

export type WithId<T> = T & { id: string }
