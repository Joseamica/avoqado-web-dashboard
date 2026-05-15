import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface Country {
  code: string
  name: string
  dial: string
  flag: string
}

/**
 * Curated list of countries used by Avoqado's payment-link share dialog.
 * Mirrors `avoqado-checkout/src/components/CountryCodePicker.tsx` so the
 * customer-facing checkout and the operator dashboard speak the same dial
 * codes. Keep both files in sync if you add/remove entries.
 */
export const COUNTRIES: Country[] = [
  { code: 'MX', name: 'México', dial: '52', flag: '🇲🇽' },
  { code: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦' },
  { code: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷' },
  { code: 'BO', name: 'Bolivia', dial: '591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', dial: '506', flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba', dial: '53', flag: '🇨🇺' },
  { code: 'DO', name: 'República Dominicana', dial: '1', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador', dial: '593', flag: '🇪🇨' },
  { code: 'SV', name: 'El Salvador', dial: '503', flag: '🇸🇻' },
  { code: 'GT', name: 'Guatemala', dial: '502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', dial: '504', flag: '🇭🇳' },
  { code: 'NI', name: 'Nicaragua', dial: '505', flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá', dial: '507', flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay', dial: '595', flag: '🇵🇾' },
  { code: 'PE', name: 'Perú', dial: '51', flag: '🇵🇪' },
  { code: 'PR', name: 'Puerto Rico', dial: '1', flag: '🇵🇷' },
  { code: 'UY', name: 'Uruguay', dial: '598', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪' },
  { code: 'ES', name: 'España', dial: '34', flag: '🇪🇸' },
  { code: 'FR', name: 'Francia', dial: '33', flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania', dial: '49', flag: '🇩🇪' },
  { code: 'IT', name: 'Italia', dial: '39', flag: '🇮🇹' },
  { code: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { code: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧' },
  { code: 'IE', name: 'Irlanda', dial: '353', flag: '🇮🇪' },
  { code: 'NL', name: 'Países Bajos', dial: '31', flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', dial: '32', flag: '🇧🇪' },
  { code: 'CH', name: 'Suiza', dial: '41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', dial: '43', flag: '🇦🇹' },
  { code: 'SE', name: 'Suecia', dial: '46', flag: '🇸🇪' },
  { code: 'NO', name: 'Noruega', dial: '47', flag: '🇳🇴' },
  { code: 'DK', name: 'Dinamarca', dial: '45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finlandia', dial: '358', flag: '🇫🇮' },
  { code: 'PL', name: 'Polonia', dial: '48', flag: '🇵🇱' },
  { code: 'CZ', name: 'Chequia', dial: '420', flag: '🇨🇿' },
  { code: 'GR', name: 'Grecia', dial: '30', flag: '🇬🇷' },
  { code: 'TR', name: 'Turquía', dial: '90', flag: '🇹🇷' },
  { code: 'RU', name: 'Rusia', dial: '7', flag: '🇷🇺' },
  { code: 'IL', name: 'Israel', dial: '972', flag: '🇮🇱' },
  { code: 'AE', name: 'Emiratos Árabes Unidos', dial: '971', flag: '🇦🇪' },
  { code: 'SA', name: 'Arabia Saudita', dial: '966', flag: '🇸🇦' },
  { code: 'IN', name: 'India', dial: '91', flag: '🇮🇳' },
  { code: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
  { code: 'JP', name: 'Japón', dial: '81', flag: '🇯🇵' },
  { code: 'KR', name: 'Corea del Sur', dial: '82', flag: '🇰🇷' },
  { code: 'TW', name: 'Taiwán', dial: '886', flag: '🇹🇼' },
  { code: 'HK', name: 'Hong Kong', dial: '852', flag: '🇭🇰' },
  { code: 'SG', name: 'Singapur', dial: '65', flag: '🇸🇬' },
  { code: 'MY', name: 'Malasia', dial: '60', flag: '🇲🇾' },
  { code: 'TH', name: 'Tailandia', dial: '66', flag: '🇹🇭' },
  { code: 'PH', name: 'Filipinas', dial: '63', flag: '🇵🇭' },
  { code: 'ID', name: 'Indonesia', dial: '62', flag: '🇮🇩' },
  { code: 'VN', name: 'Vietnam', dial: '84', flag: '🇻🇳' },
  { code: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺' },
  { code: 'NZ', name: 'Nueva Zelanda', dial: '64', flag: '🇳🇿' },
  { code: 'ZA', name: 'Sudáfrica', dial: '27', flag: '🇿🇦' },
  { code: 'EG', name: 'Egipto', dial: '20', flag: '🇪🇬' },
  { code: 'MA', name: 'Marruecos', dial: '212', flag: '🇲🇦' },
  { code: 'NG', name: 'Nigeria', dial: '234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenia', dial: '254', flag: '🇰🇪' },
]

export const DEFAULT_COUNTRY: Country = COUNTRIES[0]

/**
 * Detect leading dial code from a raw input (autofill / paste) and return
 * the matching country plus the remaining local digits. Longest-prefix
 * match (3 → 2 → 1) so e.g. `+506` (Costa Rica) wins over `+5`. Shared
 * dial codes (US/CA/PR/DO = +1) prefer the currently selected country.
 *
 * Returns `null` when the input doesn't start with `+` — caller leaves the
 * picker untouched (user is typing a plain local number).
 */
export function parsePhoneInput(raw: string, currentCountry?: Country): { country: Country; localDigits: string } | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('+')) return null
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  for (const len of [3, 2, 1]) {
    if (digits.length <= len) continue
    const prefix = digits.slice(0, len)
    const matches = COUNTRIES.filter(c => c.dial === prefix)
    if (matches.length === 0) continue
    const country = currentCountry && matches.some(m => m.code === currentCountry.code) ? currentCountry : matches[0]
    return { country, localDigits: digits.slice(len) }
  }
  return null
}

interface Props {
  value: Country
  onChange: (c: Country) => void
  disabled?: boolean
}

/**
 * Country dial-code picker built on shadcn `Popover` + cmdk `Command` so it
 * matches the rest of the dashboard's combobox patterns (e.g. venue switcher).
 * The trigger is a compact button showing flag + `+dial`; the popover holds
 * a search box and the country list, filterable by name, dial code, or ISO.
 */
export function CountryCodePicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 px-2.5 gap-1.5 font-medium"
        >
          <span className="text-base leading-none">{value.flag}</span>
          <span>+{value.dial}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command
          // cmdk's built-in filter uses `value` for matching. We expose name +
          // dial + code via the `value` so typing any of them filters.
          filter={(itemValue, search) => {
            const q = search.toLowerCase().replace(/^\+/, '').trim()
            return itemValue.toLowerCase().includes(q) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Buscar país o código…" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map(c => (
                <CommandItem
                  key={c.code}
                  value={`${c.name} ${c.dial} ${c.code}`}
                  onSelect={() => {
                    onChange(c)
                    setOpen(false)
                  }}
                  className={cn('flex items-center justify-between gap-3', c.code === value.code && 'bg-muted/40')}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">+{c.dial}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
