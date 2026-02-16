import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Building2,
  Smartphone,
  DollarSign,
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react'
import type { WizardState, PaymentSetupWizardProps } from '../PaymentSetupWizard'

interface SummaryStepProps {
  state: WizardState
  target: PaymentSetupWizardProps['target']
}

function getMarginColor(margin: number): string {
  if (margin >= 0.3) return 'text-green-600'
  if (margin >= 0.1) return 'text-amber-600'
  return 'text-red-600'
}

export const SummaryStep: React.FC<SummaryStepProps> = ({ state, target }) => {
  const primaryMerchantId = state.merchants.primary?.merchantId
  const primaryCost = primaryMerchantId ? state.costStructures[primaryMerchantId] : null
  const primaryPricing = state.pricing.PRIMARY

  // Count what will be created
  const itemsToCreate: string[] = []
  const merchantCount = [state.merchants.primary, state.merchants.secondary, state.merchants.tertiary].filter(Boolean).length
  const terminalCount = Object.values(state.terminalAssignments).reduce((sum, ids) => sum + ids.length, 0)
  const costCount = Object.keys(state.costStructures).filter(k => state.costStructures[k]?.mode === 'new').length
  const hasPricing = !!primaryPricing
  const hasSettlement = state.settlement.debitDays > 0

  if (merchantCount > 0) itemsToCreate.push(`${merchantCount} asignación${merchantCount > 1 ? 'es' : ''} de cuenta`)
  if (terminalCount > 0) itemsToCreate.push(`${terminalCount} asignación${terminalCount > 1 ? 'es' : ''} de terminal`)
  if (costCount > 0) itemsToCreate.push(`${costCount} estructura${costCount > 1 ? 's' : ''} de costos`)
  if (hasPricing) itemsToCreate.push('1 VenuePricingStructure')
  if (hasSettlement) itemsToCreate.push('5 SettlementConfigurations')
  itemsToCreate.push(`1 ${target.type === 'venue' ? 'VenuePaymentConfig' : 'OrganizationPaymentConfig'}`)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-green-500/10">
            <ClipboardCheck className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold">Resumen de Configuración</h3>
            <p className="text-sm text-muted-foreground">
              Revisa toda la configuración antes de guardar
            </p>
          </div>
        </div>
      </div>

      {/* Merchants */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">Cuentas de Cobro</h4>
        </div>
        <div className="space-y-2">
          {(['primary', 'secondary', 'tertiary'] as const).map(slot => {
            const merchant = state.merchants[slot]
            const label = slot === 'primary' ? 'PRIMARY' : slot === 'secondary' ? 'SECONDARY' : 'TERTIARY'

            return (
              <div key={slot} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">{label}:</span>
                {merchant ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {merchant.merchant.displayName || merchant.merchantId}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Terminals */}
      {terminalCount > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Terminales</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            {terminalCount} terminal{terminalCount > 1 ? 'es' : ''} será{terminalCount > 1 ? 'n' : ''} asignada{terminalCount > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Costs vs Pricing (Margins) */}
      {primaryCost && primaryPricing && (
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Costos vs Pricing (Márgenes)</h4>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground px-1 pb-1 border-b border-border/30">
              <span>Tipo</span>
              <span>Costo</span>
              <span>Pricing</span>
              <span>Margen</span>
            </div>

            {[
              { label: 'Débito', costKey: 'debitRate' as const, priceKey: 'debitRate' as const },
              { label: 'Crédito', costKey: 'creditRate' as const, priceKey: 'creditRate' as const },
              { label: 'AMEX', costKey: 'amexRate' as const, priceKey: 'amexRate' as const },
              { label: 'Int\'l', costKey: 'internationalRate' as const, priceKey: 'internationalRate' as const },
            ].map(row => {
              const cost = primaryCost[row.costKey] || 0
              const price = primaryPricing[row.priceKey] || 0
              const margin = price - cost

              return (
                <div key={row.label} className="grid grid-cols-4 gap-4 text-sm py-1">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">{cost.toFixed(2)}%</span>
                  <span>{price.toFixed(2)}%</span>
                  <span className={cn('font-medium', getMarginColor(margin))}>
                    {margin >= 0 ? '+' : ''}{margin.toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Settlement */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">Liquidación</h4>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span>
            Débito: <strong>{state.settlement.debitDays}</strong> día{state.settlement.debitDays !== 1 ? 's' : ''}{' '}
            {state.settlement.dayType === 'BUSINESS_DAYS' ? 'háb.' : 'cal.'}
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            Crédito: <strong>{state.settlement.creditDays}</strong> día{state.settlement.creditDays !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            AMEX: <strong>{state.settlement.amexDays}</strong> día{state.settlement.amexDays !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            Int'l: <strong>{state.settlement.internationalDays}</strong> día{state.settlement.internationalDays !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Corte: {state.settlement.cutoffTime} {state.settlement.cutoffTimezone.replace('America/', '')}
        </p>
      </div>

      {/* What will be created */}
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6">
        <h4 className="font-medium mb-3">Se creará:</h4>
        <ul className="space-y-1">
          {itemsToCreate.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
