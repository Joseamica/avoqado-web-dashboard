import { cn } from '@/lib/utils'

interface IccidBadgeProps {
  value: string
  className?: string
}

/**
 * ICCID display matching the existing StockControl.tsx pattern:
 * `<code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">{serialNumber}</code>`
 */
export function IccidBadge({ value, className }: IccidBadgeProps) {
  return <code className={cn('text-xs bg-muted/50 px-2 py-1 rounded font-mono', className)}>{value}</code>
}
