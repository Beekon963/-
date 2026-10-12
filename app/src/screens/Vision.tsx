import { useMemo, useRef, useState } from 'react'
import { IconBack, IconClose, IconPlus } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { childrenMap, goalProgress } from '../lib/game'
import type { Vision as VisionData, VisionMilestone, VisionValue } from '../lib/types'
import { importJson } from '../store/data'
import { saveVision, useGame, type Game } from '../store/game'
import { goTab, useUI } from '../store/ui'

export function Vision() {
  const g = useGame()
  const [editing, setEditing] = useState(false)
  const v = g.vision
  const close = () => useUI.setState({ page: null })

  return (
    <div className="fade-in">
      <div className="page-title">
        <button className="back" onClick={close} aria-label="戻る"><IconBack /></button>
        <div>
          <h1>VISION</h1>
          <div className="ja">人生の目標 ・ 何のために戦うのか</div>
        </div>
        {v && <button className="btn-sm right" onClick={() => setEditing(true)}>編集</button>}
      </div>

      {v ? <VisionView v={v} g={g} /> : <EmptyVision onEdit={() => setEditing(true)} />}

      <VisionSheet open={editing} initial={v} onClose={() => setEditing(false)} />
    </div>
  )
}

function EmptyVision({ onEdit }: { onEdit: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  return (
    <div className="sec">
      <div className="empty">
        <b>NO VISION</b>
        何のために頑張るのか。<br />人生の目標を書いておくと、ホームから毎日見返せます。
        <button className="btn" style={{ marginTop: 16 }} onClick={onEdit}>人生の目標を書く</button>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>ファイルから読み込む</button>
        <input
          ref={fileRef} type="file" accept="application/json,.json" hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              importJson(await f.text())
              setMsg('読み込みました')
            } catch (err) {
              setMsg(err instanceof Error ? err.message : '読み込みに失敗しました')
            }
          }}
        />
        {msg && <div className="help">{msg}</div>}
      </div>
    </div>
  )
}

function VisionView({ v, g }: { v: VisionData; g: Game }) {
  const year = Number(g.today.slice(0, 4))
  const kids = useMemo(() => childrenMap(g.goals), [g.goals])
  const mains = g.goals.filter((x) => x.level === 'main' && !x.parentId && !x.done)
  const milestones = [...v.milestones].sort((a, b) => a.year - b.year)

  return (
    <>
      <section className="vis-hero">
        <div className="kicker">MISSION</div>
        <p className="vis-mission">{v.mission}</p>
        {v.statement && <p className="vis-statement">{v.statement}</p>}
        <div className="vis-count">
          <div>
            <div className="n">{g.challenges.total.toLocaleString()}</div>
            <div className="l">これまでの挑戦</div>
          </div>
          <div>
            <div className="n">{g.challenges.today}</div>
            <div className="l">今日（昨日 {g.challenges.yesterday}）</div>
          </div>
        </div>
        <p className="help" style={{ textAlign: 'center' }}>挑戦＝達成・着手したデイリー＋挑戦ログ。この数字が、ミッションの証明になる。</p>
      </section>

      {v.why && (
        <section className="sec">
          <div className="sec-h"><span className="en">WHY</span><span className="ja">この目標を実現したい理由</span></div>
          <p className="vis-text">{v.why}</p>
        </section>
      )}

      {v.values.length > 0 && (
        <section className="sec">
          <div className="sec-h"><span className="en">VALUES</span><span className="ja">大切にする価値観</span></div>
          <div className="vis-values">
            {v.values.map((val) => (
              <div key={val.name} className={`vis-value${val.core ? ' core' : ''}`}>
                <div className="nm">{val.name}{val.core && <span className="core-tag">CORE</span>}</div>
                <div className="tx">{val.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(milestones.length > 0 || v.dream) && (
        <section className="sec">
          <div className="sec-h"><span className="en">ROADMAP</span><span className="ja">人生の到達目標</span></div>
          <div className="timeline">
            <div className="tl-item now">
              <div className="tl-dot" />
              <div className="tl-when"><b>{year}</b> NOW</div>
              <div className="tl-title">現在地：{g.rank.fullName} ・ 挑戦 {g.challenges.total}回</div>
            </div>
            {milestones.map((m) => (
              <div key={`${m.year}-${m.title}`} className="tl-item">
                <div className="tl-dot" />
                <div className="tl-when">
                  <b>{m.year}</b>{m.age ? ` ・ ${m.age}歳` : ''}
                  <span className="tl-left">{m.year > year ? `あと${m.year - year}年` : m.year === year ? '今年' : ''}</span>
                </div>
                <div className="tl-title">{m.title}</div>
                {m.text && <div className="tl-text">{m.text}</div>}
              </div>
            ))}
            {v.dream && (
              <div className="tl-item dream">
                <div className="tl-dot" />
                <div className="tl-when"><b>∞</b> ULTIMATE DREAM</div>
                <div className="tl-title">{v.dream}</div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="sec">
        <div className="sec-h"><span className="en">NOW</span><span className="ja">今、取り組む目標</span></div>
        {mains.length === 0 && <div className="empty">クエストタブで大目標を登録すると、ここに進み具合が出ます</div>}
        {mains.map((m) => {
          const pct = Math.round(goalProgress(m, kids) * 100)
          return (
            <button key={m.id} className="vis-goal" onClick={() => goTab('quests')}>
              <div className="t">{m.title}</div>
              <div className="goal-progress" style={{ padding: 0, marginTop: 8 }}>
                <div className="pbar"><div style={{ width: `${pct}%` }} /></div>
                <span className="pct">{pct}%</span>
              </div>
            </button>
          )
        })}
      </section>

      {v.dailyRule && (
        <section className="sec">
          <div className="sec-h"><span className="en">DAILY RULE</span><span className="ja">毎日の行動指針</span></div>
          <p className="vis-rule">{v.dailyRule}</p>
        </section>
      )}

      {v.purpose && (
        <section className="sec">
          <div className="sec-h"><span className="en">WHY THIS APP</span><span className="ja">このアプリの目的</span></div>
          <p className="vis-text">{v.purpose}</p>
        </section>
      )}
    </>
  )
}

// ---------- 編集 ----------

function emptyVision(): VisionData {
  return { mission: '', values: [], milestones: [] }
}

function VisionSheet({ open, initial, onClose }: { open: boolean; initial: VisionData | null; onClose: () => void }) {
  const [v, setV] = useState<VisionData>(emptyVision())
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setV(initial ? structuredClone(initial) : emptyVision())
  }
  const set = <K extends keyof VisionData>(k: K, val: VisionData[K]) => setV((x) => ({ ...x, [k]: val }))
  const setValue = (i: number, patch: Partial<VisionValue>) =>
    set('values', v.values.map((x, j) => (j === i ? { ...x, ...patch } : patch.core ? { ...x, core: false } : x)))
  const setMilestone = (i: number, patch: Partial<VisionMilestone>) => set('milestones', v.milestones.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const save = () => {
    saveVision({
      ...v,
      mission: v.mission.trim(),
      values: v.values.filter((x) => x.name.trim()),
      milestones: v.milestones.filter((x) => x.title.trim() && x.year),
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} en="VISION" ja="人生の目標を編集">
      <div className="field">
        <label>ミッション（人生の目標を一文で）</label>
        <textarea className="input" style={{ minHeight: 60 }} value={v.mission} onChange={(e) => set('mission', e.target.value)} placeholder="例：「挑戦回数で人生は変わる」を、自分の人生で証明する。" />
      </div>
      <div className="field">
        <label>どんな存在になる？</label>
        <textarea className="input" value={v.statement ?? ''} onChange={(e) => set('statement', e.target.value)} />
      </div>
      <div className="field">
        <label>実現したい理由</label>
        <textarea className="input" value={v.why ?? ''} onChange={(e) => set('why', e.target.value)} />
      </div>

      <div className="label">大切にする価値観（★＝いちばん大切）</div>
      {v.values.map((val, i) => (
        <div key={i} className="rank-edit">
          <div className="row">
            <button className={`chip${val.core ? ' on' : ''}`} style={{ flex: '0 0 44px' }} onClick={() => setValue(i, { core: !val.core })} aria-label="いちばん大切">★</button>
            <input className="input" value={val.name} onChange={(e) => setValue(i, { name: e.target.value })} placeholder="例：挑戦" />
            <button className="del" aria-label="削除" onClick={() => set('values', v.values.filter((_, j) => j !== i))}><IconClose size={14} /></button>
          </div>
          <textarea className="input" style={{ minHeight: 56 }} value={val.text} onChange={(e) => setValue(i, { text: e.target.value })} placeholder="どういう意味か" />
        </div>
      ))}
      <button className="toggle-link" style={{ marginBottom: 14 }} onClick={() => set('values', [...v.values, { name: '', text: '' }])}>
        <IconPlus size={13} /> 価値観を追加
      </button>

      <div className="label">人生の到達目標</div>
      {v.milestones.map((m, i) => (
        <div key={i} className="rank-edit">
          <div className="row">
            <input className="input" type="number" inputMode="numeric" value={m.year || ''} onChange={(e) => setMilestone(i, { year: Number(e.target.value) })} placeholder="西暦" />
            <input className="input" type="number" inputMode="numeric" value={m.age ?? ''} onChange={(e) => setMilestone(i, { age: e.target.value ? Number(e.target.value) : undefined })} placeholder="歳" />
            <button className="del" aria-label="削除" onClick={() => set('milestones', v.milestones.filter((_, j) => j !== i))}><IconClose size={14} /></button>
          </div>
          <input className="input" style={{ marginBottom: 8 }} value={m.title} onChange={(e) => setMilestone(i, { title: e.target.value })} placeholder="目指す姿（例：億万長者になる）" />
          <textarea className="input" style={{ minHeight: 56 }} value={m.text ?? ''} onChange={(e) => setMilestone(i, { text: e.target.value })} placeholder="くわしく" />
        </div>
      ))}
      <button
        className="toggle-link" style={{ marginBottom: 14 }}
        onClick={() => set('milestones', [...v.milestones, { year: new Date().getFullYear() + 5, title: '' }])}
      >
        <IconPlus size={13} /> 到達目標を追加
      </button>

      <div className="field">
        <label>究極の夢</label>
        <input className="input" value={v.dream ?? ''} onChange={(e) => set('dream', e.target.value)} />
      </div>
      <div className="field">
        <label>毎日の行動指針</label>
        <textarea className="input" value={v.dailyRule ?? ''} onChange={(e) => set('dailyRule', e.target.value)} />
      </div>
      <div className="field">
        <label>このアプリの目的</label>
        <textarea className="input" value={v.purpose ?? ''} onChange={(e) => set('purpose', e.target.value)} />
      </div>
      <button className="btn" disabled={!v.mission.trim()} onClick={save}>保存する</button>
    </Sheet>
  )
}
