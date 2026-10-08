import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { Currency } from '@/utils/currency'

type TFunction = (key: string, options?: Record<string, unknown>) => string

/** El desglose de IVA de los reportes contables (centavos). Todo opcional: un servidor anterior no lo manda y la pantalla queda como antes. */
export interface DesgloseDeIva {
  /** IVA por tasa; llave = la tasa ("0.16", "0.08"). */
  taxByRate?: Record<string, number>
  tasa0BaseCents?: number
  exentoBaseCents?: number
  noObjetoBaseCents?: number
  /** Ventas y devoluciones con IVA aproximado. Ausente = no se sabe (no se afirma nada). */
  movimientosConIvaAproximado?: number
}

const tasaTxt = (t: TFunction, tasa: number) => t('ivaPorTasa.tasa', { pct: Math.round(tasa * 100) })
/** Las tasas con IVA, de mayor a menor, sin las que quedaron en cero. */
const tasasConIva = (d: DesgloseDeIva) =>
  Object.entries(d.taxByRate ?? {})
    .filter(([, cents]) => cents !== 0)
    .sort(([a], [b]) => Number(b) - Number(a))

/**
 * ¿Todo el IVA es del 16 % y no hubo ventas sin IVA? Sólo entonces la pantalla queda como antes. Una sola tasa que no es el 16 % (todo
 * al 8 %) sí se muestra: si no, nadie sabría a qué tasa es el IVA (Codex r2 N9).
 */
export const soloAl16 = (d: DesgloseDeIva): boolean =>
  tasasConIva(d).every(([tasa]) => Number(tasa) === 0.16) && !d.tasa0BaseCents && !d.exentoBaseCents && !d.noObjetoBaseCents

/** Las tasas del periodo, para el subtítulo de la tarjeta de IVA: «16 %», «16 % · 0 % · exento». */
export function tasasPresentes(d: DesgloseDeIva, t: TFunction): string | undefined {
  const partes = tasasConIva(d).map(([tasa]) => tasaTxt(t, Number(tasa)))
  if (d.tasa0BaseCents) partes.push(tasaTxt(t, 0))
  if (d.exentoBaseCents) partes.push(t('ivaPorTasa.exento'))
  if (d.noObjetoBaseCents) partes.push(t('ivaPorTasa.noObjeto'))
  return partes.length > 0 ? partes.join(' · ') : undefined
}

/** Los renglones del desglose (etiqueta, centavos): el IVA de cada tasa y las bases sin IVA. Los usan la pantalla y el Excel. */
export function filasDeIva(d: DesgloseDeIva, t: TFunction): Array<[string, number]> {
  const filas: Array<[string, number]> = tasasConIva(d).map(([tasa, cents]) => [
    t('ivaPorTasa.iva', { tasa: tasaTxt(t, Number(tasa)) }),
    cents,
  ])
  if (d.tasa0BaseCents) filas.push([t('ivaPorTasa.baseTasa0'), d.tasa0BaseCents])
  if (d.exentoBaseCents) filas.push([t('ivaPorTasa.baseExenta'), d.exentoBaseCents])
  if (d.noObjetoBaseCents) filas.push([t('ivaPorTasa.baseNoObjeto'), d.noObjetoBaseCents])
  return filas
}

/**
 * Fallo 3 de la ronda 7 (Codex r6 R6-3): una línea fija, SIEMPRE. El libro saca el IVA de lo cobrado por tasa; una factura o una nota
 * de crédito puede repartir esos centavos distinto, con o sin devoluciones. No se compara documento por documento.
 */
export function AvisoIvaPorTasa() {
  const { t } = useTranslation('reports')
  return (
    <p className="text-xs text-muted-foreground" data-testid="aviso-iva-por-tasa">
      {t('ivaPorTasa.notaFacturas')}
    </p>
  )
}

/** El IVA por tasa del periodo y, si lo hay, el aviso de movimientos con IVA aproximado. Con todo al 16 % y sin aproximados, nada. */
export function IvaPorTasa({ desglose }: { desglose: DesgloseDeIva }) {
  const { t } = useTranslation('reports')
  const aproximados = desglose.movimientosConIvaAproximado ?? 0
  if (soloAl16(desglose) && aproximados === 0) return null
  return (
    <Card className="border-input" data-testid="iva-por-tasa">
      <CardContent className="py-3 space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{t('ivaPorTasa.titulo')}</h2>
        {filasDeIva(desglose, t).map(([etiqueta, cents]) => (
          <div key={etiqueta} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{etiqueta}</span>
            <span className="tabular-nums text-foreground">{Currency(cents, true)}</span>
          </div>
        ))}
        {aproximados > 0 && (
          <p className="pt-1 text-xs text-muted-foreground" data-testid="iva-aproximado">
            {t('ivaPorTasa.aproximado', { count: aproximados })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
