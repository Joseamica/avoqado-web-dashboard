import { Input } from '@/components/ui/input'
import { cn, includesNormalized } from '@/lib/utils'
import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FilterPopoverHeader } from './FilterPill'

interface SingleSelectOption {
  value: string
  label: string
}

interface SingleSelectFilterContentProps {
  title: string
  options: SingleSelectOption[]
  selectedValue: string | null
  onSelect: (value: string) => void
  onClose?: () => void
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
}

/**
 * Single-select list filter content for FilterPill popovers.
 *
 * The single-select sibling of {@link CheckboxFilterContent}: clicking an
 * option applies it and closes the popover immediately (no Apply step). Use it
 * where the backend filters by exactly one value — e.g. the "Promotor" filter
 * maps to the server-side `staffId` param, which narrows results across ALL
 * pages. Clearing is handled by the FilterPill's own "X" (call setState(null)
 * in its onClear).
 */
export function SingleSelectFilterContent({
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  searchable = false,
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'Sin resultados',
}: SingleSelectFilterContentProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options
    return options.filter(opt => includesNormalized(opt.label, searchTerm))
  }, [options, searchTerm])

  const handleSelect = (value: string) => {
    onSelect(value)
    onClose?.()
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />

      {searchable && (
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
      )}

      <div className="max-h-[280px] overflow-y-auto p-2">
        {filteredOptions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-1">
            {filteredOptions.map(option => {
              const isSelected = option.value === selectedValue
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    'hover:bg-muted/50',
                    isSelected && 'bg-muted/30 font-medium',
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{option.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
