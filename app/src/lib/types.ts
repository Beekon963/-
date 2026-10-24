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
  /** 前日までに明日のクエストを書かなかった */
  penaltyNoPlan: number
  /** 前の週のうちに今週の目標を書かなかった */
  penaltyNoWeekPlan: number
  /** 前の月のうちに今月の目標を書かなかった */
  penaltyNoMonthPlan: number
  /** 週の目標1つ達成 */
  weekGoal: number
  /** 月の目標1つ達成 */
  monthGoal: number
  /** 連続が途切れたあと、戻ってきた日のボーナス（7日に1回まで） */
  comebackBonus: number
  /** 4マスのタスク：「大切」を完了 */
  taskKey: number
  /** 4マスのタスク：「今すぐ・先に・いつか」を完了 */
  taskOther: number
}

/** 試合モード：減点の重さ */
export type MatchMode = 'casual' | 'standard' | 'ranked'

/** 通知の時刻（'HH:MM'。空文字＝なし） */
export interface Reminders {
  /** 毎朝：今日のクエストを確認 */
  morning: string
  /** 毎晩：振り返り＋明日のクエスト */
  night: string
  /** 日曜：来週の目標 */
  weekly: string
  /** 月末：来月の目標 */
  monthly: string
}

export interface Config {
  ranks: RankDef[]
  rules: XpRules
  /** この時刻より前は前日扱い */
  dayStartHour: number
  attackTargetPct: number
  mode: MatchMode
  reminders: Reminders
  /** ロック画面の壁紙の自動更新（オンのときだけ） */
  wallpaper?: WallpaperConfig
}

export interface WallpaperConfig {
  /** 壁紙の URL に入れる推測できない文字列 */
  key: string
  /** 画像の大きさ（壁紙にする iPhone の画面・実ピクセル） */
  width: number
  height: number
}

export interface Profile {
  /** 降格ペナルティの計算を始める日 */
  startDate: string
  /** 「前日までに書く」ルールを始める日（過去にさかのぼって減点しないため） */
  planSince?: string
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
  /** タスク（やること）か挑戦（やったことのないこと）か */
  kind?: QuestKind
  createdAt: number
}

export type QuestKind = 'task' | 'challenge'

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

export type PeriodKind = 'week' | 'month'

/** 週・月の目標（期間の初日 start で区切る） */
export interface PeriodGoal {
  period: PeriodKind
  /** 週は月曜日、月は1日 */
  start: string
  title: string
  goalId?: string
  done: boolean
  doneDate?: string
  xp: number
  createdAt: number
}

/** 4マスのタスクの置き場所：今すぐ・大切・先に・いつか */
export type TaskBox = 'now' | 'key' | 'next' | 'someday'

/** 4マスのタスク（減点なし。完了した翌日にボードから消える） */
export interface Task {
  title: string
  box: TaskBox
  done: boolean
  doneDate?: string
  /** 完了したときのXP */
  xp: number
  /** マスの中の並び順 */
  order: number
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
  pgoal: PeriodGoal
  task: Task
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
