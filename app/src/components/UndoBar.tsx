import { useUI } from '../store/ui'

/** 削除などの直後に出る「元に戻す」 */
export function UndoBar() {
  const undo = useUI((s) => s.undo)
  if (!undo) return null
  return (
    <div className="undo-bar" role="status">
      <span>{undo.text}</span>
      <button
        onClick={() => {
          undo.run()
          useUI.setState({ undo: null })
        }}
      >
        元に戻す
      </button>
    </div>
  )
}
