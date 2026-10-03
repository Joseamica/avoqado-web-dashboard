import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useStaffPayDetail } from '@/hooks/useStaffPay'
import { useNombreSede } from '../useNombreSede'
import { unirClases } from '../unirClases'
import { EstadoLista, TABLA_PERIODO } from './ListasDelPeriodo'

/**
 * Desglose de sólo lectura (un Sheet es válido; FullScreenModal es para crear/editar). El total viene del renglón del
 * reporte, no de sumar las filas: la lista es paginada y la suma de lo cargado mentiría con «Cargar más» pendiente.
 */
export function DesglosePersona({
  staffId,
  staffName,
  clases,
  total,
  sede,
  onClose,
}: {
  staffId: string
  staffName: string
  clases: number
  total: string
  sede?: string
  onClose: () => void
}) {
  const { t } = useTranslation('staffPay')
  const { formatDateTime } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const q = useStaffPayDetail(staffId, sede)
  const filas = useMemo(() => unirClases(q.data?.pages), [q.data])

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent hasTitle className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t('period.detailTitle', { name: staffName })}</SheetTitle>
          <SheetDescription>{t('period.detailSummary', { count: clases, total: Currency(Number(total)) })}</SheetDescription>
        </SheetHeader>
        <EstadoLista
          isLoading={q.isLoading}
          isError={q.isError && filas.length === 0}
          vacio={filas.length === 0}
          textoVacio={t('period.detailEmpty')}
          onRetry={() => q.refetch()}
          hasNextPage={!!q.hasNextPage}
          isFetchingNextPage={q.isFetchingNextPage}
          onLoadMore={() => q.fetchNextPage()}
        >
          <table className={`mt-4 ${TABLA_PERIODO}`}>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2">{t('period.detailColumns.date')}</th>
                <th>{t('period.detailColumns.venue')}</th>
                <th>{t('period.detailColumns.class')}</th>
                <th className="text-right">{t('period.detailColumns.seats')}</th>
                <th className="text-right">{t('period.detailColumns.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.classSessionId} className="border-b border-border/50">
                  <td className="whitespace-nowrap py-2">{formatDateTime(f.startsAt)}</td>
                  <td className="text-muted-foreground">{nombreSede(f.venueId)}</td>
                  <td>
                    {f.productName}
                    {f.tieneAjuste && (
                      <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[10px]">
                        {t('period.adjusted')}
                      </Badge>
                    )}
                  </td>
                  <td className="text-right">{f.conteo}</td>
                  <td className="text-right">
                    {f.estado === 'OK' ? (
                      <span className="font-medium">{Currency(Number(f.monto))}</span>
                    ) : f.estado === 'EXCLUIDA' ? (
                      <span className="text-muted-foreground">{t('period.excluded')}</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">{t(`reasons.${f.motivo ?? 'SIN_TABLA'}`)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EstadoLista>
      </SheetContent>
    </Sheet>
  )
}
