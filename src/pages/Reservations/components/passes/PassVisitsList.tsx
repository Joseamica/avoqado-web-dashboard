import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/use-access'
import { useCountdown } from '@/hooks/use-countdown'
import { passesKeys, useInvalidatePasses, usePassIntegrationsOverview, usePassVisits, type PassVisitsListFilters } from '@/hooks/use-passes'
import { useToast } from '@/hooks/use-toast'
import type { DateRangeValue } from '@/pages/AreaTickets/components/DateRangeFilterContent'
import { confirmPassVisit, rejectPassVisit } from '@/services/passes.service'
import type { PassProvider, PassVisitView } from '@/types/passes'
import { apiErrorDescription } from '@/utils/apiError'
import { useVenueDateTime } from '@/utils/datetime'
import { PASS_VISIT_TABS, type PassVisitTab } from './passVisitTabs'

/** `confirmedBy` del server es un CÓDIGO (AUTO = se confirmó sola; VENUE = la confirmó el negocio), no un nombre (P3-17). */
const CONFIRMED_BY_KEYS: Record<string, string> = { AUTO: 'visits.confirmedBy.AUTO', VENUE: 'visits.confirmedBy.VENUE' }

/** Dos páginas por offset pueden traer la misma visita si entró una nueva entre las dos consultas (P2-11). */
function dedupeById(items: PassVisitView[]): PassVisitView[] {
  const seen = new Set<string>()
  return items.filter(v => (seen.has(v.id) ? false : (seen.add(v.id), true)))
}

const errorCode = (error: unknown) => (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code

interface PassVisitsListProps {
  venueId: string
  tab: PassVisitTab
  provider: PassProvider | null
  dateRange: DateRangeValue
}

/**
 * Lista paginada del server (limit/offset, «Cargar más»). Los filtros van en la queryKey; el hook conserva la página
 * anterior mientras llega la nueva (keepPreviousData) y AQUÍ se respeta `isPlaceholderData` (P1-6): lo que se ve es del
 * filtro anterior, así que no hay botones, ni «Cargar más», ni un «vacío» definitivo hasta que responde el actual.
 *
 * Confirmar NO anuncia éxito por sí solo (P1-3): el server encola la validación con el proveedor y devuelve la visita
 * como quedó. Se decide por su `status`. Con la conexión del proveedor no activa (vista general), Confirmar se apaga y se
 * dice por qué (R2b-23); el server lo rechazaría con 409 de todos modos.
 */
export function PassVisitsList({ venueId, tab, provider, dateRange }: PassVisitsListProps) {
  const { t } = useTranslation('passes')
  const { toast } = useToast()
  const { can } = useAccess()
  const queryClient = useQueryClient()
  const invalidate = useInvalidatePasses()
  const canAct = can('reservations:update')
  const [toReject, setToReject] = useState<PassVisitView | null>(null)
  // Visitas cuya confirmación se pidió y el server dejó PENDING (la valida en segundo plano): se quedan en Pendientes
  // con el aviso y sin botones hasta que el refresco las traiga confirmadas.
  const [awaiting, setAwaiting] = useState<Record<string, true>>({})

  // Los días del filtro viajan TAL CUAL (AAAA-MM-DD, `to` inclusivo): la API los exige así y los convierte con la zona
  // del venue (P2-7). Nada de UTC ni de sumar un día aquí.
  const filters = useMemo<PassVisitsListFilters>(
    () => ({
      status: PASS_VISIT_TABS[tab],
      provider: provider ?? undefined,
      from: dateRange.from ?? undefined,
      to: dateRange.to ?? undefined,
    }),
    [tab, provider, dateRange.from, dateRange.to],
  )
  const query = usePassVisits(venueId, filters)
  const items = useMemo(() => dedupeById(query.data?.pages.flatMap(p => p.items) ?? []), [query.data?.pages])
  const total = query.data?.pages[0]?.total ?? 0
  const hasFilters = !!provider || !!dateRange.from || !!dateRange.to
  const stale = query.isPlaceholderData

  // Sin vista general (cargando o fallida) no se apaga nada: el 409 del server sigue cuidando el caso.
  const overview = usePassIntegrationsOverview(venueId)
  const inactiveProviders = useMemo(
    () => new Set(overview.data?.connections.filter(c => c.status !== 'ACTIVE').map(c => c.provider) ?? []),
    [overview.data],
  )

  // Al llegar a cero la cuenta regresiva de una fila se vuelve a pedir la lista: el server ya la venció y sale de Pendientes.
  const refreshList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: passesKeys.visits(venueId, filters) })
  }, [queryClient, venueId, filters])

  const providerName = (v: PassVisitView) => t(`providers.${v.provider}`)
  // El `message` del server, tal cual (en español: plazo vencido, conexión no activa, asistencia que no se pudo deshacer…).
  const showError = (error: unknown) => toast({ variant: 'destructive', title: apiErrorDescription(error) || t('errors.generic') })
  const confirm = useMutation({
    mutationFn: (visitId: string) => confirmPassVisit(venueId, visitId),
    // La respuesta es la visita COMO QUEDÓ. Sólo CONFIRMED/ALREADY_CONFIRMED es éxito; PENDING es «solicitada»; EXPIRED, venció.
    onSuccess: result => {
      if (result.status === 'PENDING') {
        setAwaiting(a => ({ ...a, [result.id]: true }))
        toast({ title: t('visits.confirmRequested', { provider: providerName(result) }) })
      } else if (result.status === 'CONFIRMED' || result.status === 'ALREADY_CONFIRMED') {
        toast({ title: t('visits.confirmed') })
      } else if (result.status === 'EXPIRED') {
        toast({ variant: 'destructive', title: t('visits.confirmExpired', { provider: providerName(result) }) })
      } else {
        toast({ variant: 'destructive', title: t('visits.unexpectedStatus', { status: t(`visits.status.${result.status}`) }) })
      }
      // Devolver la promesa: isPending dura hasta que la lista nueva llegó (P2-8).
      return invalidate(venueId, 'visit')
    },
    // R2b-17: tras un error la fila también se pone al día (otra recepción pudo resolverla) antes de rehabilitar. Si el server
    // dijo que la conexión no está activa, la vista general estaba vieja: se vuelve a pedir y Confirmar se apaga (R2b-23).
    onError: (error: unknown) => {
      showError(error)
      return Promise.all([
        invalidate(venueId, 'visit'),
        errorCode(error) === 'PASS_CONNECTION_NOT_ACTIVE' && queryClient.invalidateQueries({ queryKey: passesKeys.overview(venueId) }),
      ])
    },
  })
  const reject = useMutation({
    mutationFn: (visitId: string) => rejectPassVisit(venueId, visitId),
    onSuccess: result => {
      setToReject(null)
      if (result.status === 'REJECTED') toast({ title: t('visits.rejected') })
      else toast({ variant: 'destructive', title: t('visits.unexpectedStatus', { status: t(`visits.status.${result.status}`) }) })
      return invalidate(venueId, 'visit')
    },
    onError: (error: unknown) => {
      setToReject(null)
      showError(error)
      return invalidate(venueId, 'visit')
    },
  })
  const acting = confirm.isPending || reject.isPending

  if (query.isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground" role="status" aria-label={t('common:loading')}>
        <Loader2 className="h-5 w-5 animate-spin" /> {t('common:loading')}
      </div>
    )
  }
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('visits.loadError')}</AlertTitle>
        <AlertDescription>{apiErrorDescription(query.error) || t('errors.generic')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {stale && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('visits.updating')}
        </p>
      )}
      <Card className="border-input shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-input">
                <TableHead>{t('visits.columns.member')}</TableHead>
                <TableHead>{t('visits.columns.class')}</TableHead>
                <TableHead>{t('visits.columns.arrived')}</TableHead>
                <TableHead>{t('visits.columns.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(visit => (
                <VisitRow
                  key={visit.id}
                  visit={visit}
                  canAct={canAct && !stale}
                  acting={acting}
                  awaiting={!!awaiting[visit.id]}
                  connectionInactive={inactiveProviders.has(visit.provider)}
                  onConfirm={() => confirm.mutate(visit.id)}
                  onReject={() => setToReject(visit)}
                  onExpired={refreshList}
                />
              ))}
              {items.length === 0 && !stale && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    {hasFilters ? t('visits.noMatches') : t(`visits.empty.${tab}`)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t('visits.total', { count: total })}</p>
        {query.hasNextPage && !stale && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            data-tour="passes-visits-load-more"
          >
            {query.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('visits.loadMore')}
          </Button>
        )}
      </div>

      <AlertDialog open={!!toReject} onOpenChange={open => !open && setToReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('visits.rejectTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('visits.rejectBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toReject && reject.mutate(toReject.id)}
              data-tour="passes-visit-reject-confirm"
            >
              {t('visits.rejectConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface VisitRowProps {
  visit: PassVisitView
  canAct: boolean
  acting: boolean
  awaiting: boolean
  connectionInactive: boolean
  onConfirm: () => void
  onReject: () => void
  onExpired: () => void
}

function VisitRow({ visit, canAct, acting, awaiting, connectionInactive, onConfirm, onReject, onExpired }: VisitRowProps) {
  const { t } = useTranslation('passes')
  const { formatDateTime, formatTime } = useVenueDateTime()
  const pending = visit.status === 'PENDING'
  const { label, expired } = useCountdown(pending ? visit.deadlineAt : null)
  // Vencida en pantalla: se apagan los botones (el server calculó canConfirm al responder) y se vuelve a pedir la lista UNA
  // vez (los deps no cambian con un refetch que traiga la misma visita, así que no hay bucle).
  useEffect(() => {
    if (pending && expired) onExpired()
  }, [pending, expired, onExpired])
  const actionable = canAct && pending && visit.canConfirm && !expired && !awaiting
  const confirmedByKey = visit.confirmedBy ? CONFIRMED_BY_KEYS[visit.confirmedBy] : undefined
  const providerName = t(`providers.${visit.provider}`)
  // Un rechazo deja «Rechazada por el estudio» en lastError: es una nota, no un error.
  const showLastError = !!visit.lastError && visit.status !== 'REJECTED'

  return (
    <TableRow className="border-input">
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{visit.memberName ?? t('visits.unknownMember')}</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {providerName}
          </Badge>
        </div>
        {showLastError && <p className="mt-0.5 text-xs text-destructive">{t('visits.lastError', { error: visit.lastError })}</p>}
      </TableCell>
      <TableCell className="text-sm">
        {visit.reservation ? (
          <>
            <div>{visit.reservation.productName ?? '—'}</div>
            <div className="text-xs text-muted-foreground">{formatDateTime(visit.reservation.startsAt)}</div>
          </>
        ) : (
          <span className="text-muted-foreground">{t('visits.noClass')}</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDateTime(visit.startedAt)}</TableCell>
      <TableCell className="text-sm">
        {pending ? (
          expired ? (
            <Badge variant="destructive">{t('visits.expiredLabel')}</Badge>
          ) : awaiting ? (
            <div>
              <Badge variant="secondary">{t('visits.status.PENDING')}</Badge>
              <p className="text-xs text-muted-foreground">{t('visits.confirmRequested', { provider: providerName })}</p>
            </div>
          ) : (
            <div>
              <span className="font-mono tabular-nums">{label}</span>
              <div className="text-xs text-muted-foreground">{t('visits.deadlineAt', { time: formatTime(visit.deadlineAt) })}</div>
            </div>
          )
        ) : (
          <div>
            <Badge variant={visit.status === 'CONFIRMED' || visit.status === 'ALREADY_CONFIRMED' ? 'secondary' : 'outline'}>
              {t(`visits.status.${visit.status}`)}
            </Badge>
            {confirmedByKey && <div className="text-xs text-muted-foreground">{t(confirmedByKey)}</div>}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        {actionable && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={onConfirm} disabled={acting || connectionInactive} data-tour="passes-visit-confirm">
                {t('visits.confirm')}
              </Button>
              <Button size="sm" variant="outline" onClick={onReject} disabled={acting} data-tour="passes-visit-reject">
                {t('visits.reject')}
              </Button>
            </div>
            {connectionInactive && (
              <p className="max-w-64 text-right text-xs text-muted-foreground">{t('visits.connectionInactive', { provider: providerName })}</p>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}
