// 休憩タイマー。終了時刻を端末に保存し、画面を閉じても戻ったときに残り時間を正しく出す

import { create } from 'zustand'
import { buzz } from '../lib/fx'

const KEY = 'lr-rest-timer'

export interface RestTimer {
  /** 終了時刻（ms） */
  endAt: number
  /** 最初に決めた秒数 */
  total: number
  label: string
}

function load(): RestTimer | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RestTimer | null
    // 終わってから10分以上たったものは出さない
    if (t && t.endAt > Date.now() - 10 * 60_000) return t
  } catch {
    /* 読めなければなし */
  }
  return null
}

function save(t: RestTimer | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t))
    else localStorage.removeItem(KEY)
  } catch {
    /* 保存できなくても画面上では動く */
  }
}

interface RestState {
  timer: RestTimer | null
  /** 終了の音・通知を出したか */
  alerted: boolean
  sound: boolean
  notify: boolean
}

export const useRest = create<RestState>(() => {
  const timer = load()
  return { timer, alerted: !!timer && timer.endAt <= Date.now(), sound: true, notify: false }
})

let audio: AudioContext | null = null
let alarm: ReturnType<typeof setTimeout> | null = null

/** 音は、ボタンを押したとき（ユーザーの操作中）に準備しておく必要がある */
function primeAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

function beep() {
  if (!audio || audio.state !== 'running') return
  const t0 = audio.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.32)
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.32 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.32 + 0.22)
    osc.connect(gain).connect(audio.destination)
    osc.start(t0 + i * 0.32)
    osc.stop(t0 + i * 0.32 + 0.25)
  }
}

function notifyDone(label: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  void navigator.serviceWorker?.ready
    .then((reg) => reg.showNotification('休憩終了', { body: `${label}：次のセットへ`, tag: 'lr-rest' }))
    .catch(() => {})
}

/** 終了したときの合図（音・振動・通知。どれも任意で、なくてもタイマーは使える） */
export function checkRestDone() {
  const { timer, alerted, sound, notify } = useRest.getState()
  if (!timer || alerted || timer.endAt > Date.now()) return
  useRest.setState({ alerted: true })
  if (document.visibilityState === 'visible') {
    if (sound) beep()
    buzz([200, 100, 200])
  } else if (notify) notifyDone(timer.label)
}

function arm() {
  if (alarm) clearTimeout(alarm)
  const t = useRest.getState().timer
  if (!t) return
  alarm = setTimeout(checkRestDone, Math.max(0, t.endAt - Date.now()) + 50)
}

export function startRest(sec: number, label: string) {
  primeAudio()
  const timer = { endAt: Date.now() + sec * 1000, total: sec, label }
  save(timer)
  useRest.setState({ timer, alerted: false })
  arm()
}

export function addRest(sec: number) {
  const t = useRest.getState().timer
  if (!t) return
  // 終わったあとに足したときは、今から数え直す
  const now = Date.now()
  const timer = { ...t, endAt: Math.max(now, Math.max(t.endAt, now) + sec * 1000) }
  save(timer)
  useRest.setState({ timer, alerted: timer.endAt <= Date.now() })
  arm()
}

export function stopRest() {
  if (alarm) clearTimeout(alarm)
  save(null)
  useRest.setState({ timer: null, alerted: false })
}

export function setRestPrefs(prefs: { sound: boolean; notify: boolean }) {
  useRest.setState(prefs)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // 戻ってきたら、保存した終了時刻から残り時間を出し直す
      const t = load()
      useRest.setState((s) => ({ timer: t, alerted: s.alerted || (!!t && t.endAt <= Date.now()) }))
      arm()
    }
  })
  arm()
}
