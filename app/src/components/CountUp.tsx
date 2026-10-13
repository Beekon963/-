import { useEffect, useRef, useState } from 'react'

function reduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 値が変わったら前の値から数え上げる。from を渡すと最初から数え上げる */
export function useCountUp(target: number, opts: { from?: number; delay?: number; duration?: number } = {}) {
  const { from, delay = 0, duration = 700 } = opts
  const [value, setValue] = useState(from ?? target)
  const current = useRef(from ?? target)

  useEffect(() => {
    const start = current.current
    if (start === target) return
    if (reduced()) {
      current.current = target
      setValue(target)
      return
    }
    let raf = 0
    const timer = setTimeout(() => {
      const t0 = performance.now()
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / duration)
        const eased = 1 - Math.pow(1 - k, 3)
        const v = Math.round(start + (target - start) * eased)
        current.current = v
        setValue(v)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [target, delay, duration])

  return value
}

export function CountUp({ value, from, delay, duration, signed }: { value: number; from?: number; delay?: number; duration?: number; signed?: boolean }) {
  const v = useCountUp(value, { from, delay, duration })
  return <>{signed && v >= 0 ? '+' : ''}{v.toLocaleString()}</>
}
