import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useVenueDateTime } from '@/utils/datetime'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useStaffPayExceptions, useStaffPayOrphans } from '@/hooks/useStaffPay'
import type { MotivoExcepcion, ReservaHuerfanaDto } from '@/types/staffPay'
import { useNombreSede } from '../useNombreSede'
import { unirClases } from '../unirClases'

/** Tablas del periodo: aire entre columnas (sin él, «Sede» y «Clase» se pegan en el panel lateral). */
export const TABLA_PERIODO = 'w-full text-sm [&_th]:pr-4 [&_td]:pr-4 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0'

/** Excepciones que se resuelven en la pestaña «Tabla de pagos» (nivel, tabla o monto). */
const SALIDA_EN_LA_TABLA = new Set<MotivoExcepcion>(['COACH_SIN_NIVEL', 'SIN_TABLA', 'SIN_MONTO_PARA_ESE_CONTEO'])

/** Carga / error con reintento / vacío / «Cargar más»: una lista acotada nunca se queda en blanco sin explicación. */
export function EstadoLista(p: {
  isLoading: boolean
  isError: boolean
  vacio: boolean
  textoVacio: string
  onRetry: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  children: ReactNode
}) {
  const { t } = useTranslation('staffPay')
  if (p.isLoading) {
    return (
      <div className="mt-4 space-y-2" aria-busy="true">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    )
  }
  if (p.isError) {
    return (
      <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-3 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{t('period.listError')}</span>
        </div>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={p.onRetry}>
          {t('period.retry')}
        </Button>
      </div>
    )
  }
  if (p.vacio) return <p className="mt-4 text-sm text-muted-foreground">{p.textoVacio}</p>
  return (
    <>
      {p.children}
      {p.hasNextPage && (
        <Button variant="outline" className="mt-3 w-full cursor-pointer" disabled={p.isFetchingNextPage} onClick={p.onLoadMore}>
          {t('period.loadMore')}
        </Button>
      )}
    </>
  )
}

export function ExcepcionesSheet({ sede, onClose }: { sede?: string; onClose: () => void }) {
  const { t } = useTranslation('staffPay')
  const { formatDateTime } = useVenueDateTime()
  const { fullBasePath } = useCurrentVenue()
  const nombreSede = useNombreSede()
  const q = useStaffPayExceptions(sede)
  const filas = useMemo(() => unirClases(q.data?.pages), [q.data])

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent hasTitle className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t('period.exceptionsTitle')}</SheetTitle>
          <SheetDescription>{t('period.exceptionsHelp')}</SheetDescription>
        </SheetHeader>
        <EstadoLista
          isLoading={q.isLoading}
          isError={q.isError && filas.length === 0}
          vacio={filas.length === 0}
          textoVacio={t('period.listEmpty')}
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
                <th>{t('period.detailColumns.coach')}</th>
                <th>{t('period.detailColumns.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const motivo = f.motivo ?? 'SIN_TABLA'
                return (
                  <tr key={f.classSessionId} className="border-b border-border/50 align-top">
                    <td className="whitespace-nowrap py-2">{formatDateTime(f.startsAt)}</td>
                    <td className="py-2 text-muted-foreground">{nombreSede(f.venueId)}</td>
                    <td className="py-2">{f.productName}</td>
                    <td className="py-2">{f.staffName ?? t('period.noCoach')}</td>
                    <td className="py-2">
                      <p className="text-amber-700 dark:text-amber-400">{t(`reasons.${motivo}`)}</p>
                      {SALIDA_EN_LA_TABLA.has(motivo) ? (
                        <Link
                          to={`${fullBasePath}/servicio-pago#tabla`}
                          onClick={onClose}
                          className="text-xs font-medium underline underline-offset-2"
                        >
                          {t('period.resolveInTable')}
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t('period.resolveNoCoach')}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </EstadoLista>
      </SheetContent>
    </Sheet>
  )
}

export function HuerfanasSheet({ sede, onClose }: { sede?: string; onClose: () => void }) {
  const { t } = useTranslation('staffPay')
  const { formatDateTime } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const q = useStaffPayOrphans(sede)
  const filas = useMemo(() => {
    const vistas = new Map<string, ReservaHuerfanaDto>()
    for (const p of q.data?.pages ?? []) for (const r of p.items) if (!vistas.has(r.reservationId)) vistas.set(r.reservationId, r)
    return [...vistas.values()]
  }, [q.data])
  const paginas = q.data?.pages ?? []
  const total = paginas.length ? paginas[paginas.length - 1].total : 0

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent hasTitle className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t('period.orphansTitle')}</SheetTitle>
          <SheetDescription>{t('period.orphansHelp')}</SheetDescription>
        </SheetHeader>
        <EstadoLista
          isLoading={q.isLoading}
          isError={q.isError && filas.length === 0}
          vacio={filas.length === 0}
          textoVacio={t('period.listEmpty')}
          onRetry={() => q.refetch()}
          hasNextPage={!!q.hasNextPage}
          isFetchingNextPage={q.isFetchingNextPage}
          onLoadMore={() => q.fetchNextPage()}
        >
          <p className="mt-4 text-xs text-muted-foreground">{t('period.shownOf', { shown: filas.length, total })}</p>
          <table className={`mt-2 ${TABLA_PERIODO}`}>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2">{t('period.detailColumns.date')}</th>
                <th>{t('period.detailColumns.venue')}</th>
                <th>{t('period.detailColumns.class')}</th>
                <th>{t('period.detailColumns.guest')}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(r => (
                <tr key={r.reservationId} className="border-b border-border/50">
                  <td className="whitespace-nowrap py-2">{formatDateTime(r.startsAt)}</td>
                  <td className="text-muted-foreground">{nombreSede(r.venueId)}</td>
                  <td>{r.productName ?? '—'}</td>
                  <td>{r.guestName ?? t('period.noGuest')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </EstadoLista>
      </SheetContent>
    </Sheet>
  )
}
