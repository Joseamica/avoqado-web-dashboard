import React, { useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useQuery } from '@tanstack/react-query'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import {
  DollarSign,
  CheckCircle2,
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
  // Fetch existing cost structures for this merchant
  const { data: existingCosts = [], isLoading: costsLoading } = useQuery({
    queryKey: ['cost-structures', merchantId],
    queryFn: () => paymentProviderAPI.getProviderCostStructures({ merchantAccountId: merchantId, active: true }),
    enabled: !!merchantId,
  })

  const hasExisting = existingCosts.length > 0
  const currentData = state.costStructures[merchantId]

  // Initialize with existing data if available
  useEffect(() => {
    if (costsLoading) return
    if (hasExisting) {
      const existing = existingCosts[0]
      const round4 = (n: number) => Math.round(n * 10000) / 10000
      // Only skip if already loaded from this same existing record
      if (currentData?.mode === 'existing' && currentData?.existingId === existing.id) return
      dispatch({
        type: 'SET_COST_STRUCTURE',
        merchantId,
        data: {
          mode: 'existing',
          existingId: existing.id,
          debitRate: round4(Number(existing.debitRate) * 100),
          creditRate: round4(Number(existing.creditRate) * 100),
          amexRate: round4(Number(existing.amexRate) * 100),
          internationalRate: round4(Number(existing.internationalRate) * 100),
          fixedCostPerTransaction: Number(existing.fixedCostPerTransaction || 0),
          monthlyFee: Number(existing.monthlyFee || 0),
        },
      })
    } else if (!currentData) {
      // No existing costs — initialize with empty (new) structure
      dispatch({
        type: 'SET_COST_STRUCTURE',
        merchantId,
        data: {
          mode: 'new',
          debitRate: 0,
          creditRate: 0,
          amexRate: 0,
          internationalRate: 0,
          fixedCostPerTransaction: 0,
          monthlyFee: 0,
        },
      })
    }
  }, [costsLoading, hasExisting, existingCosts, merchantId, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRateChange = (field: keyof CostStructureData, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value)
    if (isNaN(numValue)) return
    const rounded = Math.round(numValue * 10000) / 10000
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
      data: { ...current, [field]: rounded },
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

      {costsLoading ? (
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
                    value={currentData?.[field.key] ? Number(Number(currentData[field.key]).toFixed(4)) : ''}
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
                  value={currentData?.fixedCostPerTransaction ? Number(Number(currentData.fixedCostPerTransaction).toFixed(2)) : ''}
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
                  value={currentData?.monthlyFee ? Number(Number(currentData.monthlyFee).toFixed(2)) : ''}
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
