import React, { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { paymentProviderAPI, type MccLookupResult } from '@/services/paymentProvider.service'
import {
  DollarSign,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import type { WizardState, CostStructureData } from '../PaymentSetupWizard'

interface CostStructureStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
}

const RATE_FIELDS = [
  { key: 'debitRate' as const, label: 'Débito', color: 'text-blue-600' },
  { key: 'creditRate' as const, label: 'Crédito', color: 'text-green-600' },
  { key: 'amexRate' as const, label: 'AMEX', color: 'text-purple-600' },
  { key: 'internationalRate' as const, label: 'Internacional', color: 'text-orange-600' },
]

export const CostStructureStep: React.FC<CostStructureStepProps> = ({ state, dispatch }) => {
  const merchantSlots = useMemo(() => {
    const slots: Array<{ slot: string; merchantId: string; displayName: string }> = []
    if (state.merchants.primary) {
      slots.push({
        slot: 'PRIMARY',
        merchantId: state.merchants.primary.merchantId,
        displayName: state.merchants.primary.merchant.displayName || state.merchants.primary.merchantId,
      })
    }
    if (state.merchants.secondary) {
      slots.push({
        slot: 'SECONDARY',
        merchantId: state.merchants.secondary.merchantId,
        displayName: state.merchants.secondary.merchant.displayName || state.merchants.secondary.merchantId,
      })
    }
    if (state.merchants.tertiary) {
      slots.push({
        slot: 'TERTIARY',
        merchantId: state.merchants.tertiary.merchantId,
        displayName: state.merchants.tertiary.merchant.displayName || state.merchants.tertiary.merchantId,
      })
    }
    return slots
  }, [state.merchants])

  if (merchantSlots.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-6 text-center">
        <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">Sin cuentas seleccionadas</h3>
        <p className="text-sm text-muted-foreground">
          Regresa al paso 1 para seleccionar al menos una cuenta de cobro
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <DollarSign className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold">Costos del Proveedor</h3>
            <p className="text-sm text-muted-foreground">
              Lo que el proveedor cobra a Avoqado por cada transacción
            </p>
          </div>
        </div>
      </div>

      {/* Cost structure per merchant */}
      {merchantSlots.map(({ slot, merchantId, displayName }) => (
        <MerchantCostCard
          key={merchantId}
          slot={slot}
          merchantId={merchantId}
          displayName={displayName}
          state={state}
          dispatch={dispatch}
        />
      ))}
    </div>
  )
}

function MerchantCostCard({
  slot,
  merchantId,
  displayName,
  state,
  dispatch,
}: {
  slot: string
  merchantId: string
  displayName: string
  state: WizardState
  dispatch: React.Dispatch<any>
}) {
  const [mccLoading, setMccLoading] = useState(false)
  const [mccResult, setMccResult] = useState<MccLookupResult | null>(null)

  // Fetch existing cost structures for this merchant
  const { data: existingCosts = [] } = useQuery({
    queryKey: ['cost-structures', merchantId],
    queryFn: () => paymentProviderAPI.getProviderCostStructures({ merchantAccountId: merchantId, active: true }),
    enabled: !!merchantId,
  })

  const hasExisting = existingCosts.length > 0
  const currentData = state.costStructures[merchantId]

  // Initialize with existing data or defaults
  useEffect(() => {
    if (!currentData && hasExisting) {
      const existing = existingCosts[0]
      dispatch({
        type: 'SET_COST_STRUCTURE',
        merchantId,
        data: {
          mode: 'existing',
          existingId: existing.id,
          debitRate: Number(existing.debitRate) * 100,
          creditRate: Number(existing.creditRate) * 100,
          amexRate: Number(existing.amexRate) * 100,
          internationalRate: Number(existing.internationalRate) * 100,
          fixedCostPerTransaction: Number(existing.fixedCostPerTransaction || 0),
          monthlyFee: Number(existing.monthlyFee || 0),
        },
      })
    }
  }, [hasExisting, existingCosts, currentData, merchantId, dispatch])

  // Auto-fetch MCC suggestion if no existing costs
  useEffect(() => {
    if (!hasExisting && !mccResult && !mccLoading) {
      setMccLoading(true)
      paymentProviderAPI
        .getMccRateSuggestion('restaurante')
        .then(result => {
          setMccResult(result)
          if (!currentData) {
            dispatch({
              type: 'SET_COST_STRUCTURE',
              merchantId,
              data: {
                mode: 'new',
                debitRate: result.rates?.debito ?? 1.63,
                creditRate: result.rates?.credito ?? 1.70,
                amexRate: result.rates?.amex ?? 3.0,
                internationalRate: result.rates?.internacional ?? 3.3,
                fixedCostPerTransaction: 0,
                monthlyFee: 0,
              },
            })
          }
        })
        .catch(() => {
          // Use defaults on error
          if (!currentData) {
            dispatch({
              type: 'SET_COST_STRUCTURE',
              merchantId,
              data: {
                mode: 'new',
                debitRate: 1.63,
                creditRate: 1.70,
                amexRate: 3.0,
                internationalRate: 3.3,
                fixedCostPerTransaction: 0,
                monthlyFee: 0,
              },
            })
          }
        })
        .finally(() => setMccLoading(false))
    }
  }, [hasExisting, mccResult, mccLoading, currentData, merchantId, dispatch])

  const handleRateChange = (field: keyof CostStructureData, value: string) => {
    const numValue = parseFloat(value) || 0
    const current = currentData || {
      mode: 'new' as const,
      debitRate: 0,
      creditRate: 0,
      amexRate: 0,
      internationalRate: 0,
      fixedCostPerTransaction: 0,
      monthlyFee: 0,
    }
    dispatch({
      type: 'SET_COST_STRUCTURE',
      merchantId,
      data: { ...current, [field]: numValue },
    })
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium">
          Cuenta {slot}: <span className="text-primary">{displayName}</span>
        </h4>
        {hasExisting && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Estructura existente
          </span>
        )}
      </div>

      {/* MCC Detection info */}
      {mccResult && (
        <div
          className={cn(
            'flex items-start gap-3 p-3 rounded-xl border mb-4',
            mccResult.found
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50'
              : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50',
          )}
        >
          {mccResult.found ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="text-xs">
            <p className="font-medium">
              {mccResult.found ? 'Tasas detectadas automáticamente' : 'Usando tasas por defecto'}
            </p>
            {mccResult.found && (
              <p className="text-muted-foreground">
                {mccResult.familia} (MCC {mccResult.mcc}) — Confianza: {mccResult.confidence}%
              </p>
            )}
          </div>
        </div>
      )}

      {mccLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Rate inputs */}
          <div className="grid grid-cols-2 gap-4">
            {RATE_FIELDS.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-sm">{field.label}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={currentData?.[field.key] ?? ''}
                    onChange={e => handleRateChange(field.key, e.target.value)}
                    className="h-12 text-base pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Fixed costs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Cuota fija/transacción</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentData?.fixedCostPerTransaction ?? 0}
                  onChange={e => handleRateChange('fixedCostPerTransaction', e.target.value)}
                  className="h-12 text-base pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cuota mensual</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentData?.monthlyFee ?? 0}
                  onChange={e => handleRateChange('monthlyFee', e.target.value)}
                  className="h-12 text-base pl-7"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
