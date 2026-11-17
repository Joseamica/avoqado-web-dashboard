import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { readHybridOffer, readHybridAttempt } from '@/lib/hybridIntent'
import { usePublicBasicPlan } from '@/hooks/usePublicBasicPlan'
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
  // Una recomendación `hybridOffer` abre solita la compra híbrida… salvo la del Plan Básico: esa llega a «Elige tu plan»
  // con la tarjeta Básico preseleccionada y NO abre ningún cobro. Para saberlo hay que esperar al slug del Básico.
  const slug = initialSlug ?? readHybridOffer()
  const { plan: basico, loaded } = usePublicBasicPlan(!!slug)
  const [open, setOpen] = useState(() => !!readHybridAttempt(venueId))
  const autoAbierto = useRef(false)
  useEffect(() => {
    if (!slug || !loaded || autoAbierto.current) return
    autoAbierto.current = true
    if (slug !== basico?.slug) setOpen(true)
  }, [slug, loaded, basico?.slug])
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
