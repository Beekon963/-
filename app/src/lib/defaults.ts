import type { Config, RankDef, XpRules } from './types'

export const MAX_DAILY_QUESTS = 3

export const DEFAULT_RULES: XpRules = {
  quest: [20, 40, 60],
  perfectBonus: 30,
  attackPer30: 10,
  defensePer30: 2,
  goal: { small: 100, mid: 300, main: 1000 },
  contact: 10,
  review: 10,
  streakEvery: 7,
  streakBonus: 50,
  penaltyMissedQuest: 15,
  penaltyNoQuest: 50,
  restDaysPerWeek: 1,
}

export const DEFAULT_RANKS: RankDef[] = [
  { id: 'iron', name: 'IRON', color: '#9aa3ad', minXp: 0, divisions: 3, conditions: [] },
  { id: 'bronze', name: 'BRONZE', color: '#d08a57', minXp: 300, divisions: 3, conditions: [] },
  { id: 'silver', name: 'SILVER', color: '#c8d3e0', minXp: 1500, divisions: 3, conditions: [] },
  {
    id: 'gold', name: 'GOLD', color: '#f2c14e', minXp: 4500, divisions: 3,
    conditions: [{ id: 'gold-1', text: '大目標を登録し、中目標・小目標まで分解する', cleared: false }],
  },
  {
    id: 'platinum', name: 'PLATINUM', color: '#45d6c4', minXp: 9000, divisions: 3,
    conditions: [{ id: 'platinum-1', text: '小目標を5つ達成する', cleared: false }],
  },
  {
    id: 'diamond', name: 'DIAMOND', color: '#a98bff', minXp: 16500, divisions: 3,
    conditions: [{ id: 'diamond-1', text: '中目標を1つ達成する', cleared: false }],
  },
  {
    id: 'master', name: 'MASTER', color: '#ff5d73', minXp: 27000, divisions: 3,
    conditions: [{ id: 'master-1', text: '攻め率50%以上の週を4週連続で達成する', cleared: false }],
  },
  {
    id: 'legend', name: 'LEGEND', color: '#ff9f1c', minXp: 45000, divisions: 1,
    conditions: [{ id: 'legend-1', text: '大目標を1つ達成する', cleared: false }],
  },
]

export const DEFAULT_CONFIG: Config = {
  ranks: DEFAULT_RANKS,
  rules: DEFAULT_RULES,
  dayStartHour: 4,
  attackTargetPct: 50,
}

export const PERSON_CATEGORIES = ['社員', '取引先', '仲間', '家族', 'その他'] as const
export const CONTACT_METHODS = ['会った', '電話', 'LINE', 'メール', 'その他'] as const

export const DEFAULT_ALERT_DAYS: Record<(typeof PERSON_CATEGORIES)[number], number> = {
  社員: 14,
  取引先: 30,
  仲間: 30,
  家族: 14,
  その他: 60,
}

export const GOAL_LEVEL_LABEL = { main: '大目標', mid: '中目標', small: '小目標' } as const
export const GOAL_CHILD_LEVEL = { main: 'mid', mid: 'small', small: null } as const
