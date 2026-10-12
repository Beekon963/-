import { create } from 'zustand'

export type Tab = 'home' | 'quests' | 'squad' | 'stats'
export type Page = 'ranks' | 'settings' | null

export interface Toast {
  id: number
  amount: number
  label: string
}

interface UIState {
  tab: Tab
  page: Page
  rankEdit: boolean
  /** 人脈タブで開く人 */
  focusPerson: string | null
  toasts: Toast[]
  matchResult: boolean
}

export const useUI = create<UIState>(() => ({
  tab: 'home',
  page: null,
  rankEdit: false,
  focusPerson: null,
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

export function toast(amount: number, label: string) {
  const id = ++seq
  useUI.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, amount, label }] }))
  setTimeout(() => useUI.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 1800)
}
