import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Separator } from '@/components/ui/separator'

import type { CommercialConfiguratorPreview } from './commercial-contract'
import { formatCommercialMinor } from './money'

export type ConfigurationReviewState =
  | { status: 'LOADING' | 'ERROR' }
  | { status: 'READY'; data: CommercialConfiguratorPreview }

/** A read-only, freshly resolved preview. Never an accepted quote or payment instruction. */
export function CommercialConfigurationReview({
  state,
  onClose,
  onRetry,
}: {
  state: ConfigurationReviewState
  onClose: () => void
  onRetry: () => void
}) {
  const { t, i18n } = useTranslation('billing')
  const money = (value: string) => formatCommercialMinor(value, 'MXN', i18n.language)
  const data = state.status === 'READY' ? state.data : null
  const quote = data?.preview.quote
  // A bound acquisition offer is not proof that a rule applies to this selection.
  // Keep Server-confirmed promotional periods even when today's discount is zero.
  const hasPromotion = quote?.lines.some(line => line.discountMinor !== '0' || line.promotionalCycles !== null) ?? false

  return (
    <FullScreenModal open onClose={onClose} title={t('commercialBilling.configurator.review.title')} contentClassName="bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:p-8" data-tour="commercial-billing-review">
        <p className="text-sm text-muted-foreground">{t('commercialBilling.configurator.review.description')}</p>
        {state.status === 'LOADING' && <p role="status">{t('commercialBilling.configurator.review.loading')}</p>}
        {state.status === 'ERROR' && (
          <Alert variant="destructive">
            <AlertTitle>{t('commercialBilling.configurator.error.title')}</AlertTitle>
            <AlertDescription>
              {t('commercialBilling.configurator.error.description')}
              <Button type="button" variant="outline" onClick={onRetry} data-tour="commercial-billing-review-retry">
                {t('commercialBilling.actions.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {data && quote && (
          <>
            {data.pricing.state === 'BOUND_OFFER_UNAVAILABLE' && (
              <Alert variant="destructive">
                <AlertTitle>{t('commercialBilling.configurator.offer.unavailableTitle')}</AlertTitle>
                <AlertDescription>{t(`commercialBilling.configurator.offer.unavailable.${data.pricing.reason}`)}</AlertDescription>
              </Alert>
            )}
            <Card className="border-input shadow-none">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">{t('commercialBilling.configurator.summary.title')}</CardTitle>
                {data.pricing.state === 'BOUND_OFFER_APPLIED' && hasPromotion && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {t('commercialBilling.configurator.review.campaign')}
                    <Badge variant="outline" className="max-w-full break-all whitespace-normal">{data.pricing.offerCode}</Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="divide-y divide-border">
                  {quote.lines.map(line => (
                    <li key={line.lineKey} className="space-y-2 py-4 first:pt-0" data-tour="commercial-billing-review-line">
                      <p className="font-medium">{line.name}</p>
                      <p className="text-sm text-muted-foreground">{t(`commercialBilling.billingUnit.${line.billingUnit}`)}</p>
                      <p className="text-sm tabular-nums">{t('commercialBilling.configurator.review.lineList', { amount: money(line.listSubtotalMinor) })}</p>
                      {line.discountMinor !== '0' && (
                        <p className="text-sm tabular-nums">{t('commercialBilling.configurator.review.lineDiscount', { amount: money(line.discountMinor) })}</p>
                      )}
                      <p className="text-sm tabular-nums">{t(
                        line.discountMinor !== '0' || line.promotionalCycles !== null
                          ? 'commercialBilling.configurator.review.lineTotal'
                          : 'commercialBilling.configurator.review.lineTotalWithoutPromotion',
                        { amount: money(line.totalMinor) },
                      )}</p>
                      {line.promotionalCycles !== null && (
                        <Badge variant="secondary">{t('commercialBilling.configurator.offer.cycles', { count: line.promotionalCycles })}</Badge>
                      )}
                      <p className="text-sm text-muted-foreground">{t('commercialBilling.configurator.review.lineRenewal', { amount: money(line.renewalTotalMinor) })}</p>
                    </li>
                  ))}
                </ul>
                <Separator />
                <dl className="space-y-3 text-sm">
                  {(['listSubtotalMinor', 'discountMinor', 'subtotalMinor', 'taxMinor', 'totalMinor'] as const).map((key, index) => (
                    key === 'discountMinor' && quote.today.discountMinor === '0' ? null : <div key={key} className="flex items-baseline justify-between gap-4">
                      <dt>{t(`commercialBilling.configurator.summary.${['list', 'discount', 'subtotal', 'tax', 'today'][index]}`)}</dt>
                      <dd className="shrink-0 font-medium tabular-nums">{key === 'discountMinor' && '−'}{money(quote.today[key])}</dd>
                    </div>
                  ))}
                </dl>
                <p className="rounded-lg bg-muted p-3 text-sm">{t(
                  hasPromotion
                    ? 'commercialBilling.configurator.review.regularRenewal'
                    : 'commercialBilling.configurator.review.renewalWithoutPromotion',
                  { amount: money(quote.renewal.totalMinor) },
                )}</p>
              </CardContent>
            </Card>
          </>
        )}
        <div className="space-y-4 rounded-xl border border-input bg-card p-5" data-tour="commercial-billing-review-safety">
          <Badge variant="outline">{t('commercialBilling.configurator.previewBadge')}</Badge>
          <p className="text-sm text-muted-foreground">{t('commercialBilling.configurator.review.noCharge')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} data-tour="commercial-billing-review-edit">{t('commercialBilling.configurator.review.edit')}</Button>
            <Button type="button" disabled data-tour="commercial-billing-review-confirm">{t('commercialBilling.configurator.review.confirm')}</Button>
          </div>
        </div>
      </div>
    </FullScreenModal>
  )
}
