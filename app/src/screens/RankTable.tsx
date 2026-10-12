import { useState } from 'react'
import { Emblem } from '../components/Emblem'
import { Check, IconBack, IconClose, IconPlus } from '../components/Icons'
import { DEFAULT_RANKS } from '../lib/defaults'
import { sortRanks, tierName } from '../lib/game'
import type { RankDef } from '../lib/types'
import { newId } from '../store/data'
import { setConditionCleared, updateConfig, useGame } from '../store/game'
import { openPage, useUI } from '../store/ui'

export function RankTable() {
  const g = useGame()
  const edit = useUI((s) => s.rankEdit)
  const ranks = sortRanks(g.config.ranks)
  const close = () => useUI.setState({ page: null, rankEdit: false })

  return (
    <div className="fade-in">
      <div className="page-title">
        <button className="back" onClick={close} aria-label="戻る"><IconBack /></button>
        <div>
          <h1>RANKS</h1>
          <div className="ja">ランク表 ・ 昇格条件は自分で決めて、自分でチェックする</div>
        </div>
        {!edit && <button className="btn-sm right" onClick={() => openPage('ranks', { rankEdit: true })}>編集</button>}
      </div>

      {edit ? (
        <RankEditor initial={ranks} onDone={() => useUI.setState({ rankEdit: false })} />
      ) : (
        <div className="sec">
          {[...ranks].reverse().map((r) => {
            const i = ranks.indexOf(r)
            const cur = i === g.rank.index
            const locked = i > g.rank.index
            const next = ranks[i + 1]
            const top = r.divisions > 1 ? `${tierName(r, 0)} 〜 ${tierName(r, r.divisions - 1)}` : r.name
            return (
              <div key={r.id}>
                <div className={`rank-row${cur ? ' cur' : ''}${locked ? ' locked' : ''}`} style={cur ? undefined : { ['--rank' as string]: r.color }}>
                  {cur && <span className="you">YOU · {g.rank.fullName}</span>}
                  <Emblem color={r.color} index={i} total={ranks.length} division={r.divisions - 1} divisions={r.divisions} size={50} />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm" style={{ color: r.color }}>{r.name}</div>
                    <div className="req">{r.minXp.toLocaleString()} XP〜{next ? ` ・ ${top}` : ''}</div>
                  </div>
                </div>
                {r.conditions.length > 0 && (
                  <div className="rank-conds">
                    <div className="label" style={{ marginBottom: 0, marginTop: 6 }}>昇格条件</div>
                    {r.conditions.map((c) => (
                      <button
                        key={c.id}
                        className={`cond${c.cleared ? ' done' : ''}`}
                        onClick={() => {
                          if (c.cleared) {
                            if (confirm('クリアを取り消しますか？')) setConditionCleared(r.id, c.id, false)
                          } else if (confirm(`「${c.text}」\n本当にクリアした？`)) {
                            setConditionCleared(r.id, c.id, true)
                          }
                        }}
                      >
                        <Check on={c.cleared} />
                        <span>{c.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <p className="help" style={{ marginTop: 10 }}>
            XPが次のランクに届いても、昇格条件が残っていれば「昇格戦」になり、条件をクリアするまで上がれません。
            XPが減ればランクも下がります（クリア済みの条件は残ります）。
          </p>
        </div>
      )}
    </div>
  )
}

function RankEditor({ initial, onDone }: { initial: RankDef[]; onDone: () => void }) {
  const [draft, setDraft] = useState<RankDef[]>(() => initial.map((r) => ({ ...r, conditions: r.conditions.map((c) => ({ ...c })) })))
  const [error, setError] = useState('')

  const update = (id: string, patch: Partial<RankDef>) => setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const save = () => {
    const cleaned = draft.map((r) => ({
      ...r,
      name: r.name.trim().toUpperCase(),
      minXp: Math.max(0, Math.round(Number(r.minXp) || 0)),
      conditions: r.conditions.filter((c) => c.text.trim()).map((c) => ({ ...c, text: c.text.trim() })),
    }))
    if (cleaned.length === 0) return setError('ランクを1つ以上にしてください')
    if (cleaned.some((r) => !r.name)) return setError('ランク名が空のものがあります')
    const sorted = sortRanks(cleaned)
    sorted[0] = { ...sorted[0], minXp: 0 }
    const xs = sorted.map((r) => r.minXp)
    if (new Set(xs).size !== xs.length) return setError('必要XPが同じランクがあります')
    updateConfig((c) => ({ ...c, ranks: sorted }))
    onDone()
  }

  return (
    <div className="sec">
      {draft.map((r, idx) => (
        <div key={r.id} className="rank-edit">
          <div className="row">
            <input className="color-in" type="color" value={r.color} onChange={(e) => update(r.id, { color: e.target.value })} aria-label="色" />
            <input className="input" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="ランク名" />
            <button className="del" aria-label="削除" onClick={() => confirm(`${r.name} を削除しますか？`) && setDraft((d) => d.filter((x) => x.id !== r.id))}>
              <IconClose size={16} />
            </button>
          </div>
          <div className="row">
            <div>
              <div className="label">必要XP（累計）</div>
              <input
                className="input" type="number" inputMode="numeric" value={idx === 0 ? 0 : r.minXp} disabled={idx === 0}
                onChange={(e) => update(r.id, { minXp: Number(e.target.value) })}
              />
            </div>
            <div>
              <div className="label">段階（III→I）</div>
              <select className="input" value={r.divisions} onChange={(e) => update(r.id, { divisions: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}段階</option>)}
              </select>
            </div>
          </div>
          {idx > 0 && (
            <>
              <div className="label">昇格条件（クリアしないと昇格できない）</div>
              {r.conditions.map((c) => (
                <div key={c.id} className="row" style={{ marginBottom: 6 }}>
                  <input
                    className="input" value={c.text} placeholder="例：月商1,000万円を達成する"
                    onChange={(e) => update(r.id, { conditions: r.conditions.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })}
                  />
                  <button className="del" style={{ flex: '0 0 30px' }} aria-label="条件を削除" onClick={() => update(r.id, { conditions: r.conditions.filter((x) => x.id !== c.id) })}>
                    <IconClose size={14} />
                  </button>
                </div>
              ))}
              <button
                className="toggle-link"
                onClick={() => update(r.id, { conditions: [...r.conditions, { id: newId(), text: '', cleared: false }] })}
              >
                <IconPlus size={13} /> 条件を追加
              </button>
            </>
          )}
        </div>
      ))}
      <button
        className="btn ghost"
        onClick={() => {
          const top = sortRanks(draft).at(-1)
          setDraft((d) => [...d, { id: newId(), name: 'NEW RANK', color: '#ffffff', minXp: (top?.minXp ?? 0) + 10000, divisions: 3, conditions: [] }])
        }}
      >
        <IconPlus size={14} /> ランクを追加
      </button>
      {error && <div className="err">{error}</div>}
      <button className="btn" style={{ marginTop: 12 }} onClick={save}>保存する</button>
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={onDone}>キャンセル</button>
      <button
        className="btn danger"
        style={{ marginTop: 8 }}
        onClick={() => confirm('ランク表を初期状態に戻しますか？（昇格条件のクリア状況も戻ります）') && setDraft(DEFAULT_RANKS.map((r) => ({ ...r })))}
      >
        初期のランク表に戻す
      </button>
    </div>
  )
}
