/**
 * EvidenceRules - Photo evidence rule configuration
 * 3 rules: Clock-in photo, Deposit voucher photo, Facade photo
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface EvidenceRulesState {
  clockInPhotoRule: 'OBLIGATORIO' | 'OPCIONAL' | 'DESACTIVADO'
  depositPhotoRule: 'OBLIGATORIO' | 'OBLIGATORIO_ALTA_CALIDAD'
  facadePhotoRule: 'ALEATORIO' | 'SIEMPRE' | 'NUNCA'
}

interface EvidenceRulesProps {
  values: EvidenceRulesState
  onChange: (key: keyof EvidenceRulesState, value: string) => void
}

export function EvidenceRules({ values, onChange }: EvidenceRulesProps) {
  const { t } = useTranslation('playtelecom')

  const rules = [
    {
      key: 'clockInPhotoRule' as const,
      label: t('tpvConfig.evidence.clockIn', { defaultValue: 'Foto en Clock-in (Entrada)' }),
      desc: t('tpvConfig.evidence.clockInDesc', { defaultValue: 'Obligar selfie al iniciar turno' }),
      options: [
        { value: 'OBLIGATORIO', label: t('tpvConfig.evidence.required', { defaultValue: 'Obligatorio' }) },
        { value: 'OPCIONAL', label: t('tpvConfig.evidence.optional', { defaultValue: 'Opcional' }) },
        { value: 'DESACTIVADO', label: t('tpvConfig.evidence.disabled', { defaultValue: 'Desactivado' }) },
      ],
    },
    {
      key: 'depositPhotoRule' as const,
      label: t('tpvConfig.evidence.deposit', { defaultValue: 'Foto de Voucher Bancario' }),
      desc: t('tpvConfig.evidence.depositDesc', { defaultValue: 'Al reportar deposito de efectivo' }),
      options: [
        { value: 'OBLIGATORIO_ALTA_CALIDAD', label: t('tpvConfig.evidence.requiredHQ', { defaultValue: 'Obligatorio (Alta Calidad)' }) },
        { value: 'OBLIGATORIO', label: t('tpvConfig.evidence.requiredNormal', { defaultValue: 'Obligatorio (Normal)' }) },
      ],
    },
    {
      key: 'facadePhotoRule' as const,
      label: t('tpvConfig.evidence.facade', { defaultValue: 'Foto de Fachada/Tienda' }),
      desc: t('tpvConfig.evidence.facadeDesc', { defaultValue: 'Validacion de ubicacion visual' }),
      options: [
        { value: 'ALEATORIO', label: t('tpvConfig.evidence.random', { defaultValue: 'Aleatorio (Spot check)' }) },
        { value: 'SIEMPRE', label: t('tpvConfig.evidence.always', { defaultValue: 'Siempre' }) },
        { value: 'NUNCA', label: t('tpvConfig.evidence.never', { defaultValue: 'Nunca' }) },
      ],
    },
  ]

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-6 flex items-center gap-2">
        {t('tpvConfig.evidence.title', { defaultValue: 'Reglas de Evidencia Fotografica' })}
      </h3>
      <div className="space-y-1">
        {rules.map((rule, idx) => (
          <div
            key={rule.key}
            className={`flex items-center justify-between py-3 ${idx < rules.length - 1 ? 'border-b border-border/50' : ''}`}
          >
            <div>
              <p className="text-sm font-semibold">{rule.label}</p>
              <p className="text-[10px] text-muted-foreground">{rule.desc}</p>
            </div>
            <Select
              value={values[rule.key]}
              onValueChange={(val) => onChange(rule.key, val)}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rule.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
