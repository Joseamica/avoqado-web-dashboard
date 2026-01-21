/**
 * InsightCard - Operational insight display card
 *
 * Displays key operational insights with icon, title, subtitle, and value.
 * Used for highlighting top/worst performers, trends, etc.
 *
 * Used in: index.html mockup (insights operativos section)
 * Design: Matches Avoqado glassmorphism with semantic colors
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export type InsightType = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

export interface InsightCardProps {
  icon: LucideIcon
  title: string // e.g., "Tienda Líder (Ventas)"
  subtitle: string // e.g., "Tienda Centro Histórico"
  value: string // e.g., "$52,400" or "45 SIMs activadas"
  type?: InsightType
  onClick?: () => void
  className?: string
}

/**
 * InsightCard Component
 *
 * @example
 * <InsightCard
 *   icon={TrendingUp}
 *   title="Tienda Líder (Ventas)"
 *   subtitle="Tienda Centro Histórico"
 *   value="$52,400"
 *   type="success"
 *   onClick={() => navigate('/stores/centro')}
 * />
 */
export function InsightCard({
  icon: Icon,
  title,
  subtitle,
  value,
  type = 'neutral',
  onClick,
  className,
}: InsightCardProps) {
  // Color scheme mapping
  const colorSchemes: Record<
    InsightType,
    {
      iconBg: string
      iconText: string
      borderHover: string
      valueText: string
    }
  > = {
    success: {
      iconBg: 'bg-green-100',
      iconText: 'text-green-600',
      borderHover: 'hover:border-green-300',
      valueText: 'text-green-600',
    },
    danger: {
      iconBg: 'bg-red-100',
      iconText: 'text-red-600',
      borderHover: 'hover:border-red-300',
      valueText: 'text-red-600',
    },
    warning: {
      iconBg: 'bg-orange-100',
      iconText: 'text-orange-600',
      borderHover: 'hover:border-orange-300',
      valueText: 'text-orange-600',
    },
    info: {
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
      borderHover: 'hover:border-blue-300',
      valueText: 'text-blue-600',
    },
    neutral: {
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600',
      borderHover: 'hover:border-purple-300',
      valueText: 'text-purple-600',
    },
  }

  const scheme = colorSchemes[type]

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card p-4 rounded-xl border border-border shadow-sm',
        'flex items-center gap-4 transition-all group',
        scheme.borderHover,
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'size-12 rounded-full flex items-center justify-center',
          'font-bold text-lg transition-transform',
          'group-hover:scale-110',
          scheme.iconBg,
          scheme.iconText
        )}
      >
        <Icon className="w-6 h-6" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <p className="text-sm font-black text-foreground truncate mt-0.5">
          {subtitle}
        </p>
        <p className={cn('text-xs font-bold flex items-center gap-1 mt-1', scheme.valueText)}>
          {value}
        </p>
      </div>
    </div>
  )
}
