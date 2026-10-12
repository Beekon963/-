import { useEffect, useMemo, useState } from 'react'
import { IconClose, IconPlus } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { formatJa, localDate } from '../lib/date'
import { CONTACT_METHODS, DEFAULT_ALERT_DAYS, PERSON_CATEGORIES } from '../lib/defaults'
import { personStatus, type PersonStatus } from '../lib/game'
import type { ContactMethod, Person, PersonCategory, WithId } from '../lib/types'
import { deleteContact, deletePerson, logContact, savePerson, useGame, type Game } from '../store/game'
import { useUI } from '../store/ui'

const ALERT_CHOICES = [7, 14, 30, 60, 90]

export function Squad() {
  const g = useGame()
  const focus = useUI((s) => s.focusPerson)
  const [filter, setFilter] = useState<PersonCategory | 'all'>('all')
  const [open, setOpen] = useState<string | 'new' | null>(null)

  useEffect(() => {
    if (focus) {
      setOpen(focus)
      useUI.setState({ focusPerson: null })
    }
  }, [focus])

  const list = useMemo(
    () =>
      g.persons
        .map((p) => ({ p, st: personStatus(p, g.contacts.filter((c) => c.personId === p.id), g.today, localDate(p.createdAt)) }))
        .filter(({ p }) => filter === 'all' || p.category === filter)
        .sort((a, b) => b.st.urgency - a.st.urgency),
    [g.persons, g.contacts, g.today, filter],
  )
  const alertCount = list.filter(({ st }) => st.overdue || st.actionDue).length

  return (
    <div className="fade-in">
      <div className="page-title">
        <div>
          <h1>SQUAD</h1>
          <div className="ja">人脈 ・ 連絡が必要な人 {alertCount}人</div>
        </div>
        <button className="btn-sm accent right" onClick={() => setOpen('new')}><IconPlus size={14} /> 追加</button>
      </div>

      <div className="sec">
        <div className="scroll-x" style={{ marginBottom: 12 }}>
          <div className="chips">
            {(['all', ...PERSON_CATEGORIES] as const).map((c) => (
              <button key={c} className={`chip${filter === c ? ' on' : ''}`} onClick={() => setFilter(c)}>{c === 'all' ? 'すべて' : c}</button>
            ))}
          </div>
        </div>

        {g.persons.length === 0 && (
          <div className="empty">
            <b>NO SQUAD</b>
            社員・取引先・仲間を登録しよう。<br />しばらく連絡していない人をホームで知らせます。
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setOpen('new')}>人を登録する</button>
          </div>
        )}

        {list.map(({ p, st }) => (
          <PersonRow key={p.id} p={p} st={st} today={g.today} onClick={() => setOpen(p.id)} />
        ))}
      </div>

      <PersonSheet g={g} id={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function PersonRow({ p, st, today, onClick }: { p: WithId<Person>; st: PersonStatus; today: string; onClick: () => void }) {
  return (
    <button className="contact" onClick={onClick}>
      <div className="avatar">{p.name.slice(0, 1)}</div>
      <div className="c-body">
        <div className="c-name">{p.name}<span className="tag">{p.category}</span></div>
        <div className="c-next">
          {p.nextAction ? `次：${p.nextAction}${p.nextActionDue ? `（${formatJa(p.nextActionDue)}）` : ''}` : p.org ?? '次のアクション未設定'}
        </div>
      </div>
      {st.actionDue ? (
        <div className="c-days due"><div className="n">{p.nextActionDue === today ? '今日' : '期限切れ'}</div><div className="u">期日</div></div>
      ) : (
        <div className={`c-days${st.overdue ? ' warn' : ''}`}>
          <div className="n">{st.daysSince}</div>
          <div className="u">{st.lastDate ? '日 連絡なし' : '日 未連絡'}</div>
        </div>
      )}
    </button>
  )
}

function PersonSheet({ g, id, onClose }: { g: Game; id: string | 'new' | null; onClose: () => void }) {
  const person = id && id !== 'new' ? g.persons.find((p) => p.id === id) : undefined
  const isNew = id === 'new'
  const [form, setForm] = useState<Omit<Person, 'createdAt'>>(emptyPerson())
  const [lastId, setLastId] = useState<string | null>(null)
  const [method, setMethod] = useState<ContactMethod>('LINE')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)

  if (id !== lastId) {
    setLastId(id)
    setForm(person ? { ...person } : emptyPerson())
    setNote('')
    setEditing(isNew)
  }

  const history = person ? g.contacts.filter((c) => c.personId === person.id).slice().reverse() : []
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.name.trim()) return
    const pid = savePerson(person ? person.id : null, form)
    if (isNew) setLastId(pid)
    setEditing(false)
    if (isNew) onClose()
  }

  return (
    <Sheet open={!!id} onClose={onClose} en={isNew ? 'NEW MEMBER' : 'MEMBER'} ja={isNew ? '人を登録' : person?.name}>
      {person && !editing && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="c-name" style={{ fontSize: 18 }}>{person.name}<span className="tag">{person.category}</span></div>
            {person.org && <div className="help" style={{ marginTop: 2 }}>{person.org}</div>}
            <div className="help">
              最終連絡：{history[0] ? formatJa(history[0].date) : 'まだなし'} ・ {person.alertDays}日連絡がないと警告
            </div>
            {person.nextAction && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <span className="lvl" style={{ marginRight: 8 }}>NEXT</span>
                {person.nextAction}{person.nextActionDue && <span className="sub">（{formatJa(person.nextActionDue)}）</span>}
              </div>
            )}
            {person.memo && <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{person.memo}</div>}
            <button className="btn-sm" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>情報を編集</button>
          </div>

          <div className="label">連絡した（+{g.config.rules.contact} XP）</div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {CONTACT_METHODS.map((m) => (
              <button key={m} className={`chip${method === m ? ' on' : ''}`} onClick={() => setMethod(m)}>{m}</button>
            ))}
          </div>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="メモ（任意）：話した内容など" style={{ marginBottom: 8 }} />
          <button
            className="btn"
            onClick={() => {
              const clear = !!person.nextAction && confirm(`次のアクション「${person.nextAction}」は完了しましたか？\n（OKで次のアクションを消します）`)
              logContact(person.id, method, note, clear)
              setNote('')
            }}
          >
            今日 {method} で連絡した
          </button>

          {history.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="label">接触履歴</div>
              {history.map((c) => (
                <div key={c.id} className="act-row">
                  <span className="m" style={{ width: 76 }}>{formatJa(c.date)}</span>
                  <span className="t"><span className="tag" style={{ marginLeft: 0, marginRight: 6 }}>{c.method}</span>{c.note}</span>
                  <button className="del" aria-label="削除" onClick={() => confirm('この履歴を削除しますか？') && deleteContact(c.id)}>
                    <IconClose size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <>
          <div className="field">
            <label>名前</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例：山田さん" autoFocus={isNew} />
          </div>
          <div className="field">
            <label>区分</label>
            <div className="chips">
              {PERSON_CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`chip${form.category === c ? ' on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, category: c, alertDays: isNew ? DEFAULT_ALERT_DAYS[c] : f.alertDays }))}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>会社・役職（任意）</label>
            <input className="input" value={form.org ?? ''} onChange={(e) => set('org', e.target.value)} placeholder="例：〇〇通信 営業部長" />
          </div>
          <div className="field">
            <label>次のアクション（任意）</label>
            <input className="input" value={form.nextAction ?? ''} onChange={(e) => set('nextAction', e.target.value)} placeholder="例：11月の催事枠を相談する" />
            <input className="input" type="date" style={{ marginTop: 6 }} value={form.nextActionDue ?? ''} onChange={(e) => set('nextActionDue', e.target.value)} />
          </div>
          <div className="field">
            <label>何日連絡がなければ警告する？</label>
            <div className="chips">
              {ALERT_CHOICES.map((d) => (
                <button key={d} className={`chip${form.alertDays === d ? ' on' : ''}`} onClick={() => set('alertDays', d)}>{d}日</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>メモ</label>
            <textarea className="input" value={form.memo ?? ''} onChange={(e) => set('memo', e.target.value)} placeholder="家族構成、好きなもの、前回話したこと…" />
          </div>
          <button className="btn" disabled={!form.name.trim()} onClick={save}>{isNew ? '登録する' : '保存する'}</button>
          {person && (
            <>
              <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => { setForm({ ...person }); setEditing(false) }}>キャンセル</button>
              <button
                className="btn danger"
                style={{ marginTop: 8 }}
                onClick={() => {
                  if (confirm(`${person.name} を削除しますか？（接触履歴も消えます）`)) {
                    deletePerson(person.id)
                    onClose()
                  }
                }}
              >
                削除する
              </button>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}

function emptyPerson(): Omit<Person, 'createdAt'> {
  return { name: '', category: '取引先', alertDays: DEFAULT_ALERT_DAYS['取引先'] }
}
