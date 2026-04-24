import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Autocomplete combobox for externalSource. Shows the venue's previously used
 * provider names (sorted by frequency). Free text is allowed — Enter or
 * clicking the "+ agregar" row accepts a new value. This is the self-curating
 * registry: first admin types "BUQ", next admin sees it in the list.
 */
export function ExternalSourceCombobox({
  value,
  onChange,
  suggestions,
  isLoading,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  isLoading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const canAddNew = useMemo(() => {
    const trimmed = search.trim()
    if (!trimmed) return false
    return !suggestions.some(s => s.toLowerCase() === trimmed.toLowerCase())
  }, [search, suggestions])

  const pick = (v: string) => {
    onChange(v)
    setSearch('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          {value || 'Selecciona o escribe proveedor (BUQ, Clip...)'}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter>
          <CommandInput placeholder="Buscar o escribir nuevo..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Cargando...' : 'Sin resultados previos. Escribe uno nuevo abajo.'}</CommandEmpty>
            {suggestions.length > 0 && (
              <CommandGroup heading="Ya usados en este venue">
                {suggestions.map(s => (
                  <CommandItem key={s} value={s} onSelect={() => pick(s)}>
                    <Check className={cn('mr-2 h-4 w-4', value === s ? 'opacity-100' : 'opacity-0')} />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {canAddNew && (
              <CommandGroup heading="Nuevo">
                <CommandItem value={search} onSelect={() => pick(search.trim())}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar "{search.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
