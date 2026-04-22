import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RECEIPT_PATHS } from '@/constants/receipt'
import type { Order, Payment } from '@/types'
import { Currency } from '@/utils/currency'
import getIcon from '@/utils/getIcon'
import { getOrderStatusConfig } from '@/utils/orderStatus'
import { Banknote, ChevronDown, CreditCard, ExternalLink, RotateCcw, Wallet } from 'lucide-react'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface Props {
  order: Order
  venueTimezone: string
}

const PaymentIcon = ({ p }: { p: Payment }) => {
  const m = (p as any).method?.toUpperCase()
  if ((p as any).type === 'REFUND')
    return (
      <div className="w-9 h-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <RotateCcw className="w-4 h-4 text-red-700 dark:text-red-400" />
      </div>
    )
  if (m === 'CASH')
    return (
      <div className="w-9 h-7 rounded-md bg-muted flex items-center justify-center">
        <Banknote className="w-4 h-4 text-muted-foreground" />
      </div>
    )
  if (m === 'DIGITAL_WALLET')
    return (
      <div className="w-9 h-7 rounded-md bg-muted flex items-center justify-center">
        <Wallet className="w-4 h-4 text-muted-foreground" />
      </div>
    )
  if ((m === 'CREDIT_CARD' || m === 'DEBIT_CARD') && (p as any).cardBrand) return <>{getIcon((p as any).cardBrand)}</>
  return (
    <div className="w-9 h-7 rounded-md bg-muted flex items-center justify-center">
      <CreditCard className="w-4 h-4 text-muted-foreground" />
    </div>
  )
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground">{value}</span>
  </div>
)

const DetailLink = ({ label, href, text }: { label: string; href: string; text: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
      {text}
      <ExternalLink className="w-3 h-3" />
    </a>
  </div>
)

const PaymentRow = ({ p, venueTimezone }: { p: Payment; venueTimezone: string }) => {
  const { t } = useTranslation('orders')
  const { t: tPayment } = useTranslation('payment')
  const [open, setOpen] = useState(false)
  const isRefund = (p as any).type === 'REFUND'
  const total = Number((p as any).amount ?? 0) + Number((p as any).tipAmount ?? 0)
  const date = DateTime.fromISO(p.createdAt, { zone: 'utc' }).setZone(venueTimezone).toFormat("d LLL, HH:mm", { locale: 'es' })
  const statusCfg = getOrderStatusConfig((p as any).status)
  const last4 = (p as any).maskedPan?.slice(-4)
  const label = isRefund
    ? t('drawer.payments.refund')
    : (p as any).cardBrand
      ? `${(p as any).cardBrand}${last4 ? ` ····${last4}` : ''}`
      : tPayment(`methods.${String((p as any).method).toLowerCase()}`, { defaultValue: (p as any).method })
  const receipt = (p as any).receipts?.[0]
  const processedByName = (p as any).processedBy
    ? `${(p as any).processedBy.firstName ?? ''} ${(p as any).processedBy.lastName ?? ''}`.trim()
    : null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border last:border-b-0">
      <div className="py-3 flex items-start gap-3">
        <PaymentIcon p={p} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-2">
            <span className={`text-sm font-medium ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>{label}</span>
            <span className={`text-sm font-medium ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
              {isRefund && '-'}
              {Currency(Math.abs(total))}
            </span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-xs text-muted-foreground">{date}</span>
            <Badge variant="outline" className={`${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} text-[10px] py-0`}>
              {t(`detail.statuses.${(p as any).status}`, { defaultValue: (p as any).status })}
            </Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-auto p-0 mt-1 text-xs underline" data-print-hide>
              {open ? t('drawer.payments.showLess') : t('drawer.payments.showMore')}
              <ChevronDown className={`ml-1 w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1 text-xs">
            {isRefund ? (
              <>
                {(p as any).refundReason && (
                  <Detail
                    label={t('drawer.payments.reason')}
                    value={t(`drawer.refundReasons.${(p as any).refundReason}`, { defaultValue: (p as any).refundReason })}
                  />
                )}
                {receipt && (
                  <DetailLink
                    label={t('drawer.payments.receipt')}
                    href={`${RECEIPT_PATHS.PUBLIC}/${receipt.accessKey}`}
                    text={receipt.accessKey.slice(0, 8)}
                  />
                )}
                {(p as any).originalPaymentId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('drawer.payments.originalPayment')}</span>
                    <Link to={`../payments/${(p as any).originalPaymentId}`} className="text-primary underline">
                      {(p as any).originalPaymentId.slice(0, 8)}
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <>
                {receipt && (
                  <DetailLink
                    label={t('drawer.payments.receipt')}
                    href={`${RECEIPT_PATHS.PUBLIC}/${receipt.accessKey}`}
                    text={receipt.accessKey.slice(0, 8)}
                  />
                )}
                {processedByName && <Detail label={t('drawer.payments.processedBy')} value={processedByName} />}
                {(p as any).authorizationNumber && <Detail label={t('drawer.payments.authorization')} value={(p as any).authorizationNumber} />}
                {(p as any).referenceNumber && <Detail label={t('drawer.payments.reference')} value={(p as any).referenceNumber} />}
              </>
            )}
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  )
}

export function PaymentsSection({ order, venueTimezone }: Props) {
  const { t } = useTranslation('orders')
  const payments = order.payments ?? []
  const remainingBalance = Number(order.remainingBalance ?? 0)
  const hasPendingBalance = remainingBalance > 0 && (order.paymentStatus === 'PENDING' || order.paymentStatus === 'PARTIAL')

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.payments')}</h2>
      <div className="rounded-lg border border-border bg-background px-4">
        {payments.length > 0 && payments.map(p => <PaymentRow key={p.id} p={p} venueTimezone={venueTimezone} />)}
        {hasPendingBalance ? (
          <div className="py-3 flex items-center justify-between gap-3 border-t border-red-200/60 dark:border-red-800/40 first:border-t-0">
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              {t('drawer.payments.pendingBalance', { defaultValue: 'Pendiente de cobrar' })}
            </span>
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">{Currency(remainingBalance)}</span>
          </div>
        ) : (
          payments.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">{t('drawer.payments.noPayments', { defaultValue: 'Sin pagos' })}</p>
          )
        )}
      </div>
    </section>
  )
}
