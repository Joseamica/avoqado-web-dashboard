import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { PricingData, OrgPaymentStatus, MerchantAccountOption } from '../onboarding.types'
import { MccPreviewCard } from '../components/MccPreviewCard'
import { fetchMccLookup, fetchOrgPaymentStatus, fetchMerchantAccounts } from '../onboarding.service'

interface Props {
  pricing: PricingData
  venueType: string
  organizationId?: string // set when org mode is 'existing'
  isNewOrg?: boolean // true when creating a new org
  onChange: (data: Partial<PricingData>) => void
}

interface MccResult {
  familia: string
  mcc: string
  confidence: number
  rates: { credito: number; debito: number; internacional: number; amex: number }
}

export const Step2PaymentConfig: React.FC<Props> = ({ pricing, venueType, organizationId, isNewOrg, onChange }) => {
  const [mccResult, setMccResult] = useState<MccResult | null>(null)
  const [mccLoading, setMccLoading] = useState(false)
  const [orgStatus, setOrgStatus] = useState<OrgPaymentStatus | null>(null)
  const [merchantAccounts, setMerchantAccounts] = useState<MerchantAccountOption[]>([])
  const [orgStatusLoading, setOrgStatusLoading] = useState(false)

  // Fetch MCC rates on mount
  useEffect(() => {
    if (!venueType) return
    setMccLoading(true)
    fetchMccLookup(venueType)
      .then((result) => {
        setMccResult(result)
        if (result?.rates) {
          const margin = 0.2
          onChange({
            debitRate: +(result.rates.debito + margin).toFixed(2),
            creditRate: +(result.rates.credito + margin).toFixed(2),
            amexRate: +(result.rates.amex + margin).toFixed(2),
            internationalRate: +(result.rates.internacional + margin).toFixed(2),
          })
        }
      })
      .finally(() => setMccLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueType])

  // Fetch merchant accounts always (needed for both org and venue-level paths)
  useEffect(() => {
    fetchMerchantAccounts().then(setMerchantAccounts)
  }, [])

  // Fetch org payment status when org is selected
  useEffect(() => {
    if (!organizationId) {
      setOrgStatus(null)
      return
    }
    setOrgStatusLoading(true)
    fetchOrgPaymentStatus(organizationId)
      .then(setOrgStatus)
      .finally(() => setOrgStatusLoading(false))
  }, [organizationId])

  const orgHasConfig = orgStatus?.hasConfig ?? false

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Configuracion de Pagos</h3>

      {/* MCC Preview */}
      {mccLoading && <p className="text-sm text-muted-foreground">Buscando tasas del proveedor...</p>}
      {mccResult && <MccPreviewCard {...mccResult} />}

      {/* Org config toggle — show for existing org or new org */}
      {(organizationId || isNewOrg) && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={pricing.useOrgConfig || false}
              onCheckedChange={(v) => onChange({ useOrgConfig: v, createOrgConfig: undefined })}
            />
            <Label>
              {isNewOrg && !organizationId
                ? 'Crear configuracion de pagos a nivel organizacion'
                : 'Usar configuracion a nivel organizacion'}
            </Label>
          </div>

          {pricing.useOrgConfig && isNewOrg && !organizationId && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4">
              <p className="text-sm font-medium">Se creara configuracion de pagos a nivel organizacion</p>
              <p className="text-xs text-muted-foreground">
                La nueva organizacion tendra una config de pagos compartida. Todos los venues que se creen despues la heredaran automaticamente.
              </p>

              {/* Merchant account selector for new org */}
              <div>
                <Label>Cuenta merchant principal</Label>
                <Select
                  value={pricing.createOrgConfig?.primaryAccountId || ''}
                  onValueChange={(v) =>
                    onChange({
                      createOrgConfig: {
                        ...(pricing.createOrgConfig || { primaryAccountId: '' }),
                        primaryAccountId: v,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar merchant account" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchantAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.displayName || acc.alias || acc.externalMerchantId} ({acc.provider.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {merchantAccounts.length === 0 && (
                <p className="text-xs text-destructive">
                  No hay merchant accounts activos. Crea uno primero o usa pricing a nivel venue.
                </p>
              )}
            </div>
          )}

          {pricing.useOrgConfig && organizationId && (
            <>
              {orgStatusLoading && <p className="text-sm text-muted-foreground">Verificando config de la org...</p>}

              {/* Org ALREADY has config */}
              {orgHasConfig && orgStatus?.config && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-medium">La organizacion ya tiene configuracion de pagos</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cuenta principal: {orgStatus.config.primaryAccount?.displayName || orgStatus.config.primaryAccountId}
                    {orgStatus.config.primaryAccount?.provider && ` (${orgStatus.config.primaryAccount.provider.name})`}
                  </p>
                  {orgStatus.pricing.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 text-xs text-center mt-2">
                      {orgStatus.pricing
                        .filter((p) => p.accountType === 'PRIMARY')
                        .map((p, i) => (
                          <React.Fragment key={i}>
                            <div>
                              <p className="text-muted-foreground">Debito</p>
                              <p className="font-semibold">{Number(p.debitRate)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Credito</p>
                              <p className="font-semibold">{Number(p.creditRate)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">AMEX</p>
                              <p className="font-semibold">{Number(p.amexRate)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Intl</p>
                              <p className="font-semibold">{Number(p.internationalRate)}%</p>
                            </div>
                          </React.Fragment>
                        ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    El nuevo venue heredara esta configuracion automaticamente.
                  </p>
                </div>
              )}

              {/* Org does NOT have config — allow creating one */}
              {!orgHasConfig && !orgStatusLoading && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-medium">La organizacion no tiene configuracion de pagos</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se creara una nueva configuracion a nivel organizacion. Todos los venues de esta org que no tengan
                    config propia la heredaran.
                  </p>

                  {/* Merchant account selector */}
                  <div>
                    <Label>Cuenta merchant principal</Label>
                    <Select
                      value={pricing.createOrgConfig?.primaryAccountId || ''}
                      onValueChange={(v) =>
                        onChange({
                          createOrgConfig: {
                            ...(pricing.createOrgConfig || { primaryAccountId: '' }),
                            primaryAccountId: v,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar merchant account" />
                      </SelectTrigger>
                      <SelectContent>
                        {merchantAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.displayName || acc.alias || acc.externalMerchantId} ({acc.provider.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {merchantAccounts.length === 0 && (
                    <p className="text-xs text-destructive">
                      No hay merchant accounts activos. Crea uno primero o usa pricing a nivel venue.
                    </p>
                  )}

                  {!pricing.createOrgConfig?.primaryAccountId && merchantAccounts.length > 0 && (
                    <Badge variant="outline" className="text-amber-600">
                      Selecciona una cuenta merchant para continuar
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Rate inputs — shown when NOT using org config, or when creating new org config (existing or new) */}
      {(!pricing.useOrgConfig || (pricing.useOrgConfig && !orgHasConfig)) && (
        <>
          <div>
            <p className="text-sm font-medium mb-1">
              {pricing.useOrgConfig
                ? 'Tasas para la nueva config organizacional'
                : 'Tasas Avoqado (lo que cobramos al venue)'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Debito %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricing.debitRate}
                  onChange={(e) => onChange({ debitRate: +e.target.value })}
                />
              </div>
              <div>
                <Label>Credito %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricing.creditRate}
                  onChange={(e) => onChange({ creditRate: +e.target.value })}
                />
              </div>
              <div>
                <Label>AMEX %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricing.amexRate}
                  onChange={(e) => onChange({ amexRate: +e.target.value })}
                />
              </div>
              <div>
                <Label>Internacional %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricing.internationalRate}
                  onChange={(e) => onChange({ internationalRate: +e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Margin preview */}
          {mccResult && (
            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Margen estimado</p>
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                {[
                  { label: 'Debito', ours: pricing.debitRate, theirs: mccResult.rates.debito },
                  { label: 'Credito', ours: pricing.creditRate, theirs: mccResult.rates.credito },
                  { label: 'AMEX', ours: pricing.amexRate, theirs: mccResult.rates.amex },
                  { label: 'Intl', ours: pricing.internationalRate, theirs: mccResult.rates.internacional },
                ].map((r) => (
                  <div key={r.label}>
                    <p className="text-muted-foreground">{r.label}</p>
                    <p className="font-semibold text-emerald-600">+{(r.ours - r.theirs).toFixed(2)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional fees */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Comision fija por transaccion (MXN)</Label>
              <Input
                type="number"
                step="0.01"
                value={pricing.fixedFeePerTransaction || ''}
                onChange={(e) => onChange({ fixedFeePerTransaction: e.target.value ? +e.target.value : undefined })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Cuota mensual de servicio (MXN)</Label>
              <Input
                type="number"
                step="0.01"
                value={pricing.monthlyServiceFee || ''}
                onChange={(e) => onChange({ monthlyServiceFee: e.target.value ? +e.target.value : undefined })}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Merchant account selector — venue-level path (not using org config) */}
          {!pricing.useOrgConfig && (
            <div className="space-y-3">
              {/* Show linked merchant account status */}
              {pricing.merchantAccountId && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Merchant account vinculado
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {merchantAccounts.find((acc) => acc.id === pricing.merchantAccountId)?.displayName ||
                      merchantAccounts.find((acc) => acc.id === pricing.merchantAccountId)?.alias ||
                      pricing.merchantAccountId}
                  </p>
                </div>
              )}

              {merchantAccounts.length > 0 && (
                <div>
                  <Label>
                    {pricing.merchantAccountId ? 'Cambiar cuenta merchant' : 'Cuenta merchant principal (opcional)'}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {pricing.merchantAccountId
                      ? 'Puedes cambiar la cuenta merchant vinculada si lo necesitas.'
                      : 'Vincula una cuenta merchant al venue para habilitar liquidaciones. Si usas Blumon Auto-Fetch en el siguiente paso, se vinculara automaticamente.'}
                  </p>
                  <Select
                    value={pricing.merchantAccountId || ''}
                    onValueChange={(v) => onChange({ merchantAccountId: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar merchant account (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {merchantAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.displayName || acc.alias || acc.externalMerchantId} ({acc.provider.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
