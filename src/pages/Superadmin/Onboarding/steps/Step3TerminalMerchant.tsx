import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Zap, Link2 } from 'lucide-react'
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Terminal y Merchant</h3>
        <Button
          variant="outline"
          size="sm"
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
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Merchant Account Vinculado
                </p>
                <p className="text-xs text-muted-foreground">{effectiveMerchantName}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-emerald-600 border-emerald-500/50">
              Listo para liquidaciones
            </Badge>
          </div>
        </div>
      )}

      {!effectiveMerchantId && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Numero de serie</Label>
              <Input
                value={terminal.serialNumber}
                onChange={(e) => setField('serialNumber', e.target.value)}
                placeholder="0821234567"
              />
            </div>
            <div>
              <Label>Nombre (opcional)</Label>
              <Input
                value={terminal.name || ''}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Terminal Caja 1"
              />
            </div>
            <div>
              <Label>Marca</Label>
              <Select value={terminal.brand} onValueChange={(v) => setField('brand', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAX">PAX</SelectItem>
                  <SelectItem value="Verifone">Verifone</SelectItem>
                  <SelectItem value="Ingenico">Ingenico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modelo</Label>
              <Input
                value={terminal.model}
                onChange={(e) => setField('model', e.target.value)}
                placeholder="A910S"
              />
            </div>
          </div>

          <div>
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

          {/* Blumon Auto-Fetch */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Blumon Auto-Fetch</p>
                <p className="text-xs text-muted-foreground">
                  Conecta con Blumon para obtener credenciales y crear la cuenta merchant automaticamente.
                </p>
              </div>
              <Button
                size="sm"
                disabled={!canAutoFetch || autoFetchLoading}
                onClick={handleAutoFetch}
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
                className={`rounded-lg p-3 text-sm space-y-2 ${
                  autoFetchResult.success
                    ? 'border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                    : 'border border-destructive/30 bg-destructive/10 text-destructive'
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
        </div>
      )}
    </div>
  )
}
