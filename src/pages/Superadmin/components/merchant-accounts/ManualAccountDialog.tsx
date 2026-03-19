import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { paymentProviderAPI, type MerchantAccount, type MerchantAccountCredentials } from '@/services/paymentProvider.service'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronRight, CreditCard, Eye, EyeOff, Loader2, Smartphone } from 'lucide-react'
import React, { useEffect, useState } from 'react'

interface ManualAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  onSave: (data: any) => Promise<void>
}

export const ManualAccountDialog: React.FC<ManualAccountDialogProps> = ({ open, onOpenChange, account, onSave }) => {
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
    // Blumon-specific fields
    blumonSerialNumber: '',
    blumonEnvironment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
    blumonBrand: 'PAX',
    blumonModel: 'A910S',
    // AngelPay-specific fields
    angelPayEmail: '',
    angelPayPassword: '',
    angelPayAffiliation: '',
    angelPayCommerceToken: '',
  })

  // Fetch providers for dropdown
  const { data: providers = [] } = useQuery({
    queryKey: ['payment-providers-list'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
    enabled: open,
  })

  // Detect provider type
  const selectedProvider = providers.find(p => p.id === formData.providerId)
  const isBlumon = selectedProvider?.code?.toLowerCase().includes('blumon')
  const isAngelPay = selectedProvider?.code?.toUpperCase() === 'ANGELPAY'
  const isGenericProvider = !isBlumon && !isAngelPay

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
        blumonSerialNumber: account.blumonSerialNumber || '',
        blumonEnvironment: (account.blumonEnvironment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
        blumonBrand: (account.providerConfig as any)?.brand || 'PAX',
        blumonModel: (account.providerConfig as any)?.model || 'A910S',
        angelPayEmail: '',
        angelPayPassword: '',
        angelPayAffiliation: account.externalMerchantId || '',
        angelPayCommerceToken: '',
      })
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
        blumonSerialNumber: '',
        blumonEnvironment: 'SANDBOX',
        blumonBrand: 'PAX',
        blumonModel: 'A910S',
        angelPayEmail: '',
        angelPayPassword: '',
        angelPayAffiliation: '',
        angelPayCommerceToken: '',
      })
    }
  }, [account, open])

  const handleSubmit = async () => {
    if (!formData.providerId || !formData.externalMerchantId) return

    // Provider-specific validation
    if (!account) {
      if (isBlumon && !formData.blumonSerialNumber) return
      if (isAngelPay && (!formData.angelPayEmail || !formData.angelPayAffiliation || !formData.angelPayCommerceToken)) return
      if (isGenericProvider && (!formData.merchantId || !formData.apiKey)) return
    }

    setLoading(true)
    try {
      let credentials: MerchantAccountCredentials | undefined
      let providerConfig: any = undefined

      if (formData.providerConfig) {
        try {
          providerConfig = JSON.parse(formData.providerConfig)
        } catch {
          alert('JSON inválido en provider config')
          setLoading(false)
          return
        }
      }

      if (isAngelPay) {
        // AngelPay credentials map to the generic credential fields
        credentials = {
          merchantId: formData.angelPayAffiliation,
          apiKey: formData.angelPayCommerceToken,
          customerId: formData.angelPayEmail,
          terminalId: formData.angelPayPassword,
        }
        providerConfig = {
          ...providerConfig,
          processor: 'ANGELPAY',
          credentialMapping: {
            merchantId: 'affiliation',
            apiKey: 'commerceToken',
            customerId: 'email',
            terminalId: 'password',
          },
        }
      } else if (isBlumon) {
        credentials =
          formData.merchantId || formData.apiKey
            ? {
                merchantId: formData.merchantId,
                apiKey: formData.apiKey,
                customerId: formData.customerId || undefined,
                terminalId: formData.terminalId || undefined,
              }
            : undefined
        providerConfig = {
          ...providerConfig,
          brand: formData.blumonBrand,
          model: formData.blumonModel,
          environment: formData.blumonEnvironment,
          serialNumber: formData.blumonSerialNumber,
          manuallyCreated: true,
          status: 'PENDING_AFFILIATION',
        }
      } else {
        credentials = {
          merchantId: formData.merchantId,
          apiKey: formData.apiKey,
          customerId: formData.customerId || undefined,
          terminalId: formData.terminalId || undefined,
        }
      }

      const payload: any = {
        providerId: formData.providerId,
        externalMerchantId: formData.externalMerchantId,
        alias: formData.alias || undefined,
        displayName: formData.displayName || undefined,
        active: formData.active,
        displayOrder: formData.displayOrder,
        credentials,
        providerConfig,
      }

      // Add Blumon-specific fields to payload
      if (isBlumon && formData.blumonSerialNumber) {
        payload.blumonSerialNumber = formData.blumonSerialNumber
        payload.blumonEnvironment = formData.blumonEnvironment
        payload.blumonMerchantId = formData.externalMerchantId
      }

      await onSave(payload)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving account:', error)
    } finally {
      setLoading(false)
    }
  }

  // Validation for submit button
  const isSubmitDisabled = () => {
    if (loading || !formData.providerId || !formData.externalMerchantId) return true
    if (account) return false // Editing — credentials already exist
    if (isBlumon) return !formData.blumonSerialNumber
    if (isAngelPay) return !formData.angelPayEmail || !formData.angelPayAffiliation || !formData.angelPayCommerceToken
    return !formData.merchantId || !formData.apiKey
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <div>
          <DialogHeader>
            <DialogTitle>{account ? 'Editar Cuenta' : 'Crear Cuenta Manual'}</DialogTitle>
            <DialogDescription>
              {account ? 'Actualiza la información de la cuenta' : 'Ingresa las credenciales manualmente'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Provider */}
            <div className="grid gap-2">
              <Label>
                Procesador de Pago <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.providerId}
                onValueChange={value => setFormData({ ...formData, providerId: value })}
                disabled={!!account}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Seleccionar procesador..." />
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

            {/* ═══════════════════════════════════════════════════ */}
            {/* BLUMON-SPECIFIC FIELDS                             */}
            {/* ═══════════════════════════════════════════════════ */}
            {isBlumon && (
              <div className="border border-amber-500/30 rounded-lg p-4 space-y-4 bg-amber-500/5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm font-medium">Configuración Blumon</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estos campos son necesarios para que la terminal encuentre esta cuenta. Puedes crearla ahora y cuando llegue la afiliación
                  usar "Auto-Fetch" para obtener las credenciales OAuth.
                </p>

                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>
                      Serial Number del Terminal <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.blumonSerialNumber}
                      onChange={e => {
                        const serial = e.target.value
                        setFormData({
                          ...formData,
                          blumonSerialNumber: serial,
                          externalMerchantId: serial ? `blumon_${serial}` : formData.externalMerchantId,
                          displayName: serial ? `Blumon ${formData.blumonBrand} ${formData.blumonModel} - ${serial}` : formData.displayName,
                        })
                      }}
                      placeholder="Ej: 2841548417"
                      className="bg-background border-input font-mono text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Marca</Label>
                      <Select value={formData.blumonBrand} onValueChange={value => setFormData({ ...formData, blumonBrand: value })}>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAX">PAX</SelectItem>
                          <SelectItem value="Verifone">Verifone</SelectItem>
                          <SelectItem value="Ingenico">Ingenico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Modelo</Label>
                      <Select value={formData.blumonModel} onValueChange={value => setFormData({ ...formData, blumonModel: value })}>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A910S">A910S</SelectItem>
                          <SelectItem value="A920">A920</SelectItem>
                          <SelectItem value="A920Pro">A920Pro</SelectItem>
                          <SelectItem value="A77">A77</SelectItem>
                          <SelectItem value="IM30">IM30</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Ambiente</Label>
                      <Select
                        value={formData.blumonEnvironment}
                        onValueChange={value => setFormData({ ...formData, blumonEnvironment: value as 'SANDBOX' | 'PRODUCTION' })}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SANDBOX">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500" />
                              Sandbox
                            </span>
                          </SelectItem>
                          <SelectItem value="PRODUCTION">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              Producción
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* ANGELPAY-SPECIFIC FIELDS                           */}
            {/* ═══════════════════════════════════════════════════ */}
            {isAngelPay && (
              <div className="border border-orange-500/30 rounded-lg p-4 space-y-4 bg-orange-500/5">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Smartphone className="h-4 w-4" />
                  <span className="text-sm font-medium">Configuración AngelPay</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estos datos se obtienen del{' '}
                  <span className="font-medium text-orange-600 dark:text-orange-400">Portal de Comercio AngelPay</span> → Información de
                  Cuenta. Una cuenta por comercio — se comparte entre todas las terminales Nexgo del mismo venue.
                </p>

                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>
                      No. Afiliación <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.angelPayAffiliation}
                      onChange={e => {
                        const affiliation = e.target.value
                        setFormData({
                          ...formData,
                          angelPayAffiliation: affiliation,
                          externalMerchantId: affiliation || formData.externalMerchantId,
                          displayName: affiliation ? `AngelPay - ${affiliation}` : formData.displayName,
                        })
                      }}
                      placeholder="Ej: 9814275"
                      className="bg-background border-input font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Portal AngelPay → Información de Cuenta → "Afiliación"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>
                        Email del comercio <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type={showCredentials ? 'text' : 'email'}
                        value={formData.angelPayEmail}
                        onChange={e => setFormData({ ...formData, angelPayEmail: e.target.value })}
                        placeholder="comercio@ejemplo.com"
                        className="bg-background border-input text-sm"
                      />
                      <p className="text-xs text-muted-foreground">Portal → "Correo electrónico"</p>
                    </div>

                    <div className="grid gap-2">
                      <Label>
                        PIN <span className="text-muted-foreground text-xs">(6 dígitos)</span>
                      </Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.angelPayPassword}
                        onChange={e => setFormData({ ...formData, angelPayPassword: e.target.value })}
                        placeholder="••••••"
                        maxLength={6}
                        className="bg-background border-input font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">Contraseña/PIN de la app AngelPay</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>
                      Commerce Token <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type={showCredentials ? 'text' : 'password'}
                      value={formData.angelPayCommerceToken}
                      onChange={e => setFormData({ ...formData, angelPayCommerceToken: e.target.value })}
                      placeholder="Token del portal AngelPay"
                      className="bg-background border-input font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Lo proporciona AngelPay al dar de alta el comercio</p>
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowCredentials(!showCredentials)}
                    >
                      {showCredentials ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                      {showCredentials ? 'Ocultar' : 'Mostrar'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* External Merchant ID */}
            <div className="grid gap-2">
              <Label>
                External Merchant ID <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.externalMerchantId}
                onChange={e => setFormData({ ...formData, externalMerchantId: e.target.value })}
                placeholder={
                  isBlumon
                    ? 'Se auto-genera con el serial'
                    : isAngelPay
                      ? 'Se auto-genera con la afiliación'
                      : 'ID único del comercio en el procesador'
                }
                className="bg-background border-input font-mono text-sm"
                disabled={(isBlumon && !!formData.blumonSerialNumber) || (isAngelPay && !!formData.angelPayAffiliation)}
              />
              {isBlumon && (
                <p className="text-xs text-muted-foreground">
                  Se genera automáticamente como <code className="bg-muted px-1 rounded">blumon_SERIAL</code>
                </p>
              )}
              {isAngelPay && <p className="text-xs text-muted-foreground">Se usa el número de afiliación como ID externo</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Alias */}
              <div className="grid gap-2">
                <Label>Alias (interno)</Label>
                <Input
                  value={formData.alias}
                  onChange={e => setFormData({ ...formData, alias: e.target.value })}
                  placeholder="Ej: cuenta-principal"
                  className="bg-background border-input"
                />
              </div>

              {/* Display Name */}
              <div className="grid gap-2">
                <Label>Nombre para mostrar</Label>
                <Input
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Ej: Cuenta Caja 1"
                  className="bg-background border-input"
                />
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* GENERIC CREDENTIALS (Blumon optional / Other required) */}
            {/* Hidden for AngelPay — uses its own section above      */}
            {/* ═══════════════════════════════════════════════════ */}
            {!isAngelPay && (
              <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Credenciales {isBlumon && <span className="text-muted-foreground font-normal">(Opcionales para Blumon)</span>}
                  </Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCredentials(!showCredentials)}>
                    {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                {isBlumon && !account && (
                  <div className="flex items-start space-x-2 text-sm bg-amber-50 dark:bg-amber-950/50 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-amber-700 dark:text-amber-300">
                      <p className="font-medium">Para Blumon, las credenciales son opcionales</p>
                      <p className="text-xs mt-1">
                        Cuando llegue la afiliación, usa "Blumon Auto-Fetch" para obtener las credenciales OAuth automáticamente.
                      </p>
                    </div>
                  </div>
                )}

                {isGenericProvider && !account && (
                  <div className="flex items-start space-x-2 text-sm bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <p className="text-blue-700 dark:text-blue-300">Las credenciales se encriptarán automáticamente (AES-256-CBC)</p>
                  </div>
                )}

                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Merchant ID {!account && isGenericProvider && <span className="text-destructive">*</span>}</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.merchantId}
                        onChange={e => setFormData({ ...formData, merchantId: e.target.value })}
                        placeholder={isBlumon ? 'Opcional - se obtiene con Auto-Fetch' : '••••••••'}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>API Key {!account && isGenericProvider && <span className="text-destructive">*</span>}</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.apiKey}
                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder={isBlumon ? 'Opcional - se obtiene con Auto-Fetch' : '••••••••'}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Customer ID (opcional)</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.customerId}
                        onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                        placeholder="••••••••"
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Terminal ID (opcional)</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.terminalId}
                        onChange={e => setFormData({ ...formData, terminalId: e.target.value })}
                        placeholder="••••••••"
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Provider Config (JSON) */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4 transition-transform ui-expanded:rotate-90" />
                  Configuración avanzada
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <Label>Provider Config (JSON)</Label>
                  <Textarea
                    value={formData.providerConfig}
                    onChange={e => setFormData({ ...formData, providerConfig: e.target.value })}
                    placeholder='{"webhookSecret": "whsec_...", "mode": "live"}'
                    rows={3}
                    className="bg-background border-input font-mono text-xs"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Orden de visualización</Label>
                  <Input
                    type="number"
                    value={formData.displayOrder}
                    onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    className="bg-background border-input w-24"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
                  />
                  <label htmlFor="active" className="text-sm font-medium cursor-pointer">
                    Cuenta activa
                  </label>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitDisabled()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {account ? 'Guardar Cambios' : 'Crear Cuenta'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
