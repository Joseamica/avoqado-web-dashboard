import { Currency } from '@/utils/currency'

/** Un ajuste con su signo a la vista: «+$100.00» (bono) o «−$150.00» (descuento). El monto viene del server como texto. */
export function conSigno(monto: string | number): string {
  const n = Number(monto)
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Currency(Math.abs(n))}`
}

/** Un total: sin «+», y si es negativo con el MISMO «−» que los ajustes (no el guion de Intl: «-$150.00»). */
export function monto(m: string | number): string {
  const n = Number(m)
  return n < 0 ? `−${Currency(-n)}` : Currency(n)
}
