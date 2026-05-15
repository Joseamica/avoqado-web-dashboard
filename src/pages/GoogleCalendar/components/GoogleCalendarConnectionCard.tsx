import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Calendar, CheckCircle2, HelpCircle, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import googleCalendarService, {
  type ConnectionStatus,
  type GoogleCalendarConnection,
  type OAuthIntent,
} from '@/services/googleCalendar.service'

// -----------------------------------------------------------------------------
// Reusable card that surfaces a single Google Calendar connection. The same
// component renders inside Reservation Settings (venue master) and Mi Cuenta
// (staff personal). Behavior differs only in:
//   - which OAuth intent the connect button triggers (`venue_master` vs `staff_personal`)
//   - which permission gates the connect button
//   - which `connection` we render (the caller filters listConnections)
//
// Visual identity intentionally diverges from the existing Google Business
// Profile card: a CalendarIcon header chip + neutral surface, never the
// store/business iconography from /settings/google-integration. Users must
// experience these as two clearly different integrations because they ARE two
// different integrations (separate OAuth apps, separate scopes).
// -----------------------------------------------------------------------------

export type GoogleCalendarConnectionCardProps = {
  /** Variant determines copy + which intent the connect button uses. */
  variant: 'venue' | 'personal'
  /** Already-filtered connection for this card (null = not connected yet). */
  connection: GoogleCalendarConnection | null
  /** Loading state from the parent's listConnections query. */
  isLoading?: boolean
  /** Permission required to initiate the OAuth flow. */
  requiredPermission: string
}

const STATUS_TO_VARIANT: Record<ConnectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CONNECTED: 'default',
  TOKEN_REVOKED: 'destructive',
  CALENDAR_LOST: 'destructive',
  WATCH_FAILED: 'destructive',
  DISCONNECTED: 'outline',
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const { t } = useTranslation('googleCalendar')
  const variant = STATUS_TO_VARIANT[status] ?? 'outline'
  const labelKey: Record<ConnectionStatus, string> = {
    CONNECTED: 'status.connected',
    TOKEN_REVOKED: 'status.tokenRevoked',
    CALENDAR_LOST: 'status.calendarLost',
    WATCH_FAILED: 'status.watchFailed',
    DISCONNECTED: 'status.disconnected',
  }
  const Icon = status === 'CONNECTED' ? CheckCircle2 : status === 'DISCONNECTED' ? XCircle : AlertTriangle
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {t(labelKey[status])}
    </Badge>
  )
}

function HelpTooltip({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Más información"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function GoogleCalendarConnectionCard({
  variant,
  connection,
  isLoading,
  requiredPermission,
}: GoogleCalendarConnectionCardProps) {
  const { t } = useTranslation('googleCalendar')
  const { toast } = useToast()
  const { formatDateTime } = useVenueDateTime()
  const queryClient = useQueryClient()
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const intent: OAuthIntent = variant === 'venue' ? 'venue_master' : 'staff_personal'

  // ---------------------------------------------------------------------------
  // Connect — POST /oauth/init, then full-page redirect to Google. We don't try
  // to open a popup: Google's consent flow needs a top-level redirect to avoid
  // cookie/sandbox issues, and the picker page handles the return trip.
  // ---------------------------------------------------------------------------
  const connectMutation = useMutation({
    mutationFn: () => googleCalendarService.initOAuth(intent),
    onSuccess: data => {
      window.location.href = data.url
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('toast.connectFailed'),
        description: err?.response?.data?.message ?? undefined,
      })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => {
      if (!connection) throw new Error('No connection to disconnect')
      return googleCalendarService.disconnectConnection(connection.id)
    },
    onSuccess: () => {
      toast({ title: t('toast.disconnected') })
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'connections'] })
      setShowDisconnectConfirm(false)
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('toast.disconnectFailed'),
        description: err?.response?.data?.message ?? undefined,
      })
    },
  })

  const title = variant === 'venue' ? t('venue.title') : t('personal.title')
  const description = variant === 'venue' ? t('venue.description') : t('personal.description')

  const isHealthy = connection?.status === 'CONNECTED'
  const showReconnect =
    connection &&
    (connection.status === 'TOKEN_REVOKED' ||
      connection.status === 'CALENDAR_LOST' ||
      connection.status === 'WATCH_FAILED')

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="rounded-md bg-muted p-2 shrink-0">
                <Calendar className="h-5 w-5 text-foreground" />
              </div>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <span className="truncate">{title}</span>
                  <HelpTooltip>{t('differentFromBusiness')}</HelpTooltip>
                </CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
            </div>
            {connection ? <StatusBadge status={connection.status} /> : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('picker.loading')}</span>
            </div>
          ) : connection ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('status.accountLabel')}</p>
                  <p className="font-medium text-foreground truncate">{connection.googleAccountEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('status.calendarLabel')}</p>
                  <p className="font-medium text-foreground truncate">
                    {connection.selectedCalendarSummary || connection.selectedCalendarId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('status.timezoneLabel')}</p>
                  <p className="font-medium text-foreground">{connection.selectedCalendarTimeZone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('status.lastSyncedAt', {
                      date: connection.lastSyncedAt ? formatDateTime(connection.lastSyncedAt) : t('status.never'),
                    })}
                  </p>
                </div>
              </div>

              {showReconnect && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/40">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-amber-900 dark:text-amber-100 flex-1">
                    {connection.statusReason ?? t('toast.connectFailed')}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {/* type="button" is required because this card may be rendered
                    inside a parent <form> (Reservation Settings). Without it,
                    clicking Disconnect/Reconnect would submit the surrounding
                    settings form. */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDisconnectConfirm(true)}
                  disabled={disconnectMutation.isPending}
                >
                  {t('actions.disconnect')}
                </Button>
                {showReconnect && (
                  <PermissionGate permission={requiredPermission}>
                    <Button
                      type="button"
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending}
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {t('actions.reconnect')}
                    </Button>
                  </PermissionGate>
                )}
              </div>
              {!isHealthy && !showReconnect && (
                <p className="text-xs text-muted-foreground">{connection.statusReason}</p>
              )}
            </>
          ) : (
            <PermissionGate
              permission={requiredPermission}
              fallback={
                <p className="text-sm text-muted-foreground">
                  {/* Intentionally no fallback CTA — without the permission the user
                      can't initiate OAuth, so we let the card stand as informational. */}
                  {t('differentFromBusiness')}
                </p>
              }
            >
              <Button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                {t('actions.connect')}
              </Button>
            </PermissionGate>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDisconnectConfirm}
        onOpenChange={setShowDisconnectConfirm}
        title={t('disconnect.confirmTitle')}
        description={t('disconnect.confirmDescription')}
        confirmText={t('disconnect.confirmAction')}
        cancelText={t('disconnect.cancel')}
        variant="destructive"
        onConfirm={() => disconnectMutation.mutate()}
      />
    </>
  )
}

export default GoogleCalendarConnectionCard
