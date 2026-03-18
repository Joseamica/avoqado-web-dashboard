import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface SummaryCardItem {
  label: string
  value: string | number
  format?: 'currency' | 'number' | 'percent'
}

interface SummaryCardsProps {
  cards: SummaryCardItem[]
  isLoading?: boolean
  className?: string
}

function formatValue(value: string | number, format?: SummaryCardItem['format']): string {
  if (typeof value === 'string') return value
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'number':
    default:
      return new Intl.NumberFormat('es-MX').format(value)
  }
}

export function SummaryCards({ cards, isLoading, className }: SummaryCardsProps) {
  return (
    <div className={cn('grid gap-3', className)} style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-input bg-card p-4"
        >
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-20 mb-1" />
              <Skeleton className="h-4 w-16" />
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {formatValue(card.value, card.format)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
