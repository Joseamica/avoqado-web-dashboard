import React from 'react'
import { Badge } from '@/components/ui/badge'

interface Props {
  familia: string
  mcc: string
  confidence: number
  rates: { credito: number; debito: number; internacional: number; amex: number }
}

export const MccPreviewCard: React.FC<Props> = ({ familia, mcc, confidence, rates }) => (
  <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">Familia: {familia}</p>
        <p className="text-xs text-muted-foreground">MCC: {mcc}</p>
      </div>
      <Badge variant={confidence >= 80 ? 'default' : 'secondary'}>{confidence}% match</Badge>
    </div>
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Debito', value: rates.debito },
        { label: 'Credito', value: rates.credito },
        { label: 'AMEX', value: rates.amex },
        { label: 'Internacional', value: rates.internacional },
      ].map((r) => (
        <div key={r.label} className="text-center">
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <p className="text-sm font-semibold">{r.value}%</p>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-muted-foreground">Tasas del proveedor (lo que Blumon nos cobra)</p>
  </div>
)
