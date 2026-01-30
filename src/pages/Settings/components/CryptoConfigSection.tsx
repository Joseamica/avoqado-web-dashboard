import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bitcoin, AlertTriangle, Copy, ExternalLink, Loader2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

import cryptoConfigService from '@/services/crypto-config.service'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export function CryptoConfigSection() {
  const { t } = useTranslation('settings')
  const { toast } = useToast()
  const { venue } = useCurrentVenue()
  const queryClient = useQueryClient()
  const [deviceId, setDeviceId] = useState('')
  const [secretKey, setSecretKey] = useState('')

  const venueId = venue?.id

  const { data: config, isLoading } = useQuery({
    queryKey: ['cryptoConfig', venueId],
    queryFn: () => cryptoConfigService.getConfig(venueId!),
    enabled: !!venueId,
  })

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['b4bitDevices'],
    queryFn: () => cryptoConfigService.listDevices(),
    enabled: config?.status === 'PENDING_SETUP',
  })

  const enableMutation = useMutation({
    mutationFn: () => cryptoConfigService.enableCrypto(venueId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cryptoConfig', venueId] })
      toast({
        title: t('crypto.enableSuccess', 'Crypto habilitado'),
        description: t('crypto.enableSuccessDesc', 'Selecciona un dispositivo B4Bit para completar la configuración.'),
      })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al activar crypto', variant: 'destructive' })
    },
  })

  const setupMutation = useMutation({
    mutationFn: () => cryptoConfigService.completeCryptoSetup(venueId!, deviceId, secretKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cryptoConfig', venueId] })
      setDeviceId('')
      setSecretKey('')
      toast({
        title: t('crypto.setupSuccess', 'Configuración completada'),
        description: t('crypto.setupSuccessDesc', 'Los pagos crypto están activos.'),
      })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al completar configuración', variant: 'destructive' })
    },
  })

  const disableMutation = useMutation({
    mutationFn: () => cryptoConfigService.disableCrypto(venueId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cryptoConfig', venueId] })
      toast({ title: t('crypto.disableSuccess', 'Crypto desactivado') })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al desactivar', variant: 'destructive' })
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: t('crypto.copied', 'Copiado al portapapeles') })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5" />
            {t('crypto.title', 'Pagos con Criptomonedas')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // State 1: Not configured
  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5" />
            {t('crypto.title', 'Pagos con Criptomonedas')}
          </CardTitle>
          <CardDescription>
            {t('crypto.description', 'Acepta pagos en Bitcoin, Ethereum, USDT y 10+ criptomonedas via B4Bit.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => enableMutation.mutate()} disabled={enableMutation.isPending}>
            {enableMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('crypto.enabling', 'Activando...')}
              </>
            ) : (
              <>
                <Bitcoin className="mr-2 h-4 w-4" /> {t('crypto.enableButton', 'Activar pagos crypto')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // State 2: PENDING_SETUP
  if (config.status === 'PENDING_SETUP') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5" />
            {t('crypto.title', 'Pagos con Criptomonedas')}
            <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-400/50">
              {t('crypto.pendingSetup', 'Configuración pendiente')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('crypto.pendingWarning', 'Los pagos crypto no se procesarán hasta completar la configuración.')}
            </AlertDescription>
          </Alert>

          {/* Step 1: Select B4Bit device */}
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center mt-0.5 shrink-0">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <div className="flex-1 space-y-3">
              <p className="font-medium">{t('crypto.step1', 'Seleccionar dispositivo B4Bit')}</p>
              <p className="text-sm text-muted-foreground">
                {t('crypto.step1Desc', 'Selecciona el dispositivo de tu cuenta B4Bit que se asignará a este venue.')}
              </p>

              <div>
                <Label htmlFor="deviceSelect">Device</Label>
                {devicesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando dispositivos...
                  </div>
                ) : devices && devices.length > 0 ? (
                  <Select value={deviceId} onValueChange={setDeviceId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('crypto.selectDevice', 'Seleccionar dispositivo...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.name} ({device.deviceId.slice(0, 8)}...)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('crypto.noDevices', 'No se encontraron dispositivos. Crea uno en el')}{' '}
                    <a href={config.b4bitDashboardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      dashboard de B4Bit <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Enter Secret Key */}
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center mt-0.5 shrink-0">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <div className="flex-1 space-y-3">
              <p className="font-medium">{t('crypto.step2', 'Ingresar Secret Key')}</p>
              <p className="text-sm text-muted-foreground">
                {t('crypto.step2Desc', 'Copia el Secret Key del dispositivo desde el dashboard de B4Bit.')}
              </p>

              <div>
                <Label htmlFor="secretKey">Secret Key</Label>
                <Input
                  id="secretKey"
                  type="text"
                  placeholder={t('crypto.secretKeyPlaceholder', 'Pegar Secret Key aquí...')}
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                />
              </div>

              <Button onClick={() => setupMutation.mutate()} disabled={!deviceId || !secretKey.trim() || setupMutation.isPending}>
                {setupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('crypto.validateButton', 'Validar y Activar')}
              </Button>
            </div>
          </div>

          {/* Step 3: Webhook URL */}
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center mt-0.5 shrink-0">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('crypto.step3', 'Configurar Webhook URL en B4Bit')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('crypto.webhookInstructions', 'Copia esta URL y pégala en la configuración de webhooks del dispositivo en B4Bit:')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="bg-muted px-2 py-1 rounded text-sm flex-1 truncate">{config.webhookUrl}</code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(config.webhookUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // State 3: ACTIVE
  if (config.status === 'ACTIVE') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5" />
            {t('crypto.title', 'Pagos con Criptomonedas')}
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/15">
              {t('crypto.active', 'Activo')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Device ID</p>
              <p className="font-mono">{config.b4bitDeviceId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('crypto.deviceName', 'Nombre')}</p>
              <p>{config.b4bitDeviceName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Secret Key</p>
              <p className="font-mono">{config.b4bitSecretKeyMasked}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Webhook URL</p>
              <div className="flex items-center gap-1">
                <p className="font-mono truncate">{config.webhookUrl}</p>
                <button onClick={() => copyToClipboard(config.webhookUrl)}>
                  <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending}
            >
              {disableMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('crypto.disableButton', 'Desactivar pagos crypto')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // State 4: INACTIVE
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bitcoin className="h-5 w-5" />
          {t('crypto.title', 'Pagos con Criptomonedas')}
          <Badge variant="secondary">{t('crypto.inactive', 'Desactivado')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => enableMutation.mutate()} disabled={enableMutation.isPending}>
          {enableMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('crypto.reactivating', 'Reactivando...')}
            </>
          ) : (
            t('crypto.reactivateButton', 'Reactivar pagos crypto')
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
