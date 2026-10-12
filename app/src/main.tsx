import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/bebas-neue/latin-400.css'
import '@fontsource/rajdhani/latin-500.css'
import '@fontsource/rajdhani/latin-600.css'
import '@fontsource/rajdhani/latin-700.css'
import './styles.css'
import { App } from './App'
import { initCloud } from './store/cloud'
import { hydrate } from './store/data'

registerSW({ immediate: true })

if (import.meta.env.DEV) {
  // 開発時の動作確認用
  void import('./store/data').then((m) => Object.assign(window, { __lr: m }))
}

void hydrate().then(() => initCloud())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
