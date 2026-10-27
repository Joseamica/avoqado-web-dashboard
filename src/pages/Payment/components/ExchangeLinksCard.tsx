import api from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAccess } from '@/hooks/use-access'
import { exchangeReviewReasonLabel, exchangeStatusLabel } from '@/lib/exchangeStatus'
import type { ExchangeLinks } from '@/types'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

// `applied` confirms the exchange, but inventory posting may still be pending.
interface ExchangeDetail {
  id: string
  status: string
  applied: boolean
  returnedCents: number
  takenCents: number
  differenceCents: number
  returned: Array<{
    orderItemId: string
    productId: string | null
    productName: string
    quantity: number
    reason: string
    restock: boolean
    pieceValuesCents: number[]
    valueCents: number
  }>
  taken: Array<{
    productId: string
    productName: string
    quantity: number
    listCents: number
    priceCents: number
    pieces: Array<{ priceCents: number; inheritedFromOrderItemId: string | null }>
    newOrderItemIds: string[]
  }>
  settlement: { kind: string; method: string | null; amountCents: number }
  staffName: string | null
  reviewedAt: string | null
  reviewNote: string | null
  reviewReason: string | null
  expectedChargeCents: number | null
  chargedCents: number | null
  chargePaymentCount: number | null
  paymentIds: string[]
  chargePaymentId: string | null
}

export function ExchangeDetailContent({ exchangeId }: { exchangeId: string }) {
  const { t } = useTranslation('payment')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['exchange', venueId, exchangeId],
    queryFn: async () => (await api.get<{ data: ExchangeDetail }>(`/api/v1/dashboard/venues/${venueId}/exchanges/${exchangeId}`)).data.data,
    enabled: !!venueId && !!exchangeId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  if (isPending) return <p role="status">{t('exchange.loading')}</p>
  if (isError)
    return (
      <div role="alert">
        <p>{t('exchange.loadError')}</p>
        <Button variant="outline" onClick={() => refetch()}>
          {t('exchange.retry')}
        </Button>
      </div>
    )

  const money = (cents: number | null) => (cents == null ? '—' : Currency(cents, true))
  const reasonKeys: Record<string, string> = {
    SIZE: 'exchange.reasons.size',
    TASTE: 'exchange.reasons.taste',
    DEFECT: 'exchange.reasons.defect',
  }
  const methodKeys: Record<string, string> = {
    CASH: 'exchange.methods.cash',
    CARD_TERMINAL: 'exchange.methods.card',
    BANK_TRANSFER: 'exchange.methods.bankTransfer',
    GIFT_CARD_BALANCE: 'exchange.methods.giftCard',
    TENDER: 'exchange.methods.tender',
  }
  const settlementKeys: Record<string, string> = {
    EVEN: 'exchange.settlement.even',
    COLLECT: 'exchange.settlement.collect',
    PAYOUT: 'exchange.settlement.payout',
  }
  const paymentIds = [...new Set([...(data.paymentIds ?? []), ...(data.chargePaymentId ? [data.chargePaymentId] : [])])]

  return (
    <div className="space-y-4 text-sm" data-tour="exchange-detail">
      <p className="font-medium">{exchangeStatusLabel(data.status, t)}</p>
      <section aria-label={t(data.applied ? 'exchange.returned' : 'exchange.requestedReturned')} className="space-y-2">
        <h4 className="font-semibold">{t(data.applied ? 'exchange.returned' : 'exchange.requestedReturned')}</h4>
        {data.returned.map(line => (
          <div key={line.orderItemId} className="space-y-1">
            <p>{line.productName}</p>
            <p>{t('exchange.quantityValue', { quantity: line.quantity, value: money(line.valueCents) })}</p>
            <p className="text-muted-foreground">{reasonKeys[line.reason] ? t(reasonKeys[line.reason]) : line.reason}</p>
            <p>{t(line.restock ? 'exchange.requestedRestock' : 'exchange.noRestock')}</p>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h4 className="font-semibold">{t(data.applied ? 'exchange.taken' : 'exchange.requestedTaken')}</h4>
        {data.taken.map((line, index) => (
          <div key={`${line.productId}-${index}`} className="space-y-1">
            <p>{line.productName}</p>
            <p>{t('exchange.quantityPrice', { quantity: line.quantity, price: money(line.priceCents) })}</p>
            {line.pieces.map((piece, i) => (
              <p key={i} className="text-muted-foreground">
                {t(piece.inheritedFromOrderItemId ? 'exchange.inheritedPrice' : 'exchange.piecePrice', { price: money(piece.priceCents) })}
              </p>
            ))}
          </div>
        ))}
      </section>
      <div className="border-t border-input pt-3 space-y-1">
        <p>{t('exchange.returnedTotal', { amount: money(data.returnedCents) })}</p>
        <p>{t('exchange.takenTotal', { amount: money(data.takenCents) })}</p>
        <p className="font-semibold">{t('exchange.difference', { amount: money(data.differenceCents) })}</p>
        <p>{t(data.applied ? 'exchange.settled' : 'exchange.requestedSettlement')}</p>
        <p>{settlementKeys[data.settlement.kind] ? t(settlementKeys[data.settlement.kind]) : data.settlement.kind}</p>
        {data.settlement.method && (
          <p>{methodKeys[data.settlement.method] ? t(methodKeys[data.settlement.method]) : data.settlement.method}</p>
        )}
        <p>{t('exchange.settlementAmount', { amount: money(data.settlement.amountCents) })}</p>
      </div>
      <div className="space-y-1">
        <p>{t('exchange.staff', { name: data.staffName ?? '—' })}</p>
        {data.status === 'NEEDS_REVIEW' && (
          <>
            {data.reviewReason && <p>{exchangeReviewReasonLabel(data.reviewReason, t)}</p>}
            <p>{t('exchange.expectedCharge', { amount: money(data.expectedChargeCents) })}</p>
            <p>
              {data.chargedCents != null && data.chargePaymentCount != null
                ? t('exchange.chargedCount', { amount: money(data.chargedCents), count: data.chargePaymentCount })
                : t('exchange.charged', { amount: money(data.chargedCents) })}
            </p>
            {paymentIds.map(id => (
              <Link key={id} to={`${fullBasePath}/payments/${id}`} className="block text-primary underline">
                {t('exchange.viewPayment', { id })}
              </Link>
            ))}
          </>
        )}
        {data.status === 'NEEDS_REVIEW' && data.reviewedAt && <p>{t('exchange.reviewedAt', { date: formatDateTime(data.reviewedAt) })}</p>}
        {data.reviewNote && <p>{data.reviewNote}</p>}
      </div>
    </div>
  )
}

function ExchangeLinkRow({
  exchangeId,
  orderId,
  label,
  status,
  reviewedAt,
}: {
  exchangeId: string
  orderId: string
  label: string
  status: string
  reviewedAt: string | null
}) {
  const { t } = useTranslation('payment')
  const { fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-input pt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {can('orders:read') ? (
          <Link to={`${fullBasePath}/orders/${orderId}`} className="text-primary underline">
            {label}
          </Link>
        ) : (
          <span>{label}</span>
        )}
        <Badge variant="secondary">{exchangeStatusLabel(status, t)}</Badge>
        {status === 'NEEDS_REVIEW' && reviewedAt && <Badge variant="outline">{t('exchange.reviewed')}</Badge>}
        {/* The detail endpoint requires payments:read; the order drawer can be opened without it. */}
        {can('payments:read') && (
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              data-tour="exchange-expand"
              aria-label={t(open ? 'exchange.hideDetail' : 'exchange.viewDetail', { order: label })}
            >
              <ChevronDown aria-hidden="true" className={`h-4 w-4 ${open ? 'rotate-180' : ''}`} />
              {t(open ? 'exchange.hideDetailShort' : 'exchange.viewDetailShort')}
            </Button>
          </CollapsibleTrigger>
        )}
      </div>
      <CollapsibleContent>{open && can('payments:read') && <ExchangeDetailContent exchangeId={exchangeId} />}</CollapsibleContent>
    </Collapsible>
  )
}

export function ExchangeLinksCard({ orderId, links }: { orderId: string; links?: ExchangeLinks }) {
  const { t } = useTranslation('payment')
  const { fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  if (!links || (!links.asOriginal.length && !links.asNew && !links.asOriginalTotal)) return null
  const remaining = links.asOriginalTotal - links.asOriginal.length
  return (
    <section data-tour="exchange-links" aria-label={t('exchange.title')} className="rounded-xl border border-input bg-card p-6 space-y-3">
      <Badge variant="outline">{t('exchange.title')}</Badge>
      {links.asOriginal.map(link => (
        <ExchangeLinkRow
          key={link.exchangeId}
          exchangeId={link.exchangeId}
          orderId={link.newOrderId}
          label={t('exchange.asOriginal', { order: link.newOrderNumber })}
          status={link.status}
          reviewedAt={link.reviewedAt}
        />
      ))}
      {links.asNew && (
        <ExchangeLinkRow
          exchangeId={links.asNew.exchangeId}
          orderId={links.asNew.originalOrderId}
          label={t('exchange.asNew', { order: links.asNew.originalOrderNumber })}
          status={links.asNew.status}
          reviewedAt={links.asNew.reviewedAt}
        />
      )}
      {remaining > 0 &&
        (can('payments:read') ? (
          <Link to={`${fullBasePath}/payments/exchanges?order=${encodeURIComponent(orderId)}`} className="block text-primary underline">
            {t('exchange.more', { count: remaining })}
          </Link>
        ) : (
          <span className="block text-muted-foreground">{t('exchange.more', { count: remaining })}</span>
        ))}
    </section>
  )
}
