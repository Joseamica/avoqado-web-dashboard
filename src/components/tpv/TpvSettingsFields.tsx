import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Monitor,
  Lightbulb,
  Receipt,
  Star,
  KeyRound,
  Percent,
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
  Bitcoin,
  Plus,
  X,
  BarChart3,
  HelpCircle,
  Target,
  Mail,
  GraduationCap,
  Signal,
  HandCoins,
  Unplug,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TpvSettings, TpvSettingsUpdate } from '@/services/tpv-settings.service'

interface Merchant {
  id: string
  displayName: string
}

export interface TpvSettingsFieldsProps {
  settings: TpvSettings
  onUpdate: (updates: TpvSettingsUpdate) => void
  disabled?: boolean
  isPending?: boolean
  /** 'terminal' shows all fields; 'org' hides kioskDefaultMerchantId (per-terminal only) */
  mode: 'terminal' | 'org'
  /** Merchants for kiosk dropdown (terminal mode only) */
  merchants?: Merchant[]
  /**
   * When provided (terminal edit mode), renders the offline card-payment kill-switch,
   * gated by the terminal's reported TPV version. The fix ships in v2.5.0 (versionCode 76);
   * older terminals ignore the flag, so the toggle is disabled there. Omit this prop
   * (e.g. the create-terminal dialog) to hide the toggle entirely.
   */
  offlineCardPaymentGate?: { versionCode: number | null; versionName: string | null }
}

// TPV 2.5.0 (versionCode 76) is the first build that reads `requireAvoqadoServerForCardPayment`.
// Older terminals silently ignore it, so enabling the toggle there would be a confusing no-op.
const MIN_VERSION_CODE_OFFLINE_CARD = 76

/** 'ok' = has the fix, 'old' = too old, 'unknown' = version not reported. */
function offlineCardVersionStatus(gate: { versionCode: number | null; versionName: string | null }): 'ok' | 'old' | 'unknown' {
  if (typeof gate.versionCode === 'number') {
    return gate.versionCode >= MIN_VERSION_CODE_OFFLINE_CARD ? 'ok' : 'old'
  }
  // Fallback: parse the versionName (e.g. "2.5.0-sandbox") when versionCode wasn't reported.
  const match = gate.versionName?.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (match) {
    const major = Number(match[1])
    const minor = Number(match[2])
    return major > 2 || (major === 2 && minor >= 5) ? 'ok' : 'old'
  }
  return 'unknown'
}

function SettingRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

export function TpvSettingsFields({
  settings,
  onUpdate,
  disabled = false,
  isPending = false,
  mode,
  merchants = [],
  offlineCardPaymentGate,
}: TpvSettingsFieldsProps) {
  const { t } = useTranslation('tpv')
  const [newTipValue, setNewTipValue] = useState('')

  const isDisabled = disabled || isPending

  // Offline card-payment kill-switch gate: only meaningful on terminals running v2.5.0+.
  const offlineCardStatus = offlineCardPaymentGate ? offlineCardVersionStatus(offlineCardPaymentGate) : null
  const offlineCardGated = offlineCardStatus === 'old' || offlineCardStatus === 'unknown'

  const handleToggle = (field: keyof TpvSettings, value: boolean) => {
    if (isDisabled) return
    onUpdate({ [field]: value })
  }

  const handleSelectChange = (value: string) => {
    if (isDisabled) return
    const tipValue = value === 'none' ? null : parseInt(value, 10)
    onUpdate({ defaultTipPercentage: tipValue })
  }

  // Cellular Failover handlers (guarded by validation before emitting onUpdate)
  const handleCellularFailoverModeChange = (value: string) => {
    if (isDisabled) return
    onUpdate({ cellularFailoverMode: value as TpvSettings['cellularFailoverMode'] })
  }

  const handleCellularFailoverNumberChange = (
    field: 'cellularFailoverBadReadingsThreshold' | 'cellularFailoverCooldownSeconds' | 'cellularFailoverMinCellHoldSeconds',
    raw: string,
  ) => {
    if (isDisabled) return
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed)) return
    // threshold must be >=1, cooldown and hold must be >=0
    const min = field === 'cellularFailoverBadReadingsThreshold' ? 1 : 0
    if (parsed < min) return
    onUpdate({ [field]: parsed })
  }

  const handleAddTipOption = () => {
    if (isDisabled) return
    const num = parseInt(newTipValue, 10)
    if (isNaN(num) || num < 1 || num > 100) return
    const current = settings.tipSuggestions || [10, 15, 20]
    if (current.includes(num)) return
    const updated = [...current, num].sort((a, b) => a - b)
    onUpdate({ tipSuggestions: updated })
    setNewTipValue('')
  }

  const handleRemoveTipOption = (value: number) => {
    if (isDisabled) return
    const current = settings.tipSuggestions || [10, 15, 20]
    const updated = current.filter(v => v !== value)
    if (updated.length === 0) return
    const resetDefault = settings.defaultTipPercentage === value ? { defaultTipPercentage: null } : {}
    onUpdate({ tipSuggestions: updated, ...resetDefault })
  }

  const handleKioskMerchantChange = (value: string) => {
    if (isDisabled) return
    const merchantId = value === 'none' ? null : value
    onUpdate({ kioskDefaultMerchantId: merchantId })
  }

  // Per-terminal override of the venue's promoter-location tracking ("Cambaceo").
  // Tri-state: 'inherit' (override absent/null) | 'on' (true) | 'off' (false).
  const trackPromoterLocationTriState: 'inherit' | 'on' | 'off' =
    settings.trackPromoterLocationOverride === true ? 'on' : settings.trackPromoterLocationOverride === false ? 'off' : 'inherit'

  const handleTrackPromoterLocationChange = (value: string) => {
    if (isDisabled) return
    const override = value === 'on' ? true : value === 'off' ? false : null
    onUpdate({ trackPromoterLocation: override })
  }

  const tipOptions = settings.tipSuggestions || [10, 15, 20]

  return (
    <div className="space-y-6">
      {/* Payment Experience Section */}
      <Collapsible defaultOpen>
        <GlassCard className="mb-4">
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-500/5">
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
                disabled={isDisabled}
              />
              <SettingRow
                icon={Star}
                label={t('tpvSettings.showReviewScreen')}
                description={t('tpvSettings.showReviewScreenDesc')}
                checked={settings.showReviewScreen}
                onCheckedChange={checked => handleToggle('showReviewScreen', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={Receipt}
                label={t('tpvSettings.showReceiptScreen')}
                description={t('tpvSettings.showReceiptScreenDesc')}
                checked={settings.showReceiptScreen}
                onCheckedChange={checked => handleToggle('showReceiptScreen', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={Bitcoin}
                label={t('tpvSettings.showCryptoOption', 'Pago con Crypto')}
                description={t(
                  'tpvSettings.showCryptoOptionDesc',
                  'Muestra la opcion de pago con criptomonedas en la seleccion de metodo de pago',
                )}
                checked={settings.showCryptoOption}
                onCheckedChange={checked => handleToggle('showCryptoOption', checked)}
                disabled={isDisabled}
              />
              {/*
                Card payment server-decoupling kill-switch. Rendered only when a version gate
                is supplied (terminal edit mode), and disabled on terminals older than v2.5.0.
                INVERSION: the stored flag is `requireAvoqadoServerForCardPayment`
                (default true = require backend before charge = today's behavior).
                The switch shows the *capability* "charge offline", so:
                  switch ON  → flag false (offline charging enabled)
                  switch OFF → flag true  (default/safe). OFF by default.
              */}
              {offlineCardPaymentGate && (
                <div>
                  <SettingRow
                    icon={Unplug}
                    label={t('tpvSettings.allowOfflineCardPayment', 'Cobrar aunque el servidor no responda')}
                    description={t(
                      'tpvSettings.allowOfflineCardPaymentDesc',
                      'Permite cobrar con tarjeta aunque Avoqado no esté disponible. El cobro pasa por el procesador (Blumon) y se registra al volver la conexión. Úsalo solo en terminales con red inestable.',
                    )}
                    checked={!settings.requireAvoqadoServerForCardPayment}
                    onCheckedChange={checked => handleToggle('requireAvoqadoServerForCardPayment', !checked)}
                    disabled={isDisabled || offlineCardGated}
                  />
                  {offlineCardGated && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 ml-8 -mt-1 mb-2">
                      {offlineCardStatus === 'old'
                        ? t(
                            'tpvSettings.allowOfflineCardPaymentVersionGate',
                            'Requiere TPV v2.5.0 o superior. Esta terminal tiene v{{version}}.',
                            { version: offlineCardPaymentGate.versionName ?? '—' },
                          )
                        : t(
                            'tpvSettings.allowOfflineCardPaymentUnknownVersion',
                            'No se pudo determinar la versión de la terminal. Disponible desde la v2.5.0.',
                          )}
                    </p>
                  )}
                </div>
              )}
              {settings.showTipScreen && (
                <>
                  {/* Tip suggestions editor */}
                  <div className="py-3">
                    <div className="flex items-start gap-3">
                      <Percent className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <Label className="text-sm font-medium">{t('tpvSettings.tipSuggestionsLabel')}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('tpvSettings.tipSuggestionsDesc')}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {tipOptions.map(tip => (
                            <Badge key={tip} variant="secondary" className="text-sm px-3 py-1 gap-1.5">
                              {tip}%
                              {!isDisabled && tipOptions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTipOption(tip)}
                                  disabled={isPending}
                                  className="ml-0.5 hover:text-destructive transition-colors disabled:opacity-50"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </Badge>
                          ))}
                        </div>
                        {!isDisabled && (
                          <div className="flex items-center gap-2 mt-3">
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              placeholder={t('tpvSettings.tipPlaceholder')}
                              value={newTipValue}
                              onChange={e => setNewTipValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddTipOption()
                                }
                              }}
                              className="w-24 h-8 text-sm"
                              disabled={isPending}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleAddTipOption}
                              disabled={!newTipValue || isPending}
                              className="h-8"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              {t('tpvSettings.addTipOption')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Default tip percentage selector */}
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
                      disabled={isDisabled}
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
                </>
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
                <div className="p-2 rounded-xl bg-linear-to-br from-orange-500/20 to-orange-500/5">
                  <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('tpvSettings.securitySection', 'Seguridad y Verificacion')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('tpvSettings.securitySectionDesc', 'Control de acceso y validacion de ventas')}
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
                disabled={isDisabled}
              />
              <SettingRow
                icon={ShieldCheck}
                label={t('tpvSettings.showVerificationScreen')}
                description={t('tpvSettings.showVerificationScreenDesc')}
                checked={settings.showVerificationScreen}
                onCheckedChange={checked => handleToggle('showVerificationScreen', checked)}
                disabled={isDisabled}
              />
              {settings.showVerificationScreen && (
                <>
                  <SettingRow
                    icon={Camera}
                    label={t('tpvSettings.requireVerificationPhoto')}
                    description={t('tpvSettings.requireVerificationPhotoDesc')}
                    checked={settings.requireVerificationPhoto}
                    onCheckedChange={checked => handleToggle('requireVerificationPhoto', checked)}
                    disabled={isDisabled}
                  />
                  <SettingRow
                    icon={Barcode}
                    label={t('tpvSettings.requireVerificationBarcode')}
                    description={t('tpvSettings.requireVerificationBarcodeDesc')}
                    checked={settings.requireVerificationBarcode}
                    onCheckedChange={checked => handleToggle('requireVerificationBarcode', checked)}
                    disabled={isDisabled}
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
                <div className="p-2 rounded-xl bg-linear-to-br from-green-500/20 to-green-500/5">
                  <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('tpvSettings.attendanceSection')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('tpvSettings.attendanceSectionDesc', 'Configuracion del reloj checador')}
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
                disabled={isDisabled}
              />
              <SettingRow
                icon={MapPin}
                label={t('tpvSettings.requireClockOutPhoto')}
                description={t('tpvSettings.requireClockOutPhotoDesc')}
                checked={settings.requireClockOutPhoto}
                onCheckedChange={checked => handleToggle('requireClockOutPhoto', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={LogIn}
                label={t('tpvSettings.requireClockInToLogin')}
                description={t('tpvSettings.requireClockInToLoginDesc')}
                checked={settings.requireClockInToLogin}
                onCheckedChange={checked => handleToggle('requireClockInToLogin', checked)}
                disabled={isDisabled}
              />
              {/* Per-terminal override of promoter location tracking — terminal mode only */}
              {mode === 'terminal' && (
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-sm font-medium">{t('tpvSettings.trackPromoterLocationOverride')}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('tpvSettings.trackPromoterLocationOverrideDesc')}</p>
                    </div>
                  </div>
                  <Select value={trackPromoterLocationTriState} onValueChange={handleTrackPromoterLocationChange} disabled={isDisabled}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">{t('tpvSettings.trackPromoterLocationInherit')}</SelectItem>
                      <SelectItem value="on">{t('tpvSettings.trackPromoterLocationOn')}</SelectItem>
                      <SelectItem value="off">{t('tpvSettings.trackPromoterLocationOff')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5">
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
                disabled={isDisabled}
              />
              {/* kioskDefaultMerchantId is per-terminal only — hidden in org mode */}
              {mode === 'terminal' && settings.kioskModeEnabled && (
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
                    disabled={isDisabled || merchants.length === 0}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('tpvSettings.selectMerchant')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('tpvSettings.showMerchantSelection')}</SelectItem>
                      {merchants.map(merchant => (
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
                <div className="p-2 rounded-xl bg-linear-to-br from-cyan-500/20 to-cyan-500/5">
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
                disabled={isDisabled}
              />
              <SettingRow
                icon={HandCoins}
                label={t('tpvSettings.showCheckout')}
                description={t('tpvSettings.showCheckoutDesc')}
                checked={settings.showCheckout}
                onCheckedChange={checked => handleToggle('showCheckout', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={UtensilsCrossed}
                label={t('tpvSettings.showOrderManagement')}
                description={t('tpvSettings.showOrderManagementDesc')}
                checked={settings.showOrderManagement}
                onCheckedChange={checked => handleToggle('showOrderManagement', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={BarChart3}
                label={t('tpvSettings.showReports')}
                description={t('tpvSettings.showReportsDesc')}
                checked={settings.showReports}
                onCheckedChange={checked => handleToggle('showReports', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={Receipt}
                label={t('tpvSettings.showPayments')}
                description={t('tpvSettings.showPaymentsDesc')}
                checked={settings.showPayments}
                onCheckedChange={checked => handleToggle('showPayments', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={HelpCircle}
                label={t('tpvSettings.showSupport')}
                description={t('tpvSettings.showSupportDesc')}
                checked={settings.showSupport}
                onCheckedChange={checked => handleToggle('showSupport', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={Target}
                label={t('tpvSettings.showGoals')}
                description={t('tpvSettings.showGoalsDesc')}
                checked={settings.showGoals}
                onCheckedChange={checked => handleToggle('showGoals', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={Mail}
                label={t('tpvSettings.showMessages')}
                description={t('tpvSettings.showMessagesDesc')}
                checked={settings.showMessages}
                onCheckedChange={checked => handleToggle('showMessages', checked)}
                disabled={isDisabled}
              />
              <SettingRow
                icon={GraduationCap}
                label={t('tpvSettings.showTrainings')}
                description={t('tpvSettings.showTrainingsDesc')}
                checked={settings.showTrainings}
                onCheckedChange={checked => handleToggle('showTrainings', checked)}
                disabled={isDisabled}
              />
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

      {/* Cellular Failover (Experimental) — per-terminal only for canary rollout */}
      {mode === 'terminal' && (
        <Collapsible>
          <GlassCard className="p-0 overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-linear-to-br from-amber-500/20 to-amber-500/5">
                    <Signal className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{t('tpvSettings.cellularFailoverSection')}</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
                        {t('tpvSettings.experimental', { defaultValue: 'Experimental' })}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('tpvSettings.cellularFailoverSectionDesc')}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4 pt-2">
                {/* Mode select */}
                <div className="space-y-1.5">
                  <Label htmlFor="cellular-failover-mode" className="text-sm font-medium">
                    {t('tpvSettings.cellularFailoverMode')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('tpvSettings.cellularFailoverModeDesc')}</p>
                  <Select value={settings.cellularFailoverMode} onValueChange={handleCellularFailoverModeChange} disabled={isDisabled}>
                    <SelectTrigger id="cellular-failover-mode" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFF">{t('tpvSettings.cellularFailoverModeOff')}</SelectItem>
                      <SelectItem value="MANUAL_TOGGLE">{t('tpvSettings.cellularFailoverModeManual')}</SelectItem>
                      <SelectItem value="AUTO_SHADOW">{t('tpvSettings.cellularFailoverModeShadow')}</SelectItem>
                      <SelectItem value="AUTO_ENFORCED">{t('tpvSettings.cellularFailoverModeEnforced')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bad readings threshold */}
                <div className="space-y-1.5">
                  <Label htmlFor="cellular-failover-threshold" className="text-sm font-medium">
                    {t('tpvSettings.cellularFailoverThreshold')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('tpvSettings.cellularFailoverThresholdDesc')}</p>
                  <Input
                    id="cellular-failover-threshold"
                    type="number"
                    min={1}
                    step={1}
                    className="h-9 w-32"
                    value={settings.cellularFailoverBadReadingsThreshold}
                    onChange={e => handleCellularFailoverNumberChange('cellularFailoverBadReadingsThreshold', e.target.value)}
                    disabled={isDisabled}
                  />
                </div>

                {/* Cooldown seconds */}
                <div className="space-y-1.5">
                  <Label htmlFor="cellular-failover-cooldown" className="text-sm font-medium">
                    {t('tpvSettings.cellularFailoverCooldown')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('tpvSettings.cellularFailoverCooldownDesc')}</p>
                  <Input
                    id="cellular-failover-cooldown"
                    type="number"
                    min={0}
                    step={1}
                    className="h-9 w-32"
                    value={settings.cellularFailoverCooldownSeconds}
                    onChange={e => handleCellularFailoverNumberChange('cellularFailoverCooldownSeconds', e.target.value)}
                    disabled={isDisabled}
                  />
                </div>

                {/* Min cell hold seconds */}
                <div className="space-y-1.5">
                  <Label htmlFor="cellular-failover-hold" className="text-sm font-medium">
                    {t('tpvSettings.cellularFailoverHold')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('tpvSettings.cellularFailoverHoldDesc')}</p>
                  <Input
                    id="cellular-failover-hold"
                    type="number"
                    min={0}
                    step={1}
                    className="h-9 w-32"
                    value={settings.cellularFailoverMinCellHoldSeconds}
                    onChange={e => handleCellularFailoverNumberChange('cellularFailoverMinCellHoldSeconds', e.target.value)}
                    disabled={isDisabled}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </GlassCard>
        </Collapsible>
      )}
    </div>
  )
}
