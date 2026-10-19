import { describe, expect, it } from 'vitest'
import { DEFAULT_REMINDERS } from './defaults'
import { REMINDER_DEFS, buildIcs, firstDate, googleCalendarUrl } from './reminders'

const def = (key: string) => REMINDER_DEFS.find((d) => d.key === key)!

describe('reminders', () => {
  it('starts each rule on its first matching day', () => {
    // 2026-10-19 は月曜
    expect(firstDate(def('morning'), '2026-10-19')).toBe('2026-10-19')
    expect(firstDate(def('weekly'), '2026-10-19')).toBe('2026-10-25')
    expect(firstDate(def('weekly'), '2026-10-25')).toBe('2026-10-25')
    expect(firstDate(def('monthly'), '2026-10-19')).toBe('2026-10-31')
    expect(firstDate(def('monthly'), '2027-02-01')).toBe('2027-02-28')
  })

  it('writes recurring events with an alarm at the start time', () => {
    const ics = buildIcs({ ...DEFAULT_REMINDERS, monthly: '' }, new Date(2026, 9, 19, 12))
    const events = ics.split('BEGIN:VEVENT').length - 1
    expect(events).toBe(3)
    expect(ics).toContain('DTSTART:20261019T073000')
    expect(ics).toContain('DTEND:20261019T074000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU')
    expect(ics).toContain('DTSTART:20261025T210000')
    expect(ics).toContain('TRIGGER:PT0S')
    expect(ics).not.toContain('BYMONTHDAY')
    // 1行75バイトまで（折り返しは CRLF＋空白）
    const enc = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75)
  })

  it('rolls the end time over midnight', () => {
    const ics = buildIcs({ morning: '', night: '23:55', weekly: '', monthly: '' }, new Date(2026, 9, 19, 12))
    expect(ics).toContain('DTEND:20261020T000500')
  })

  it('builds a Google Calendar link with the recurrence', () => {
    const url = new URL(googleCalendarUrl(def('night'), '22:00', new Date(2026, 9, 19, 12)))
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY')
    expect(url.searchParams.get('dates')).toBe('20261019T220000/20261019T221000')
  })
})
