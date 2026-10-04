import { Currency } from '@/utils/currency'

/** Un ajuste con su signo a la vista: «+$100.00» (bono) o «−$150.00» (descuento). El monto viene del server como texto. */
export function conSigno(monto: string | number): string {
  const n = Number(monto)
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Currency(Math.abs(n))}`
}
