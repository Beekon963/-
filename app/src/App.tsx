import { useEffect } from 'react'
import { IconBolt, IconChart, IconFlag, IconHome, IconUsers } from './components/Icons'
import { rankVars } from './lib/color'
import { Challenges } from './screens/Challenges'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { MatchResult, RankChange } from './screens/Overlays'
import { Quests } from './screens/Quests'
import { RankTable } from './screens/RankTable'
import { Settings } from './screens/Settings'
import { Squad } from './screens/Squad'
import { Stats } from './screens/Stats'
import { Vision } from './screens/Vision'
import { useCloud } from './store/cloud'
import { useData } from './store/data'
import { ensureProfile, useGame } from './store/game'
import { goTab, useUI, type Tab } from './store/ui'

export function App() {
  const loaded = useData((s) => s.loaded)
  const { auth, localMode } = useCloud()

  if (!loaded || auth === 'loading') return <div className="boot">LIFE RANKED</div>
  if (auth !== 'signedIn' && !localMode) return <Login />
  return <Game />
}

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'home', label: 'ホーム', Icon: IconHome },
  { id: 'quests', label: 'クエスト', Icon: IconFlag },
  { id: 'challenge', label: '挑戦', Icon: IconBolt },
  { id: 'squad', label: '人脈', Icon: IconUsers },
  { id: 'stats', label: '戦績', Icon: IconChart },
]

function Game() {
  const g = useGame()
  const { tab, page, toasts } = useUI()
  const pulled = useData((s) => s.sync.lastPulledAt !== null)
  const { auth } = useCloud()

  // 初回の取り込みが終わってから開始日を決める（別端末の開始日を上書きしないため）
  useEffect(() => {
    if (auth !== 'signedIn' || pulled) ensureProfile()
  }, [auth, pulled])

  useEffect(() => {
    const vars = rankVars(g.rank.rank.color)
    for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v)
  }, [g.rank.rank.color])

  return (
    <div className="app">
      {page === 'ranks' ? <RankTable /> : page === 'settings' ? <Settings /> : page === 'vision' ? <Vision /> : (
        <>
          {tab === 'home' && <Home />}
          {tab === 'quests' && <Quests />}
          {tab === 'challenge' && <Challenges />}
          {tab === 'squad' && <Squad />}
          {tab === 'stats' && <Stats />}
        </>
      )}

      <nav className="nav">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id && !page ? 'on' : ''} onClick={() => goTab(id)}>
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.amount < 0 ? ' neg' : ''}`}>
            <span className="a">{t.amount >= 0 ? '+' : ''}{t.amount} XP</span>
            <span className="l">{t.label}</span>
          </div>
        ))}
      </div>

      <RankChange />
      <MatchResult />
    </div>
  )
}
