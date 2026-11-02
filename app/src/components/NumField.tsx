import { useEffect, useState } from 'react'

interface Props {
  value: number | null | undefined
  onChange: (v: number | null) => void
  /** 小数を入力できる（重量） */
  decimal?: boolean
  placeholder?: string
  label: string
}

/** ジム向けの大きな数字入力。入力のたびに保存し、「22.」のような途中の入力も消さない */
export function NumField({ value, onChange, decimal, placeholder, label }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const [focused, setFocused] = useState(false)

  // 前回の重量のコピーなど、外から値が変わったときは入力中でなければ表示を合わせる
  useEffect(() => {
    if (!focused) setText(value == null ? '' : String(value))
  }, [value, focused])

  return (
    <input
      className="num-in"
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="next"
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        let t = e.target.value.replace(/[，,．。]/g, '.').replace(/[^0-9.]/g, '')
        if (!decimal) t = t.replace(/\./g, '')
        setText(t)
        if (t === '') onChange(null)
        else {
          const n = Number(t)
          if (Number.isFinite(n)) onChange(n)
        }
      }}
    />
  )
}
