import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { InventoryByResponsible, ResponsibleCounts } from '@/services/stockDashboard.service'

/**
 * Tabla Ciudad › Supervisor › Promotor del Control de Stock.
 *
 * La columna "En mano HOY" es el propósito de la pantalla: es el número que el
 * supervisor lleva a la tienda para contar SIMs contra la mano del promotor. Por
 * eso va destacada y con una nota que lo dice — quien la usa no necesariamente
 * sabe leer una tabla de inventario.
 *
 * La jerarquía se lee por indentación y peso, no por color: tres colores de
 * fondo distintos leen como ruido y no sobreviven al modo oscuro.
 *
 * 🔴 Textos en español fijo, NO con `t()`, por decisión explícita del founder
 * (2026-08-25). La regla del repo pide i18n, pero el resto de esta pantalla
 * (`OrgStockControlPage`, tabs, gráficas) está hardcodeado en español: al
 * traducir sólo esta tabla, con el dashboard en inglés quedaba media pantalla
 * en cada idioma — peor que cualquiera de los dos extremos.
 * Si algún día se migra la pantalla completa a i18n, este archivo se migra con
 * ella; las claves vivían en `locales/<idioma>/playtelecom.json`, bajo `stock.byResponsible`.
 */

type Level = 'total' | 'city' | 'supervisor' | 'promoter' | 'unassigned'

interface RowModel extends ResponsibleCounts {
  key: string
  label: string
  level: Level
  hint?: string
}

const NUMERIC_COLUMNS: Array<{ key: keyof ResponsibleCounts; label: string; emphasis?: boolean }> = [
  { key: 'assigned', label: 'Asignados' },
  { key: 'receptionApproved', label: 'Recepción aprobada' },
  { key: 'saleApproved', label: 'Venta aprobada' },
  { key: 'saleInAdminReview', label: 'Venta en revisión de Admin' },
  { key: 'saleInPromoterReview', label: 'Venta en revisión por promotor' },
  { key: 'saleRejected', label: 'Venta rechazada' },
  { key: 'inHandToday', label: 'En mano HOY', emphasis: true },
]

const ROW_STYLES: Record<Level, string> = {
  total: 'bg-muted font-semibold',
  city: 'bg-muted/50 font-semibold',
  supervisor: 'font-medium',
  promoter: '',
  unassigned: 'bg-muted/50 font-semibold',
}

const LABEL_INDENT: Record<Level, string> = {
  total: 'pl-3',
  city: 'pl-3',
  supervisor: 'pl-7',
  promoter: 'pl-12',
  unassigned: 'pl-3',
}

/** Aplana el árbol a filas, conservando el orden en que se leen. */
function flatten(data: InventoryByResponsible, totalLabel: string): RowModel[] {
  const rows: RowModel[] = [{ key: '__total__', label: totalLabel, level: 'total', ...data.total }]

  for (const city of data.cities) {
    rows.push({ key: `city:${city.city}`, label: city.city, level: 'city', ...city })
    for (const supervisor of city.supervisors) {
      const supKey = `sup:${city.city}:${supervisor.supervisorId ?? 'none'}`
      rows.push({ key: supKey, label: supervisor.supervisorName, level: 'supervisor', ...supervisor })
      for (const promoter of supervisor.promoters) {
        rows.push({ key: `${supKey}:${promoter.promoterId}`, label: promoter.promoterName, level: 'promoter', ...promoter })
      }
    }
  }

  return rows
}

interface Props {
  data?: InventoryByResponsible
  isLoading: boolean
}

export function InventoryByResponsibleTable({ data, isLoading }: Props) {
  const rows = useMemo(() => (data ? flatten(data, 'Total País') : []), [data])
  const unassignedPromoters = data?.unassigned.promoters ?? []

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (!data || (data.cities.length === 0 && unassignedPromoters.length === 0)) {
    return (
      <div className="rounded-xl border border-input bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No hay inventario en manos de promotores con estos filtros.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Inventario por responsable</h3>
        <p className="text-sm text-muted-foreground">Lo que cada promotor debe traer físicamente</p>
      </div>

      {/* Scroll propio: 8 columnas no caben en móvil y el body no debe desplazarse. */}
      <div className="overflow-x-auto rounded-xl border border-input">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-input bg-card">
              <th scope="col" className="py-3 pl-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Responsable
              </th>
              {NUMERIC_COLUMNS.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-3 py-3 text-right text-xs font-medium uppercase tracking-wider',
                    col.emphasis ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map(row => (
              <tr key={row.key} className={cn('border-b border-input/60', ROW_STYLES[row.level])}>
                <td className={cn('py-2 pr-4 text-left', LABEL_INDENT[row.level])}>{row.label}</td>
                {NUMERIC_COLUMNS.map(col => (
                  <td
                    key={col.key}
                    className={cn('px-3 py-2 text-right tabular-nums', col.emphasis && 'bg-muted/40 font-semibold text-foreground')}
                  >
                    {row[col.key].toLocaleString('es-MX')}
                  </td>
                ))}
              </tr>
            ))}

            {/* Los promotores dados de baja NUNCA se esconden: su inventario sigue
                siendo responsabilidad de alguien y es justo lo que esta pantalla
                existe para sacar a la luz. */}
            {unassignedPromoters.length > 0 && data && (
              <>
                <tr className={cn('border-b border-input/60', ROW_STYLES.unassigned)}>
                  <td className={cn('py-2 pr-4 text-left', LABEL_INDENT.unassigned)}>
                    <span className="mr-2">{data.unassigned.label}</span>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                      {unassignedPromoters.length} {unassignedPromoters.length === 1 ? 'promotor' : 'promotores'}
                    </Badge>
                  </td>
                  {NUMERIC_COLUMNS.map(col => (
                    <td
                      key={col.key}
                      className={cn('px-3 py-2 text-right tabular-nums', col.emphasis && 'bg-muted/40 font-semibold text-foreground')}
                    >
                      {data.unassigned[col.key].toLocaleString('es-MX')}
                    </td>
                  ))}
                </tr>
                {unassignedPromoters.map(promoter => (
                  <tr key={`unassigned:${promoter.promoterId}`} className="border-b border-input/60">
                    <td className={cn('py-2 pr-4 text-left', LABEL_INDENT.promoter)}>{promoter.promoterName}</td>
                    {NUMERIC_COLUMNS.map(col => (
                      <td
                        key={col.key}
                        className={cn('px-3 py-2 text-right tabular-nums', col.emphasis && 'bg-muted/40 font-semibold text-foreground')}
                      >
                        {promoter[col.key].toLocaleString('es-MX')}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Este es el número que debes contar en la tienda</span>
        </p>
        {unassignedPromoters.length > 0 && (
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Promotores dados de baja o sin sucursal. Se muestran para que su inventario no quede fuera del control.</span>
          </p>
        )}
      </div>
    </div>
  )
}
