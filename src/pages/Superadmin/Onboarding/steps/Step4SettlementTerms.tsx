import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Banknote, Clock } from 'lucide-react'
import type { SettlementData } from '../onboarding.types'

interface Props {
  settlement: SettlementData
  onChange: (data: Partial<SettlementData>) => void
}

const CARD_TYPES: Array<{ key: keyof Pick<SettlementData, 'debitDays' | 'creditDays' | 'amexDays' | 'internationalDays' | 'otherDays'>; label: string }> = [
  { key: 'debitDays', label: 'Debito' },
  { key: 'creditDays', label: 'Credito' },
  { key: 'amexDays', label: 'AMEX' },
  { key: 'internationalDays', label: 'Internacional' },
  { key: 'otherDays', label: 'Otro' },
]

export const Step4SettlementTerms: React.FC<Props> = ({ settlement, onChange }) => (
  <div className="space-y-6">
    {/* Settlement Days Card */}
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
          <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="font-semibold">Plazos de Liquidacion</h3>
          <p className="text-sm text-muted-foreground">Dias para liquidar cada tipo de transaccion</p>
        </div>
      </div>

      <div className="space-y-3">
        {CARD_TYPES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-4">
            <span className="w-28 text-sm font-medium">{label}</span>
            <Input
              type="number"
              min={0}
              className="w-24 h-12 text-base"
              value={settlement[key]}
              onChange={(e) => onChange({ [key]: +e.target.value })}
            />
            <span className="text-sm text-muted-foreground">dias</span>
          </div>
        ))}
      </div>
    </div>

    {/* Cutoff Config Card */}
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold">Configuracion de Corte</h3>
          <p className="text-sm text-muted-foreground">Tipo de dias, hora y zona horaria de corte</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo de dias</Label>
          <Select value={settlement.dayType} onValueChange={(v) => onChange({ dayType: v as SettlementData['dayType'] })}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUSINESS_DAYS">Dias habiles</SelectItem>
              <SelectItem value="CALENDAR_DAYS">Dias calendario</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Hora de corte</Label>
          <Input className="h-12 text-base" type="time" value={settlement.cutoffTime} onChange={(e) => onChange({ cutoffTime: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Zona horaria</Label>
          <Select value={settlement.cutoffTimezone} onValueChange={(v) => onChange({ cutoffTimezone: v })}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Mexico_City">Ciudad de Mexico</SelectItem>
              <SelectItem value="America/Monterrey">Monterrey</SelectItem>
              <SelectItem value="America/Tijuana">Tijuana</SelectItem>
              <SelectItem value="America/Cancun">Cancun</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  </div>
)
