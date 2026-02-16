import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Calendar, Info } from 'lucide-react'
import type { WizardState, SettlementData } from '../PaymentSetupWizard'

interface SettlementStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
}

const CARD_TYPES = [
  { key: 'debitDays' as const, label: 'Débito', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  { key: 'creditDays' as const, label: 'Crédito', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/20' },
  { key: 'amexDays' as const, label: 'AMEX', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/20' },
  { key: 'internationalDays' as const, label: 'Internacional', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/20' },
  { key: 'otherDays' as const, label: 'Otro', color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
]

function getExampleDate(days: number, isBusinessDays: boolean): string {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  // Assume transaction on Monday
  const txDay = 1 // Monday

  if (isBusinessDays) {
    let depositDay = txDay + days
    // Skip weekends
    while (depositDay > 5) depositDay += 2
    if (depositDay > 7) depositDay -= 7
    return `Tx ${dayNames[txDay]} → Depósito ${dayNames[depositDay]}`
  }

  const depositDay = (txDay + days) % 7
  return `Tx ${dayNames[txDay]} → Depósito ${dayNames[depositDay]}`
}

/** Local input that allows free typing + validates on blur */
const DaysInput: React.FC<{
  value: number
  onChange: (v: number) => void
  className?: string
}> = ({ value, onChange, className }) => {
  const [local, setLocal] = useState(String(value))
  const [touched, setTouched] = useState(false)

  // Sync from parent when value changes externally (e.g. pre-fill)
  useEffect(() => {
    setLocal(String(value))
  }, [value])

  const isEmpty = local.trim() === ''
  const showError = touched && isEmpty

  return (
    <div className="flex flex-col">
      <Input
        type="number"
        min={1}
        max={30}
        value={local}
        onChange={e => {
          setLocal(e.target.value)
          setTouched(true)
          const parsed = parseInt(e.target.value)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 30) {
            onChange(parsed)
          }
        }}
        onBlur={() => {
          setTouched(true)
          if (isEmpty) return // keep empty to show error
          const parsed = parseInt(local)
          const clamped = isNaN(parsed) ? 1 : Math.min(30, Math.max(1, parsed))
          setLocal(String(clamped))
          onChange(clamped)
        }}
        className={cn(
          'h-10 w-20 text-center font-bold',
          showError && 'border-destructive focus-visible:ring-destructive',
          className,
        )}
      />
      {showError && (
        <span className="text-[10px] text-destructive mt-0.5">Requerido</span>
      )}
    </div>
  )
}

export const SettlementStep: React.FC<SettlementStepProps> = ({ state, dispatch }) => {
  const settlement = state.settlement

  const handleChange = (field: keyof SettlementData, value: any) => {
    dispatch({
      type: 'SET_SETTLEMENT',
      data: { ...settlement, [field]: value },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-indigo-500/10">
            <Calendar className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold">Configuración de Liquidación</h3>
            <p className="text-sm text-muted-foreground">
              Cuándo se depositan los fondos de cada transacción
            </p>
          </div>
        </div>
      </div>

      {/* Global settings */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Day type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de días</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChange('dayType', 'BUSINESS_DAYS')}
                className={cn(
                  'p-3 rounded-xl border-2 text-left transition-all text-sm',
                  settlement.dayType === 'BUSINESS_DAYS'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50',
                )}
              >
                <span className="font-medium">Hábiles</span>
                <p className="text-xs text-muted-foreground mt-0.5">Excluye fines de semana</p>
              </button>
              <button
                type="button"
                onClick={() => handleChange('dayType', 'CALENDAR_DAYS')}
                className={cn(
                  'p-3 rounded-xl border-2 text-left transition-all text-sm',
                  settlement.dayType === 'CALENDAR_DAYS'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50',
                )}
              >
                <span className="font-medium">Calendario</span>
                <p className="text-xs text-muted-foreground mt-0.5">Incluye todos los días</p>
              </button>
            </div>
          </div>

          {/* Cutoff time */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hora de corte</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={settlement.cutoffTime}
                onChange={e => handleChange('cutoffTime', e.target.value)}
                className="h-12 text-base"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {settlement.cutoffTimezone.replace('America/', '')}
              </span>
            </div>
          </div>
        </div>

        {/* Days per card type */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-xs font-medium text-muted-foreground px-1">
            <span>Tipo</span>
            <span>Días</span>
            <span>Ejemplo</span>
          </div>

          {CARD_TYPES.map(card => {
            const days = settlement[card.key]
            const example = getExampleDate(days, settlement.dayType === 'BUSINESS_DAYS')

            return (
              <div
                key={card.key}
                className={cn(
                  'grid grid-cols-3 gap-4 items-center p-3 rounded-xl',
                  card.bgColor,
                )}
              >
                <span className={cn('text-sm font-medium', card.color)}>{card.label}</span>
                <div className="flex items-center gap-2">
                  <DaysInput
                    value={days}
                    onChange={v => handleChange(card.key, v)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {settlement.dayType === 'BUSINESS_DAYS' ? 'háb.' : 'cal.'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{example}</span>
              </div>
            )
          })}
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {settlement.dayType === 'BUSINESS_DAYS'
              ? 'Los días hábiles excluyen sábados, domingos y feriados oficiales'
              : 'Los días calendario incluyen todos los días, incluyendo fines de semana y feriados'}
          </p>
        </div>
      </div>
    </div>
  )
}
