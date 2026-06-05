import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useDebounce } from '@/hooks/useDebounce'
import { cfdiService, type SatCatalogType } from '@/services/cfdi.service'
import { cn } from '@/lib/utils'

interface SatKeyPickerProps {
  /** Which SAT catalog to search: product (`ClaveProdServ`) or unit (`ClaveUnidad`). */
  type: SatCatalogType
  /** Currently selected SAT key, or null when empty. */
  value: string | null
  /** Called with the chosen key, or null when cleared. */
  onChange: (key: string | null) => void
  /** Venue whose fiscal catalog is searched (feature-gated server-side). */
  venueId: string | null
  disabled?: boolean
  /** Optional placeholder override for the trigger when nothing is selected. */
  placeholder?: string
}

/**
 * Searchable SAT-catalog combobox.
 *
 * Debounces the search box (300ms) and queries the venue-scoped SAT catalog
 * endpoint via `cfdiService.searchSatCatalog`. Renders `{key} — {description}`
 * options. When a value is set but we only know the key (e.g. prefilled on edit
 * before any search), the trigger shows the bare key. Clearable.
 */
export function SatKeyPicker({ type, value, onChange, venueId, disabled, placeholder }: SatKeyPickerProps) {
  const { t } = useTranslation('cfdi')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['sat-catalog', type, venueId, debouncedSearch],
    queryFn: () => cfdiService.searchSatCatalog(venueId!, type, debouncedSearch),
    enabled: !!venueId && open,
    staleTime: 5 * 60 * 1000,
    placeholderData: prev => prev,
  })

  // Prefer the full "{key} — {description}" label when we have the matching
  // option loaded; otherwise fall back to the bare key (edit prefill case).
  const selectedResult = results.find(r => r.key === value)
  const selectedLabel = selectedResult ? `${selectedResult.key} — ${selectedResult.description}` : value

  const triggerPlaceholder = placeholder ?? t('satKeys.searchPlaceholder')

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !venueId}
          className="w-full justify-between font-normal bg-transparent shadow-xs text-sm h-12"
        >
          {value ? (
            <span className="truncate">{selectedLabel}</span>
          ) : (
            <span className="text-muted-foreground">{triggerPlaceholder}</span>
          )}
          <span className="ml-2 flex items-center gap-1 shrink-0">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label={t('satKeys.clear')}
                className="rounded-sm p-0.5 hover:bg-muted cursor-pointer"
                onClick={e => {
                  e.stopPropagation()
                  onChange(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange(null)
                  }
                }}
              >
                <X className="h-3.5 w-3.5 opacity-60" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="!w-[--radix-popover-trigger-width] p-0 bg-card border-input"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command shouldFilter={false} className="bg-card">
          <CommandInput placeholder={t('satKeys.searchPlaceholder')} value={search} onValueChange={setSearch} />
          <CommandList>
            {isFetching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('satKeys.loading')}
              </div>
            ) : (
              <>
                <CommandEmpty>{debouncedSearch.trim() ? t('satKeys.empty') : t('satKeys.typeToSearch')}</CommandEmpty>
                <CommandGroup>
                  {results.map(result => (
                    <CommandItem
                      key={result.key}
                      value={result.key}
                      onSelect={() => {
                        onChange(result.key)
                        setOpen(false)
                        setSearch('')
                      }}
                      className="cursor-pointer"
                    >
                      <Check className={cn('h-4 w-4 shrink-0', value === result.key ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate text-sm">
                        <span className="font-medium">{result.key}</span>
                        <span className="text-muted-foreground"> — {result.description}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
