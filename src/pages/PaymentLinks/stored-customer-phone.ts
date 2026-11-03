import { DEFAULT_COUNTRY, parsePhoneInput, type Country } from './CountryCodePicker'

/** Validate local digits before combining them with the operator's chosen country. */
function localPhoneNumber(local: string, country: Country): string | null {
  if (!/^[0-9\s().-]+$/.test(local)) return null
  const digits = local.replace(/\D/g, '')
  if ((country.dial === '52' || country.dial === '1') && digits.length !== 10) return null
  const international = `+${country.dial}${digits}`
  return digits.length >= 7 && /^\+[0-9]{10,15}$/.test(international) ? international : null
}

/** Resolve the complete draft once at validation/submission; never rewrite it while typing. */
export function customerPhoneNumber(raw: string, country: Country): string | null {
  const input = raw.trim()
  if (!/^\+?[0-9\s().-]+$/.test(input)) return null
  const digits = input.replace(/\D/g, '')
  if (input.startsWith('+') || (country.dial === '52' && digits.length > 10)) {
    const parsed = parseStoredCustomerPhone(input, country)
    return parsed ? `+${parsed.country.dial}${parsed.localDigits}` : null
  }
  return localPhoneNumber(input, country)
}

/** Read stored CRM formats without changing the shared dial-code parser. */
export function parseStoredCustomerPhone(raw: string | null | undefined, currentCountry?: Country) {
  const input = raw?.trim()
  if (!input || !/^\+?[0-9\s().-]+$/.test(input)) return null
  const digits = input.replace(/\D/g, '')
  // An incomplete legacy 521 number must not look like a finished +52 number.
  if (digits.startsWith('521') && digits.length !== 13 && (input.startsWith('+') || digits.length > 10)) return null
  let international: string
  // A leading + declares an international number; only Mexico's old +521 is an alias.
  if (input.startsWith('+')) international = /^521[0-9]{10}$/.test(digits) ? `+52${digits.slice(3)}` : `+${digits}`
  else if (/^(521|04[45])[0-9]{10}$/.test(digits)) international = `+52${digits.slice(3)}`
  else if (digits.length === 10) international = `+${DEFAULT_COUNTRY.dial}${digits}`
  else if (/^52[0-9]{10}$/.test(digits)) international = `+${digits}`
  else return null
  if (!/^\+[0-9]{10,15}$/.test(international)) return null
  const parsed = parsePhoneInput(international, currentCountry)
  return parsed && localPhoneNumber(parsed.localDigits, parsed.country) ? parsed : null
}
