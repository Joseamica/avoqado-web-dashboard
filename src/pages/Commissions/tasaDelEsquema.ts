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

/**
 * Los NIVELES (por monto o «meta como nivel») sólo existen con porcentaje: el servidor multiplica la venta por la tasa del nivel, y no
 * hay un monto fijo por nivel. En un fijo no se ofrecen (final-fijo-niveles).
 */
export const ofreceNiveles = (calcType: CommissionCalcType) => !esMontoFijo(calcType)

/** La tasa propia por persona sólo tiene efecto con porcentaje: en un fijo el servidor paga el monto fijo y sólo «excluir» cuenta. */
export const ofreceTasaPorPersona = (calcType: CommissionCalcType) => !esMontoFijo(calcType)

/**
 * El `calcType` que se guarda. 🔴 DINERO: un fijo se guarda FIXED siempre. Con TIERED, el servidor lee `defaultRate` como TASA para
 * quien no cae en un nivel o va bajo su meta (`commission-utils.ts` `calculateFinalRate`, paso 4): un fijo de $5 mandado como
 * TIERED era una tasa de 500 % ($500 por una venta de $116, base $100 sin IVA), y dentro de un nivel pagaba el porcentaje del nivel.
 */
export function calcTypeAGuardar(
  calcType: CommissionCalcType,
  nivelesPrendidos: boolean,
  metaComoNivel: boolean,
): CommissionCalcType {
  if (!ofreceNiveles(calcType)) return calcType
  return nivelesPrendidos || metaComoNivel ? 'TIERED' : calcType
}

/**
 * Las excepciones por persona que se guardan. Con porcentaje, todas tal cual. En un fijo, sólo las que excluyen y sin tasa propia: una
 * excepción que no excluye no cambia nada (todos ganan el monto fijo) y el servidor la rechaza por no traer tasa ni exclusión.
 */
export function excepcionesAGuardar(
  calcType: CommissionCalcType,
  excepciones: Array<{ staffId: string; customRate: number | null; excluir: boolean }>,
): Array<{ staffId: string; customRate: number | null; excludeFromCommissions: boolean }> {
  const conTasa = ofreceTasaPorPersona(calcType)
  return excepciones
    .filter(e => conTasa || e.excluir)
    .map(e => ({ staffId: e.staffId, customRate: conTasa ? e.customRate : null, excludeFromCommissions: e.excluir }))
}
