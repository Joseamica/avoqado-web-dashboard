import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { FilterPill } from '@/components/filters/FilterPill'
import { SingleSelectFilterContent } from '@/components/filters/SingleSelectFilterContent'
import { Button } from '@/components/ui/button'
import { ExchangesToReviewSection } from '@/pages/Reports/components/ExchangesToReviewSection'

export default function Exchanges() {
  const { t } = useTranslation('reports')
  const [params, setParams] = useSearchParams()
  const originalOrderId = params.get('order') || undefined
  // The overflow link must include completed/reviewed exchanges too.
  const pendingReview = params.get('view') === 'pending' || (!params.has('view') && !originalOrderId)
  const filter = t(pendingReview ? 'refunds.exchangesToReview.pending' : 'refunds.exchangesToReview.all')
  const setView = (value: string) =>
    setParams(previous => {
      const next = new URLSearchParams(previous)
      next.set('view', value)
      return next
    })
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('refunds.exchangesToReview.pageTitle')}</h1>
      <div className="flex flex-wrap items-center gap-3" data-tour="exchanges-filters">
        <FilterPill label={t('refunds.exchangesToReview.status')} activeValue={filter}>
          <SingleSelectFilterContent
            title={t('refunds.exchangesToReview.status')}
            selectedValue={pendingReview ? 'pending' : 'all'}
            onSelect={setView}
            options={[
              { value: 'pending', label: t('refunds.exchangesToReview.pending') },
              { value: 'all', label: t('refunds.exchangesToReview.all') },
            ]}
          />
        </FilterPill>
        {originalOrderId && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() =>
              setParams(previous => {
                const next = new URLSearchParams(previous)
                next.delete('order')
                next.set('view', pendingReview ? 'pending' : 'all')
                return next
              })
            }
          >
            {t('refunds.exchangesToReview.clearOrder')}
          </Button>
        )}
      </div>
      <ExchangesToReviewSection pendingReview={pendingReview} originalOrderId={originalOrderId} />
    </div>
  )
}
