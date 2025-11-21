import React, { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import type { EcommerceMerchant } from '@/services/ecommerceMerchant.service'

interface EcommerceMerchantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchant: EcommerceMerchant | null
  venueId: string
  onSubmit: (data: any) => void
  isLoading: boolean
}

export const EcommerceMerchantDialog: React.FC<EcommerceMerchantDialogProps> = ({
  open,
  onOpenChange,
  merchant,
  venueId: _venueId,
  onSubmit,
  isLoading,
}) => {
  const { t } = useTranslation('ecommerce')

  // Form state
  const [channelName, setChannelName] = useState('Web Principal')
  const [businessName, setBusinessName] = useState('')
  const [rfc, setRfc] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [providerId, setProviderId] = useState('')
  const [providerCredentials, setProviderCredentials] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [sandboxMode, setSandboxMode] = useState(true)
  const [active, setActive] = useState(true)
  const [jsonError, setJsonError] = useState('')

  // Fetch payment providers for selection
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['payment-providers'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
  })

  // Populate form when merchant is provided (edit mode)
  useEffect(() => {
    if (merchant) {
      setChannelName(merchant.channelName)
      setBusinessName(merchant.businessName)
      setRfc(merchant.rfc || '')
      setContactEmail(merchant.contactEmail)
      setContactPhone(merchant.contactPhone || '')
      setWebsite(merchant.website || '')
      setProviderId(merchant.providerId)
      // Don't populate credentials in edit mode (security)
      setProviderCredentials('')
      setWebhookUrl('')
      setSandboxMode(merchant.sandboxMode)
      setActive(merchant.active)
    } else {
      // Reset form for create mode
      setChannelName('Web Principal')
      setBusinessName('')
      setRfc('')
      setContactEmail('')
      setContactPhone('')
      setWebsite('')
      setProviderId('')
      setProviderCredentials('')
      setWebhookUrl('')
      setSandboxMode(true)
      setActive(true)
    }
    setJsonError('')
  }, [merchant, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate JSON credentials if provided
    let parsedCredentials = {}
    if (providerCredentials.trim()) {
      try {
        parsedCredentials = JSON.parse(providerCredentials)
        setJsonError('')
      } catch (error) {
        setJsonError('Las credenciales deben ser un JSON válido')
        return
      }
    } else if (!merchant) {
      // Creating new merchant requires credentials
      setJsonError('Las credenciales del proveedor son requeridas')
      return
    }

    const data: any = {
      channelName,
      businessName,
      contactEmail,
      providerId,
      active,
      sandboxMode,
    }

    // Optional fields
    if (rfc) data.rfc = rfc
    if (contactPhone) data.contactPhone = contactPhone
    if (website) data.website = website
    if (webhookUrl) data.webhookUrl = webhookUrl
    if (providerCredentials.trim()) data.providerCredentials = parsedCredentials

    onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {merchant ? 'Editar Canal de E-commerce' : 'Crear Canal de E-commerce'}
          </DialogTitle>
          <DialogDescription>
            {merchant
              ? 'Actualiza la configuración de tu canal de pagos online.'
              : 'Crea un nuevo canal para recibir pagos online (web, app, marketplace).'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Channel Name */}
            <div className="space-y-2">
              <Label htmlFor="channelName">
                Nombre del Canal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="channelName"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder={t('merchantDialog.namePlaceholder')}
                required
              />
              <p className="text-sm text-muted-foreground">
                Identificador interno para este canal de ventas
              </p>
            </div>

            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName">
                Nombre del Negocio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t('merchantDialog.legalNamePlaceholder')}
                required
              />
            </div>

            {/* RFC */}
            <div className="space-y-2">
              <Label htmlFor="rfc">{t('merchantDialog.rfcLabel')}</Label>
              <Input
                id="rfc"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                placeholder={t('merchantDialog.rfcPlaceholder')}
                maxLength={13}
              />
            </div>

            {/* Contact Email */}
            <div className="space-y-2">
              <Label htmlFor="contactEmail">
                Email de Contacto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t('merchantDialog.emailPlaceholder')}
                required
              />
            </div>

            {/* Contact Phone */}
            <div className="space-y-2">
              <Label htmlFor="contactPhone">{t('merchantDialog.phoneLabel')}</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={t('merchantDialog.phonePlaceholder')}
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website">{t('merchantDialog.websiteLabel')}</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder={t('merchantDialog.websitePlaceholder')}
              />
            </div>

            {/* Payment Provider */}
            <div className="space-y-2">
              <Label htmlFor="provider">
                Proveedor de Pagos <span className="text-destructive">*</span>
              </Label>
              <Select value={providerId} onValueChange={setProviderId} disabled={!!merchant}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder={t('merchantDialog.selectProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {loadingProviders ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} ({provider.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {merchant && (
                <p className="text-sm text-muted-foreground">
                  No puedes cambiar el proveedor después de crear el canal
                </p>
              )}
            </div>

            {/* Provider Credentials (JSON) */}
            <div className="space-y-2">
              <Label htmlFor="credentials">
                Credenciales del Proveedor {!merchant && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="credentials"
                value={providerCredentials}
                onChange={(e) => {
                  setProviderCredentials(e.target.value)
                  setJsonError('')
                }}
                placeholder={`{\n  "merchantId": "123456",\n  "apiKey": "sk_live_...",\n  "posId": "789"\n}`}
                rows={6}
                className="font-mono text-sm"
                required={!merchant}
              />
              {jsonError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{jsonError}</AlertDescription>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">
                {merchant
                  ? 'Deja vacío para mantener las credenciales actuales. Solo llena si quieres actualizarlas.'
                  : 'Formato JSON con las credenciales de tu proveedor de pagos'}
              </p>
            </div>

            {/* Webhook URL */}
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">{t('merchantDialog.webhookLabel')}</Label>
              <Input
                id="webhookUrl"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={t('merchantDialog.webhookPlaceholder')}
              />
              <p className="text-sm text-muted-foreground">
                URL donde recibirás notificaciones de eventos de pago
              </p>
            </div>

            {/* Sandbox Mode */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="sandboxMode">{t('merchantDialog.sandboxMode')}</Label>
                <p className="text-sm text-muted-foreground">
                  Usa credenciales de prueba (no se cobrarán pagos reales)
                </p>
              </div>
              <Switch id="sandboxMode" checked={sandboxMode} onCheckedChange={setSandboxMode} />
            </div>

            {/* Active */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="active">{t('merchantDialog.active')}</Label>
                <p className="text-sm text-muted-foreground">
                  El canal puede procesar pagos
                </p>
              </div>
              <Switch id="active" checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {merchant ? 'Actualizar' : 'Crear Canal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
