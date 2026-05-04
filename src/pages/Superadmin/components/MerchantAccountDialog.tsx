import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  type MerchantAccount,
  type MerchantAccountCredentials,
  paymentProviderAPI,
} from '@/services/paymentProvider.service'
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface MerchantAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: MerchantAccount | null
  onSave: (data: {
    providerId: string
    externalMerchantId: string
    alias?: string
    displayName?: string
    active?: boolean
    displayOrder?: number
    credentials: MerchantAccountCredentials
    providerConfig?: any
  }) => Promise<void>
}

export const MerchantAccountDialog: React.FC<MerchantAccountDialogProps> = ({
  open,
  onOpenChange,
  account,
  onSave,
}) => {
  const { t } = useTranslation('venuePricing')
  const [loading, setLoading] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)

  const [formData, setFormData] = useState({
    providerId: '',
    externalMerchantId: '',
    alias: '',
    displayName: '',
    active: true,
    displayOrder: 0,
    merchantId: '',
    apiKey: '',
    customerId: '',
    terminalId: '',
    providerConfig: '',
  })

  // Dynamic credentials for providers that declare `configSchema.credentialFields`
  // (e.g. AngelPay needs email + PIN + afiliacion + commerceToken instead of
  // merchantId + apiKey). Keeping this separate from `formData` avoids polluting
  // the legacy state shape and keeps the schema-driven path opt-in per provider.
  const [dynamicCredentials, setDynamicCredentials] = useState<Record<string, string>>({})

  // 💳 MSI months currently selected. Source of truth is the providerConfig JSON,
  // but we keep a parallel array so the checkboxes can render and stay in sync.
  const [msiMonths, setMsiMonths] = useState<number[]>([])

  // Common MSI options for retail in Mexico. Add more if a merchant negotiates
  // exotic terms with Blumon — they'd live in the JSON textarea even if not here.
  const COMMON_MSI_OPTIONS = [3, 6, 9, 12, 18, 24]

  // Fetch providers for dropdown
  const { data: providers = [] } = useQuery({
    queryKey: ['payment-providers-list'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
  })

  useEffect(() => {
    if (account) {
      setFormData({
        providerId: account.providerId,
        externalMerchantId: account.externalMerchantId,
        alias: account.alias || '',
        displayName: account.displayName || '',
        active: account.active,
        displayOrder: account.displayOrder || 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: account.providerConfig ? JSON.stringify(account.providerConfig, null, 2) : '',
      })
      setMsiMonths(extractMsiFromConfig(account.providerConfig))
      setDynamicCredentials({})
    } else {
      setFormData({
        providerId: '',
        externalMerchantId: '',
        alias: '',
        displayName: '',
        active: true,
        displayOrder: 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: '',
      })
      setMsiMonths([])
      setDynamicCredentials({})
    }
  }, [account, open])

  // Resolved provider for the current `providerId` selection.
  // When this provider declares `configSchema.credentialFields`, the dialog
  // renders those inputs instead of the legacy 4-field block (merchantId,
  // apiKey, customerId, terminalId). This is what unlocks AngelPay
  // (email + PIN + afiliacion + commerceToken) without hardcoding it here.
  const selectedProvider = providers.find(p => p.id === formData.providerId)
  const credentialFields: Array<{
    key: string
    label?: string
    type?: string
    placeholder?: string
    required?: boolean
    helperText?: string
    pattern?: string
    minLength?: number
    maxLength?: number
  }> = selectedProvider?.configSchema?.credentialFields ?? []
  const useDynamicForm = credentialFields.length > 0

  /**
   * Pulls MSI months out of the providerConfig in any of the three shapes the
   * TPV mapper accepts (`promotions.msi`, `dataResponse.promotions.msi`, top-level `msi`).
   */
  function extractMsiFromConfig(config: any): number[] {
    if (!config || typeof config !== 'object') return []
    const fromTopLevel = config.promotions?.msi
    const fromNested = config.dataResponse?.promotions?.msi
    const fromFlat = config.msi
    const raw = fromTopLevel ?? fromNested ?? fromFlat ?? []
    if (!Array.isArray(raw)) return []
    return raw
      .map(n => (typeof n === 'number' ? n : parseInt(String(n), 10)))
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)
  }

  /**
   * Toggles a single MSI option and re-serializes the JSON textarea so the
   * checkboxes and the raw JSON stay in sync. Preserves any other fields the
   * user has set inside providerConfig.
   */
  function toggleMsiMonth(months: number, checked: boolean) {
    const nextMonths = checked
      ? [...msiMonths, months].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
      : msiMonths.filter(m => m !== months)
    setMsiMonths(nextMonths)

    // Merge into existing JSON instead of overwriting — the textarea may already
    // have other operational fields (webhookSecret, environment, etc.).
    let parsed: Record<string, any> = {}
    if (formData.providerConfig.trim()) {
      try {
        parsed = JSON.parse(formData.providerConfig)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) parsed = {}
      } catch {
        parsed = {}
      }
    }
    parsed.promotions = { ...(parsed.promotions ?? {}), msi: nextMonths }
    setFormData(prev => ({ ...prev, providerConfig: JSON.stringify(parsed, null, 2) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Schema-driven providers (AngelPay, etc.) submit only the dynamic
      // fields they declared. Backend validation in
      // merchantAccount.service.ts -> createMerchantAccount() drives off the
      // same schema, so this stays consistent end-to-end.
      const credentials: MerchantAccountCredentials = useDynamicForm
        ? ({ ...dynamicCredentials } as MerchantAccountCredentials)
        : {
            merchantId: formData.merchantId,
            apiKey: formData.apiKey,
            customerId: formData.customerId || undefined,
            terminalId: formData.terminalId || undefined,
          }

      let providerConfig: any = undefined
      if (formData.providerConfig) {
        try {
          providerConfig = JSON.parse(formData.providerConfig)
        } catch (_err) {
          alert('Invalid JSON in provider config')
          setLoading(false)
          return
        }
      }

      await onSave({
        providerId: formData.providerId,
        externalMerchantId: formData.externalMerchantId,
        alias: formData.alias || undefined,
        displayName: formData.displayName || undefined,
        active: formData.active,
        displayOrder: formData.displayOrder,
        credentials,
        providerConfig,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving account:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {account ? 'Edit Merchant Account' : 'Add Merchant Account'}
            </DialogTitle>
            <DialogDescription>
              {account
                ? 'Update merchant account information'
                : 'Add a new merchant account for payment processing'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Provider */}
            <div className="grid gap-2">
              <Label htmlFor="provider">
                Payment Provider <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.providerId}
                onValueChange={value => setFormData({ ...formData, providerId: value })}
                disabled={!!account}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder={t('merchantDialog.selectProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} ({provider.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* External Merchant ID */}
            <div className="grid gap-2">
              <Label htmlFor="externalMerchantId">
                External Merchant ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="externalMerchantId"
                value={formData.externalMerchantId}
                onChange={e => setFormData({ ...formData, externalMerchantId: e.target.value })}
                placeholder={t('merchantDialog.externalIdPlaceholder')}
                required
                className="bg-background border-input font-mono text-sm"
              />
            </div>

            {/* Alias */}
            <div className="grid gap-2">
              <Label htmlFor="alias">{t('merchantDialog.alias')}</Label>
              <Input
                id="alias"
                value={formData.alias}
                onChange={e => setFormData({ ...formData, alias: e.target.value })}
                placeholder={t('merchantDialog.aliasPlaceholder')}
                className="bg-background border-input"
              />
            </div>

            {/* Display Name */}
            <div className="grid gap-2">
              <Label htmlFor="displayName">{t('merchantDialog.displayName')}</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                placeholder={t('merchantDialog.displayNamePlaceholder')}
                className="bg-background border-input"
              />
            </div>

            {/* Credentials Section */}
            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('merchantDialog.credentials')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCredentials(!showCredentials)}
                >
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              {!account && (
                <div className="flex items-start space-x-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <p>{t('merchantDialog.credentialsNote')}</p>
                </div>
              )}

              <div className="grid gap-3">
                {useDynamicForm ? (
                  // Schema-driven render for providers that declare their
                  // own credential fields (e.g. AngelPay: email + PIN +
                  // afiliacion + commerceToken). The keys / labels /
                  // validation hints come from the backend's
                  // PaymentProvider.configSchema.credentialFields, so adding
                  // a new processor only requires updating the row in the DB.
                  <>
                    {credentialFields.map(field => {
                      const fieldId = `cred-${field.key}`
                      const isSensitive =
                        field.type === 'password' || field.type === 'email' || /token|secret|pin/i.test(field.key)
                      return (
                        <div key={field.key} className="grid gap-2">
                          <Label htmlFor={fieldId}>
                            {field.label || field.key}
                            {field.required && <span className="text-destructive"> *</span>}
                          </Label>
                          <Input
                            id={fieldId}
                            type={isSensitive && !showCredentials ? 'password' : field.type === 'email' ? 'email' : 'text'}
                            value={dynamicCredentials[field.key] ?? ''}
                            onChange={e =>
                              setDynamicCredentials(prev => ({ ...prev, [field.key]: e.target.value }))
                            }
                            required={field.required && !account}
                            placeholder={field.placeholder}
                            minLength={field.minLength}
                            maxLength={field.maxLength}
                            pattern={field.pattern}
                            className="bg-background border-input font-mono text-sm"
                          />
                          {field.helperText && (
                            <p className="text-xs text-muted-foreground">{field.helperText}</p>
                          )}
                        </div>
                      )
                    })}
                  </>
                ) : (
                  // Legacy fixed form for providers without a configSchema
                  // (Menta, Stripe Connect today). Kept as-is so existing
                  // integrations don't change behavior.
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="merchantId">
                        Merchant ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="merchantId"
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.merchantId}
                        onChange={e => setFormData({ ...formData, merchantId: e.target.value })}
                        required={!account}
                        placeholder={t('merchantDialog.merchantIdPlaceholder')}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="apiKey">
                        API Key <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="apiKey"
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.apiKey}
                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                        required={!account}
                        placeholder={t('merchantDialog.apiKeyPlaceholder')}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="customerId">{t('merchantDialog.customerId')}</Label>
                      <Input
                        id="customerId"
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.customerId}
                        onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                        placeholder={t('merchantDialog.customerIdPlaceholder')}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="terminalId">{t('merchantDialog.terminalId')}</Label>
                      <Input
                        id="terminalId"
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.terminalId}
                        onChange={e => setFormData({ ...formData, terminalId: e.target.value })}
                        placeholder={t('merchantDialog.terminalIdPlaceholder')}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Promotions: Meses sin intereses (MSI) */}
            <div className="grid gap-2 border border-border rounded-lg p-4 bg-muted/30">
              <Label className="text-base font-semibold">Meses sin intereses (MSI)</Label>
              <p className="text-sm text-muted-foreground">
                Selecciona los meses que se ofrecerán al cobrar con tarjeta. Los meses deben estar
                activados también en Matter (Blumon) — si no, el cobro fallará con{' '}
                <code className="text-xs bg-background px-1 py-0.5 rounded">TX_005 - PROMOCIONES NO ACTIVAS</code>.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {COMMON_MSI_OPTIONS.map(months => (
                  <div key={months} className="flex items-center space-x-2">
                    <Checkbox
                      id={`msi-${months}`}
                      checked={msiMonths.includes(months)}
                      onCheckedChange={(checked: boolean) => toggleMsiMonth(months, checked)}
                    />
                    <label
                      htmlFor={`msi-${months}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {months} MSI
                    </label>
                  </div>
                ))}
              </div>
              {msiMonths.length === 0 ? (
                <p className="text-xs text-muted-foreground italic pt-1">
                  Sin meses seleccionados — el TPV no mostrará el selector de promociones.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground pt-1">
                  TPV mostrará: <span className="font-mono">[{msiMonths.join(', ')}]</span>
                </p>
              )}
            </div>

            {/* Provider Config (JSON) — advanced editing, source of truth on save */}
            <div className="grid gap-2">
              <Label htmlFor="providerConfig">
                {t('merchantDialog.providerConfig')}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (avanzado — los checkboxes de arriba sobreescriben <code>promotions.msi</code>)
                </span>
              </Label>
              <Textarea
                id="providerConfig"
                value={formData.providerConfig}
                onChange={e => {
                  const next = e.target.value
                  setFormData({ ...formData, providerConfig: next })
                  // Re-sync checkboxes if the user manually edits the JSON
                  try {
                    const parsed = next.trim() ? JSON.parse(next) : null
                    setMsiMonths(extractMsiFromConfig(parsed))
                  } catch {
                    // Invalid JSON — leave checkboxes alone, user is mid-edit
                  }
                }}
                placeholder='{"webhookSecret": "whsec_...", "mode": "live"}'
                rows={4}
                className="bg-background border-input font-mono text-xs"
              />
            </div>

            {/* Display Order */}
            <div className="grid gap-2">
              <Label htmlFor="displayOrder">{t('merchantDialog.displayOrder')}</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>

            {/* Active */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
              />
              <label htmlFor="active" className="text-sm font-medium leading-none cursor-pointer">
                Active
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {account ? 'Update Account' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
