// 開発用：?emblems で全ランクのエンブレムを並べて確認する（本番ビルドには入らない）
import { Emblem } from '../components/Emblem'
import { DEFAULT_RANKS } from '../lib/defaults'

export function EmblemGallery() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: 16, background: '#07090d' }}>
      {DEFAULT_RANKS.map((r, i) => (
        <div key={r.id} style={{ textAlign: 'center', color: r.color, fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 22 }}>
          <Emblem color={r.color} index={i} total={DEFAULT_RANKS.length} division={1} divisions={r.divisions} size={150} animated />
          <div>{r.name}</div>
        </div>
      ))}
    </div>
  )
}
