import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCategoryBadgeClass } from '../lib/categoryConfig'

interface CategoryChipProps {
  name: string
  className?: string
}

/**
 * Category badge matching the existing pattern from StockControl.tsx:
 * `<Badge variant="outline" className={`text-xs ${typeConfig.className}`}>`
 */
export function CategoryChip({ name, className }: CategoryChipProps) {
  return (
    <Badge variant="outline" className={cn('text-xs', getCategoryBadgeClass(name), className)}>
      {name}
    </Badge>
  )
}
