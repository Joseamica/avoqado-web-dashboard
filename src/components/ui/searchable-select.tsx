import * as React from 'react'
import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  /** Custom filter function. If not provided, filters by label. */
  filterFn?: (option: SearchableSelectOption, search: string) => boolean
  /** Minimum number of options to show search input. Default is 5. Set to 0 to always show search. */
  searchThreshold?: number
  /** Size variant. "default" is compact (h-9), "lg" is larger (h-12). Default is "default". */
  size?: 'default' | 'lg'
  /** Optional footer content rendered below the options list (e.g., a "Create new" button). */
  footer?: React.ReactNode
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  className,
  disabled = false,
  filterFn,
  searchThreshold = 5,
  size = 'default',
  footer,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedOption = options.find(opt => opt.value === value)

  // Show search input only when there are more options than the threshold
  const showSearch = options.length >= searchThreshold

  const filteredOptions = useMemo(() => {
    if (!search || !showSearch) return options
    const searchLower = search.toLowerCase()

    if (filterFn) {
      return options.filter(opt => filterFn(opt, searchLower))
    }

    return options.filter(opt => opt.label.toLowerCase().includes(searchLower))
  }, [options, search, filterFn, showSearch])

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal bg-transparent shadow-xs text-sm',
            size === 'lg' ? 'h-12' : 'h-9',
            className
          )}
        >
          {selectedOption ? (
            <span className="flex items-center gap-2 truncate">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate">{selectedOption.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="!w-[--radix-popover-trigger-width] p-0 bg-card border-input"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command shouldFilter={false} className="bg-card">
          {showSearch && (
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
            />
          )}
          <CommandList>
            {showSearch && <CommandEmpty>{emptyMessage}</CommandEmpty>}
            <ScrollArea className={showSearch ? 'h-[300px]' : 'max-h-[300px]'}>
              <CommandGroup>
                {filteredOptions.map(option => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onValueChange(option.value)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={cn(
                      'flex items-center gap-3 cursor-pointer',
                      size === 'lg' ? 'py-3' : 'py-2'
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.icon && <span className="shrink-0 text-base">{option.icon}</span>}
                    <span className="truncate text-sm">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
          {footer && (
            <div className="border-t border-border p-1">
              {footer}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
