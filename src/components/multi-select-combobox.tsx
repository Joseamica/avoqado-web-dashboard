import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, includesNormalized } from '@/lib/utils'
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react'

interface Option {
  label: string
  value: string
  /** No se puede elegir ni quitar: en la lista no responde y, si ya está elegida, su chip sale sin la X (p. ej. una variante). */
  disabled?: boolean
  /** Línea secundaria en la lista (no en el chip), p. ej. «3 categorías del menú». */
  description?: string
}

interface MultiSelectComboboxProps {
  options: Option[]
  selected: Option[]
  onChange: (value: Option[]) => void
  placeholder: string
  emptyText: string
  isLoading?: boolean
  className?: string
  /** No abre ni deja quitar chips (p. ej. mientras se guarda la elección). */
  disabled?: boolean
}

export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder,
  emptyText,
  isLoading,
  className,
  disabled,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = options.filter(option => includesNormalized(option.label, search))

  return (
    <div className={cn('space-y-2', className)}>
      {/* Deshabilitado no abre; si ya estaba abierto, sus opciones quedan inertes (abajo) y se puede cerrar. */}
      <Popover open={open} onOpenChange={next => (!next || !disabled) && setOpen(next)} modal={true}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-auto min-h-12 py-2 px-3 text-left font-normal bg-transparent shadow-xs text-sm overflow-hidden"
          >
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 overflow-hidden">
              {selected.length === 0 && <span className="text-muted-foreground text-sm truncate">{placeholder}</span>}
              {selected.map(item => (
                <div
                  key={item.value}
                  className={cn(
                    'flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    !item.disabled && !disabled && 'cursor-pointer hover:bg-primary/20',
                  )}
                  onClick={e => {
                    e.stopPropagation()
                    if (item.disabled || disabled) return
                    onChange(selected.filter(i => i.value !== item.value))
                  }}
                >
                  {item.label}
                  {!item.disabled && !disabled && <X className="h-3 w-3 opacity-60 hover:opacity-100" />}
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
                        disabled={option.disabled || disabled}
                        onSelect={() => {
                          if (isSelected) {
                            onChange(selected.filter(item => item.value !== option.value))
                          } else {
                            onChange([...selected, option])
                          }
                        }}
                        className={cn(
                          'flex items-center gap-3 py-3',
                          option.disabled || disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer',
                        )}
                      >
                        <Check
                          className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">{option.label}</span>
                          {option.description && <span className="truncate text-xs text-muted-foreground">{option.description}</span>}
                        </span>
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
