// 日付は 'YYYY-MM-DD' 文字列で扱う（辞書順＝時系列順になる）

const DAY_MS = 86_400_000

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toUtc(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(ms: number) {
  const dt = new Date(ms)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** 1日の切り替わり時刻（例：朝4時）を考慮した「今日」 */
export function logicalToday(now: Date, dayStartHour: number) {
  const shifted = new Date(now.getTime() - dayStartHour * 3_600_000)
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`
}

export function addDays(date: string, n: number) {
  return fromUtc(toUtc(date) + n * DAY_MS)
}

export function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

/** 0=日 … 6=土 */
export function weekday(date: string) {
  return new Date(toUtc(date)).getUTCDay()
}

/** その週の月曜日 */
export function weekStart(date: string) {
  return addDays(date, -((weekday(date) + 6) % 7))
}

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const WD_JA = ['日', '月', '火', '水', '木', '金', '土']

export function formatDot(date: string) {
  return `${date.replace(/-/g, '.')} ${WD_EN[weekday(date)]}`
}

export function formatShort(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}`
}

export function formatJa(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日(${WD_JA[weekday(date)]})`
}

/** タイムスタンプ（ms）の端末ローカル日付 */
export function localDate(ms: number) {
  return logicalToday(new Date(ms), 0)
}

/** その月の1日 */
export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`
}

/** 翌月の1日 */
export function nextMonthStart(date: string) {
  const [y, m] = date.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`
}
