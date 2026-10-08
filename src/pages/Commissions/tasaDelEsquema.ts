import type { CommissionCalcType } from '@/types/commission'

/**
 * Un esquema de MONTO FIJO guarda en `defaultRate` el monto en pesos: el servidor paga ese monto por venta, sin tasa
 * (`commission-calculation`: FIXED ⇒ `defaultRate`). Los demás (porcentaje, escalonado, meta como nivel) guardan una tasa decimal.
 */
export const esMontoFijo = (calcType: CommissionCalcType) => calcType === 'FIXED'

/** Las tasas por rol sólo cuentan donde hay tasa: en un esquema fijo el servidor las ignora, y pintarlas diría que aplican (G5). */
export const usaTasasPorRol = (c: { calcType: CommissionCalcType; roleRates: Record<string, number> | null }) =>
  !esMontoFijo(c.calcType) && !!c.roleRates && Object.keys(c.roleRates).length > 0

/** «$5.00» para un monto fijo; «3.00%» para una tasa. Nunca «500.00%» por leer pesos como tasa (G5). */
export function textoDeTasa(calcType: CommissionCalcType, valor: number, idioma: string): string {
  if (!esMontoFijo(calcType)) return `${(valor * 100).toFixed(2)}%`
  return new Intl.NumberFormat(idioma === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(valor)
}

/** Las tasas por rol sólo se OFRECEN donde hay tasa: en un esquema fijo el servidor las ignora, y ofrecer algo sin efecto es un defecto. */
export const ofreceTasasPorRol = (calcType: CommissionCalcType) => !esMontoFijo(calcType)

/** Lo que se guarda: las tasas por rol sólo si se ofrecen y están prendidas. Un fijo nunca guarda tasas por rol (las limpia al editar). */
export function tasasPorRolAGuardar(
  calcType: CommissionCalcType,
  prendidas: boolean,
  tasas: Record<string, number> | null | undefined,
): Record<string, number> | null {
  return ofreceTasasPorRol(calcType) && prendidas && tasas ? tasas : null
}
