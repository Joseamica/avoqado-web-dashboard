import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { readHybridOffer, readHybridAttempt } from '@/lib/hybridIntent'
import type { SetupData } from '@/pages/Setup/types'
const Checkout = lazy(() => import('./HybridCheckout').then(module => ({ default: module.HybridCheckout })))
export function HybridOnboardingButton({
  venueId,
  disabled,
  onNext,
  initialSlug,
}: {
  venueId: string
  initialSlug?: string
  disabled?: boolean
  onNext: (data: Partial<SetupData>) => void | Promise<boolean | void>
}) {
  const { t } = useTranslation('billing')
  const [open, setOpen] = useState(() => !!initialSlug || !!readHybridOffer() || !!readHybridAttempt(venueId))
  return (
    <>
      <Button variant="outline" disabled={disabled || !venueId} onClick={() => setOpen(true)} data-tour="setup-hybrid-offers">
        {t('hybrid.open')}
      </Button>
      <FullScreenModal
        open={open && !!venueId && !disabled}
        onClose={() => setOpen(false)}
        title={t('hybrid.title')}
        contentClassName="bg-muted/30"
      >
        <div className="p-4 sm:p-8">
          <Suspense fallback={<p>{t('catalog.loading')}</p>}>
            <Checkout
              key={venueId}
              venueId={venueId}
              initialSlug={initialSlug}
              onCompleted={async hybridPurchaseId => {
                // Hybrid contracts own access. FREE here means no second legacy base-plan charge.
                const result = await onNext({ plan: { tier: 'FREE', hybridPurchaseId, acceptedAt: new Date().toISOString() } })
                if (result === false) throw new Error(t('hybrid.error'))
                setOpen(false)
              }}
            />
          </Suspense>
        </div>
      </FullScreenModal>
    </>
  )
}
