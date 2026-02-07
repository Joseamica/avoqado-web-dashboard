/**
 * EvidenceRules - Photo evidence toggle for deposit voucher
 *
 * Note: Facade photo is a sub-toggle under "Control de Asistencia" in ModuleToggles.
 * Clock-in photo is also controlled by "Control de Asistencia".
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Switch } from '@/components/ui/switch'
import { Camera } from 'lucide-react'

export interface EvidenceRulesState {
  requireDepositPhoto: boolean
}

interface EvidenceRulesProps {
  values: EvidenceRulesState
  onChange: (key: keyof EvidenceRulesState, value: boolean) => void
}

export function EvidenceRules({ values, onChange }: EvidenceRulesProps) {
  const { t } = useTranslation('playtelecom')

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-6 flex items-center gap-2">
        {t('tpvConfig.evidence.title', { defaultValue: 'Reglas de Evidencia Fotografica' })}
      </h3>
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400">
            <Camera className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {t('tpvConfig.evidence.deposit', { defaultValue: 'Foto de Voucher Bancario' })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t('tpvConfig.evidence.depositDesc', { defaultValue: 'Requiere foto del comprobante al reportar deposito de efectivo' })}
            </p>
          </div>
        </div>
        <Switch
          checked={values.requireDepositPhoto}
          onCheckedChange={(checked) => onChange('requireDepositPhoto', checked)}
        />
      </div>
    </GlassCard>
  )
}
