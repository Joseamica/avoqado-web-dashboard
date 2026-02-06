import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Zap, Link2, Monitor, Cpu } from 'lucide-react'
import type { TerminalData, PricingData } from '../onboarding.types'
import { blumonAutoFetch } from '../onboarding.service'

interface Props {
  terminal: TerminalData | null
  venueType: string
  merchantAccountId?: string // Current linked merchant account
  merchantAccountName?: string // Display name of the linked merchant
  onPricingChange: (data: Partial<PricingData>) => void
  onChange: (data: TerminalData | null) => void
}

export const Step3TerminalMerchant: React.FC<Props> = ({ terminal, venueType, merchantAccountId, merchantAccountName, onPricingChange, onChange }) => {
  const hasTerminal = terminal !== null
  const [autoFetchLoading, setAutoFetchLoading] = useState(false)
  const [autoFetchResult, setAutoFetchResult] = useState<{ success: boolean; message: string; merchantAccountId?: string; displayName?: string } | null>(null)

  // Determine the effective merchant account (from auto-fetch result or passed prop)
  const effectiveMerchantId = autoFetchResult?.merchantAccountId || merchantAccountId
  const effectiveMerchantName = autoFetchResult?.displayName || merchantAccountName || effectiveMerchantId

  const setField = (field: keyof TerminalData, value: string) => {
    if (!terminal) return
    onChange({ ...terminal, [field]: value })
  }

  const handleAutoFetch = async () => {
    if (!terminal?.serialNumber || !terminal?.brand || !terminal?.model) return
    setAutoFetchLoading(true)
    setAutoFetchResult(null)
    try {
      const result = await blumonAutoFetch({
        serialNumber: terminal.serialNumber,
        brand: terminal.brand,
        model: terminal.model,
        displayName: terminal.name || undefined,
        environment: terminal.environment,
        businessCategory: venueType,
      })
      // Link the merchant account to the venue via pricing
      onPricingChange({ merchantAccountId: result.id })
      setAutoFetchResult({
        success: true,
        message: result.alreadyExists
          ? `Merchant account ya existente: ${result.displayName}`
          : `Merchant account creado: ${result.displayName}`,
        merchantAccountId: result.id,
        displayName: result.displayName,
      })
    } catch (err: any) {
      const serverMessage = err?.response?.data?.error || err?.response?.data?.message
      const statusCode = err?.response?.status
      let message = serverMessage || err.message || 'Error al conectar con Blumon'

      if (statusCode === 500 && !serverMessage) {
        message = 'Error interno del servidor al conectar con Blumon.'
      }

      setAutoFetchResult({
        success: false,
        message,
      })
    } finally {
      setAutoFetchLoading(false)
    }
  }

  const canAutoFetch = terminal?.serialNumber && terminal?.brand && terminal?.model

  return (
    <div className="space-y-6">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
            <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold">Terminal y Merchant</h3>
            <p className="text-sm text-muted-foreground">Configura el terminal fisico y cuenta merchant</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full cursor-pointer"
          onClick={() =>
            onChange(
              hasTerminal ? null : { serialNumber: '', brand: 'PAX', model: '', name: '', environment: 'SANDBOX' },
            )
          }
        >
          {hasTerminal ? 'Omitir terminal' : 'Agregar terminal'}
        </Button>
      </div>

      {/* Merchant Account Status Indicator */}
      {effectiveMerchantId && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Merchant Account Vinculado
                </p>
                <p className="text-xs text-muted-foreground">{effectiveMerchantName}</p>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full bg-green-500/10 text-green-600 border-green-500/50">
              Listo para liquidaciones
            </Badge>
          </div>
        </div>
      )}

      {!effectiveMerchantId && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-orange-600 dark:text-orange-400">
              Sin merchant account vinculado. Usa Auto-Fetch o selecciona uno en el paso anterior.
            </p>
          </div>
        </div>
      )}

      {!hasTerminal && (
        <p className="text-sm text-muted-foreground">
          No se configurara terminal fisico. Puedes agregar uno despues desde la seccion de Terminales.
        </p>
      )}

      {hasTerminal && terminal && (
        <>
          {/* Terminal Details Card */}
          <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <Cpu className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold">Datos del Terminal</h3>
                <p className="text-sm text-muted-foreground">Informacion del dispositivo fisico</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Numero de serie</Label>
                  <Input
                    className="h-12 text-base"
                    value={terminal.serialNumber}
                    onChange={(e) => setField('serialNumber', e.target.value)}
                    placeholder="0821234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre (opcional)</Label>
                  <Input
                    className="h-12 text-base"
                    value={terminal.name || ''}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Terminal Caja 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Select value={terminal.brand} onValueChange={(v) => setField('brand', v)}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAX">PAX</SelectItem>
                      <SelectItem value="Verifone">Verifone</SelectItem>
                      <SelectItem value="Ingenico">Ingenico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    className="h-12 text-base"
                    value={terminal.model}
                    onChange={(e) => setField('model', e.target.value)}
                    placeholder="A910S"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ambiente</Label>
                <RadioGroup
                  value={terminal.environment}
                  onValueChange={(v) => setField('environment', v)}
                  className="flex gap-4 mt-1"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="SANDBOX" id="env-sandbox" />
                    <Label htmlFor="env-sandbox">Sandbox</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="PRODUCTION" id="env-prod" />
                    <Label htmlFor="env-prod">Produccion</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          {/* Blumon Auto-Fetch Card */}
          <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
                  <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Blumon Auto-Fetch</h3>
                  <p className="text-sm text-muted-foreground">
                    Conecta con Blumon para obtener credenciales y crear la cuenta merchant automaticamente.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                disabled={!canAutoFetch || autoFetchLoading}
                onClick={handleAutoFetch}
                className="rounded-full cursor-pointer"
              >
                {autoFetchLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {autoFetchLoading ? 'Conectando...' : 'Auto-Fetch'}
              </Button>
            </div>

            {!canAutoFetch && (
              <p className="text-xs text-muted-foreground">
                Completa numero de serie, marca y modelo para habilitar Auto-Fetch.
              </p>
            )}

            {autoFetchResult && (
              <div
                className={`rounded-2xl p-3 text-sm space-y-2 ${
                  autoFetchResult.success
                    ? 'border border-green-500/20 bg-green-500/5 text-green-600 dark:text-green-400'
                    : 'border border-destructive/20 bg-destructive/5 text-destructive'
                }`}
              >
                <div className="flex items-center gap-2">
                  {autoFetchResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  {autoFetchResult.message}
                </div>
                {!autoFetchResult.success && (
                  <p className="text-xs text-muted-foreground">
                    Verifica el numero de serie y que el ambiente sea correcto. Si el error persiste, vincula una cuenta merchant manualmente en el paso anterior.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
