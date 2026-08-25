import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
 */

type Level = 'total' | 'city' | 'supervisor' | 'promoter' | 'unassigned'

interface RowModel extends ResponsibleCounts {
  key: string
  label: string
  level: Level
  hint?: string
}

const NUMERIC_COLUMNS: Array<{ key: keyof ResponsibleCounts; i18n: string; emphasis?: boolean }> = [
  { key: 'assigned', i18n: 'assigned' },
  { key: 'receptionApproved', i18n: 'receptionApproved' },
  { key: 'saleApproved', i18n: 'saleApproved' },
  { key: 'saleInAdminReview', i18n: 'saleInAdminReview' },
  { key: 'saleInPromoterReview', i18n: 'saleInPromoterReview' },
  { key: 'saleRejected', i18n: 'saleRejected' },
  { key: 'inHandToday', i18n: 'inHandToday', emphasis: true },
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
  const { t } = useTranslation('playtelecom')
  const base = 'stock.byResponsible'

  const rows = useMemo(() => (data ? flatten(data, t(`${base}.totalCountry`)) : []), [data, t])
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
        <p className="text-sm text-muted-foreground">{t(`${base}.empty`)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t(`${base}.title`)}</h3>
        <p className="text-sm text-muted-foreground">{t(`${base}.subtitle`)}</p>
      </div>

      {/* Scroll propio: 8 columnas no caben en móvil y el body no debe desplazarse. */}
      <div className="overflow-x-auto rounded-xl border border-input">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-input bg-card">
              <th scope="col" className="py-3 pl-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(`${base}.columns.responsible`)}
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
                  {t(`${base}.columns.${col.i18n}`)}
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
                      {t(`${base}.promoterCount`, { count: unassignedPromoters.length })}
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
          <span>{t(`${base}.inHandHint`)}</span>
        </p>
        {unassignedPromoters.length > 0 && (
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t(`${base}.unassignedHint`)}</span>
          </p>
        )}
      </div>
    </div>
  )
}
