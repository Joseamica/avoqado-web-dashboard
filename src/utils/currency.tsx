import { getIntlLocale } from '@/utils/i18n-locale'

/**
 * Formats a given amount as a currency string in Mexican Pesos (MXN).
 *
 * @param {number | null} amount - The amount to be formatted in pesos (e.g., 129.50 = $129.50).
 * @param {boolean} [inCents=false] - Set to true only if amount is in centavos (rarely needed).
 *   When true, divides by 100 for display. Defaults to false (amount already in pesos).
 *   NOTE: Database values are stored in PESOS, not centavos.
 * @param {string} [locale] - The locale to use for formatting. Defaults to user's language.
 * @returns {string} - The formatted currency string or 'N/A' if the amount is null or undefined.
 */
export function Currency(amount: number | null, inCents: boolean = false, locale?: string): string {
  if (amount == null) return 'N/A' // Handle null or undefined amounts

  // Adjust for cents if `inCents` is true
  const number = inCents ? Number(amount) / 100 : Number(amount)

  return number.toLocaleString(getIntlLocale(locale), { style: 'currency', currency: 'MXN' })
}
