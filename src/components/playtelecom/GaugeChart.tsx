/**
 * GaugeChart - Radial gauge indicator
 *
 * Displays a circular progress gauge with a value/max score in the center.
 * Used for health scores, completion percentages, etc.
 *
 * Used in: tiendas.html mockup (92/100 health score)
 * Design: Matches Avoqado glassmorphism with semantic colors
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface GaugeChartProps {
  value: number // Current value
  max: number // Maximum value
  label: string // Label text (e.g., "Salud General")
  size?: 'sm' | 'md' | 'lg' // Size variant
  className?: string
  colorScheme?: 'green' | 'blue' | 'orange' | 'red' | 'auto' // auto = based on percentage
}

/**
 * GaugeChart Component
 *
 * @example
 * <GaugeChart
 *   value={92}
 *   max={100}
 *   label="Salud General"
 *   colorScheme="auto"
 * />
 */
export function GaugeChart({
  value,
  max,
  label,
  size = 'md',
  className,
  colorScheme = 'auto',
}: GaugeChartProps) {
  // Calculate percentage
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  // Determine color based on percentage if auto
  const getColor = React.useMemo(() => {
    if (colorScheme !== 'auto') return colorScheme

    if (percentage >= 90) return 'green'
    if (percentage >= 70) return 'blue'
    if (percentage >= 50) return 'orange'
    return 'red'
  }, [percentage, colorScheme])

  // Color mappings (Avoqado theme semantic colors)
  const colorClasses = {
    green: {
      stroke: 'stroke-green-500',
      text: 'text-green-600 dark:text-green-400',
      bg: 'from-green-500/20 to-green-500/5',
    },
    blue: {
      stroke: 'stroke-primary',
      text: 'text-primary',
      bg: 'from-blue-500/20 to-blue-500/5',
    },
    orange: {
      stroke: 'stroke-orange-500',
      text: 'text-orange-600 dark:text-orange-400',
      bg: 'from-orange-500/20 to-orange-500/5',
    },
    red: {
      stroke: 'stroke-red-500',
      text: 'text-red-600 dark:text-red-400',
      bg: 'from-red-500/20 to-red-500/5',
    },
  }

  // Size configs
  const sizeConfig = {
    sm: { size: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
    md: { size: 160, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-sm' },
    lg: { size: 200, strokeWidth: 12, fontSize: 'text-4xl', labelSize: 'text-base' },
  }

  const config = sizeConfig[size]
  const radius = (config.size - config.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      {/* SVG Gauge */}
      <div className="relative">
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            className="stroke-muted"
            strokeWidth={config.strokeWidth}
            fill="none"
          />

          {/* Progress circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            className={cn(colorClasses[getColor].stroke, 'transition-all duration-500 ease-out')}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={cn('font-black tracking-tight', config.fontSize, colorClasses[getColor].text)}>
            {Math.round(value)}
          </div>
          <div className="text-muted-foreground text-sm font-medium">
            / {max}
          </div>
        </div>
      </div>

      {/* Label */}
      <div className={cn('mt-3 font-semibold text-center text-muted-foreground uppercase tracking-wide', config.labelSize)}>
        {label}
      </div>

      {/* Percentage badge */}
      <div className={cn(
        'mt-2 px-3 py-1 rounded-full text-xs font-bold',
        'bg-gradient-to-br',
        colorClasses[getColor].bg,
        colorClasses[getColor].text,
      )}>
        {Math.round(percentage)}%
      </div>
    </div>
  )
}
