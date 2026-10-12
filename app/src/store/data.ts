// 全データは「レコード」の集まり。端末に保存し、ログイン中は Supabase と同期する

import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import type { Rec, RecType, RecordMap } from '../lib/types'

const STORAGE_KEY = 'life-ranked-v1'

export interface SyncMeta {
  /** このデータが紐づくユーザー（null = ログイン前に作ったデータ） */
  userId: string | null
  /** サーバーから取り込んだ最新の updated_at */
  lastPulledAt: string | null
}

interface DataState {
  loaded: boolean
  records: Record<string, Rec>
  /** 未送信のレコード id → キューに入れた時点の updatedAt */
  outbox: Record<string, number>
  sync: SyncMeta
}

const EMPTY: Omit<DataState, 'loaded'> = {
  records: {},
  outbox: {},
  sync: { userId: null, lastPulledAt: null },
}

export const useData = create<DataState>(() => ({ loaded: false, ...EMPTY }))

let changeListener: (() => void) | null = null

/** ローカル変更のたびに呼ばれる（同期の予約に使う） */
export function onLocalChange(fn: () => void) {
  changeListener = fn
}

export function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function put<T extends RecType>(type: T, id: string, data: RecordMap[T]) {
  const now = Date.now()
  useData.setState((s) => ({
    records: { ...s.records, [id]: { id, type, data, updatedAt: now } as Rec },
    outbox: { ...s.outbox, [id]: now },
  }))
  changeListener?.()
}

export function patch<T extends RecType>(type: T, id: string, partial: Partial<RecordMap[T]>) {
  const rec = useData.getState().records[id]
  if (!rec || rec.deleted) return
  put(type, id, { ...(rec.data as RecordMap[T]), ...partial })
}

export function remove(...ids: string[]) {
  const now = Date.now()
  useData.setState((s) => {
    const records = { ...s.records }
    const outbox = { ...s.outbox }
    for (const id of ids) {
      const rec = records[id]
      if (!rec) continue
      records[id] = { ...rec, deleted: true, updatedAt: now }
      outbox[id] = now
    }
    return { records, outbox }
  })
  changeListener?.()
}

export async function hydrate() {
  try {
    const saved = await get<Omit<DataState, 'loaded'>>(STORAGE_KEY)
    if (saved) useData.setState({ ...EMPTY, ...saved, loaded: true })
    else useData.setState({ loaded: true })
  } catch {
    useData.setState({ loaded: true })
  }
}

export async function wipeLocal() {
  useData.setState({ ...EMPTY, loaded: true })
  await del(STORAGE_KEY).catch(() => {})
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function save() {
  const { records, outbox, sync, loaded } = useData.getState()
  if (!loaded) return
  set(STORAGE_KEY, { records, outbox, sync }).catch(() => {})
}

useData.subscribe(() => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 250)
})

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', save)
}

/** バックアップ用 */
export function exportJson() {
  const { records } = useData.getState()
  return JSON.stringify({ app: 'life-ranked', version: 1, exportedAt: new Date().toISOString(), records: Object.values(records) }, null, 2)
}

export function importJson(text: string) {
  const parsed = JSON.parse(text) as { app?: string; records?: Rec[] }
  if (parsed.app !== 'life-ranked' || !Array.isArray(parsed.records)) throw new Error('LIFE RANKED のバックアップファイルではありません')
  const now = Date.now()
  useData.setState((s) => {
    const records = { ...s.records }
    const outbox = { ...s.outbox }
    for (const r of parsed.records!) {
      if (!r?.id || !r.type) continue
      records[r.id] = { ...r, updatedAt: now }
      outbox[r.id] = now
    }
    return { records, outbox }
  })
  changeListener?.()
  return parsed.records.length
}
