import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useStaffPayDetail, useStaffReceipt } from '@/hooks/useStaffPay'
import { staffPayService } from '@/services/staffPay.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { RenglonReciboDto } from '@/types/staffPay'
import { useNombreSede } from '../useNombreSede'
import { unirClases } from '../unirClases'
import { conSigno, monto } from '../conSigno'
import { EstadoLista, TABLA_PERIODO } from './ListasDelPeriodo'

/**
 * Desglose de sólo lectura (un Sheet es válido; FullScreenModal es para crear/editar). El total viene del renglón del
 * reporte o del recibo ENTERO que suma el server, nunca de sumar las filas: las listas son paginadas y la suma de lo
 * cargado mentiría con «Cargar más» pendiente (Codex R2-R1-20). Con periodo CERRADO el desglose es el recibo congelado
 * y el desglose en vivo no se pide (el server respondería 409 PERIODO_CERRADO, Codex R2-R1-21).
 */
export function DesglosePersona({
  staffId,
  staffName,
  clases,
  total,
  sede,
  fecha,
  cerrado = false,
  onClose,
}: {
  staffId: string
  staffName: string
  clases: number
  total: string
  sede?: string
  /** Un día del periodo; sin él (fase 1) no hay recibo ni descargas. */
  fecha?: string
  cerrado?: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation('staffPay')
  const { formatDateTime, formatDate, formatCalendarDate } = useVenueDateTime()
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const nombreSede = useNombreSede()
  const q = useStaffPayDetail(staffId, sede, fecha, !cerrado)
  const filas = useMemo(() => unirClases(q.data?.pages), [q.data])
  // El recibo se pide siempre que haya `fecha`: en un periodo cerrado ES el desglose; en uno abierto aporta los ajustes.
  // Con el MISMO filtro de sede que las clases y el encabezado (Codex bloque A #5): si no, los ajustes de otra sede se
  // sumarían a la vista de ésta. La exportación sí va sin sede (su aviso lo dice).
  const recibo = useStaffReceipt(staffId, fecha ?? null, !!fecha, sede)
  const renglones = recibo.data?.renglones ?? []
  const ajustes = renglones.filter(r => r.tipo !== 'CLASE')
  // Vista parcial: el recibo sólo trae las sedes que este usuario puede ver; nunca se presenta como el recibo completo.
  const parcial = !!recibo.data?.parcial
  const avisoParcial = parcial && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('period.receiptPartial')}</p>
  const [bajando, setBajando] = useState<'pdf' | 'xlsx' | null>(null)
  // La fecha de un renglón con el MISMO formato que el desglose en vivo (formatDateTime: «29 sep 2026, 6:00 p.m.»). La hora
  // del recibo ya es la de la sede (HH:MM): se arma sin zona para no moverla. Un ajuste no es de un día de servicio: su
  // fecha es la de captura y lo dice.
  const fechaDelRenglon = (r: RenglonReciboDto) =>
    r.tipo === 'AJUSTE'
      ? t('period.capturedOn', { fecha: formatCalendarDate(r.fecha) })
      : r.hora
        ? DateTime.fromISO(`${r.fecha}T${r.hora}`, { zone: 'utc' }).setLocale(getIntlLocale(i18n?.language)).toLocaleString(DateTime.DATETIME_MED)
        : formatCalendarDate(r.fecha)

  const descargar = async (format: 'pdf' | 'xlsx') => {
    if (!fecha || !venueId || bajando) return
    setBajando(format)
    try {
      await staffPayService.downloadReceipt(venueId, staffId, fecha, format, `recibo-${staffName}-${fecha.slice(0, 7)}`)
    } catch (err) {
      toast({ title: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
    } finally {
      setBajando(null)
    }
  }

  const masRenglones = recibo.hasNextPage && (
    <Button variant="outline" size="sm" className="mt-3 w-full cursor-pointer" disabled={recibo.isFetchingNextPage} onClick={() => recibo.fetchNextPage()}>
      {recibo.isFetchingNextPage && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
      {t('period.loadMore')}
    </Button>
  )

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent hasTitle className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t('period.detailTitle', { name: staffName })}</SheetTitle>
          <SheetDescription>{t('period.detailSummary', { count: clases, total: monto(total) })}</SheetDescription>
          {cerrado && recibo.data && (
            <div className="pt-1">
              {recibo.data.pagadoEn ? (
                <span className="inline-flex items-center gap-1 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('closed.paidOn', { fecha: formatDate(recibo.data.pagadoEn) })}
                </span>
              ) : (
                <Badge variant="outline">{t('closed.pending')}</Badge>
              )}
            </div>
          )}
          {fecha && (
            <div className="space-y-1 pt-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={!!bajando}
                  onClick={() => descargar('pdf')}
                  data-tour="staffpay-receipt-pdf"
                >
                  {bajando === 'pdf' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                  {t('period.receiptPdf')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={!!bajando}
                  onClick={() => descargar('xlsx')}
                  data-tour="staffpay-receipt-excel"
                >
                  {bajando === 'xlsx' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                  {t('period.receiptExcel')}
                </Button>
              </div>
              {/* La exportación no filtra por sede (no se promete «sólo esta sede»), pero en vista parcial sí trae sólo lo visible. */}
              {parcial ? (
                <p className="text-xs text-muted-foreground">{t('period.receiptExportPartial')}</p>
              ) : (
                sede && <p className="text-xs text-muted-foreground">{t('period.receiptAllVenues')}</p>
              )}
            </div>
          )}
        </SheetHeader>

        {cerrado ? (
          recibo.isLoading ? (
            <div className="mt-4 space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : recibo.isError && !recibo.data ? (
            // Un error NUNCA se pinta como un recibo de $0 (Codex R1-20).
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{(recibo.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? t('period.listError')}</span>
              </div>
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => recibo.refetch()}>
                {t('period.retry')}
              </Button>
            </div>
          ) : (
            <>
              <table className={`mt-4 ${TABLA_PERIODO}`}>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2">{t('period.detailColumns.date')}</th>
                    <th className="hidden sm:table-cell">{t('period.detailColumns.venue')}</th>
                    <th>{t('period.detailColumns.concept')}</th>
                    <th className="hidden text-right sm:table-cell">{t('period.detailColumns.seats')}</th>
                    <th className="text-right">{t('period.detailColumns.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 sm:whitespace-nowrap">{r.fecha ? fechaDelRenglon(r) : ''}</td>
                      <td className="hidden text-muted-foreground sm:table-cell">{r.sede}</td>
                      <td>{r.concepto}</td>
                      <td className="hidden text-right sm:table-cell">{r.lugares ?? '—'}</td>
                      <td className="whitespace-nowrap text-right">{r.tipo === 'CLASE' ? Currency(Number(r.monto)) : conSigno(r.monto)}</td>
                    </tr>
                  ))}
                  <tr>
                    {/* El total del recibo ENTERO (lo suma el server), aunque falten páginas por cargar (Codex R2-R1-20). Celdas
                        que se esconden igual que las columnas: en el celular el monto cae bajo «Monto», no en una columna fantasma. */}
                    <td className="py-2 font-semibold" colSpan={2}>
                      {parcial ? t('period.totalPartial') : t('period.total')}
                      {recibo.hasNextPage && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t('period.shownOf', { shown: renglones.length, total: recibo.data?.cantidad ?? 0 })}
                        </span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell" />
                    <td className="hidden sm:table-cell" />
                    <td className="whitespace-nowrap text-right font-semibold">{monto(recibo.data?.total ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
              {avisoParcial}
              {masRenglones}
            </>
          )
        ) : (
          <>
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
                    <th className="hidden sm:table-cell">{t('period.detailColumns.venue')}</th>
                    <th>{t('period.detailColumns.class')}</th>
                    <th className="hidden text-right sm:table-cell">{t('period.detailColumns.seats')}</th>
                    <th className="text-right">{t('period.detailColumns.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f.classSessionId} className="border-b border-border/50">
                      <td className="py-2 sm:whitespace-nowrap">{formatDateTime(f.startsAt)}</td>
                      <td className="hidden text-muted-foreground sm:table-cell">{nombreSede(f.venueId)}</td>
                      <td>
                        {f.productName}
                        {f.tieneAjuste && (
                          <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[10px]">
                            {t('period.adjusted')}
                          </Badge>
                        )}
                      </td>
                      <td className="hidden text-right sm:table-cell">{f.conteo}</td>
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
            {(ajustes.length > 0 || recibo.hasNextPage || parcial) && (
              <div className="mt-6 space-y-1" data-tour="staffpay-detail-adjustments">
                <p className="text-sm font-medium">{t('period.periodAdjustments')}</p>
                {ajustes.map((r, i) => (
                  <p key={i} className="flex justify-between gap-3 text-sm">
                    <span>{r.concepto}</span>
                    <span className="whitespace-nowrap font-medium">{conSigno(r.monto)}</span>
                  </p>
                ))}
                {avisoParcial}
                {/* Un recibo de más de una página puede traer sus ajustes después de las clases: se ofrecen, no se esconden. */}
                {masRenglones}
              </div>
            )}
            {recibo.isError && !recibo.data && (
              <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-3 text-sm">
                <span>{t('period.adjustmentsError')}</span>
                <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => recibo.refetch()}>
                  {t('period.retry')}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
