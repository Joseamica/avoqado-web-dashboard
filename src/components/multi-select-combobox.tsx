import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react'

interface Option {
  label: string
  value: string
  disabled?: boolean
}

interface MultiSelectComboboxProps {
  options: Option[]
  selected: Option[]
  onChange: (value: Option[]) => void
  placeholder: string
  emptyText: string
  isLoading?: boolean
  className?: string
}

export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder,
  emptyText,
  isLoading,
  className,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = options.filter(option => option.label.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-12 py-2 px-3 text-left font-normal bg-transparent shadow-xs text-sm overflow-hidden"
          >
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 overflow-hidden">
              {selected.length === 0 && <span className="text-muted-foreground text-sm truncate">{placeholder}</span>}
              {selected.map(item => (
                <div
                  key={item.value}
                  className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={e => {
                    e.stopPropagation()
                    onChange(selected.filter(i => i.value !== item.value))
                  }}
                >
                  {item.label}
                  <X className="h-3 w-3 opacity-60 hover:opacity-100" />
                </div>
              ))}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="!w-[--radix-popover-trigger-width] p-0 bg-card border-input"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <Command shouldFilter={false} className="bg-card">
            <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
            <CommandList>
              {isLoading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" />
                </div>
              )}
              {!isLoading && filtered.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
              <ScrollArea className="max-h-[300px]">
                <CommandGroup>
                  {filtered.map(option => {
                    const isSelected = selected.some(item => item.value === option.value)
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
                          if (isSelected) {
                            onChange(selected.filter(item => item.value !== option.value))
                          } else {
                            onChange([...selected, option])
                          }
                        }}
                        className="flex items-center gap-3 cursor-pointer py-3"
                      >
                        <Check
                          className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                        <span className="truncate text-sm">{option.label}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
