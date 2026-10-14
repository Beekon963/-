import { create } from 'zustand'

export type Tab = 'home' | 'quests' | 'challenge' | 'squad' | 'stats'
export type Page = 'ranks' | 'settings' | 'vision' | null
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
}

export const useUI = create<UIState>(() => ({
  tab: 'home',
  page: null,
  rankEdit: false,
  focusPerson: null,
  questView: 'life',
  toasts: [],
  matchResult: false,
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
