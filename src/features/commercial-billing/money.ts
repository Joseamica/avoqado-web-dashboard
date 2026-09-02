const MINOR_UNITS = /^(0|[1-9][0-9]{0,18})$/

export function formatCommercialMinor(minorUnits: string, currency: 'MXN', locale: string): string {
  if (!MINOR_UNITS.test(minorUnits)) throw new Error('COMMERCIAL_MONEY_MINOR_INVALID')
  const amount = BigInt(minorUnits)
  const whole = amount / 100n
  const fraction = (amount % 100n).toString().padStart(2, '0')
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter
    .formatToParts(whole)
    .map(part => (part.type === 'fraction' ? fraction : part.value))
    .join('')
}
