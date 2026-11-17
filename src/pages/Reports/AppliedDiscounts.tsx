/**
 * Reporte «Descuentos» (encargo f998c8, founder «A», como el «Discount Reasons» de Toast): qué descuentos se dieron en el periodo,
 * cuánto y por qué. Arriba, el total y una tarjeta por motivo (exactos, del servidor); abajo, la lista paginada con su motivo,
 * comentario, quién lo aplicó y quién lo aprobó. Tocar un motivo filtra la lista; «Sin motivo» son los de apps viejas, la terminal
 * o de antes de prender «Pedir motivo».
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Percent, ChevronLeft, ChevronRight } from 'lucide-react'
import { AvisoDeCarga } from '@/components/AvisoDeCarga'
import { falloDeCarga } from '@/lib/falloDeCarga'
import { Button } from '@/components/ui/button'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/date-range-picker'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { getLast7Days, useVenueDateTime } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import { appliedDiscountsKeys, fetchAppliedDiscounts, SIN_MOTIVO } from '@/services/reports/appliedDiscounts.service'

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm', className)}>{children}</div>
)

const PAGE_SIZE = 50

export default function AppliedDiscounts() {
  const { t, i18n } = useTranslation('reports')
  const { venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const { formatDateTime } = useVenueDateTime()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  const defaultDateRange = useMemo(() => getLast7Days(venueTimezone), [venueTimezone])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: defaultDateRange.from, to: defaultDateRange.to })
  const [reason, setReason] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const filters = useMemo(
    () => ({ venueId, from: dateRange.from.toISOString(), to: dateRange.to.toISOString(), page, pageSize: PAGE_SIZE, reason }),
    [venueId, dateRange.from, dateRange.to, page, reason],
  )

  const query = useQuery({
    queryKey: appliedDiscountsKeys.report(filters),
    queryFn: () => fetchAppliedDiscounts(filters),
    enabled: !!venueId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const isLoading = data === undefined && !falloDeCarga(query)

  const reasonLabel = (r: string | null) => r ?? t('appliedDiscounts.noReason', { defaultValue: 'Sin motivo' })

  const elegirMotivo = (r: string | null) => {
    const valor = r ?? SIN_MOTIVO
    setReason(prev => (prev === valor ? undefined : valor))
    setPage(1)
  }

  const handleDateRangeUpdate = (values: { range: { from: Date; to: Date | undefined } }) => {
    if (values.range.from && values.range.to) {
      setDateRange({ from: values.range.from, to: values.range.to })
      setPage(1)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitleWithInfo
          title={t('appliedDiscounts.title', { defaultValue: 'Descuentos' })}
          className="text-2xl font-bold"
          tooltip={t('appliedDiscounts.info', {
            defaultValue: 'Los descuentos que se dieron en las ventas del periodo, con su motivo, quién lo aplicó y quién lo aprobó.',
          })}
        />
      </div>

      <div className="flex items-center">
        <DateRangePicker
          initialDateFrom={dateRange.from}
          initialDateTo={dateRange.to}
          onUpdate={handleDateRangeUpdate}
          align="start"
          locale={i18n.language}
          showCompare={false}
        />
      </div>

      <AvisoDeCarga query={query} hayDatos={data !== undefined} />

      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      )}

      {data && (
        <GlassCard className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Percent className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-2xl font-bold tracking-tight">{Currency(data.totales.amount)}</p>
                  <p className="text-xs text-muted-foreground">{t('appliedDiscounts.totalAmount', { defaultValue: 'Total descontado' })}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{data.totales.count}</p>
                  <p className="text-xs text-muted-foreground">{t('appliedDiscounts.count', { defaultValue: 'Descuentos dados' })}</p>
                </div>
              </div>

              {data.porMotivo.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium mb-2">{t('appliedDiscounts.byReason', { defaultValue: 'Por motivo' })}</p>
                  <div className="flex flex-wrap gap-2">
                    {data.porMotivo.map(m => {
                      const activo = reason === (m.reason ?? SIN_MOTIVO)
                      return (
                        <button
                          type="button"
                          key={m.reason ?? SIN_MOTIVO}
                          onClick={() => elegirMotivo(m.reason)}
                          aria-pressed={activo}
                          className={cn(
                            'rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer',
                            activo ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-muted/40 hover:bg-muted',
                          )}
                        >
                          <span className={cn(!m.reason && !activo && 'italic text-muted-foreground')}>{reasonLabel(m.reason)}</span>
                          <span className={cn('ml-1.5', activo ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                            {m.count} · {Currency(m.amount)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {data.motivosRecortados && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('appliedDiscounts.reasonsTruncated', {
                        defaultValue:
                          'Se muestran los 100 motivos con más monto del periodo. El total de arriba sí incluye todos; acorta el periodo para ver el resto.',
                      })}
                    </p>
                  )}
                  {reason && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('appliedDiscounts.filteredHint', { defaultValue: 'Toca el motivo otra vez para ver todos.' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {data && data.rows.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30 text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3 text-left">{t('appliedDiscounts.columns.date', { defaultValue: 'Fecha' })}</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">
                    {t('appliedDiscounts.columns.order', { defaultValue: 'Folio' })}
                  </th>
                  <th className="px-4 py-3 text-left">{t('appliedDiscounts.columns.discount', { defaultValue: 'Descuento' })}</th>
                  <th className="px-4 py-3 text-left">{t('appliedDiscounts.columns.reason', { defaultValue: 'Motivo' })}</th>
                  <th className="px-4 py-3 text-right">{t('appliedDiscounts.columns.amount', { defaultValue: 'Monto' })}</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">
                    {t('appliedDiscounts.columns.appliedBy', { defaultValue: 'Lo aplicó' })}
                  </th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">
                    {t('appliedDiscounts.columns.authorizedBy', { defaultValue: 'Lo aprobó' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm font-mono text-muted-foreground">{r.orderNumber || '—'}</td>
                    <td className="px-4 py-3 text-sm">{r.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className={cn('text-sm', !r.reason && 'italic text-muted-foreground')}>{reasonLabel(r.reason)}</span>
                        {r.reasonComment && <span className="text-xs text-muted-foreground line-clamp-2">{r.reasonComment}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono">-{Currency(r.amount)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">{r.appliedBy || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">{r.authorizedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t('appliedDiscounts.pageInfo', {
                defaultValue: 'Página {{page}} de {{totalPages}} · {{total}} descuentos',
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                total: data.pagination.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page <= 1 || query.isFetching}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                aria-label={t('appliedDiscounts.prev', { defaultValue: 'Anterior' })}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page >= data.pagination.totalPages || query.isFetching}
                onClick={() => setPage(p => p + 1)}
                aria-label={t('appliedDiscounts.next', { defaultValue: 'Siguiente' })}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {data && data.rows.length === 0 && (
        <GlassCard className="p-12 text-center">
          <Percent className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {reason
              ? t('appliedDiscounts.noMatches', { defaultValue: 'No hay descuentos con ese motivo en el periodo.' })
              : t('appliedDiscounts.noData', { defaultValue: 'No se dieron descuentos en el periodo.' })}
          </p>
        </GlassCard>
      )}
    </div>
  )
}
