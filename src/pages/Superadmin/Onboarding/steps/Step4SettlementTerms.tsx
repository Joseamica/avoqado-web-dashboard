import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    <h3 className="text-lg font-semibold">Plazos de Liquidacion</h3>

    <div className="space-y-3">
      {CARD_TYPES.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-4">
          <span className="w-28 text-sm font-medium">{label}</span>
          <Input
            type="number"
            min={0}
            className="w-20"
            value={settlement[key]}
            onChange={(e) => onChange({ [key]: +e.target.value })}
          />
          <span className="text-sm text-muted-foreground">dias</span>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <Label>Tipo de dias</Label>
        <Select value={settlement.dayType} onValueChange={(v) => onChange({ dayType: v as SettlementData['dayType'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BUSINESS_DAYS">Dias habiles</SelectItem>
            <SelectItem value="CALENDAR_DAYS">Dias calendario</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Hora de corte</Label>
        <Input type="time" value={settlement.cutoffTime} onChange={(e) => onChange({ cutoffTime: e.target.value })} />
      </div>
      <div>
        <Label>Zona horaria</Label>
        <Select value={settlement.cutoffTimezone} onValueChange={(v) => onChange({ cutoffTimezone: v })}>
          <SelectTrigger>
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
)
