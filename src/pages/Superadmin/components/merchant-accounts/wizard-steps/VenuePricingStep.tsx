import React, { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  CreditCard,
  TrendingUp,
  Calculator,
} from 'lucide-react'
import type { WizardState, PricingData, CostStructureData } from '../PaymentSetupWizard'

interface VenuePricingStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
}

const RATE_FIELDS = [
  { key: 'debitRate' as const, label: 'Débito', costKey: 'debitRate' as const },
  { key: 'creditRate' as const, label: 'Crédito', costKey: 'creditRate' as const },
  { key: 'amexRate' as const, label: 'AMEX', costKey: 'amexRate' as const },
  { key: 'internationalRate' as const, label: 'Internacional', costKey: 'internationalRate' as const },
]

function getMarginColor(margin: number): string {
  if (margin >= 0.3) return 'text-green-600'
  if (margin >= 0.1) return 'text-amber-600'
  return 'text-red-600'
}

function getMarginBg(margin: number): string {
  if (margin >= 0.3) return 'bg-green-50 dark:bg-green-950/20'
  if (margin >= 0.1) return 'bg-amber-50 dark:bg-amber-950/20'
  return 'bg-red-50 dark:bg-red-950/20'
}

export const VenuePricingStep: React.FC<VenuePricingStepProps> = ({ state, dispatch }) => {
  // Get primary merchant cost data
  const primaryMerchantId = state.merchants.primary?.merchantId
  const primaryCost = primaryMerchantId ? state.costStructures[primaryMerchantId] : null
  const primaryPricing = state.pricing.PRIMARY

  // Simulator state
  const [simAmount, setSimAmount] = React.useState(1000)
  const [simCardType, setSimCardType] = React.useState<'debitRate' | 'creditRate' | 'amexRate' | 'internationalRate'>('creditRate')

  const handlePricingChange = (
    slot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    field: keyof PricingData,
    value: string,
  ) => {
    const numValue = parseFloat(value) || 0
    const current = state.pricing[slot] || {
      debitRate: 0,
      creditRate: 0,
      amexRate: 0,
      internationalRate: 0,
      fixedFeePerTransaction: 0,
      monthlyServiceFee: 0,
    }
    dispatch({
      type: 'SET_PRICING',
      slot,
      data: { ...current, [field]: numValue },
    })
  }

  // Calculate simulator values
  const simCost = primaryCost ? (simAmount * (primaryCost[simCardType] || 0)) / 100 : 0
  const simCharge = primaryPricing ? (simAmount * (primaryPricing[simCardType] || 0)) / 100 : 0
  const simProfit = simCharge - simCost
  const simProfitPct = simAmount > 0 ? (simProfit / simAmount) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-green-500/10">
            <CreditCard className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold">Tarifas al Venue</h3>
            <p className="text-sm text-muted-foreground">
              Lo que Avoqado cobra al venue por cada transacción
            </p>
          </div>
        </div>
      </div>

      {/* Pricing card - PRIMARY */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <h4 className="font-medium mb-4">Cuenta Primaria</h4>

        {/* Rate table with margin */}
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground px-1">
            <span>Tipo</span>
            <span>Costo</span>
            <span>Tu Tarifa</span>
            <span>Margen</span>
          </div>

          {RATE_FIELDS.map(field => {
            const cost = primaryCost?.[field.costKey] ?? 0
            const price = primaryPricing?.[field.key] ?? 0
            const margin = price - cost

            return (
              <div
                key={field.key}
                className={cn(
                  'grid grid-cols-4 gap-4 items-center p-3 rounded-xl',
                  getMarginBg(margin),
                )}
              >
                <span className="text-sm font-medium">{field.label}</span>
                <span className="text-sm text-muted-foreground">{cost.toFixed(2)}%</span>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={price}
                    onChange={e => handlePricingChange('PRIMARY', field.key, e.target.value)}
                    className="h-10 text-sm pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <span className={cn('text-sm font-medium', getMarginColor(margin))}>
                  {margin >= 0 ? '+' : ''}
                  {margin.toFixed(2)}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Fixed fees */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Cuota fija/transacción</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={primaryPricing?.fixedFeePerTransaction ?? 0}
                onChange={e => handlePricingChange('PRIMARY', 'fixedFeePerTransaction', e.target.value)}
                className="h-12 text-base pl-7"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Cuota mensual</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={primaryPricing?.monthlyServiceFee ?? 0}
                onChange={e => handlePricingChange('PRIMARY', 'monthlyServiceFee', e.target.value)}
                className="h-12 text-base pl-7"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Profit Simulator */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">Simulador de Ganancia</h4>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Monto</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                min="0"
                value={simAmount}
                onChange={e => setSimAmount(parseFloat(e.target.value) || 0)}
                className="h-12 text-base pl-7"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Tipo de tarjeta</Label>
            <Select value={simCardType} onValueChange={v => setSimCardType(v as any)}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debitRate">Débito</SelectItem>
                <SelectItem value="creditRate">Crédito</SelectItem>
                <SelectItem value="amexRate">AMEX</SelectItem>
                <SelectItem value="internationalRate">Internacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-xl bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Cobro al venue</p>
            <p className="text-lg font-bold">${simCharge.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Costo proveedor</p>
            <p className="text-lg font-bold">${simCost.toFixed(2)}</p>
          </div>
          <div className={cn('p-3 rounded-xl text-center', getMarginBg(simProfitPct))}>
            <p className="text-xs text-muted-foreground mb-1">Ganancia Avoqado</p>
            <p className={cn('text-lg font-bold', getMarginColor(simProfitPct))}>
              ${simProfit.toFixed(2)} ({simProfitPct.toFixed(2)}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
