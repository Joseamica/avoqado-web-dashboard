import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ChevronDown, CirclePlus, CircleX } from 'lucide-react'
import { cloneElement, isValidElement, useState } from 'react'

interface FilterPillProps {
  label: string
  activeValue?: string | null
  activeLabel?: string | null // Alias for activeValue
  /** Count of selected values — pill is treated as active when > 0. Useful for multi-select filters where the count is meaningful. */
  activeCount?: number
  isActive?: boolean
  children: React.ReactNode
  onClear?: () => void
  align?: 'start' | 'center' | 'end'
  className?: string
  contentClassName?: string // Custom width/styling for PopoverContent
  /** Controlled open state — used by <FilterPillBar> to programmatically open a pill from the "Más filtros" overflow popover. */
  open?: boolean
  /** Controlled open-change callback — pair with `open`. */
  onOpenChange?: (open: boolean) => void
  /** Uncontrolled initial open state — only read on mount. Used by <FilterPillBar> to open a pill the moment it gets promoted from "Más filtros". */
  defaultOpen?: boolean
}

/**
 * Stripe-style filter pill with popover.
 *
 * Inactive: dashed-border pill, "+ Label" in muted text.
 * Active: solid border pill with "[X] Label | Value ▾" — X clears, value is in primary color.
 *
 * Width-aware overflow is handled by the parent <FilterPillBar>.
 */
export function FilterPill({
  label,
  activeValue,
  activeLabel,
  activeCount,
  isActive,
  children,
  onClear,
  align = 'start',
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen,
}: FilterPillProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false)
  const open = controlledOpen ?? internalOpen
  const handleOpenChange = (next: boolean) => {
    if (controlledOnOpenChange) controlledOnOpenChange(next)
    else setInternalOpen(next)
  }

  const displayValue = activeLabel || activeValue || (activeCount && activeCount > 0 ? String(activeCount) : null)
  const hasValue = isActive || !!displayValue || (typeof activeCount === 'number' && activeCount > 0)

  // Clone children and inject onClose handler
  const childrenWithClose = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        onClose: () => handleOpenChange(false),
      })
    : children

  return (
    <div className={cn('flex-shrink-0', className)} data-filter-pill data-filter-pill-active={hasValue ? 'true' : 'false'}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 gap-1.5 rounded-full font-normal text-xs transition-all',
              !hasValue && 'border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/40 px-2.5',
              // Active: inverted surface (black on light theme, white on dark). bg-foreground/text-background
              // auto-flip via the semantic tokens. No visible border needed because the strong fill carries weight.
              hasValue && 'border-solid border-transparent bg-foreground text-background hover:bg-foreground/90 pl-1.5 pr-2',
            )}
          >
            {hasValue ? (
              <>
                {onClear && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => {
                      e.stopPropagation()
                      e.preventDefault()
                      onClear()
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        e.preventDefault()
                        onClear()
                      }
                    }}
                    className="-ml-0.5 flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full text-background/70 hover:text-background"
                    aria-label={`Clear ${label} filter`}
                  >
                    <CircleX className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="text-background/70">{label}</span>
                <span className="text-background/30">|</span>
                <span className="max-w-[140px] truncate font-medium text-background">{displayValue}</span>
                <ChevronDown className="h-3 w-3 text-background/60" />
              </>
            ) : (
              <>
                <CirclePlus className="h-3 w-3 text-muted-foreground/70" />
                <span>{label}</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-[280px] p-0" sideOffset={8}>
          {childrenWithClose}
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
