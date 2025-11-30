/**
 * Searchable timezone selector with grouped options
 *
 * Features:
 * - Search/filter by timezone name, city, or abbreviation
 * - Grouped by region (México, Latinoamérica, etc.)
 * - Keyboard navigation
 * - Responsive design
 */

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { TIMEZONES, getCountryOrder, getTimezoneLabel } from '@/lib/timezones'
import { useTranslation } from 'react-i18next'

interface TimezoneComboboxProps {
  value?: string
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function TimezoneCombobox({ value, onValueChange, disabled }: TimezoneComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const countryOrder = getCountryOrder()

  // Filter timezones based on search query
  const filteredTimezones = searchQuery
    ? TIMEZONES.filter(
        tz =>
          tz.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tz.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tz.country.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : TIMEZONES

  // Group filtered timezones by country
  const filteredByCountry: Record<string, typeof TIMEZONES> = {}
  filteredTimezones.forEach(tz => {
    if (!filteredByCountry[tz.country]) {
      filteredByCountry[tz.country] = []
    }
    filteredByCountry[tz.country].push(tz)
  })

  const displayValue = value ? getTimezoneLabel(value) : t('venues.edit.placeholders.timezone', { defaultValue: 'Selecciona una zona horaria' })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('search', { defaultValue: 'Buscar zona horaria...' })}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {t('no_results', { defaultValue: 'No se encontraron zonas horarias' })}
            </CommandEmpty>
            {countryOrder.map(country => {
              const timezones = filteredByCountry[country]
              if (!timezones || timezones.length === 0) return null

              return (
                <CommandGroup key={country} heading={country}>
                  {timezones.map(tz => (
                    <CommandItem
                      key={tz.value}
                      value={tz.value}
                      onSelect={currentValue => {
                        onValueChange(currentValue)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === tz.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="truncate">{tz.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
