// 通知はカレンダーに任せる（アプリを閉じていても、iPhone・Android・PC で確実に届くため）

import { addDays, localDate, weekday } from './date'
import type { Reminders } from './types'

export const APP_URL = 'https://beekon963.github.io/-/life-rank/'

export interface ReminderDef {
  key: keyof Reminders
  /** 設定画面の見出し */
  label: string
  when: string
  /** カレンダーの予定名 */
  title: string
  body: string
  rrule: string
}

export const REMINDER_DEFS: ReminderDef[] = [
  {
    key: 'morning', label: '朝：今日のクエスト', when: '毎日',
    title: 'LIFE RANKED｜今日のクエストに1つ着手',
    body: '最低ライン：クエストに「着手」か挑戦1回で連続キープ。完璧じゃなくていい。',
    rrule: 'FREQ=DAILY',
  },
  {
    key: 'night', label: '夜：振り返り＋明日のクエスト', when: '毎日',
    title: 'LIFE RANKED｜振り返り＋明日のクエスト',
    body: '一言の振り返りと、明日のクエストを1つ書いて今日を締める。',
    rrule: 'FREQ=DAILY',
  },
  {
    key: 'weekly', label: '日曜：来週の目標', when: '毎週日曜',
    title: 'LIFE RANKED｜来週の目標を書く',
    body: '日曜のうちに来週の目標を1つ以上。',
    rrule: 'FREQ=WEEKLY;BYDAY=SU',
  },
  {
    key: 'monthly', label: '月末：来月の目標', when: '毎月末',
    title: 'LIFE RANKED｜来月の目標を書く',
    body: '月末のうちに来月の目標を1つ以上。',
    rrule: 'FREQ=MONTHLY;BYMONTHDAY=-1',
  },
]

/** 繰り返しの最初の日（今日から数えて最初に当てはまる日） */
export function firstDate(def: ReminderDef, today: string) {
  if (def.key === 'weekly') return addDays(today, (7 - weekday(today)) % 7)
  if (def.key === 'monthly') {
    let d = today
    while (!addDays(d, 1).endsWith('-01')) d = addDays(d, 1)
    return d
  }
  return today
}

const compact = (date: string, hhmm: string) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`

function endOf(date: string, hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const day = total >= 1440 ? addDays(date, 1) : date
  const t = total % 1440
  return compact(day, `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
}

function escapeText(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** 1行75バイトで折り返す（日本語は UTF-8 で3バイト） */
function fold(line: string) {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** 繰り返しの予定＋開始時刻の通知を .ics にする（時刻は端末のタイムゾーン） */
export function buildIcs(rem: Reminders, now = new Date()) {
  const today = localDate(now.getTime())
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LIFE RANKED//Reminders//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  ]
  for (const def of REMINDER_DEFS) {
    const time = rem[def.key]
    if (!time) continue
    const date = firstDate(def, today)
    lines.push(
      'BEGIN:VEVENT',
      `UID:life-ranked-${def.key}@beekon963.github.io`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${compact(date, time)}`,
      `DTEND:${endOf(date, time, 10)}`,
      `RRULE:${def.rrule}`,
      `SUMMARY:${escapeText(def.title)}`,
      `DESCRIPTION:${escapeText(`${def.body}\n${APP_URL}`)}`,
      `URL:${APP_URL}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(def.title)}`, 'TRIGGER:PT0S', 'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Google カレンダーの「予定を作成」画面を、繰り返し付きで開くリンク */
export function googleCalendarUrl(def: ReminderDef, time: string, now = new Date()) {
  const date = firstDate(def, localDate(now.getTime()))
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: def.title,
    details: `${def.body}\n${APP_URL}`,
    dates: `${compact(date, time)}/${endOf(date, time, 10)}`,
    recur: `RRULE:${def.rrule}`,
    ctz: tz,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}
