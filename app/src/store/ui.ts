import { create } from 'zustand'

export type Tab = 'home' | 'quests' | 'challenge' | 'squad' | 'stats'
export type Page = 'ranks' | 'settings' | 'vision' | 'gym' | 'workout' | null
/** 筋トレページの表示：今週・履歴・メニュー・体重 */
export type GymView = 'week' | 'history' | 'menu' | 'weight'
/** クエストタブの表示：明日・今週・今月・人生（大中小の目標） */
export type QuestView = 'tomorrow' | 'week' | 'month' | 'life'

export interface Toast {
  id: number
  amount: number
  label: string
  detail?: string
  /** atk = 攻め系の行動（オレンジ） */
  tone?: 'atk'
}

interface UIState {
  tab: Tab
  page: Page
  rankEdit: boolean
  /** 人脈タブで開く人 */
  focusPerson: string | null
  questView: QuestView
  toasts: Toast[]
  matchResult: boolean
  gymView: GymView
  /** 記録中・編集中のトレーニング */
  workoutId: string | null
  /** 取り消しバー */
  undo: { id: number; text: string; run: () => void } | null
}

export const useUI = create<UIState>(() => ({
  tab: 'home',
  page: null,
  rankEdit: false,
  focusPerson: null,
  questView: 'life',
  toasts: [],
  matchResult: false,
  gymView: 'week',
  workoutId: null,
  undo: null,
}))

export function goTab(tab: Tab) {
  useUI.setState({ tab, page: null })
  window.scrollTo({ top: 0 })
}

export function openPage(page: Page, opts: { rankEdit?: boolean } = {}) {
  useUI.setState({ page, rankEdit: !!opts.rankEdit })
  window.scrollTo({ top: 0 })
}

let seq = 0

/** キルフィード風の XP 通知 */
export function toast(amount: number, label: string, detail?: string, tone?: 'atk') {
  const id = ++seq
  useUI.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, amount, label, detail, tone }] }))
  setTimeout(() => useUI.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
}

/** クエストタブの指定の表示を開く */
export function openQuests(view: QuestView) {
  useUI.setState({ tab: 'quests', page: null, questView: view })
  window.scrollTo({ top: 0 })
}

let undoSeq = 0

/** 「元に戻す」付きのバーを出す（6秒で消える） */
export function offerUndo(text: string, run: () => void) {
  const id = ++undoSeq
  useUI.setState({ undo: { id, text, run } })
  setTimeout(() => {
    if (useUI.getState().undo?.id === id) useUI.setState({ undo: null })
  }, 6000)
}

export function openGym(view?: GymView) {
  useUI.setState((s) => ({ page: 'gym', gymView: view ?? s.gymView }))
  window.scrollTo({ top: 0 })
}

export function openWorkout(id: string) {
  useUI.setState({ page: 'workout', workoutId: id })
  window.scrollTo({ top: 0 })
}
