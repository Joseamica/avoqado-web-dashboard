/**
 * La marca de una tarjeta como la lee una persona («Visa», «American Express»), no la clave de Stripe (`visa`, `amex`).
 *
 * Espejo de `marcaLegible` del SERVIDOR (`email.service.ts`, B2 Task 6), para que la ventana del alta diga lo mismo que los
 * correos: una marca desconocida sale palabra por palabra con mayúscula inicial (`cartes_bancaires` → «Cartes Bancaires»), y
 * sin marca (o `unknown`) no se imprime nada.
 */
const MARCAS_DE_TARJETA: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  americanexpress: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  dinersclub: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
}

export function marcaLegible(brand: string | null | undefined): string | null {
  const limpia = brand?.trim()
  if (!limpia || limpia.toLowerCase() === 'unknown') return null
  const conocida = MARCAS_DE_TARJETA[limpia.toLowerCase().replace(/[\s_-]/g, '')]
  if (conocida) return conocida
  return limpia
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ')
}
