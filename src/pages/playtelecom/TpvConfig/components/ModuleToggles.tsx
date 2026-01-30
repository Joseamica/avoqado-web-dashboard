/**
 * ModuleToggles - 4 toggle cards for TPV modules
 * Attendance, Cash Payments, Card Payments, Barcode Scanner
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Switch } from '@/components/ui/switch'
import { Clock, Banknote, CreditCard, ScanBarcode } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModuleToggleState {
  attendanceTracking: boolean
  enableCashPayments: boolean
  enableCardPayments: boolean
  enableBarcodeScanner: boolean
}

interface ModuleTogglesProps {
  values: ModuleToggleState
  onChange: (key: keyof ModuleToggleState, value: boolean) => void
}

const MODULES = [
  {
    key: 'attendanceTracking' as const,
    icon: Clock,
    labelKey: 'tpvConfig.modules.attendance',
    labelDefault: 'Control de Asistencia',
    descKey: 'tpvConfig.modules.attendanceDesc',
    descDefault: 'Clock-in / Clock-out obligatorio',
    colorClass: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
  },
  {
    key: 'enableCashPayments' as const,
    icon: Banknote,
    labelKey: 'tpvConfig.modules.cash',
    labelDefault: 'Cobros en Efectivo',
    descKey: 'tpvConfig.modules.cashDesc',
    descDefault: 'Permitir recibir dinero fisico',
    colorClass: 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400',
  },
  {
    key: 'enableCardPayments' as const,
    icon: CreditCard,
    labelKey: 'tpvConfig.modules.card',
    labelDefault: 'Cobros con Tarjeta',
    descKey: 'tpvConfig.modules.cardDesc',
    descDefault: 'Integracion con terminal bancaria',
    colorClass: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
  },
  {
    key: 'enableBarcodeScanner' as const,
    icon: ScanBarcode,
    labelKey: 'tpvConfig.modules.scanner',
    labelDefault: 'Escaner de Codigo',
    descKey: 'tpvConfig.modules.scannerDesc',
    descDefault: 'Uso de camara para leer ICCID',
    colorClass: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
  },
]

export function ModuleToggles({ values, onChange }: ModuleTogglesProps) {
  const { t } = useTranslation('playtelecom')

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-6 flex items-center gap-2">
        {t('tpvConfig.modules.title', { defaultValue: 'Modulos Principales' })}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map(mod => {
          const Icon = mod.icon
          return (
            <div
              key={mod.key}
              className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50"
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg bg-gradient-to-br', mod.colorClass)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t(mod.labelKey, { defaultValue: mod.labelDefault })}</p>
                  <p className="text-[10px] text-muted-foreground">{t(mod.descKey, { defaultValue: mod.descDefault })}</p>
                </div>
              </div>
              <Switch
                checked={values[mod.key]}
                onCheckedChange={(checked) => onChange(mod.key, checked)}
              />
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}
