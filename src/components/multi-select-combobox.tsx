import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 py-2 px-3 text-left font-normal"
          >
            <div className="flex flex-wrap gap-1">
              {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
              {selected.map(item => (
                <div
                  key={item.value}
                  className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md text-xs border border-secondary-foreground/20 cursor-pointer hover:bg-secondary/80"
                  onClick={e => {
                    e.stopPropagation()
                    onChange(selected.filter(i => i.value !== item.value))
                  }}
                >
                  {item.label}
                  <div className="hover:bg-secondary-foreground/20 rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </div>
                </div>
              ))}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
            <CommandList>
              {isLoading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" />
                  Loading...
                </div>
              )}
              {!isLoading && options.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
              <CommandGroup>
                {options
                  .filter(option => option.label.toLowerCase().includes(search.toLowerCase()))
                  .map(option => {
                    const isSelected = selected.some(item => item.value === option.value)
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => {
                          if (isSelected) {
                            onChange(selected.filter(item => item.value !== option.value))
                          } else {
                            onChange([...selected, option])
                          }
                        }}
                      >
                        <div
                          className={cn(
                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible',
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                        <span>{option.label}</span>
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
