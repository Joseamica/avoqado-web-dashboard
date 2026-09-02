import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { ArrowDown, ReceiptText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'

import { CommercialBillingIncompatible, CommercialBillingSkeleton, CommercialBillingUnavailable } from './CommercialBillingStates'
import { formatCommercialMinor } from './money'
import { useCommercialBillingOverview, useCommercialBillingReceipts } from './use-commercial-billing'

export function CommercialReceiptHistoryBoundary({ legacy }: { legacy: ReactNode }) {
  const { t, i18n } = useTranslation('billing')
  const { venueId } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const overview = useCommercialBillingOverview(venueId)
  const commercialReady = overview.data?.state === 'READY'
  const receipts = useCommercialBillingReceipts(venueId, commercialReady)
  const incompatibleReceiptPage = receipts.data?.pages.find(page => page.state === 'INCOMPATIBLE')
  const items = useMemo(() => {
    const seen = new Set<string>()
    return (receipts.data?.pages ?? []).flatMap(page => {
      if (page.state !== 'READY') return []
      return page.items.filter(item => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
    })
  }, [receipts.data?.pages])

  if (overview.isLoading) return <CommercialBillingSkeleton />
  if (overview.isError || !overview.data) return <CommercialBillingUnavailable onRetry={() => void overview.refetch()} />
  if (overview.data.state === 'NO_COMMERCIAL_CONTRACT') return <>{legacy}</>
  if (overview.data.state === 'INCOMPATIBLE') return <CommercialBillingIncompatible supportCode={overview.data.supportCode} />
  if (receipts.isLoading) return <CommercialBillingSkeleton />
  if (receipts.isError) return <CommercialBillingUnavailable onRetry={() => void receipts.refetch()} />
  if (incompatibleReceiptPage?.state === 'INCOMPATIBLE') {
    return <CommercialBillingIncompatible supportCode={incompatibleReceiptPage.supportCode} />
  }

  return (
    <div className="px-4 py-6 sm:px-8" data-tour="commercial-billing-receipts">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="size-4 text-muted-foreground" />
            {t('commercialBilling.receipts.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium text-foreground">{t('commercialBilling.receipts.empty.title')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('commercialBilling.receipts.empty.description')}</p>
            </div>
          ) : (
            <div>
              {items.map((receipt, index) => (
                <div key={receipt.id}>
                  {index > 0 && <Separator />}
                  <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{t(`commercialBilling.receipts.entryType.${receipt.entryType}`)}</p>
                        <Badge variant="outline">{t(`commercialBilling.receipts.provider.${receipt.provider}`)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(receipt.observedAt)}</p>
                    </div>
                    <p className="font-semibold tabular-nums text-foreground">
                      {formatCommercialMinor(receipt.amountMinor, 'MXN', i18n.language)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {receipts.hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer gap-2"
                data-tour="commercial-billing-load-more-receipts"
                disabled={receipts.isFetchingNextPage}
                onClick={() => void receipts.fetchNextPage()}
              >
                <ArrowDown className="size-4" />
                {receipts.isFetchingNextPage ? t('commercialBilling.receipts.loadingMore') : t('commercialBilling.receipts.loadMore')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
