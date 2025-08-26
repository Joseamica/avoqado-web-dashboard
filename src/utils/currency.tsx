/**
 * Formats a given amount as a currency string in Mexican Pesos (MXN).
 *
 * @param {number | null} amount - The amount to be formatted. Can be in cents or whole units.
 * @param {boolean} [inCents=true] - A flag indicating whether the amount is in cents. Defaults to true.
 * @returns {string} - The formatted currency string in 'es-MX' locale or 'N/A' if the amount is null or undefined.
 */
export function Currency(amount: number | null, inCents: boolean = false): string {
  if (amount == null) return 'N/A' // Handle null or undefined amounts

  // Adjust for cents if `inCents` is true
  const number = inCents ? Number(amount) / 100 : Number(amount)

  return number.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}
