import { QrCode, Smartphone, Globe, Monitor, Phone, Terminal, Sparkles, CircleDollarSign } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

type Source = 'TPV' | 'QR' | 'WEB' | 'APP' | 'PHONE' | 'POS' | 'SDK' | 'DASHBOARD_TEST' | 'OTHER'

interface PaymentSourceBadgeProps {
  source: Source | string
  externalSource?: string | null
  className?: string
}

/**
 * Renders a payment.source as a Badge with a matching icon.
 *
 * Special case: when `source === 'OTHER'` and `externalSource` is a non-empty
 * string (free-text label typed by staff when logging a manual payment), that
 * label is rendered in place of the generic "Otro" label so operators see the
 * actual channel (e.g. "Uber Eats", "Rappi").
 */
export function PaymentSourceBadge({ source, externalSource, className }: PaymentSourceBadgeProps) {
  // OTHER with a free-text externalSource → show that label
  if (source === 'OTHER' && externalSource && externalSource.trim().length > 0) {
    return (
      <Badge variant="secondary" className={className}>
        <Sparkles className="h-3 w-3 mr-1" />
        {externalSource}
      </Badge>
    )
  }

  const map: Record<Source, { icon: typeof QrCode; label: string }> = {
    TPV: { icon: Terminal, label: 'TPV' },
    QR: { icon: QrCode, label: 'QR' },
    WEB: { icon: Globe, label: 'Web' },
    APP: { icon: Smartphone, label: 'App' },
    PHONE: { icon: Phone, label: 'Teléfono' },
    POS: { icon: Monitor, label: 'POS' },
    SDK: { icon: CircleDollarSign, label: 'SDK' },
    DASHBOARD_TEST: { icon: Sparkles, label: 'Test' },
    OTHER: { icon: CircleDollarSign, label: 'Otro' },
  }

  const entry = map[source as Source] ?? { icon: CircleDollarSign, label: String(source) }
  const Icon = entry.icon
  return (
    <Badge variant="secondary" className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {entry.label}
    </Badge>
  )
}
