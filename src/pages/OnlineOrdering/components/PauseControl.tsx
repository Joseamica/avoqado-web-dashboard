import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { onlineOrderingKeys, pauseOrdering, serverMessage } from '@/services/onlineOrdering.service'
import type { PauseMinutes, StoreState } from '@/types/onlineOrdering'

const OPTIONS: PauseMinutes[] = [15, 30, 60]

/**
 * Botones de pausa corta de la bandeja (`online-orders:pause`, sin plan: R14). El texto de la pausa lo pone la cabecera
 * (`pauseLabel`). La pausa del gerente (`manualPause`, Configuración) no se quita desde aquí; con la tienda apagada o sin estado
 * no hay nada que pausar.
 */
export function PauseControl({ venueId, store, canPause }: { venueId: string; store: StoreState | null; canPause: boolean }) {
  const { t } = useTranslation('onlineOrdering')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const pause = useMutation({
    mutationFn: (minutes: PauseMinutes) => pauseOrdering(venueId, minutes),
    // La pausa se lee en la bandeja (`store`) y en Configuración; se espera al refresco para no reactivar con el estado viejo.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) }),
        queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.settings(venueId) }),
      ]),
    onError: (error: unknown) =>
      (error as { response?: unknown })?.response
        ? toast({ title: serverMessage(error, t('inbox.pause.failed')), variant: 'destructive' })
        : toast({ title: t('inbox.outcome.network') }),
  })

  if (!canPause || !store || store.status === 'DISABLED' || store.manualPause) return null

  if (store.status === 'PAUSED' && store.reason === 'MANUAL_PAUSE' && store.pausedUntil) {
    return (
      <Button size="sm" variant="outline" disabled={pause.isPending} onClick={() => pause.mutate(null)} data-tour="online-inbox-resume">
        {t('inbox.pause.resume')}
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-tour="online-inbox-pause">
      <span className="text-sm text-muted-foreground">{t('inbox.pause.label')}</span>
      {OPTIONS.map(m => (
        <Button key={m} size="sm" variant="outline" className="rounded-full" disabled={pause.isPending} onClick={() => pause.mutate(m)}>
          {t('inbox.pause.minutes', { minutes: m })}
        </Button>
      ))}
    </div>
  )
}
