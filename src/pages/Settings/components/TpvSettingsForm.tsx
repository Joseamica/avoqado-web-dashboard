import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Monitor,
  Lightbulb,
  Receipt,
  Star,
  KeyRound,
  Percent,
  Info,
  Camera,
  Barcode,
  ShieldCheck,
  Clock,
  MapPin,
  ChevronRight,
  LogIn,
  Tablet,
  Store,
  CreditCard,
  UtensilsCrossed,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

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

  const handleKioskMerchantChange = (value: string) => {
    if (!canUpdate) return
    const merchantId = value === 'none' ? null : value
    updateMutation.mutate({ kioskDefaultMerchantId: merchantId })
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
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={!canUpdate || updateMutation.isPending} />
    </div>
  )

  const content = (
    <div className="space-y-6">
      {/* Payment Experience Section */}
      <Collapsible defaultOpen>
        <GlassCard className="mb-4">
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                  <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('tpvSettings.paymentSection', 'Experiencia de Pago')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('tpvSettings.paymentSectionDesc', 'Configura el flujo de cobro y opciones de recibo')}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <SettingRow
                icon={Lightbulb}
                label={t('tpvSettings.showTipScreen')}
                description={t('tpvSettings.showTipScreenDesc')}
                checked={settings.showTipScreen}
                onCheckedChange={checked => handleToggle('showTipScreen', checked)}
              />
              <SettingRow
                icon={Star}
                label={t('tpvSettings.showReviewScreen')}
                description={t('tpvSettings.showReviewScreenDesc')}
                checked={settings.showReviewScreen}
                onCheckedChange={checked => handleToggle('showReviewScreen', checked)}
              />
              <SettingRow
                icon={Receipt}
                label={t('tpvSettings.showReceiptScreen')}
                description={t('tpvSettings.showReceiptScreenDesc')}
                checked={settings.showReceiptScreen}
                onCheckedChange={checked => handleToggle('showReceiptScreen', checked)}
              />
              {settings.showTipScreen && (
                <div className="flex items-center justify-between py-3">
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
                      {tipOptions.map(tip => (
                        <SelectItem key={tip} value={tip.toString()}>
                          {tip}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

      {/* Security & Verification Section */}
      <Collapsible defaultOpen>
        <GlassCard className="mb-4">
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
                  <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('tpvSettings.securitySection', 'Seguridad y Verificación')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('tpvSettings.securitySectionDesc', 'Control de acceso y validación de ventas')}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <SettingRow
                icon={KeyRound}
                label={t('tpvSettings.requirePinLogin')}
                description={t('tpvSettings.requirePinLoginDesc')}
                checked={settings.requirePinLogin}
                onCheckedChange={checked => handleToggle('requirePinLogin', checked)}
              />
              <SettingRow
                icon={ShieldCheck}
                label={t('tpvSettings.showVerificationScreen')}
                description={t('tpvSettings.showVerificationScreenDesc')}
                checked={settings.showVerificationScreen}
                onCheckedChange={checked => handleToggle('showVerificationScreen', checked)}
              />
              {settings.showVerificationScreen && (
                <>
                  <SettingRow
                    icon={Camera}
                    label={t('tpvSettings.requireVerificationPhoto')}
                    description={t('tpvSettings.requireVerificationPhotoDesc')}
                    checked={settings.requireVerificationPhoto}
                    onCheckedChange={checked => handleToggle('requireVerificationPhoto', checked)}
                  />
                  <SettingRow
                    icon={Barcode}
                    label={t('tpvSettings.requireVerificationBarcode')}
                    description={t('tpvSettings.requireVerificationBarcodeDesc')}
                    checked={settings.requireVerificationBarcode}
                    onCheckedChange={checked => handleToggle('requireVerificationBarcode', checked)}
                  />
                </>
              )}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

      {/* Attendance Section */}
      <Collapsible defaultOpen>
        <GlassCard className="mb-4">
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                  <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('tpvSettings.attendanceSection')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('tpvSettings.attendanceSectionDesc', 'Configuración del reloj checador')}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <SettingRow
                icon={Camera}
                label={t('tpvSettings.requireClockInPhoto')}
                description={t('tpvSettings.requireClockInPhotoDesc')}
                checked={settings.requireClockInPhoto}
                onCheckedChange={checked => handleToggle('requireClockInPhoto', checked)}
              />
              <SettingRow
                icon={MapPin}
                label={t('tpvSettings.requireClockOutPhoto')}
                description={t('tpvSettings.requireClockOutPhotoDesc')}
                checked={settings.requireClockOutPhoto}
                onCheckedChange={checked => handleToggle('requireClockOutPhoto', checked)}
              />
              <SettingRow
                icon={LogIn}
                label={t('tpvSettings.requireClockInToLogin')}
                description={t('tpvSettings.requireClockInToLoginDesc')}
                checked={settings.requireClockInToLogin}
                onCheckedChange={checked => handleToggle('requireClockInToLogin', checked)}
              />
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

      {/* Kiosk Mode Section */}
      <Collapsible defaultOpen>
        <GlassCard className="mb-4">
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                  <Tablet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('tpvSettings.kioskSection')}</h3>
                  <p className="text-xs text-muted-foreground">{t('tpvSettings.kioskSectionDesc')}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <SettingRow
                icon={Tablet}
                label={t('tpvSettings.kioskModeEnabled')}
                description={t('tpvSettings.kioskModeEnabledDesc')}
                checked={settings.kioskModeEnabled}
                onCheckedChange={checked => handleToggle('kioskModeEnabled', checked)}
              />
              {settings.kioskModeEnabled && (
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-start gap-3">
                    <Store className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-sm font-medium">{t('tpvSettings.kioskDefaultMerchant')}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('tpvSettings.kioskDefaultMerchantDesc')}</p>
                    </div>
                  </div>
                  <Select
                    value={settings.kioskDefaultMerchantId ?? 'none'}
                    onValueChange={handleKioskMerchantChange}
                    disabled={!canUpdate || updateMutation.isPending || terminalMerchants.length === 0}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('tpvSettings.selectMerchant')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('tpvSettings.showMerchantSelection')}</SelectItem>
                      {terminalMerchants.map(merchant => (
                        <SelectItem key={merchant.id} value={merchant.id}>
                          {merchant.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

      {/* Home Screen Section */}
      <Collapsible defaultOpen>
        <GlassCard className="mb-4">
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
                  <Monitor className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('tpvSettings.homeScreenSection')}</h3>
                  <p className="text-xs text-muted-foreground">{t('tpvSettings.homeScreenSectionDesc')}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <SettingRow
                icon={CreditCard}
                label={t('tpvSettings.showQuickPayment')}
                description={t('tpvSettings.showQuickPaymentDesc')}
                checked={settings.showQuickPayment}
                onCheckedChange={checked => handleToggle('showQuickPayment', checked)}
              />
              <SettingRow
                icon={UtensilsCrossed}
                label={t('tpvSettings.showOrderManagement')}
                description={t('tpvSettings.showOrderManagementDesc')}
                checked={settings.showOrderManagement}
                onCheckedChange={checked => handleToggle('showOrderManagement', checked)}
              />
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

      {/* Permission warning */}
      {!canUpdate && (
        <Alert className="mt-4 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">{t('tpvSettings.noUpdatePermission')}</AlertDescription>
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
