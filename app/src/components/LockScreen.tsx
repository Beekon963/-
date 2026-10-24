import { useEffect, useState } from 'react'
import { setLocalMode, useCloud } from '../store/cloud'
import { useData } from '../store/data'
import type { Game } from '../store/game'
import {
  disableWallpaper, enableWallpaper, fitWallpaperToThisScreen, renewWallpaperKey, syncWallpaper, todayWallpaper,
  useWallpaper, wallpaperUrlBase,
} from '../store/wallpaper'
import { IconCopy } from './Icons'

/** 設定画面：ロック画面の壁紙（プレビュー・保存・自動更新・ショートカットの作り方） */
export function LockScreenSettings({ g }: { g: Game }) {
  const records = useData((s) => s.records)
  const cloud = useCloud()
  const status = useWallpaper()
  const [preview, setPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const cfg = g.config.wallpaper
  const signedIn = cloud.auth === 'signedIn'

  // データが変わったらプレビューを描き直す
  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    const t = setTimeout(() => {
      void todayWallpaper().then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      }).catch(() => {})
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
      if (url) URL.revokeObjectURL(url)
    }
  }, [records])

  const save = async () => {
    try {
      const blob = await todayWallpaper()
      const file = new File([blob], `life-ranked-${g.today}.jpg`, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => {})
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '画像を作れませんでした')
    }
  }

  const base = signedIn && cfg ? wallpaperUrlBase() : null
  const copy = async () => {
    if (!base) return
    try {
      await navigator.clipboard.writeText(base)
      setMsg('URLをコピーしました')
    } catch {
      setMsg('コピーできませんでした。長押しで選んでコピーしてください')
    }
  }

  const statusText = status.busy ? '更新中…'
    : status.error ? status.error
      : status.lastAt ? `更新 ${new Date(status.lastAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
        : '次にデータが変わったら更新'

  return (
    <div className="set-group">
      <h3>LOCK SCREEN ・ ロック画面の壁紙</h3>
      <div className="wp-top">
        {preview ? <img className="wp-thumb" src={preview} alt="今日の壁紙のプレビュー" /> : <div className="wp-thumb" />}
        <div className="wp-side">
          <p className="help">ランク・今日のクエスト・4マスのタスクを、ロック画面の壁紙にします。</p>
          <button className="btn-sm" onClick={() => void save()}>今の画像を保存・共有</button>
        </div>
      </div>

      {!signedIn ? (
        <>
          <p className="help" style={{ padding: '10px 2px 6px' }}>
            自動で更新するには、ログイン（同期）が必要です。ログインすると、アプリで変えた内容が数秒で壁紙の画像に反映され、
            iPhone のショートカットが決まった時刻にその画像を壁紙にします。
          </p>
          <button className="set-row" onClick={() => setLocalMode(false)} style={{ color: 'var(--rank)' }}>
            ログインして同期を始める<span className="v">›</span>
          </button>
        </>
      ) : !cfg ? (
        <>
          <p className="help" style={{ padding: '10px 2px 8px' }}>
            オンにすると、今日・明日・明後日の壁紙を作ってサーバーに置きます。<b>壁紙にする iPhone で</b>オンにしてください（画面の大きさを合わせます）。
          </p>
          <button className="btn" onClick={enableWallpaper}>自動更新をオンにする</button>
        </>
      ) : (
        <>
          <div className="set-row">
            自動更新
            <span className="v" style={status.error ? { color: 'var(--danger)' } : undefined}>
              {cfg.width}×{cfg.height} ・ {statusText}
            </span>
          </div>
          <div className="wp-url">
            <div className="wp-url-h">ショートカットに貼る URL</div>
            <code>{base ?? '（ログイン中のアカウントで作られます）'}<b>{'{日付}'}</b>.jpg</code>
            <button className="btn-sm accent" onClick={() => void copy()} disabled={!base}><IconCopy size={14} /> URLをコピー</button>
          </div>
          <ol className="wp-steps">
            <li>「ショートカット」アプリで「＋」→ 新しいショートカット（名前：LIFE RANKED 壁紙）</li>
            <li>「日付をフォーマット」を追加 → 日付「現在の日付」、日付のフォーマット「カスタム」、書式に <code>yyyy-MM-dd</code></li>
            <li>「テキスト」を追加 → コピーした URL を貼り、続けて変数「フォーマット済みの日付」と <code>.jpg</code> を入れる</li>
            <li>「URLの内容を取得」を追加（URL は上のテキスト）</li>
            <li>「壁紙を設定」を追加 → 画像は「URLの内容」、壁紙は「ロック画面」だけ。詳細で「プレビューを表示」と「被写体を切り抜く」をオフ</li>
            <li>「オートメーション」→「＋」→「時刻」で 5:00・12:00・18:00・21:00 などを作り、「すぐに実行」にしてこのショートカットを選ぶ</li>
          </ol>
          <p className="help" style={{ padding: '4px 2px 10px' }}>
            画像はアプリで変更してから数秒で更新されます。明日・明後日の分も先に作っておくので、アプリを開かない日も壁紙は替わります。
            URL を知っている人は画像を見られるので、人に教えないでください。
          </p>
          <div className="wp-actions">
            <button className="btn-sm" onClick={() => void syncWallpaper(true)} disabled={status.busy}>今すぐ更新</button>
            <button className="btn-sm" onClick={fitWallpaperToThisScreen}>この端末の画面に合わせる</button>
            <button
              className="btn-sm"
              onClick={() => confirm('URLを作り直しますか？ショートカットのURLも貼り直しが必要です') && void renewWallpaperKey()}
            >
              URLを作り直す
            </button>
            <button
              className="btn-sm" style={{ color: 'var(--danger)' }}
              onClick={() => confirm('自動更新をオフにして、サーバーの画像を消しますか？') && void disableWallpaper()}
            >
              オフにする
            </button>
          </div>
        </>
      )}
      {msg && <div className="ok-msg" style={{ padding: '8px 2px' }}>{msg}</div>}
    </div>
  )
}
