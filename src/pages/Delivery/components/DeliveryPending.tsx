import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { useVenueDateTime } from '@/utils/datetime'
import { providerLabel } from '../providerLabels'
import type { DeliveryActivationRequest } from '@/types/delivery'

interface DeliveryPendingProps {
  request: DeliveryActivationRequest
}

/**
 * PENDING state: the owner has a live activation request (PENDING/CONTACTED) but no channel is
 * ACTIVE yet. Read-only — "sin acciones" per the design spec (ops does the connection, not the
 * dashboard). The 3→4 transition to LIVE is automatic once ops connects a channel (readiness =
 * data, no flag to flip here).
 */
export function DeliveryPending({ request }: DeliveryPendingProps) {
  const { t } = useTranslation('delivery')
  const { formatDate } = useVenueDateTime()

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-400/15 text-amber-500">
          <Clock className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{t('pending.title')}</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('pending.description')}</p>
          <p className="text-xs text-muted-foreground">{t('pending.requestedOn', { date: formatDate(request.createdAt) })}</p>
        </div>

        {request.requestedChannels.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('pending.channelsLabel')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {request.requestedChannels.map(channel => (
                <span
                  key={channel}
                  className="rounded-full border border-input bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {providerLabel(channel)}
                </span>
              ))}
            </div>
          </div>
        )}

        {request.note && (
          <div className="w-full space-y-1 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('pending.noteLabel')}</p>
            <p className="rounded-lg border border-input bg-muted/40 p-3 text-sm text-muted-foreground">{request.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
