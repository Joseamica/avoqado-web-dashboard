import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SearchComboboxItem {
  id: string
  label: string
  description?: string
  /** Shown aligned to the right (e.g. price) */
  endLabel?: string
  disabled?: boolean
  disabledLabel?: string
}

interface SearchComboboxProps {
  /** Placeholder for the search input */
  placeholder?: string
  /** Items to display in the dropdown */
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
}

export function SearchCombobox({
  placeholder,
  items,
  isLoading = false,
  onSelect,
  onCreateNew,
  createNewLabel,
  value,
  onChange,
  autoFocus = false,
  className,
}: SearchComboboxProps) {
  const { t } = useTranslation('common')
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const showDropdown = isFocused

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    if (isFocused) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFocused])

  const handleSelect = useCallback(
    (item: SearchComboboxItem) => {
      if (item.disabled) return
      onSelect(item)
      setIsFocused(false)
    },
    [onSelect],
  )

  const handleCreateNew = useCallback(() => {
    if (!value.trim() || !onCreateNew) return
    onCreateNew(value.trim())
    setIsFocused(false)
  }, [value, onCreateNew])

  const defaultCreateLabel = (term: string) => `${term} (${t('createNew', 'crear nuevo')})`

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={cn(
          'w-full h-12 px-4 text-base bg-transparent outline-none placeholder:text-muted-foreground rounded-lg border border-input transition-colors',
          isFocused && 'border-ring ring-1 ring-ring',
        )}
      />

      {/* Dropdown — absolute, floats over content */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-input bg-popover shadow-md overflow-hidden">
          {/* Create new option — always on top when there's a search term */}
          {value.trim() && onCreateNew && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center w-full px-4 py-3 text-sm text-left bg-muted hover:bg-accent transition-colors"
            >
              {(createNewLabel || defaultCreateLabel)(value.trim())}
            </button>
          )}

          {/* Loading */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length > 0 ? (
            <div className="max-h-[360px] overflow-y-auto">
              {items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors',
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-accent cursor-pointer',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="truncate">
                      {item.label}
                      {item.description && (
                        <span className="text-muted-foreground"> - {item.description}</span>
                      )}
                    </span>
                  </div>
                  {item.endLabel && (
                    <span className="text-sm font-medium tabular-nums shrink-0">{item.endLabel}</span>
                  )}
                  {item.disabled && item.disabledLabel && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-2 shrink-0">
                      {item.disabledLabel}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          ) : !value.trim() ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {placeholder}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
