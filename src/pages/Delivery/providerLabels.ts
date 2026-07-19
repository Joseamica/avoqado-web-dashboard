/**
 * Human-friendly brand labels for delivery providers/channels — shared across the Delivery
 * page's teaser, pending, and live-panel states.
 *
 * Mirrors `ChannelBadge`'s DELIVERY_LABELS (src/components/delivery/ChannelBadge.tsx), plus
 * DELIVERECT — the adapter itself, shown on live channel cards (`DeliveryChannelLink.provider`)
 * but never offered as a requestable checkbox in `RequestActivationDialog` (owners think in
 * platform brands, not in "which aggregator we use behind the scenes").
 *
 * Brand names are intentionally hardcoded, not translated (real trademarks read the same in
 * every locale — see task-6 brief rule on i18n).
 */
export const PROVIDER_LABELS: Record<string, string> = {
  DELIVERECT: 'Deliverect',
  UBER_EATS: 'Uber Eats',
  RAPPI: 'Rappi',
  DIDI_FOOD: 'DiDi Food',
}

export function providerLabel(code: string): string {
  return PROVIDER_LABELS[code] ?? code
}
