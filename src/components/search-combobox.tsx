import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Command as CommandPrimitive } from 'cmdk'
import { Badge } from '@/components/ui/badge'
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface SearchComboboxItem {
  id: string
  label: string
  description?: string
  /** Shown aligned to the right (e.g. price) */
  endLabel?: string
  disabled?: boolean
  disabledLabel?: string
  /** Inline style applied to the label span — useful when the label needs
   *  per-item typography (e.g. a font picker rendering each option in its
   *  own face). Kept narrow on purpose to discourage drift. */
  labelStyle?: CSSProperties
  /** Fired the first time the cursor enters the row. Used by font picker
   *  to lazy-load the .woff2 so the next render shows it in its real face. */
  onHover?: () => void
}

interface SearchComboboxProps {
  onOpenChange?: (open: boolean) => void
  footer?: ReactNode
  /** Placeholder for the search input */
  placeholder?: string
  /** Items to display in the dropdown (already filtered by the caller) */
  items: SearchComboboxItem[]
  /** Whether items are loading */
  isLoading?: boolean
  /** Called when an item is selected */
  onSelect: (item: SearchComboboxItem) => void
  /** Called when "create new" is clicked — receives the current search term */
  onCreateNew?: (term: string) => void
  /** Label for the create new option. Receives search term. e.g. (term) => `${term} (crear nuevo)` */
  createNewLabel?: (term: string) => string
  /** The current search value (controlled) */
  value: string
  /** Called when search value changes */
  onChange: (value: string) => void
  /** Auto-focus the input on mount */
  autoFocus?: boolean
  /** Additional class for the container */
  className?: string
  /** `id` of the input, so a `<Label htmlFor>` gives it an accessible name */
  inputId?: string
  /** Called when scroll reaches the bottom — for infinite scroll */
  onLoadMore?: () => void
  /** Whether there are more items to load */
  hasMore?: boolean
  /** Whether more items are currently loading */
  isLoadingMore?: boolean
  /**
   * Accessible name of the results list. Defaults to the translated «Sugerencias» (cmdk's own default is the English
   * «Suggestions», which screen readers announced on a Spanish dashboard — E6a-fix2 K5).
   */
  listLabel?: string
}

/**
 * Search combobox built on Radix Popover + cmdk Command.
 *
 * The Popover handles portal/positioning so the dropdown escapes overflow:hidden
 * ancestors. cmdk's `CommandList` is a known-good wheel-scroll target inside a
 * Radix portal. We pass `shouldFilter={false}` to cmdk because the caller is
 * already filtering the `items` prop server-side or with `includesNormalized`.
 */
export function SearchCombobox({
  placeholder,
  onOpenChange,
  footer,
  items,
  isLoading = false,
  onSelect,
  onCreateNew,
  createNewLabel,
  value,
  onChange,
  autoFocus = false,
  className,
  inputId,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  listLabel,
}: SearchComboboxProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const changeOpen = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  // Infinite scroll detection on the cmdk list element.
  useEffect(() => {
    const list = listRef.current
    if (!list || !onLoadMore || !hasMore || isLoadingMore) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = list
      if (scrollHeight - scrollTop - clientHeight < 80) onLoadMore()
    }
    list.addEventListener('scroll', handleScroll)
    return () => list.removeEventListener('scroll', handleScroll)
  }, [onLoadMore, hasMore, isLoadingMore])

  const handleSelect = (item: SearchComboboxItem) => {
    if (item.disabled) return
    onSelect(item)
    changeOpen(false)
  }

  const handleCreateNew = () => {
    if (!onCreateNew) return
    onCreateNew(value.trim())
    changeOpen(false)
  }

  const defaultCreateLabel = (term: string) => `${term} (${t('createNew', 'crear nuevo')})`

  return (
    <Command shouldFilter={false} className="overflow-visible rounded-none border-none bg-transparent">
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverAnchor asChild>
          <div className={cn('relative', className)}>
            <CommandPrimitive.Input
              asChild
              value={value}
              onValueChange={value => {
                onChange(value)
                if (!open) changeOpen(true)
              }}
            >
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                aria-expanded={open}
                aria-labelledby={undefined}
                onFocus={() => changeOpen(true)}
                onClick={() => changeOpen(true)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                autoComplete="one-time-code"
                className={cn(
                  'w-full h-12 px-4 text-base bg-transparent outline-none placeholder:text-muted-foreground rounded-lg border border-input transition-colors',
                  open && 'border-ring ring-1 ring-ring',
                )}
              />
            </CommandPrimitive.Input>
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={4}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          // Keep focus on our own input; don't let Radix steal it.
          onOpenAutoFocus={e => e.preventDefault()}
          // Keep popover open when user clicks back into the input area.
          onInteractOutside={e => {
            if (inputRef.current?.contains(e.target as Node)) e.preventDefault()
          }}
          className="p-0 overflow-hidden rounded-lg border border-input bg-popover shadow-md"
        >
          {onCreateNew && (
            <button
              type="button"
              onClick={handleCreateNew}
              onKeyDown={e => e.stopPropagation()}
              className="flex items-center w-full px-4 py-3 text-sm text-left font-medium bg-muted hover:bg-accent transition-colors"
            >
              {(createNewLabel || defaultCreateLabel)(value.trim())}
            </button>
          )}

          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CommandList
              ref={listRef}
              label={listLabel ?? t('suggestions')}
              // cmdk falls back to focusing its list when asChild preserves an
              // external inputId. Keep that generated-ID fallback on our input,
              // so external labels work and arrows never interrupt typing.
              onFocus={e => {
                if (e.target !== e.currentTarget) return
                const list = e.currentTarget
                queueMicrotask(() => {
                  if (listRef.current === list && document.activeElement === list) inputRef.current?.focus()
                })
              }}
              className="max-h-[360px]"
              // Some ancestor in the dashboard layout intercepts wheel events
              // (same workaround as time-picker.tsx:160). Without this, mouse
              // wheel scroll is blocked even though the scrollbar drag works.
              onWheel={e => e.stopPropagation()}
            >
              {items.length === 0 && value.trim() ? (
                <CommandEmpty>{t('noResults')}</CommandEmpty>
              ) : (
                items.map(item => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    disabled={item.disabled}
                    onSelect={() => handleSelect(item)}
                    onMouseEnter={item.onHover}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-3 text-sm rounded-none',
                      item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="truncate" style={item.labelStyle}>
                        {item.label}
                        {item.description && <span className="text-muted-foreground"> - {item.description}</span>}
                      </span>
                    </div>
                    {item.endLabel && <span className="text-sm font-medium tabular-nums shrink-0">{item.endLabel}</span>}
                    {item.disabled && item.disabledLabel && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-2 shrink-0">
                        {item.disabledLabel}
                      </Badge>
                    )}
                  </CommandItem>
                ))
              )}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </CommandList>
          )}
          {footer && <div onKeyDown={e => e.stopPropagation()}>{footer}</div>}
        </PopoverContent>
      </Popover>
    </Command>
  )
}
