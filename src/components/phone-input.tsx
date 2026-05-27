import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { CountryCodePicker, DEFAULT_COUNTRY, parsePhoneInput, type Country } from '@/pages/PaymentLinks/CountryCodePicker'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  /**
   * Phone number in E.164 form (`+526648442154`). Empty string means no value.
   * The component keeps internal state for the picker + local digits but always
   * reports back via `onChange` as a normalized E.164 string so the rest of the
   * app stores a single canonical representation.
   */
  value: string
  onChange: (e164: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  /** Country pre-selected when `value` is empty. Defaults to MX. */
  defaultCountry?: Country
  /** Marks the input as invalid (red ring). */
  invalid?: boolean
}

/**
 * Parses an E.164 string into picker country + local digits. Falls back to
 * `defaultCountry` with the raw value as local digits when the string does not
 * start with `+`. Used to hydrate the component from a persisted value.
 */
function splitE164(value: string, defaultCountry: Country): { country: Country; local: string } {
  if (!value) return { country: defaultCountry, local: '' }
  if (value.startsWith('+')) {
    const parsed = parsePhoneInput(value)
    if (parsed) return { country: parsed.country, local: parsed.localDigits }
  }
  // Legacy data: stored as raw local digits without prefix. Keep them and let
  // the user re-pick the country if needed.
  return { country: defaultCountry, local: value.replace(/\D/g, '') }
}

/**
 * Phone input with a country dial-code picker. Stores its emitted value as
 * E.164 (`+<dial><digits>`) so the backend has a single canonical format.
 *
 * Used by:
 *   - Setup wizard step 4 (EntityTypeStep) during onboarding
 *   - "Configuración del Local > Contacto e Imágenes" post-onboarding form
 *
 * Both consumers previously accepted plain strings like `6648442154` which
 * then became impossible to dial without the `+52` prefix.
 */
export function PhoneInput({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  className,
  defaultCountry = DEFAULT_COUNTRY,
  invalid,
}: PhoneInputProps) {
  // Resolve the initial split once and let user edits drive state from there.
  // Lazy initializer runs only on mount, sidestepping the exhaustive-deps lint.
  const [country, setCountry] = useState<Country>(() => splitE164(value, defaultCountry).country)
  const [local, setLocal] = useState<string>(() => splitE164(value, defaultCountry).local)

  // External value changed (e.g. async form reset) → re-sync internal state.
  useEffect(() => {
    const next = splitE164(value, defaultCountry)
    if (next.country.code !== country.code) setCountry(next.country)
    if (next.local !== local) setLocal(next.local)
    // We intentionally exclude `country`/`local` from deps to avoid loops; this
    // only fires when the *external* value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const emit = (nextCountry: Country, nextLocal: string) => {
    const digits = nextLocal.replace(/\D/g, '')
    const e164 = digits ? `+${nextCountry.dial}${digits}` : ''
    onChange(e164)
  }

  const handleLocalChange = (raw: string) => {
    // Detect paste with leading + and re-route through the picker.
    const parsed = parsePhoneInput(raw, country)
    if (parsed) {
      setCountry(parsed.country)
      setLocal(parsed.localDigits)
      emit(parsed.country, parsed.localDigits)
      return
    }
    const digits = raw.replace(/\D/g, '')
    setLocal(digits)
    emit(country, digits)
  }

  const handleCountryChange = (c: Country) => {
    setCountry(c)
    emit(c, local)
  }

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <CountryCodePicker value={country} onChange={handleCountryChange} disabled={disabled} />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={local}
        onChange={e => handleLocalChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn('flex-1', invalid && 'border-destructive focus-visible:ring-destructive')}
      />
    </div>
  )
}

