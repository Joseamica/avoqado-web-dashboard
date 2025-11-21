import api from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

interface GoogleIntegrationStatus {
  connected: boolean
  email?: string
  locationName?: string
  placeId?: string
  lastSyncAt?: string
  reviewsCount?: number
}

export default function GoogleIntegration() {
  const { t } = useTranslation('googleIntegration')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  // Check for success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'true') {
      toast({
        title: t('success.connected'),
        description: t('status.connected'),
      })
      // Clear URL params
      setSearchParams({})
      // Refresh status
      queryClient.invalidateQueries({ queryKey: ['google-integration', venueId] })
    } else if (error) {
      let errorMessage = t('errors.connectionFailed')
      if (error === 'no_locations') {
        errorMessage = t('errors.noLocations')
      } else if (error === 'unauthorized') {
        errorMessage = t('errors.unauthorized')
      }

      toast({
        variant: 'destructive',
        title: t('errors.connectionFailed'),
        description: errorMessage,
      })
      setSearchParams({})
    }
  }, [searchParams, setSearchParams, toast, t, queryClient, venueId])

  // Fetch integration status
  const { data: integrationStatus, isLoading } = useQuery<GoogleIntegrationStatus>({
    queryKey: ['google-integration', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/integrations/google/status`)
      return response.data
    },
    enabled: !!venueId,
  })

  // Init OAuth mutation
  const initOAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/integrations/google/init-oauth`)
      return response.data
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth consent screen
      window.location.href = data.authUrl
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('errors.connectionFailed'),
        description: error.response?.data?.message || error.message,
      })
    },
  })

  // Sync now mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/integrations/google/sync`)
      return response.data
    },
    onSuccess: (data) => {
      toast({
        title: t('success.synced'),
        description: t('connectedInfo.reviewsCount', { count: data.syncedCount || 0 }),
      })
      queryClient.invalidateQueries({ queryKey: ['google-integration', venueId] })
      queryClient.invalidateQueries({ queryKey: ['reviews', venueId] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('errors.syncFailed'),
        description: error.response?.data?.message || error.message,
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/v1/dashboard/venues/${venueId}/integrations/google/disconnect`)
    },
    onSuccess: () => {
      toast({
        title: t('success.disconnected'),
      })
      queryClient.invalidateQueries({ queryKey: ['google-integration', venueId] })
      setShowDisconnectConfirm(false)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('errors.disconnectFailed'),
        description: error.response?.data?.message || error.message,
      })
    },
  })

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return t('connectedInfo.never')
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('status.title')}</CardTitle>
              <CardDescription>
                {integrationStatus?.connected ? t('status.connected') : t('status.notConnected')}
              </CardDescription>
            </div>
            {integrationStatus?.connected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t('status.connectedBadge')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                {t('status.notConnectedBadge')}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {integrationStatus?.connected ? (
            <>
              {/* Connected Info */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{t('connectedInfo.account')}</p>
                  <p className="text-sm text-muted-foreground">{integrationStatus.email}</p>
                </div>

                {integrationStatus.locationName && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{t('connectedInfo.businessLocation')}</p>
                    <p className="text-sm text-muted-foreground">{integrationStatus.locationName}</p>
                    {integrationStatus.placeId && (
                      <p className="text-xs text-muted-foreground/70">{integrationStatus.placeId}</p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{t('connectedInfo.lastSync')}</p>
                  <p className="text-sm text-muted-foreground">{formatLastSync(integrationStatus.lastSyncAt)}</p>
                </div>

                {integrationStatus.reviewsCount !== undefined && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Google Reviews</p>
                    <p className="text-sm text-muted-foreground">
                      {t('connectedInfo.reviewsCount', { count: integrationStatus.reviewsCount })}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowDisconnectConfirm(true)} disabled={disconnectMutation.isPending}>
                  {t('actions.disconnect')}
                </Button>
                <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                  {syncMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('actions.syncing')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('actions.syncNow')}
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Authorization Info */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{t('authorization.title')}</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-muted-foreground">{t('authorization.readReviews')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-muted-foreground">{t('authorization.postResponses')}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-muted-foreground">{t('authorization.accessInfo')}</span>
                  </li>
                </ul>
              </div>

              {/* Connect Button */}
              <Button
                onClick={() => initOAuthMutation.mutate()}
                disabled={initOAuthMutation.isPending}
                className="w-full"
                size="lg"
              >
                {initOAuthMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('actions.connect')}
                  </>
                ) : (
                  <>
                    {t('actions.connect')}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('instructions.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t('instructions.step1.title')}</p>
            <p className="text-sm text-muted-foreground">{t('instructions.step1.description')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t('instructions.step2.title')}</p>
            <p className="text-sm text-muted-foreground">{t('instructions.step2.description')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t('instructions.step3.title')}</p>
            <p className="text-sm text-muted-foreground">{t('instructions.step3.description')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t('instructions.step4.title')}</p>
            <p className="text-sm text-muted-foreground">{t('instructions.step4.description')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Requirements Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('requirements.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{t('requirements.verified')}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{t('requirements.owner')}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{t('requirements.active')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Benefits Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('benefits.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span className="text-muted-foreground">{t('benefits.autoSync')}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span className="text-muted-foreground">{t('benefits.centralResponse')}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span className="text-muted-foreground">{t('benefits.aiPowered')}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span className="text-muted-foreground">{t('benefits.analytics')}</span>
          </div>
        </CardContent>
      </Card>

      {/* External Link to Google Business */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Google Business Profile</p>
              <p className="text-xs text-muted-foreground">Manage your profile on Google</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="https://business.google.com" target="_blank" rel="noopener noreferrer">
                Open
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        open={showDisconnectConfirm}
        onOpenChange={setShowDisconnectConfirm}
        title={t('confirm.disconnect.title')}
        description={t('confirm.disconnect.description')}
        confirmText={t('confirm.disconnect.confirm')}
        cancelText={t('confirm.disconnect.cancel')}
        variant="destructive"
        onConfirm={() => disconnectMutation.mutate()}
      />
    </div>
  )
}
