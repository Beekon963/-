import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import './styles.css'
import { App } from './App'
import { initCloud } from './store/cloud'
import { startWallpaperSync } from './store/wallpaper'
import { hydrate } from './store/data'

registerSW({ immediate: true })

if (import.meta.env.DEV) {
  // 開発時の動作確認用
  void import('./store/data').then((m) => Object.assign(window, { __lr: m }))
}

void hydrate().then(() => {
  void initCloud()
  startWallpaperSync()
})

const root = createRoot(document.getElementById('root')!)
if (import.meta.env.DEV && location.search.includes('emblems')) {
  void import('./dev/EmblemGallery').then(({ EmblemGallery }) => root.render(<EmblemGallery />))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
