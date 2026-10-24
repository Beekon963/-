// ロック画面の壁紙を自動で更新する。
// 方式：アプリが「今日・明日・明後日」の壁紙を作って Supabase Storage に日付ごとに置く。
// iPhone のショートカットが決まった時刻に、その日の画像を取りに行って壁紙にする。

import { create } from 'zustand'
import { addDays, logicalToday } from '../lib/date'
import { renderWallpaper, screenSize, wallpaperData, type WallpaperData } from '../lib/wallpaper'
import type { Rec } from '../lib/types'
import { getClient, getServerConfig, useCloud } from './cloud'
import { useData } from './data'
import { deriveGame, updateConfig } from './game'

export const WALLPAPER_BUCKET = 'wallpapers'
/** 今日から何日先まで作っておくか（アプリを開かない日があっても壁紙が出るように） */
const DAYS_AHEAD = 2
const SENT_KEY = 'lr-wallpaper-sent'
const CLEAN_KEY = 'lr-wallpaper-cleaned'

interface WallpaperState {
  busy: boolean
  lastAt: number | null
  error: string | null
}

export const useWallpaper = create<WallpaperState>(() => ({ busy: false, lastAt: null, error: null }))

/** その日（論理日付）の昼の時点のゲーム状態 */
export function gameOn(records: Record<string, Rec>, date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return deriveGame(records, new Date(y, m - 1, d, 12))
}

export function stampNow() {
  const n = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${n.getMonth() + 1}/${n.getDate()} ${n.getHours()}:${pad(n.getMinutes())} 時点`
}

/** 今日の壁紙（設定画面のプレビューと、手動で保存するとき用） */
export function todayWallpaper(size = screenSize()) {
  const records = useData.getState().records
  const g = deriveGame(records, new Date())
  const cfg = g.config.wallpaper
  const { width, height } = cfg ?? size
  return renderWallpaper(wallpaperData(g), width, height, stampNow())
}

function randomKey() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24)
}

function folder(userId: string, key: string) {
  return `${userId}/${key}`
}

/** ショートカットに貼る URL（{日付} の部分を yyyy-MM-dd に置き換える） */
export function wallpaperUrlBase() {
  const server = getServerConfig()
  const { userId } = useCloud.getState()
  const cfg = deriveGame(useData.getState().records, new Date()).config.wallpaper
  if (!server || !userId || !cfg) return null
  return `${server.url.replace(/\/+$/, '')}/storage/v1/object/public/${WALLPAPER_BUCKET}/${folder(userId, cfg.key)}/`
}

// ---------- 送信 ----------

function readSent(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeSent(sent: Record<string, string>) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent))
  } catch {
    /* 保存できなくても毎回送るだけ */
  }
}

function jaStorageError(message: string) {
  if (/Bucket not found/i.test(message)) return '画像の置き場所がありません（schema.sql をもう一度実行してください）'
  if (/row-level security|Unauthorized|403/i.test(message)) return '画像を置く権限がありません（schema.sql をもう一度実行してください）'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'サーバーに接続できません'
  return message
}

let running = false
let again = false

/** 変わった日の壁紙だけ作り直して送る。force = 全部送り直す */
export async function syncWallpaper(force = false) {
  if (running) {
    again = true
    return
  }
  const { auth, userId } = useCloud.getState()
  const c = getClient()
  const records = useData.getState().records
  const base = deriveGame(records, new Date())
  const cfg = base.config.wallpaper
  if (!cfg || auth !== 'signedIn' || !userId || !c) return

  running = true
  useWallpaper.setState({ busy: true })
  try {
    const dir = folder(userId, cfg.key)
    const sent = force ? {} : readSent()
    const stamp = stampNow()
    const keep: Record<string, string> = {}
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const date = addDays(base.today, i)
      const data: WallpaperData = wallpaperData(i === 0 ? base : gameOn(records, date))
      const path = `${dir}/${date}.jpg`
      const hash = JSON.stringify([data, cfg.width, cfg.height])
      keep[path] = hash
      if (sent[path] === hash) continue
      const blob = await renderWallpaper(data, cfg.width, cfg.height, stamp)
      const { error } = await c.storage.from(WALLPAPER_BUCKET).upload(path, blob, {
        upsert: true, contentType: 'image/jpeg', cacheControl: '60',
      })
      if (error) throw new Error(error.message)
      sent[path] = hash
      writeSent(sent)
    }
    writeSent(keep)
    useWallpaper.setState({ lastAt: Date.now(), error: null })
    await cleanOld(dir, base.today)
  } catch (e) {
    useWallpaper.setState({ error: jaStorageError(e instanceof Error ? e.message : String(e)) })
  } finally {
    running = false
    useWallpaper.setState({ busy: false })
    if (again) {
      again = false
      void syncWallpaper()
    }
  }
}

/** 過ぎた日の画像を消す（1日1回。ファイル名の先頭10文字が日付） */
async function cleanOld(dir: string, today: string) {
  const c = getClient()
  if (!c || localStorage.getItem(CLEAN_KEY) === `${dir}:${today}`) return
  const { data, error } = await c.storage.from(WALLPAPER_BUCKET).list(dir, { limit: 100 })
  if (error || !data) return
  const old = data.map((f) => f.name).filter((name) => name.slice(0, 10) < today)
  if (old.length) await c.storage.from(WALLPAPER_BUCKET).remove(old.map((name) => `${dir}/${name}`))
  localStorage.setItem(CLEAN_KEY, `${dir}:${today}`)
}

async function removeFolder(dir: string) {
  const c = getClient()
  if (!c) return
  const { data } = await c.storage.from(WALLPAPER_BUCKET).list(dir, { limit: 100 })
  if (data?.length) await c.storage.from(WALLPAPER_BUCKET).remove(data.map((f) => `${dir}/${f.name}`))
}

// ---------- オン・オフ ----------

/** 自動更新を始める。画像の大きさはこの端末の画面に合わせる */
export function enableWallpaper() {
  const size = screenSize()
  updateConfig((c) => ({ ...c, wallpaper: { key: c.wallpaper?.key ?? randomKey(), ...size } }))
  void syncWallpaper(true)
}

export function fitWallpaperToThisScreen() {
  const size = screenSize()
  updateConfig((c) => (c.wallpaper ? { ...c, wallpaper: { ...c.wallpaper, ...size } } : c))
  void syncWallpaper(true)
}

export async function disableWallpaper() {
  const { userId } = useCloud.getState()
  const cfg = deriveGame(useData.getState().records, new Date()).config.wallpaper
  updateConfig((c) => ({ ...c, wallpaper: undefined }))
  writeSent({})
  if (cfg && userId) await removeFolder(folder(userId, cfg.key)).catch(() => {})
}

/** URL を作り直す（前の URL では見られなくなる） */
export async function renewWallpaperKey() {
  const { userId } = useCloud.getState()
  const cfg = deriveGame(useData.getState().records, new Date()).config.wallpaper
  if (!cfg) return
  updateConfig((c) => ({ ...c, wallpaper: { ...cfg, key: randomKey() } }))
  writeSent({})
  if (userId) await removeFolder(folder(userId, cfg.key)).catch(() => {})
  void syncWallpaper(true)
}

// ---------- 自動で送る ----------

let started = false
let timer: ReturnType<typeof setTimeout> | null = null

function schedule(ms = 4000) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void syncWallpaper()
  }, ms)
}

/** データが変わったら少し待って送る。日付が変わったときにも送る */
export function startWallpaperSync() {
  if (started) return
  started = true
  useData.subscribe((s, prev) => {
    if (s.records !== prev.records) schedule()
  })
  useCloud.subscribe((s, prev) => {
    if (s.auth === 'signedIn' && prev.auth !== 'signedIn') schedule(1500)
  })
  let lastDay = ''
  const tick = () => {
    if (document.visibilityState !== 'visible') return
    const cfg = deriveGame(useData.getState().records, new Date()).config
    const day = logicalToday(new Date(), cfg.dayStartHour)
    if (day !== lastDay) {
      lastDay = day
      schedule(1500)
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      // 閉じる前にまとめて送る
      clearTimeout(timer)
      timer = null
      void syncWallpaper()
    } else tick()
  })
  setInterval(tick, 10 * 60_000)
  tick()
}
