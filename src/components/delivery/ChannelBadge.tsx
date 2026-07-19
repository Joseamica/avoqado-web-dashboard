const DELIVERY_LABELS: Record<string, string> = {
  UBER_EATS: 'Uber Eats',
  RAPPI: 'Rappi',
  DIDI_FOOD: 'DiDi Food',
  DELIVERY_PLATFORM: 'Delivery',
}

/**
 * Small badge that flags an Order/Payment row as coming from a delivery
 * channel (Uber Eats, Rappi, DiDi Food, or an unidentified aggregator).
 *
 * Renders `null` for any non-delivery `source` (TPV, QR, WEB, APP, ...), so
 * it's safe to drop into every row of Orders/Payments without affecting
 * normal (non-delivery) rows' layout.
 */
export function ChannelBadge({ source }: { source?: string | null }) {
  if (!source || !(source in DELIVERY_LABELS)) return null
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      {DELIVERY_LABELS[source]}
    </span>
  )
}
