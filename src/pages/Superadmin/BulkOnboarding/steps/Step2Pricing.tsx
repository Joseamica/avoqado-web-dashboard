import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreditCard, Clock, Wallet } from 'lucide-react'
import { getMerchantAccountsList } from '@/services/paymentProvider.service'
import type { BulkOnboardingState, BulkOnboardingAction } from '../types'

interface Props {
  state: BulkOnboardingState
  dispatch: React.Dispatch<BulkOnboardingAction>
}

function RateInput({
  label,
  value,
  onChange,
  suffix = '%',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="relative mt-1">
        <Input
          type="number"
          step="0.01"
          min="0"
          max={suffix === '%' ? '100' : undefined}
          value={value || ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="pr-8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  )
}

export const Step2Pricing: React.FC<Props> = ({ state, dispatch }) => {
  const { data: merchantAccounts = [], isLoading: loadingMerchants } = useQuery({
    queryKey: ['superadmin', 'merchant-accounts-list'],
    queryFn: () => getMerchantAccountsList({ active: true }),
  })

  return (
    <div className="space-y-6">
      {/* Merchant Account */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10">
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold">Cuenta de Comerciante</h3>
            <p className="text-xs text-muted-foreground">
              Merchant account que se asignará a todos los venues (puede ser sobrescrita por venue)
            </p>
          </div>
        </div>

        <div>
          <Label>Merchant Account</Label>
          <Select
            value={state.merchantAccountId || '__none'}
            onValueChange={v => dispatch({ type: 'SET_MERCHANT', merchantAccountId: v === '__none' ? '' : v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={loadingMerchants ? 'Cargando...' : 'Seleccionar cuenta'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sin merchant account</SelectItem>
              {merchantAccounts.map(ma => (
                <SelectItem key={ma.id} value={ma.id}>
                  {ma.displayName || ma.alias || ma.externalMerchantId} — {ma.providerName}
                  {ma.environment && ` (${ma.environment})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pricing Rates */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold">Tasas por Tipo de Tarjeta</h3>
            <p className="text-xs text-muted-foreground">
              Tasas en porcentaje (ej: 2.5 = 2.5%). Se aplican como default a todos los venues.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <RateInput
            label="Débito"
            value={state.pricing.debitRate}
            onChange={v => dispatch({ type: 'SET_PRICING', pricing: { debitRate: v } })}
          />
          <RateInput
            label="Crédito"
            value={state.pricing.creditRate}
            onChange={v => dispatch({ type: 'SET_PRICING', pricing: { creditRate: v } })}
          />
          <RateInput
            label="AMEX"
            value={state.pricing.amexRate}
            onChange={v => dispatch({ type: 'SET_PRICING', pricing: { amexRate: v } })}
          />
          <RateInput
            label="Internacional"
            value={state.pricing.internationalRate}
            onChange={v => dispatch({ type: 'SET_PRICING', pricing: { internationalRate: v } })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/30">
          <RateInput
            label="Cuota fija por transacción"
            value={state.pricing.fixedFeePerTransaction || 0}
            onChange={v => dispatch({ type: 'SET_PRICING', pricing: { fixedFeePerTransaction: v || undefined } })}
            suffix="MXN"
          />
          <RateInput
            label="Cuota mensual de servicio"
            value={state.pricing.monthlyServiceFee || 0}
            onChange={v => dispatch({ type: 'SET_PRICING', pricing: { monthlyServiceFee: v || undefined } })}
            suffix="MXN"
          />
        </div>
      </div>

      {/* Settlement Days */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold">Días de Liquidación</h3>
            <p className="text-xs text-muted-foreground">
              Días para liquidación por tipo de tarjeta. Requiere merchant account para aplicarse.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: 'debitDays' as const, label: 'Débito' },
            { key: 'creditDays' as const, label: 'Crédito' },
            { key: 'amexDays' as const, label: 'AMEX' },
            { key: 'internationalDays' as const, label: 'Internacional' },
            { key: 'otherDays' as const, label: 'Otros' },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min="0"
                  max="90"
                  step="1"
                  value={state.settlement[key]}
                  onChange={e =>
                    dispatch({ type: 'SET_SETTLEMENT', settlement: { [key]: parseInt(e.target.value) || 0 } })
                  }
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">días</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border/30">
          <div>
            <Label className="text-xs">Tipo de día</Label>
            <Select
              value={state.settlement.dayType}
              onValueChange={v =>
                dispatch({
                  type: 'SET_SETTLEMENT',
                  settlement: { dayType: v as 'BUSINESS_DAYS' | 'CALENDAR_DAYS' },
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUSINESS_DAYS">Días hábiles</SelectItem>
                <SelectItem value="CALENDAR_DAYS">Días calendario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Hora de corte</Label>
            <Input
              type="time"
              value={state.settlement.cutoffTime || '23:00'}
              onChange={e =>
                dispatch({ type: 'SET_SETTLEMENT', settlement: { cutoffTime: e.target.value } })
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Zona horaria de corte</Label>
            <Select
              value={state.settlement.cutoffTimezone || 'America/Mexico_City'}
              onValueChange={v => dispatch({ type: 'SET_SETTLEMENT', settlement: { cutoffTimezone: v } })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Mexico_City">Mexico City</SelectItem>
                <SelectItem value="America/Cancun">Cancún</SelectItem>
                <SelectItem value="America/Tijuana">Tijuana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
