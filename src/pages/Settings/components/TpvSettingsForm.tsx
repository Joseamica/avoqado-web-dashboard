import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Monitor, Lightbulb, Receipt, Star, KeyRound, Percent, Info, Camera, Barcode, ShieldCheck } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { tpvSettingsService, TpvSettings, TpvSettingsUpdate } from '@/services/tpv-settings.service'

interface TpvSettingsFormProps {
  tpvId: string
  /** Compact mode for embedding in other pages (e.g., TpvId) */
  compact?: boolean
}

export function TpvSettingsForm({ tpvId, compact = false }: TpvSettingsFormProps) {
  const { t } = useTranslation('tpv')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = usePermissions()

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

  // Update mutation with optimistic updates
  const updateMutation = useMutation({
    mutationFn: (update: TpvSettingsUpdate) => tpvSettingsService.updateSettings(tpvId, update),
    onMutate: async (update) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tpvSettings', tpvId] })

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<TpvSettings>(['tpvSettings', tpvId])

      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData<TpvSettings>(['tpvSettings', tpvId], {
          ...previousSettings,
          ...update,
        })
      }

      return { previousSettings }
    },
    onError: (_error, _update, context) => {
      // Rollback on error
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
    },
    onSettled: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ['tpvSettings', tpvId] })
    },
  })

  const handleToggle = (field: keyof TpvSettings, value: boolean) => {
    if (!canUpdate) return
    updateMutation.mutate({ [field]: value })
  }

  const handleSelectChange = (value: string) => {
    if (!canUpdate) return
    const tipValue = value === 'none' ? null : parseInt(value, 10)
    updateMutation.mutate({ defaultTipPercentage: tipValue })
  }

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

  const tipOptions = settings.tipSuggestions || [15, 18, 20, 25]

  const SettingRow = ({
    icon: Icon,
    label,
    description,
    checked,
    onCheckedChange,
  }: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    description: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
  }) => (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={!canUpdate || updateMutation.isPending}
      />
    </div>
  )

  const content = (
    <div className="space-y-1">
      {/* Show Tip Screen */}
      <SettingRow
        icon={Lightbulb}
        label={t('tpvSettings.showTipScreen')}
        description={t('tpvSettings.showTipScreenDesc')}
        checked={settings.showTipScreen}
        onCheckedChange={(checked) => handleToggle('showTipScreen', checked)}
      />

      {/* Show Review Screen */}
      <SettingRow
        icon={Star}
        label={t('tpvSettings.showReviewScreen')}
        description={t('tpvSettings.showReviewScreenDesc')}
        checked={settings.showReviewScreen}
        onCheckedChange={(checked) => handleToggle('showReviewScreen', checked)}
      />

      {/* Show Receipt Screen */}
      <SettingRow
        icon={Receipt}
        label={t('tpvSettings.showReceiptScreen')}
        description={t('tpvSettings.showReceiptScreenDesc')}
        checked={settings.showReceiptScreen}
        onCheckedChange={(checked) => handleToggle('showReceiptScreen', checked)}
      />

      {/* Require PIN Login */}
      <SettingRow
        icon={KeyRound}
        label={t('tpvSettings.requirePinLogin')}
        description={t('tpvSettings.requirePinLoginDesc')}
        checked={settings.requirePinLogin}
        onCheckedChange={(checked) => handleToggle('requirePinLogin', checked)}
      />

      {/* Step 4: Sale Verification Section (for retail/telecomunicaciones) */}
      <div className="pt-2 mt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
          {t('tpvSettings.verificationSection')}
        </p>
      </div>

      {/* Show Verification Screen */}
      <SettingRow
        icon={ShieldCheck}
        label={t('tpvSettings.showVerificationScreen')}
        description={t('tpvSettings.showVerificationScreenDesc')}
        checked={settings.showVerificationScreen}
        onCheckedChange={(checked) => handleToggle('showVerificationScreen', checked)}
      />

      {/* Require Verification Photo - Only show if verification screen is enabled */}
      {settings.showVerificationScreen && (
        <SettingRow
          icon={Camera}
          label={t('tpvSettings.requireVerificationPhoto')}
          description={t('tpvSettings.requireVerificationPhotoDesc')}
          checked={settings.requireVerificationPhoto}
          onCheckedChange={(checked) => handleToggle('requireVerificationPhoto', checked)}
        />
      )}

      {/* Require Verification Barcode - Only show if verification screen is enabled */}
      {settings.showVerificationScreen && (
        <SettingRow
          icon={Barcode}
          label={t('tpvSettings.requireVerificationBarcode')}
          description={t('tpvSettings.requireVerificationBarcodeDesc')}
          checked={settings.requireVerificationBarcode}
          onCheckedChange={(checked) => handleToggle('requireVerificationBarcode', checked)}
        />
      )}

      {/* Default Tip Percentage - Only show if tip screen is enabled */}
      {settings.showTipScreen && (
        <div className="flex items-center justify-between py-3 border-b last:border-b-0">
          <div className="flex items-start gap-3">
            <Percent className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <Label className="text-sm font-medium">{t('tpvSettings.defaultTipPercentage')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t('tpvSettings.defaultTipPercentageDesc')}</p>
            </div>
          </div>
          <Select
            value={settings.defaultTipPercentage?.toString() ?? 'none'}
            onValueChange={handleSelectChange}
            disabled={!canUpdate || updateMutation.isPending}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('tpvSettings.noDefaultTip')}</SelectItem>
              {tipOptions.map((tip) => (
                <SelectItem key={tip} value={tip.toString()}>
                  {tip}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Permission warning */}
      {!canUpdate && (
        <Alert className="mt-4 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {t('tpvSettings.noUpdatePermission')}
          </AlertDescription>
        </Alert>
      )}
    </div>
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
