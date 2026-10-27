import { useState } from 'react'
import { getServerConfig, resetServerConfig, saveServerConfig, setLocalMode, signIn, signUp } from '../store/cloud'
import { useData } from '../store/data'

export function Login() {
  const [server, setServer] = useState(getServerConfig())
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const hasLocal = useData((s) => Object.keys(s.records).length > 0)

  const submit = async () => {
    setErr('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'in') await signIn(email, password)
      else {
        const ok = await signUp(email, password)
        if (!ok) setInfo('確認メールを送りました。メール内のリンクを開いてから、ここでログインしてください。')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login fade-in">
      <div className="logo">LIFE <b>RANKED</b></div>
      <div className="tagline">人生をランクマッチにする</div>

      {!server ? (
        <>
          <div className="label" style={{ marginBottom: 10 }}>サーバー設定（初回のみ）</div>
          <div className="field">
            <label>Supabase Project URL</label>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoCapitalize="off" autoCorrect="off" />
          </div>
          <div className="field">
            <label>anon / publishable key</label>
            <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ... または sb_publishable_..." autoCapitalize="off" autoCorrect="off" />
          </div>
          <button
            className="btn"
            disabled={!url.trim() || key.trim().length < 20}
            onClick={() => {
              saveServerConfig(url, key)
              // クライアントを作り直すため再読み込み
              location.reload()
              setServer(getServerConfig())
            }}
          >
            保存して次へ
          </button>
          <p className="help">
            Supabase のプロジェクトの上にある「Connect」に書いてある値です（URL は Project Settings → Data API にもあります）。
            URL は https://xxxx.supabase.co の部分だけで大丈夫です。
          </p>
        </>
      ) : (
        <>
          <div className="chips" style={{ marginBottom: 16 }}>
            <button className={`chip${mode === 'in' ? ' on' : ''}`} onClick={() => setMode('in')}>ログイン</button>
            <button className={`chip${mode === 'up' ? ' on' : ''}`} onClick={() => setMode('up')}>アカウント作成</button>
          </div>
          <div className="field">
            <label>メールアドレス</label>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>パスワード</label>
            <input
              className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          {err && <div className="err">{err}</div>}
          {info && <div className="ok-msg">{info}</div>}
          <button className="btn" disabled={busy || !email || password.length < 6} onClick={() => void submit()}>
            {busy ? '接続中…' : mode === 'in' ? 'ログイン' : 'アカウントを作成'}
          </button>
          {hasLocal && <p className="help">この端末に保存済みのデータは、ログイン後にアカウントへ引き継がれます。</p>}
          {!server.fromEnv && (
            <p className="help">
              接続先：{server.url}
              <button
                className="toggle-link" style={{ marginLeft: 8 }}
                onClick={() => confirm('サーバーの URL とキーを入れ直しますか？') && resetServerConfig()}
              >
                URL・キーを入れ直す
              </button>
            </p>
          )}
        </>
      )}

      <div className="divider-text">または</div>
      <button className="btn ghost" onClick={() => setLocalMode(true)}>ログインせずに使う（この端末だけ）</button>
      <p className="help" style={{ textAlign: 'center' }}>あとから設定画面でログインして同期できます。</p>
    </div>
  )
}
