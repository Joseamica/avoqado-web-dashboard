import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Monitor, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useAccess } from '@/hooks/use-access'
import { tpvSettingsService, TpvSettings, TpvSettingsUpdate } from '@/services/tpv-settings.service'
import { TpvSettingsFields } from '@/components/tpv/TpvSettingsFields'

interface TpvSettingsFormProps {
  tpvId: string
  /** Compact mode for embedding in other pages (e.g., TpvId) */
  compact?: boolean
  /** Called after a setting is successfully saved, so the parent can prompt a TPV restart */
  onSettingChanged?: () => void
}

export function TpvSettingsForm({ tpvId, compact = false, onSettingChanged }: TpvSettingsFormProps) {
  const { t } = useTranslation('tpv')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = useAccess()

  const canUpdate = can('tpv-settings:update')

  // Fetch current settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tpvSettings', tpvId],
    queryFn: () => tpvSettingsService.getSettings(tpvId),
    enabled: !!tpvId,
  })

  // Fetch merchants assigned to this terminal for kiosk dropdown (only when kiosk enabled)
  const { data: terminalMerchants = [] } = useQuery({
    queryKey: ['terminalMerchants', tpvId],
    queryFn: () => tpvSettingsService.getTerminalMerchants(tpvId),
    enabled: !!tpvId && settings?.kioskModeEnabled,
  })

  // Update mutation with optimistic updates
  const updateMutation = useMutation({
    mutationFn: (update: TpvSettingsUpdate) => tpvSettingsService.updateSettings(tpvId, update),
    onMutate: async update => {
      await queryClient.cancelQueries({ queryKey: ['tpvSettings', tpvId] })
      const previousSettings = queryClient.getQueryData<TpvSettings>(['tpvSettings', tpvId])
      if (previousSettings) {
        queryClient.setQueryData<TpvSettings>(['tpvSettings', tpvId], {
          ...previousSettings,
          ...update,
        })
      }
      return { previousSettings }
    },
    onError: (_error, _update, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['tpvSettings', tpvId], context.previousSettings)
      }
      toast({
        title: t('tpvSettings.updateError'),
        variant: 'destructive',
      })
    },
    onSuccess: () => {
      toast({
        title: t('tpvSettings.updateSuccess'),
      })
      onSettingChanged?.()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tpvSettings', tpvId] })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {compact ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('tpvSettings.loadError')}</AlertDescription>
      </Alert>
    )
  }

  if (!settings) {
    return null
  }

  const content = (
    <>
      <TpvSettingsFields
        settings={settings}
        onUpdate={updates => updateMutation.mutate(updates)}
        disabled={!canUpdate}
        isPending={updateMutation.isPending}
        mode="terminal"
        merchants={terminalMerchants}
      />
      {/* Permission warning */}
      {!canUpdate && (
        <Alert className="mt-4 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">{t('tpvSettings.noUpdatePermission')}</AlertDescription>
        </Alert>
      )}
    </>
  )

  if (compact) {
    return content
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          <CardTitle>{t('tpvSettings.title')}</CardTitle>
        </div>
        <CardDescription>{t('tpvSettings.description')}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

export default TpvSettingsForm
