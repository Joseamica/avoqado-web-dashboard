/**
 * Searchable business type selector
 *
 * Features:
 * - Search/filter by business type name
 * - Alphabetically sorted
 * - Keyboard navigation
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
import { useTranslation } from 'react-i18next'
import { BusinessType } from '@/types'

interface BusinessTypeComboboxProps {
  value?: BusinessType
  onValueChange: (value: BusinessType) => void
  disabled?: boolean
}

export function BusinessTypeCombobox({ value, onValueChange, disabled }: BusinessTypeComboboxProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Get all business types with their labels, sorted alphabetically
  const businessTypes = Object.values(BusinessType)
    .map(type => ({
      value: type,
      label: t(`businessInfo.businessTypes.${type}`, { defaultValue: type.replace(/_/g, ' ') }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  // Filter based on search query
  const filteredTypes = searchQuery
    ? businessTypes.filter(type =>
        type.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : businessTypes

  const displayValue = value
    ? t(`businessInfo.businessTypes.${value}`, { defaultValue: value.replace(/_/g, ' ') })
    : t('businessInfo.form.businessTypePlaceholder', { defaultValue: 'Selecciona un tipo' })

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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={tCommon('search', { defaultValue: 'Buscar...' })}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {tCommon('noResults', { defaultValue: 'No se encontraron resultados' })}
            </CommandEmpty>
            <CommandGroup>
              {filteredTypes.map(type => (
                <CommandItem
                  key={type.value}
                  value={type.value}
                  onSelect={() => {
                    onValueChange(type.value)
                    setOpen(false)
                    setSearchQuery('')
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === type.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span>{type.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
