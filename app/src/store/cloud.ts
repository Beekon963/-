// Supabase によるログインと同期。
// 方式：端末側を正とし、変更は outbox に積んで送信 → サーバーの差分を updated_at 順に取り込む。

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { normalizeServerUrl } from '../lib/serverUrl'
import type { Rec } from '../lib/types'
import { onLocalChange, useData, wipeLocal } from './data'

const SERVER_KEY = 'lr-server'
const MODE_KEY = 'lr-mode'
const PAGE = 500
const PULL_MARGIN_MS = 10_000

export interface ServerConfig {
  url: string
  key: string
  fromEnv?: boolean
}

export function getServerConfig(): ServerConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) return { url: normalizeServerUrl(url), key, fromEnv: true }
  try {
    const raw = localStorage.getItem(SERVER_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as ServerConfig
      // 以前に「…/rest/v1/」付きで保存した URL も直して使う
      return { ...saved, url: normalizeServerUrl(saved.url) }
    }
  } catch {
    /* 読めなければ未設定扱い */
  }
  return null
}

export function saveServerConfig(url: string, key: string) {
  localStorage.setItem(SERVER_KEY, JSON.stringify({ url: normalizeServerUrl(url), key: key.trim() }))
  client = null
}

/** URL とキーを入れ直せるように消す */
export function resetServerConfig() {
  localStorage.removeItem(SERVER_KEY)
  client = null
  location.reload()
}

let client: SupabaseClient | null = null

/** ログインと同期に使う Supabase（未設定なら null） */
export function getClient() {
  if (client) return client
  const cfg = getServerConfig()
  if (!cfg) return null
  client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'lr-auth' },
  })
  return client
}

// ---------- 状態 ----------

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'
type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

interface CloudState {
  auth: AuthStatus
  email: string | null
  userId: string | null
  localMode: boolean
  syncState: SyncState
  lastSyncAt: number | null
  syncError: string | null
}

export const useCloud = create<CloudState>(() => ({
  auth: 'loading',
  email: null,
  userId: null,
  localMode: localStorage.getItem(MODE_KEY) === 'local',
  syncState: 'idle',
  lastSyncAt: null,
  syncError: null,
}))

function jaError(message: string) {
  if (/Invalid login credentials/i.test(message)) return 'メールアドレスかパスワードが違います'
  if (/Email not confirmed/i.test(message)) return 'メールアドレスの確認が済んでいません（届いたメールのリンクを開いてください）'
  if (/User already registered/i.test(message)) return 'このメールアドレスは登録済みです。ログインしてください'
  if (/Password should be at least/i.test(message)) return 'パスワードは6文字以上にしてください'
  if (/Signups not allowed/i.test(message)) return '新規登録は無効になっています'
  if (/Invalid path specified/i.test(message)) {
    return 'サーバーの URL が違います（https://xxxx.supabase.co の形。後ろに /rest/v1 などを付けない）'
  }
  if (/Invalid API key|No API key/i.test(message)) return 'キーが違います（anon か publishable key を貼ってください）'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'サーバーに接続できません。URL と通信状況を確認してください'
  if (/relation .*records.* does not exist|Could not find the table/i.test(message)) {
    return 'データベースの準備ができていません（schema.sql を実行してください）'
  }
  return message
}

// ---------- 認証 ----------

let started = false

export async function initCloud() {
  if (started) return
  started = true
  onLocalChange(scheduleSync)
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => useCloud.setState({ syncState: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)

  const c = getClient()
  if (!c) {
    useCloud.setState({ auth: 'signedOut' })
    return
  }
  try {
    const { data } = await c.auth.getSession()
    applySession(data.session)
  } catch {
    useCloud.setState({ auth: 'signedOut' })
  }
  c.auth.onAuthStateChange((_event, session) => {
    // コールバック内で Supabase を await しない（公式の注意点）
    setTimeout(() => applySession(session), 0)
  })
}

async function applySession(session: Session | null) {
  if (!session) {
    useCloud.setState({ auth: 'signedOut', email: null, userId: null })
    return
  }
  const userId = session.user.id
  const { sync } = useData.getState()
  if (sync.userId && sync.userId !== userId) {
    // 別アカウントのデータが残っていたら消してから取り込む
    await wipeLocal()
  }
  if (useData.getState().sync.userId !== userId) {
    useData.setState((s) => ({ sync: { ...s.sync, userId } }))
  }
  localStorage.removeItem(MODE_KEY)
  useCloud.setState({ auth: 'signedIn', email: session.user.email ?? null, userId, localMode: false })
  void syncNow()
}

export async function signIn(email: string, password: string) {
  const c = getClient()
  if (!c) throw new Error('サーバーが設定されていません')
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(jaError(error.message))
}

/** 戻り値 true = すぐログイン済み、false = 確認メール待ち */
export async function signUp(email: string, password: string) {
  const c = getClient()
  if (!c) throw new Error('サーバーが設定されていません')
  const { data, error } = await c.auth.signUp({ email: email.trim(), password })
  if (error) throw new Error(jaError(error.message))
  return !!data.session
}

export async function signOut() {
  const c = getClient()
  await c?.auth.signOut().catch(() => {})
  await wipeLocal()
  useCloud.setState({ auth: 'signedOut', email: null, userId: null, lastSyncAt: null, syncError: null, syncState: 'idle' })
}

export function setLocalMode(on: boolean) {
  if (on) localStorage.setItem(MODE_KEY, 'local')
  else localStorage.removeItem(MODE_KEY)
  useCloud.setState({ localMode: on })
}

// ---------- 同期 ----------

let syncing = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

function scheduleSync() {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), 1500)
}

interface Row {
  id: string
  type: Rec['type']
  data: Rec['data']
  deleted: boolean
  updated_at: string
}

export async function syncNow() {
  const c = getClient()
  const { auth, userId } = useCloud.getState()
  if (!c || auth !== 'signedIn' || !userId || !useData.getState().loaded) return
  if (!navigator.onLine) {
    useCloud.setState({ syncState: 'offline' })
    return
  }
  if (syncing) {
    again = true
    return
  }
  syncing = true
  useCloud.setState({ syncState: 'syncing' })
  try {
    // 初回はサーバー側を優先（別端末で作った設定を上書きしないため）
    if (useData.getState().sync.lastPulledAt === null) await pull(c, true)
    await push(c, userId)
    await pull(c, false)
    useCloud.setState({ syncState: 'idle', lastSyncAt: Date.now(), syncError: null })
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
    useCloud.setState({ syncState: 'error', syncError: jaError(message) })
  } finally {
    syncing = false
    if (again) {
      again = false
      void syncNow()
    }
  }
}

async function push(c: SupabaseClient, userId: string) {
  const { records, outbox } = useData.getState()
  const ids = Object.keys(outbox)
  for (let i = 0; i < ids.length; i += PAGE) {
    const chunk = ids.slice(i, i + PAGE)
    const rows = chunk
      .map((id) => records[id])
      .filter(Boolean)
      .map((r) => ({ user_id: userId, id: r.id, type: r.type, data: r.data, deleted: !!r.deleted }))
    if (rows.length) {
      const { error } = await c.from('records').upsert(rows, { onConflict: 'user_id,id' })
      if (error) throw new Error(error.message)
    }
    // 送信中にさらに編集されたものは残す
    useData.setState((s) => {
      const next = { ...s.outbox }
      for (const id of chunk) if (next[id] === outbox[id]) delete next[id]
      return { outbox: next }
    })
  }
}

async function pull(c: SupabaseClient, remoteWins: boolean) {
  const last = useData.getState().sync.lastPulledAt
  let cursor = last ? new Date(Date.parse(last) - PULL_MARGIN_MS).toISOString() : null
  let newest = last
  for (;;) {
    let q = c.from('records').select('id,type,data,deleted,updated_at').order('updated_at', { ascending: true }).limit(PAGE)
    if (cursor) q = q.gt('updated_at', cursor)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Row[]
    if (rows.length === 0) break
    useData.setState((s) => {
      const records = { ...s.records }
      const outbox = { ...s.outbox }
      for (const row of rows) {
        if (outbox[row.id] !== undefined) {
          if (!remoteWins) continue
          delete outbox[row.id]
        }
        records[row.id] = {
          id: row.id, type: row.type, data: row.data, deleted: row.deleted, updatedAt: Date.parse(row.updated_at),
        } as Rec
      }
      return { records, outbox }
    })
    cursor = rows[rows.length - 1].updated_at
    newest = cursor
    if (rows.length < PAGE) break
  }
  useData.setState((s) => ({ sync: { ...s.sync, lastPulledAt: newest } }))
}
