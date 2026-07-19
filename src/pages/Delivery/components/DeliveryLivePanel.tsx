import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { Currency } from '@/utils/currency'
import { useToast } from '@/hooks/use-toast'
import { getDeliverySummary, pauseChannel, updateChannel } from '@/services/delivery.service'
import { providerLabel } from '../providerLabels'
import type { DeliveryChannelLink, DeliveryChannelStatus } from '@/types/delivery'

interface DeliveryLivePanelProps {
  venueId: string
  channels: DeliveryChannelLink[]
}

const STATUS_VARIANT: Record<DeliveryChannelStatus, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  PENDING: 'outline',
  DISABLED: 'outline',
}

const STATUS_LABEL_KEY: Record<DeliveryChannelStatus, string> = {
  ACTIVE: 'live.statusActive',
  PAUSED: 'live.statusPaused',
  PENDING: 'live.statusPending',
  DISABLED: 'live.statusDisabled',
}

/**
 * LIVE state: ≥1 `DeliveryChannelLink` ACTIVE. Per design spec §5.3: (a) today's stats strip per
 * channel, (b) one card per linked channel with pause/resume control, (c) a link into the
 * existing Orders view — reusing that table, NOT rebuilding it (Orders has no `source` filter
 * param yet, so this links plainly to `/orders`; wiring a real filter is a fast-follow — see
 * task-6 report).
 */
export function DeliveryLivePanel({ venueId, channels }: DeliveryLivePanelProps) {
  const { t } = useTranslation('delivery')
  const { can } = useAccess()
  // Pause/resume is `delivery-channels:manage` (OWNER/ADMIN — MANAGER reaches this panel via `:read`
  // but the backend 403s the pause). Without it the Switch renders disabled: the ACTIVE/PAUSED badge
  // still reads the status, but the control can't be operated (no dead 403 button).
  const canManage = can('delivery-channels:manage')
  const { fullBasePath } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['deliverySummary', venueId],
    queryFn: () => getDeliverySummary(venueId),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  const pauseMutation = useMutation({
    mutationFn: ({ linkId, paused }: { linkId: string; paused: boolean }) => pauseChannel(venueId, linkId, paused),
    onSuccess: (_data, variables) => {
      // Matches useDeliveryStatus's exact queryKey so the channel cards + LIVE/PENDING gate refresh.
      queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
      toast({ title: variables.paused ? t('live.pauseToastSuccess') : t('live.resumeToastSuccess') })
    },
    onError: (err: any) => {
      toast({
        title: t('live.pauseToastError'),
        description: err?.response?.data?.message ?? err?.message ?? '',
        variant: 'destructive',
      })
    },
  })

  const modeMutation = useMutation({
    mutationFn: ({ linkId, orderAcceptanceMode }: { linkId: string; orderAcceptanceMode: 'AUTO' | 'MANUAL' }) =>
      updateChannel(venueId, linkId, { orderAcceptanceMode }),
    onSuccess: () => {
      // Same queryKey as pauseMutation — keeps the card's displayed mode in sync with the server.
      queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
      toast({ title: t('live.modeToastSuccess') })
    },
    onError: (err: any) => {
      toast({
        title: t('live.modeToastError'),
        description: err?.response?.data?.message ?? err?.message ?? '',
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="space-y-6">
      {/* (a) Today's stats strip, per channel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('live.statsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : summaryError ? (
            // Distinguish a failed fetch from a genuine "no orders yet" — otherwise a transient
            // summary error would masquerade as zero delivery activity (Minor #1, task-6 review).
            <p className="text-sm text-destructive">{t('live.statsError')}</p>
          ) : !summary?.channels.length ? (
            <p className="text-sm text-muted-foreground">{t('live.statsEmpty')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {summary.channels.map(row => (
                <div key={row.channel} className="rounded-xl border border-input p-4">
                  <p className="text-sm font-medium text-muted-foreground">{providerLabel(row.channel)}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{Currency(row.totalPesos)}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.orders} {t('live.ordersLabel')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* (b) One card per linked channel, with pause/resume control */}
      <div>
        <h3 className="mb-3 text-base font-semibold">{t('live.channelsTitle')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map(channel => {
            const isTogglable = channel.status === 'ACTIVE' || channel.status === 'PAUSED'
            const isMutatingThis = pauseMutation.isPending && pauseMutation.variables?.linkId === channel.id
            return (
              <Card key={channel.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{providerLabel(channel.provider)}</p>
                    <Badge variant={STATUS_VARIANT[channel.status]}>{t(STATUS_LABEL_KEY[channel.status])}</Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      {t('live.lastSync')}: {channel.lastMenuSyncAt ? formatDateTime(channel.lastMenuSyncAt) : t('live.lastSyncNever')}
                    </p>
                  </div>

                  {/* Acceptance mode (AUTO/MANUAL) — editable via updateChannel. Gated by
                      delivery-channels:manage the same way as the pause Switch below: always
                      rendered, `disabled` (not hidden) without the permission. */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{t('live.modeLabel')}</span>
                    <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
                      {(['AUTO', 'MANUAL'] as const).map(mode => {
                        const isActive = channel.orderAcceptanceMode === mode
                        const isMutatingThisMode = modeMutation.isPending && modeMutation.variables?.linkId === channel.id
                        return (
                          <Button
                            key={mode}
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-pressed={isActive}
                            disabled={isMutatingThisMode || !canManage}
                            className={cn('h-6 px-2 text-[11px]', isActive && 'bg-primary text-primary-foreground hover:bg-primary/90')}
                            onClick={() => !isActive && modeMutation.mutate({ linkId: channel.id, orderAcceptanceMode: mode })}
                          >
                            {mode === 'AUTO' ? t('live.modeAuto') : t('live.modeManual')}
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  {isTogglable && (
                    <div className="flex items-center justify-between border-t border-input pt-3">
                      <span className="text-sm">{channel.status === 'ACTIVE' ? t('live.pauseAction') : t('live.resumeAction')}</span>
                      <Switch
                        checked={channel.status === 'ACTIVE'}
                        disabled={isMutatingThis || !canManage}
                        onCheckedChange={checked => pauseMutation.mutate({ linkId: channel.id, paused: !checked })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* (c) Link into the EXISTING Orders view — reused, not rebuilt. */}
      <Link to={`${fullBasePath}/orders`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        {t('live.viewOrders')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
