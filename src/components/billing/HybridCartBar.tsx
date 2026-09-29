import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/** The offer list pushes the cart far below the fold, so its state and its one action stay in view here. */
export function HybridCartBar({
  missing,
  price,
  reviewDisabled,
  onReview,
}: {
  missing: { offer: string; count: number; rowId: string } | null
  price: string
  reviewDisabled: boolean
  onReview: () => void
}) {
  const { t } = useTranslation('billing')
  return (
    <div
      data-testid="hybrid-cart-bar"
      className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg"
    >
      <p aria-live="polite" className="text-sm font-medium">
        {missing ? t('hybrid.missing', { offer: missing.offer, count: missing.count }) : t('hybrid.cartSummary', { price })}
      </p>
      <div className="flex flex-wrap gap-2">
        {missing && (
          <Button
            variant="outline"
            onClick={() => document.getElementById(`hybrid-row-${missing.rowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {t('hybrid.chooseNow')}
          </Button>
        )}
        <Button disabled={reviewDisabled} onClick={onReview} data-tour="hybrid-review">
          {t('hybrid.review')}
        </Button>
      </div>
    </div>
  )
}
