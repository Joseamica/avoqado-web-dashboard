import { filasDeIva, soloAl16 } from '@/components/accounting/IvaPorTasa'
import type { IncomeStatementResponse } from '@/services/reports/incomeStatement.service'

type TFunction = (key: string, options?: Record<string, unknown>) => string

/**
 * El read-model contable guarda CENTAVOS enteros (`...Cents`). Todo lo que sale hacia una persona —pantalla, Excel, PDF— divide entre
 * 100: un error de 100× en un archivo que el contador carga en su propio sistema se descubre semanas después, si acaso.
 */
const pesos = (cents: number | undefined | null): number => Math.round(cents ?? 0) / 100

/**
 * Las filas del Excel del estado de resultados —lo que recibe el contador—, con las mismas cifras y los mismos avisos que la pantalla
 * (Codex r1 P3 #9): con mezcla, el IVA de cada tasa y las bases sin IVA; con movimientos aproximados, su número y por qué.
 */
export function filasDelExcel(
  data: IncomeStatementResponse,
  t: TFunction,
  from: string,
  to: string,
): Array<Record<string, string | number>> {
  const r = data.revenue
  const fila = (concepto: string, importe: string | number) => ({
    [t('incomeStatement.concept')]: concepto,
    [t('incomeStatement.amount')]: importe,
  })
  const filas = [
    fila(t('incomeStatement.period'), `${from} → ${to}`),
    fila(t('incomeStatement.grossSales'), pesos(r.grossSalesCents)),
    fila(t('incomeStatement.refunds'), pesos(r.refundsCents)),
    fila(t('incomeStatement.netRevenue'), pesos(r.netRevenueCents)),
    fila(t('incomeStatement.taxableBase'), pesos(r.taxableBaseCents)),
    fila(t('incomeStatement.iva'), pesos(r.ivaCents)),
  ]
  if (!soloAl16(r)) for (const [etiqueta, cents] of filasDeIva(r, t)) filas.push(fila(etiqueta, pesos(cents)))
  if ((r.movimientosConIvaAproximado ?? 0) > 0) {
    filas.push(fila(t('ivaPorTasa.aproximadoBadge'), t('ivaPorTasa.aproximado', { count: r.movimientosConIvaAproximado })))
  }
  // Fallo 3 de la ronda 7: la misma línea fija que la pantalla, siempre.
  filas.push(fila(t('ivaPorTasa.nota'), t('ivaPorTasa.notaFacturas')))
  return filas
}
