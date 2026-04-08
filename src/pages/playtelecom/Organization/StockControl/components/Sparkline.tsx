import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

/**
 * Inline SVG sparkline. Uses currentColor for the stroke so it inherits text color from the parent.
 */
export function Sparkline({ data, width = 80, height = 20, className }: SparklineProps) {
  const path = useMemo(() => {
    if (data.length === 0) return `M0 ${height / 2} L${width} ${height / 2}`
    if (data.length === 1) return `M0 ${height / 2} L${width} ${height / 2}`

    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const step = width / (data.length - 1)
    const padding = 2

    const points = data.map((v, i) => {
      const x = i * step
      const y = height - padding - ((v - min) / range) * (height - 2 * padding)
      return `${x},${y}`
    })

    return `M${points.join(' L')}`
  }, [data, width, height])

  return (
    <svg className={cn('inline-block', className)} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
