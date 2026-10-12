import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  en: string
  ja?: string
  children: ReactNode
}

export function Sheet({ open, onClose, en, ja, children }: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  // ページのアニメーションが重なり順を作るので、body 直下に描画する
  return createPortal(
    <>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={ja ?? en}>
        <div className="sheet-h">
          <span className="en">{en}</span>
          {ja && <span className="ja">{ja}</span>}
          <button className="icon-btn x" onClick={onClose} aria-label="閉じる"><IconClose /></button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  )
}
