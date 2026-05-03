import { useEffect, useRef } from 'react'

type Props = {
  value: number
  className?: string
}

export function BumpingCount({ value, className = '' }: Props) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)

  useEffect(() => {
    if (value > prev.current) {
      const el = spanRef.current
      if (el) {
        el.classList.remove('animate-cheer-count-bump')
        void el.offsetWidth
        el.classList.add('animate-cheer-count-bump')
      }
    }
    prev.current = value
  }, [value])

  return (
    <span
      ref={spanRef}
      className={`inline-block origin-center tabular-nums ${className}`}
    >
      {value}
    </span>
  )
}
