import { useState, type ReactNode } from 'react'
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, ReceiptText, Settings2, TriangleAlert, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PermissionGate } from '@/components/PermissionGate'
import { Separator } from '@/components/ui/separator'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'

import type { CommercialBillingReadyOverview } from './commercial-contract'
import { CommercialBillingIncompatible, CommercialBillingSkeleton, CommercialBillingUnavailable } from './CommercialBillingStates'
import { CommercialConfigurator } from './CommercialConfigurator'
import { formatCommercialMinor } from './money'
import { useCommercialBillingOverview } from './use-commercial-billing'

function CollectionStatus({ overview }: { overview: CommercialBillingReadyOverview }) {
  const { t } = useTranslation('billing')
  const calm = ['CURRENT', 'PAYMENT_PENDING', 'PAYMENT_UNDER_REVIEW'].includes(overview.collectionState)
  const Icon = overview.collectionState === 'CURRENT' ? CheckCircle2 : calm ? Clock3 : TriangleAlert
  return (
    <Alert variant={calm ? 'default' : 'destructive'}>
      <Icon />
      <AlertTitle>{t(`commercialBilling.collection.${overview.collectionState}.title`)}</AlertTitle>
      <AlertDescription>{t(`commercialBilling.collection.${overview.collectionState}.description`)}</AlertDescription>
    </Alert>
  )
}

function CommercialSubscriptions({ overview }: { overview: CommercialBillingReadyOverview }) {
  const { t, i18n } = useTranslation('billing')
  const { fullBasePath } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()
  const money = (value: string) => formatCommercialMinor(value, 'MXN', i18n.language)
  const [configuratorOpen, setConfiguratorOpen] = useState(false)
  const unpaidDeadline = [...overview.obligations]
    .filter(obligation => obligation.outstandingMinor !== '0')
    .sort((left, right) => left.graceEndsAt.localeCompare(right.graceEndsAt))[0]
  const explainsNonPayment = ['PENDING_PAYMENT', 'ACTIVE', 'PAUSED'].includes(overview.contract.status)

  return (
    <div className="space-y-6 px-4 py-6 sm:px-8" data-tour="commercial-billing-overview">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('commercialBilling.title')}</h2>
            <Badge variant="outline">{t(`commercialBilling.contractStatus.${overview.contract.status}`)}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('commercialBilling.subtitle')}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('commercialBilling.renewal.total')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{money(overview.contract.renewal.totalMinor)}</p>
          <p className="text-xs text-muted-foreground">{t('commercialBilling.taxIncluded')}</p>
        </div>
      </div>

      <CollectionStatus overview={overview} />

      {unpaidDeadline && explainsNonPayment && (
        <Alert data-tour="commercial-billing-non-payment-deadline">
          <CalendarClock />
          <AlertTitle>
            {t(
              overview.contract.status === 'PAUSED'
                ? 'commercialBilling.nonPayment.expiredAt'
                : 'commercialBilling.nonPayment.deadline',
              { date: formatDate(unpaidDeadline.graceEndsAt) },
            )}
          </AlertTitle>
          <AlertDescription>
            {t(
              overview.contract.status === 'PENDING_PAYMENT'
                ? 'commercialBilling.nonPayment.pendingSelection'
                : overview.contract.status === 'PAUSED'
                  ? 'commercialBilling.nonPayment.pausedSubscription'
                  : 'commercialBilling.nonPayment.activeSubscription',
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('commercialBilling.products.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {overview.contract.lines.map((line, index) => (
            <div key={line.lineKey}>
              {index > 0 && <Separator />}
              <div className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{line.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`commercialBilling.billingUnit.${line.billingUnit}`)}
                    {line.quantity > 1 ? ` · ${t('commercialBilling.quantity', { count: line.quantity })}` : ''}
                  </p>
                  {line.promotionalCycles && (
                    <Badge variant="secondary" className="mt-2">
                      {t('commercialBilling.products.promotionalCycles', { count: line.promotionalCycles })}
                    </Badge>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium tabular-nums text-foreground">{money(line.totalMinor)}</p>
                  {line.totalMinor !== line.renewalTotalMinor && (
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {t('commercialBilling.products.then', { amount: money(line.renewalTotalMinor) })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <Separator />
          <dl className="space-y-2 py-4 text-sm">
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>{t('commercialBilling.breakdown.subtotal')}</dt>
              <dd className="tabular-nums">{money(overview.contract.renewal.subtotalMinor)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>{t('commercialBilling.breakdown.tax')}</dt>
              <dd className="tabular-nums">{money(overview.contract.renewal.taxMinor)}</dd>
            </div>
            <div className="flex justify-between gap-4 font-semibold text-foreground">
              <dt>{t('commercialBilling.breakdown.total')}</dt>
              <dd className="tabular-nums">{money(overview.contract.renewal.totalMinor)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {overview.obligations.map(obligation => (
        <Card key={obligation.receivableId}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">{t('commercialBilling.balance.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('commercialBilling.balance.outstanding')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{money(obligation.outstandingMinor)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('commercialBilling.balance.dueAt')}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formatDate(obligation.dueAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('commercialBilling.balance.reference')}
              </p>
              <p className="mt-1 break-all font-mono text-sm font-medium text-foreground">{obligation.reference}</p>
            </div>
          </CardContent>
        </Card>
      ))}

      {overview.nextRenewalAt && (
        <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t('commercialBilling.renewal.next')}</span>
          <span className="font-medium text-foreground">{formatDate(overview.nextRenewalAt)}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" className="cursor-pointer gap-2" data-tour="commercial-billing-view-receipts">
          <Link to={`${fullBasePath}/settings/billing/history`}>
            {t('commercialBilling.actions.viewReceipts')}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <PermissionGate permission="billing:subscriptions:manage">
          <Button
            type="button"
            className="gap-2"
            variant={configuratorOpen ? 'outline' : 'default'}
            onClick={() => setConfiguratorOpen(value => !value)}
            aria-expanded={configuratorOpen}
            data-tour="commercial-billing-open-configurator"
          >
            {configuratorOpen ? <X className="size-4" /> : <Settings2 className="size-4" />}
            {t(
              configuratorOpen
                ? 'commercialBilling.configurator.actions.close'
                : 'commercialBilling.configurator.actions.open',
            )}
          </Button>
        </PermissionGate>
      </div>

      {configuratorOpen && (
        <>
          <Separator />
          <CommercialConfigurator overview={overview} />
        </>
      )}
    </div>
  )
}

export function CommercialSubscriptionsBoundary({ legacy }: { legacy: ReactNode }) {
  const { venueId } = useCurrentVenue()
  const query = useCommercialBillingOverview(venueId)

  if (query.isLoading) return <CommercialBillingSkeleton />
  if (query.isError || !query.data) return <CommercialBillingUnavailable onRetry={() => void query.refetch()} />
  if (query.data.state === 'NO_COMMERCIAL_CONTRACT') return <>{legacy}</>
  if (query.data.state === 'INCOMPATIBLE') return <CommercialBillingIncompatible supportCode={query.data.supportCode} />
  return <CommercialSubscriptions overview={query.data} />
}
