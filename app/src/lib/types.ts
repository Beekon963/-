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

// ---------- 筋トレ ----------

/** 記録のしかた：回数・秒数・左右別の回数 */
export type GymKind = 'reps' | 'seconds' | 'perSide'
/** 重量の条件：マシン（表示重量）・ダンベル（片手）・バーベル・自重 */
export type GymLoad = 'machine' | 'dumbbell' | 'barbell' | 'bodyweight'
export type GymGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'abs' | 'calves'

export interface GymExercise {
  id: string
  /** 履歴を比べるときの種目の名前（作ったときの名前。あとで名前を変えても続けて比べられる） */
  key: string
  name: string
  kind: GymKind
  load: GymLoad
  group: GymGroup
  targetMin: number
  targetMax: number
  /** 通常のセット数 */
  sets: number
  /** 導入期間のセット数（2か1） */
  introSets: number
  /** 休憩タイマーの秒数 */
  restSec: number
  /** 置き換えできる種目 */
  alt?: { name: string; load: GymLoad; key?: string }
}

export interface GymMenu {
  id: string
  name: string
  /** 目安の時間（分） */
  minutes: number
  exercises: GymExercise[]
}

export interface GymPlan {
  menus: GymMenu[]
  /** 曜日（0=日〜6=土）ごとのメニュー id。null = 休養 */
  schedule: (string | null)[]
  /** intro = 導入期間のセット数、normal = 通常のセット数（本人が切り替える） */
  volume: 'intro' | 'normal'
  /** 初めてトレーニングを始めた日（導入期間の起点・日本時間） */
  introStart?: string
  timer: { sound: boolean; notify: boolean }
}

/** その日だけの予定の振替（menuId = null で休養） */
export interface GymDay {
  date: string
  menuId: string | null
}

export interface GymSet {
  /** ウォームアップ（本番セットと分けて記録） */
  warmup?: boolean
  /** kg。ダンベルは片手あたり、マシンは表示重量 */
  weight?: number | null
  reps?: number | null
  repsL?: number | null
  repsR?: number | null
  seconds?: number | null
  done: boolean
  /** 余力：あと何回できそうだったか（任意） */
  rir?: number | null
}

/** 実施した種目（メニューをあとで変えても変わらないよう、その日の内容をそのまま持つ） */
export interface GymSessionExercise {
  exId: string
  key: string
  name: string
  kind: GymKind
  load: GymLoad
  group: GymGroup
  targetMin: number
  targetMax: number
  /** この日に予定した本番のセット数 */
  plannedSets: number
  restSec: number
  /** マシンの機器名（任意） */
  machine?: string
  alt?: { name: string; load: GymLoad; key?: string }
  /** 置き換えた元の種目名 */
  swappedFrom?: string
  sets: GymSet[]
  note?: string
  /** 痛みや違和感 */
  pain?: string
}

/** active = 実施中、done = 完了、partial = 一部実施、skipped = 見送り */
export type GymStatus = 'active' | 'done' | 'partial' | 'skipped'

export interface GymSession {
  /** 日本時間の日付 */
  date: string
  menuId: string
  menuName: string
  minutes: number
  status: GymStatus
  /** 導入期間中のトレーニング */
  intro: boolean
  startedAt: number
  endedAt?: number
  exercises: GymSessionExercise[]
}

export interface BodyWeight {
  /** 日本時間の日付 */
  date: string
  kg: number
  createdAt: number
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
  gymPlan: GymPlan
  gymDay: GymDay
  gymSession: GymSession
  bodyWeight: BodyWeight
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
