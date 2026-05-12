import {
  QrCode,
  Smartphone,
  Globe,
  Monitor,
  Phone,
  Terminal,
  Sparkles,
  CircleDollarSign,
  Link2,
  CalendarCheck,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'

type Source = 'TPV' | 'QR' | 'WEB' | 'APP' | 'PHONE' | 'POS' | 'SDK' | 'DASHBOARD_TEST' | 'OTHER'

interface PaymentSourceBadgeProps {
  source: Source | string
  externalSource?: string | null
  /**
   * Optional `Order.source` from the parent order. When `payment.source === 'WEB'`
   * the parent order's source tells us *which* web channel actually generated
   * the payment (PAYMENT_LINK vs reservation deposit vs other). Lets the badge
   * surface a meaningful label like "Liga de pago" instead of a generic "Web".
   */
  orderSource?: string | null
  className?: string
}

/**
 * Renders a payment.source as a Badge with a matching icon.
 *
 * Two refinements over the raw enum:
 *  - When `source === 'OTHER'` and `externalSource` is set, that free-text
 *    label (e.g. "Uber Eats", "Rappi") shows instead of the generic "Otro".
 *  - When `source === 'WEB'`, the parent `orderSource` (`PAYMENT_LINK` etc.)
 *    disambiguates the channel — important now that we have multiple WEB-
 *    originated flows (payment links, reservation deposits, future kiosk).
 */
export function PaymentSourceBadge({ source, externalSource, orderSource, className }: PaymentSourceBadgeProps) {
  // OTHER with a free-text externalSource → show that label
  if (source === 'OTHER' && externalSource && externalSource.trim().length > 0) {
    return (
      <Badge variant="secondary" className={className}>
        <Sparkles className="h-3 w-3 mr-1" />
        {externalSource}
      </Badge>
    )
  }

  // WEB + payment-link order → "Liga" (more useful than generic Web). The
  // /payments table Origen column is narrow; longer labels like "Liga de pago"
  // wrap onto 3 lines and look broken — short label + nowrap keeps it clean.
  if (source === 'WEB' && orderSource === 'PAYMENT_LINK') {
    return (
      <Badge variant="secondary" className={`whitespace-nowrap ${className ?? ''}`} title="Liga de pago">
        <Link2 className="h-3 w-3 mr-1" />
        Liga
      </Badge>
    )
  }
  // Reservation deposits travel through the same Stripe Connect rail but the
  // Order is created on a different code path (today none; reservations don't
  // create Orders). Once they do, this branch surfaces them.
  if (source === 'WEB' && orderSource === 'RESERVATION') {
    return (
      <Badge variant="secondary" className={`whitespace-nowrap ${className ?? ''}`} title="Reservación">
        <CalendarCheck className="h-3 w-3 mr-1" />
        Reserva
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
    <Badge variant="secondary" className={`whitespace-nowrap ${className ?? ''}`}>
      <Icon className="h-3 w-3 mr-1" />
      {entry.label}
    </Badge>
  )
}
