import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { useState, useMemo } from 'react'
import { FilterPopoverHeader, FilterPopoverFooter } from './FilterPill'

interface CheckboxOption {
  value: string
  label: string
}

interface CheckboxFilterContentProps {
  title: string
  options: CheckboxOption[]
  selectedValues: string[]
  onApply: (values: string[]) => void
  onClose?: () => void
  searchable?: boolean
  searchPlaceholder?: string
  applyLabel?: string
  clearLabel?: string
  emptyLabel?: string
}

/**
 * Checkbox list filter content for multi-select filters.
 * Used inside FilterPill popover for Status, Type, etc.
 */
export function CheckboxFilterContent({
  title,
  options,
  selectedValues,
  onApply,
  onClose,
  searchable = false,
  searchPlaceholder = 'Buscar...',
  applyLabel = 'Aplicar',
  clearLabel = 'Limpiar',
  emptyLabel = 'Sin resultados',
}: CheckboxFilterContentProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options
    const lower = searchTerm.toLowerCase()
    return options.filter(opt => opt.label.toLowerCase().includes(lower))
  }, [options, searchTerm])

  const handleToggle = (value: string) => {
    setLocalSelected(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
  }

  const handleApply = () => {
    onApply(localSelected)
    onClose?.()
  }

  const handleClear = () => {
    setLocalSelected([])
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

      <div className="max-h-[240px] overflow-y-auto p-2">
        {filteredOptions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-1">
            {filteredOptions.map(option => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-muted/50',
                  localSelected.includes(option.value) && 'bg-muted/30'
                )}
              >
                <Checkbox
                  checked={localSelected.includes(option.value)}
                  onCheckedChange={() => handleToggle(option.value)}
                  className="h-4 w-4"
                />
                <span className="flex-1">{option.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <FilterPopoverFooter
        onApply={handleApply}
        onClear={handleClear}
        applyLabel={applyLabel}
        clearLabel={clearLabel}
        showClear={localSelected.length > 0}
      />
    </div>
  )
}
