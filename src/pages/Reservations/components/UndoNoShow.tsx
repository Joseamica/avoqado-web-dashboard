import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, FileText, Loader2, Lock, Ticket, Undo2, type LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import reservationService from '@/services/reservation.service'
import type { NoShowCorrectionSummary, UndoNoShowPlan } from '@/types/reservation'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

// D4 «Sí llegó»: deshacer un «No Show». Dos piezas que comparten el detalle de la reserva y la lista de la clase:
//  - UndoNoShowButton: el botón + su confirmación (qué se revierte, con SÓLO los renglones que aplican) + el aviso de pases.
//  - NoShowPendingBanner: la franja ámbar con lo que una persona todavía tiene que resolver y «Marcar resuelto».
// Permiso de las dos acciones: `reservations:update` (el SERVIDOR lo vuelve a exigir).

const PASS_BOOKING = 'NO_SHOW_UNDO_PASS_BOOKING'
const NOT_APPLICABLE = 'NO_SHOW_UNDO_NOT_APPLICABLE'
const AMBER_PANEL = 'rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/40'

const errorCode = (error: any): string | undefined => {
  const data = error?.response?.data
  return data?.code ?? data?.errorCode ?? data?.error?.code
}

/** Qué se vuelve a leer después de deshacer o de resolver (el detalle, las listas, el calendario y la clase). */
function useRefreshAfterCorrection(venueId: string, reservationId: string, classSessionId?: string | null) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['reservation', venueId, reservationId] })
    queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
    // Un No Show que pasa a CHECKED_IN cuenta en `enrolled` de la lista de clases.
    queryClient.invalidateQueries({ queryKey: ['class-sessions', venueId] })
    if (classSessionId) queryClient.invalidateQueries({ queryKey: ['class-session', venueId, classSessionId] })
    queryClient.invalidateQueries({ queryKey: ['reservation-calendar', venueId] })
  }
}

/** Texto de un pendiente; un código que este panel no conoce (server más nuevo) cae en un aviso genérico, nunca en el código crudo. */
function usePendingText() {
  const { t } = useTranslation('reservations')
  return (code: string) => t(`undoNoShow.pending.${code}`, { defaultValue: t('undoNoShow.pending.OTHER') })
}

/**
 * Texto de un error de «Sí llegó». Los dos 409 que el panel conoce salen traducidos; el mensaje crudo del servidor
 * (en español, sin traducir) sólo se usa como último recurso, para un código que este panel todavía no conoce.
 */
function useErrorText() {
  const { t } = useTranslation('reservations')
  return (error: any): string => {
    const code = errorCode(error)
    if (code === NOT_APPLICABLE) return t('undoNoShow.notApplicable')
    if (code === PASS_BOOKING) return t('undoNoShow.passBooking')
    return error?.response?.data?.message || t('toasts.error')
  }
}

function PlanRow({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </li>
  )
}

interface UndoNoShowButtonProps {
  venueId: string
  reservationId: string
  guestName: string
  /** Nombre de la clase o servicio; sin él la confirmación dice «su reserva». */
  serviceName?: string | null
  startsAt: string
  classSessionId?: string | null
  size?: 'default' | 'sm'
  variant?: 'default' | 'outline'
}

export function UndoNoShowButton({
  venueId,
  reservationId,
  guestName,
  serviceName,
  startsAt,
  classSessionId,
  size = 'default',
  variant = 'default',
}: UndoNoShowButtonProps) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { can } = useAccess()
  const { toast } = useToast()
  const { formatTime } = useVenueDateTime()
  const refresh = useRefreshAfterCorrection(venueId, reservationId, classSessionId)
  const pendingText = usePendingText()
  const errorText = useErrorText()
  const [plan, setPlan] = useState<UndoNoShowPlan | null>(null)
  const [passNotice, setPassNotice] = useState(false)
  // Candado SÍNCRONO de la vista previa y de aplicar (full-testing, 28-oct): un doble clic mandaba dos peticiones porque el
  // `isPending` de React llega después del segundo clic. Se suelta en `onSettled`.
  const enVuelo = useRef(false)

  // La vista previa no escribe nada: sólo calcula qué se revertiría y qué quedaría pendiente.
  const previewMutation = useMutation({
    mutationFn: () => reservationService.previewUndoNoShow(venueId, reservationId),
    onSettled: () => {
      enVuelo.current = false
    },
    onSuccess: ({ plan: nextPlan }) => setPlan(nextPlan),
    onError: (error: any) => {
      if (errorCode(error) === PASS_BOOKING) {
        setPassNotice(true)
        return
      }
      // Ya no aplica (otra persona la corrigió, o cambió de estado): se dice y se vuelve a leer para que la pantalla no mienta.
      toast({ title: tCommon('error'), description: errorText(error), variant: 'destructive' })
      refresh()
    },
  })

  const undoMutation = useMutation({
    mutationFn: () => reservationService.undoNoShow(venueId, reservationId),
    onSettled: () => {
      enVuelo.current = false
    },
    onSuccess: result => {
      // Con un pendiente abierto el aviso lo lleva: desde la lista de la clase la fila desaparece y, si no, nadie lo vería.
      const abiertos = result.correction.resolvedAt ? [] : result.correction.pending
      toast({
        title: result.outcome === 'ALREADY_UNDONE' ? t('undoNoShow.alreadyUndone') : t('undoNoShow.success'),
        description: abiertos.length > 0 ? abiertos.map(pendingText).join(' · ') : undefined,
      })
      setPlan(null)
      refresh()
    },
    onError: (error: any) => {
      toast({ title: tCommon('error'), description: errorText(error), variant: 'destructive' })
      setPlan(null)
      refresh()
    },
  })

  if (!can('reservations:update')) return null

  /** Corre `accion` sólo si no hay otra petición de este botón en vuelo. */
  const sinDobleClic = (accion: () => void) => {
    if (enVuelo.current) return
    enVuelo.current = true
    accion()
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className="shrink-0"
        onClick={() => sinDobleClic(() => previewMutation.mutate())}
        disabled={previewMutation.isPending || undoMutation.isPending}
      >
        {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
        {t('undoNoShow.button')}
      </Button>

      {/* Qué se revierte: sólo los renglones que aplican. La bitácora siempre aplica. */}
      <AlertDialog open={plan !== null} onOpenChange={open => !open && !undoMutation.isPending && setPlan(null)}>
        <AlertDialogContent>
          {plan && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('undoNoShow.title', {
                    name: guestName,
                    className: serviceName || t('undoNoShow.defaultClassName'),
                    time: formatTime(startsAt),
                  })}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('undoNoShow.intro')}</AlertDialogDescription>
              </AlertDialogHeader>
              <ul className="space-y-2 text-sm">
                {/* Con el dato (paquete, monto) el renglón lo dice; sin él —null, o un plan viejo sin la llave— queda genérico. */}
                {plan.creditToReconsume > 0 && (
                  <PlanRow icon={Ticket}>
                    {plan.packName
                      ? t('undoNoShow.rows.creditPack', { count: plan.creditToReconsume, packName: plan.packName })
                      : t('undoNoShow.rows.credit', { count: plan.creditToReconsume })}
                  </PlanRow>
                )}
                {plan.clearFee && (
                  <PlanRow icon={Banknote}>
                    {plan.feeAmount != null ? t('undoNoShow.rows.feeAmount', { amount: Currency(plan.feeAmount) }) : t('undoNoShow.rows.fee')}
                  </PlanRow>
                )}
                {plan.restoreDeposit && (
                  <PlanRow icon={Lock}>
                    {plan.depositAmount != null
                      ? t('undoNoShow.rows.depositAmount', { amount: Currency(plan.depositAmount) })
                      : t('undoNoShow.rows.deposit')}
                  </PlanRow>
                )}
                <PlanRow icon={FileText}>{t('undoNoShow.rows.log')}</PlanRow>
              </ul>
              {plan.pending.length > 0 && (
                <div role="note" className={AMBER_PANEL}>
                  <p className="font-medium">{t('undoNoShow.pendingIntro')}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {plan.pending.map(code => (
                      <li key={code}>{pendingText(code)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={undoMutation.isPending}>{tCommon('cancel')}</AlertDialogCancel>
                {/* preventDefault: el diálogo no se cierra hasta que el SERVIDOR contesta (y no hay segundo toque). */}
                <AlertDialogAction
                  onClick={e => {
                    e.preventDefault()
                    sinDobleClic(() => undoMutation.mutate())
                  }}
                  disabled={undoMutation.isPending}
                >
                  {undoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('undoNoShow.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Reserva de un pase (TotalPass/Wellhub): aquí no se corrige; en lugar de la confirmación sale este aviso. */}
      <AlertDialog open={passNotice} onOpenChange={setPassNotice}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('undoNoShow.passTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('undoNoShow.passBooking')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>{tCommon('close')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface NoShowPendingBannerProps {
  venueId: string
  reservationId: string
  correction: NoShowCorrectionSummary | null | undefined
  classSessionId?: string | null
}

/** Pendiente abierto = quedó algo por resolver y nadie lo ha cerrado. Una corrección limpia o ya resuelta no pinta nada. */
export function NoShowPendingBanner({ venueId, reservationId, correction, classSessionId }: NoShowPendingBannerProps) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { can } = useAccess()
  const { toast } = useToast()
  const refresh = useRefreshAfterCorrection(venueId, reservationId, classSessionId)
  const pendingText = usePendingText()
  const errorText = useErrorText()
  // Candado SÍNCRONO (mismo motivo que en «Sí llegó»): el segundo clic sale antes de que `isPending` apague el botón.
  const enVuelo = useRef(false)

  const resolveMutation = useMutation({
    mutationFn: () => reservationService.resolveNoShowCorrection(venueId, reservationId),
    onSettled: () => {
      enVuelo.current = false
    },
    onSuccess: () => {
      toast({ title: t('undoNoShow.resolved') })
      refresh()
    },
    onError: (error: any) => {
      toast({ title: tCommon('error'), description: errorText(error), variant: 'destructive' })
      refresh()
    },
  })

  const resolver = () => {
    if (enVuelo.current) return
    enVuelo.current = true
    resolveMutation.mutate()
  }

  if (!correction || correction.pending.length === 0 || correction.resolvedAt != null) return null

  return (
    <div role="status" className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${AMBER_PANEL}`}>
      <div className="min-w-0">
        <p className="font-medium">{t('undoNoShow.bannerTitle')}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {correction.pending.map(code => (
            <li key={code}>{pendingText(code)}</li>
          ))}
        </ul>
      </div>
      {can('reservations:update') && (
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={resolver} disabled={resolveMutation.isPending}>
          {resolveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('undoNoShow.resolve')}
        </Button>
      )}
    </div>
  )
}
