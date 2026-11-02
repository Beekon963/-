import { daysBetween, formatShort, weekday } from '../lib/date'
import { INTRO_DAYS, WEEKDAY_JA, isClosed } from '../lib/gym'
import type { GymStatus } from '../lib/types'
import { skipToday, startWorkout, useGym } from '../store/gym'
import { openGym, openWorkout } from '../store/ui'

export const STATUS_LABEL: Record<GymStatus | 'none', string> = {
  none: '未開始', active: '実施中', done: '完了', partial: '一部実施', skipped: '見送り',
}

export function dayLabel(date: string) {
  return `${WEEKDAY_JA[weekday(date)]} ${formatShort(date)}`
}

/** ホームの筋トレ枠：今日の予定・開始／再開・今週の回数・次回 */
export function GymCard() {
  const gym = useGym()
  const { todayInfo: t, week, next, active, plan, today } = gym
  const session = t.session
  const status: GymStatus | 'none' = session?.status ?? 'none'
  // 今日の分でなくても、実施中のものがあれば再開できるようにする
  const resume = session?.status === 'active' ? session : active
  const introDay = plan.introStart ? daysBetween(plan.introStart, today) + 1 : null

  return (
    <section className="sec">
      <div className="sec-h">
        <span className="en">TRAINING</span><span className="ja">筋トレ</span>
        <span className="right">
          今週 <b>{week.done}</b>/{week.planned}
          {week.partial > 0 && <small className="gc-partial">一部{week.partial}</small>}
        </span>
      </div>
      <div className={`gym-card${t.menu ? ` s-${status}` : ' rest'}`}>
        {t.menu ? (
          <>
            <div className="gc-k">
              TODAY ・ <b>{STATUS_LABEL[status]}</b>
              {t.moved && <span className="gc-tag">振替</span>}
            </div>
            <div className="gc-t">{t.menu.name}</div>
            <div className="gc-s">
              目安{t.menu.minutes}分 ・ {t.menu.exercises.length}種目
              {gym.intro && introDay !== null && introDay <= INTRO_DAYS && ` ・ 導入期間 ${introDay}/${INTRO_DAYS}日目`}
            </div>
          </>
        ) : (
          <>
            <div className="gc-k">REST DAY{isClosed(today) && ' ・ ジム休館日'}</div>
            <div className="gc-t">今日は休養日</div>
            <div className="gc-s">休むのも予定どおり。</div>
          </>
        )}

        <div className="gc-btns">
          {resume ? (
            <button className="btn" onClick={() => openWorkout(resume.id)}>再開</button>
          ) : t.menu && status === 'none' ? (
            <button className="btn" onClick={() => startWorkout(t.menu!.id)}>開始</button>
          ) : null}
          <button className="btn ghost" onClick={() => openGym(status === 'none' && t.menu ? 'week' : 'history')}>記録を見る</button>
        </div>

        <div className="gc-foot">
          <span>
            今週 完了{week.done}{week.partial > 0 && `・一部${week.partial}`} / 予定{week.planned}
          </span>
          {next && <span>次回 {dayLabel(next.date)} {next.menu.name}</span>}
        </div>
        {t.menu && status === 'none' && !resume && (
          <button className="gc-skip" onClick={() => skipToday(t.menu!)}>今日は見送る</button>
        )}
        {gym.introOver && (
          <button className="gc-intro" onClick={() => openGym('menu')}>導入期間が終わりました ・ 通常のセット数に切り替えられます ›</button>
        )}
      </div>
    </section>
  )
}
