import { Loader2, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDeliveryStatus } from '@/hooks/use-delivery-status'
import { DeliveryTeaser } from './components/DeliveryTeaser'
import { DeliveryPending } from './components/DeliveryPending'
import { DeliveryLivePanel } from './components/DeliveryLivePanel'

/**
 * Delivery — single page, 4 data-driven states ("readiness = dato", no manual flags; design
 * spec docs/superpowers/specs/2026-07-18-delivery-dashboard-design.md §3):
 *   1. LOCKED  — intercepted by <FeatureGate>: content below still mounts but renders blurred
 *      behind the paywall card (same pattern as CfdiList's SAMPLE_CFDIS). useDeliveryStatus's
 *      own `enabled` gate keeps this from ever hitting the (feature-gated) activation API.
 *   2. TEASER  — PREMIUM, no activation request yet → DeliveryTeaser (sales copy + CTA).
 *   3. PENDING — activation request PENDING/CONTACTED, no channel ACTIVE yet → DeliveryPending.
 *   4. LIVE    — ≥1 channel ACTIVE → DeliveryLivePanel (stats + channel cards + Orders link).
 */
export default function DeliveryPage() {
  const { t } = useTranslation('delivery')
  const { venueId } = useCurrentVenue()
  const { state, channels, activationRequest, isLoading } = useDeliveryStatus(venueId ?? undefined)

  return (
    <FeatureGate feature="DELIVERY_CHANNELS">
      <div className="p-4 bg-background text-foreground">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
        </div>

        {isLoading || !venueId ? (
          <div className="flex items-center justify-center py-24" role="status" aria-label={t('page.loading')}>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : state === 'PENDING' && activationRequest ? (
          <DeliveryPending request={activationRequest} />
        ) : state === 'LIVE' ? (
          <DeliveryLivePanel venueId={venueId} channels={channels} />
        ) : (
          // TEASER default — LOCKED falls through here too: FeatureGate (above) already blurs
          // this whole subtree behind its paywall card, so the teaser just becomes the "sample
          // content" visible behind the blur (mirrors CfdiList's SAMPLE_CFDIS under FeatureGate).
          <DeliveryTeaser venueId={venueId} />
        )}
      </div>
    </FeatureGate>
  )
}
