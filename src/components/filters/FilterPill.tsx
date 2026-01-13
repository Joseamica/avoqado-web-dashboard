import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'

interface FilterPillProps {
  label: string
  activeValue?: string | null
  isActive?: boolean
  children: React.ReactNode
  onClear?: () => void
  align?: 'start' | 'center' | 'end'
  className?: string
}

/**
 * Stripe-style filter pill with popover.
 *
 * When inactive: Shows "+ Label"
 * When active: Shows "Label: Value" with X to clear
 *
 * Note: Uses flex-shrink-0 by default to prevent shrinking in scrollable filter bars.
 */
export function FilterPill({ label, activeValue, isActive, children, onClear, align = 'start', className }: FilterPillProps) {
  const [open, setOpen] = useState(false)

  const hasValue = isActive || !!activeValue

  return (
    <div className={cn('flex-shrink-0', className)}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 rounded-full border-dashed font-normal transition-all',
            hasValue && 'border-solid border-primary/50 bg-primary/5 pr-1.5'
          )}
        >
          {!hasValue && <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className={cn(hasValue && 'text-foreground')}>{label}</span>
          {hasValue && activeValue && (
            <>
              <span className="text-muted-foreground">:</span>
              <span className="max-w-[150px] truncate font-medium text-primary">{activeValue}</span>
            </>
          )}
          {hasValue && onClear && (
            <button
              onClick={e => {
                e.stopPropagation()
                onClear()
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[280px] p-0" sideOffset={8}>
        {children}
      </PopoverContent>
    </Popover>
    </div>
  )
}

interface FilterPopoverHeaderProps {
  title: string
}

export function FilterPopoverHeader({ title }: FilterPopoverHeaderProps) {
  return (
    <div className="border-b px-3 py-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
    </div>
  )
}

interface FilterPopoverFooterProps {
  onApply: () => void
  onClear?: () => void
  applyLabel?: string
  clearLabel?: string
  showClear?: boolean
}

export function FilterPopoverFooter({
  onApply,
  onClear,
  applyLabel = 'Aplicar',
  clearLabel = 'Limpiar',
  showClear = true,
}: FilterPopoverFooterProps) {
  return (
    <div className="flex items-center gap-2 border-t p-3">
      {showClear && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="flex-1">
          {clearLabel}
        </Button>
      )}
      <Button size="sm" onClick={onApply} className="flex-1">
        {applyLabel}
      </Button>
    </div>
  )
}
