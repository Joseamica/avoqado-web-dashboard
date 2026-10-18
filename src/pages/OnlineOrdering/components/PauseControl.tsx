import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { onlineOrderingKeys, pauseOrdering, serverMessage } from '@/services/onlineOrdering.service'
import type { PauseMinutes, StoreState } from '@/types/onlineOrdering'
import { useVenueDateTime } from '@/utils/datetime'

const OPTIONS: PauseMinutes[] = [15, 30, 60]

/**
 * Pausa corta desde la bandeja (`online-orders:pause`, sin plan: R14). La pausa del gerente (`manualPause`, Configuración) no se
 * quita desde aquí: se dice y se oculta «Reanudar». Sin permiso sólo se ve el estado.
 */
export function PauseControl({ venueId, store, canPause }: { venueId: string; store: StoreState | null; canPause: boolean }) {
  const { t } = useTranslation('onlineOrdering')
  const { toast } = useToast()
  const { formatTime } = useVenueDateTime()
  const queryClient = useQueryClient()

  const pause = useMutation({
    mutationFn: (minutes: PauseMinutes) => pauseOrdering(venueId, minutes),
    onSuccess: () => {
      // La pausa se lee en la bandeja (`store`) y en Configuración (`pausedUntil`/`manualPause`).
      queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) })
      queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.settings(venueId) })
    },
    onError: (error: unknown) =>
      (error as { response?: unknown })?.response
        ? toast({ title: serverMessage(error, t('inbox.pause.failed')), variant: 'destructive' })
        : toast({ title: t('inbox.outcome.network') }),
  })

  if (store?.manualPause) return <p className="text-sm font-medium">{t('inbox.pause.manual')}</p>

  if (store?.status === 'PAUSED' && store.reason === 'MANUAL_PAUSE' && store.pausedUntil) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('inbox.pause.until', { time: formatTime(store.pausedUntil) })}</span>
        {canPause && (
          <Button size="sm" variant="outline" disabled={pause.isPending} onClick={() => pause.mutate(null)} data-tour="online-inbox-resume">
            {t('inbox.pause.resume')}
          </Button>
        )}
      </div>
    )
  }

  if (!canPause) return null
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
