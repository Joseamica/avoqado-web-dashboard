import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Info, Landmark, ReceiptText, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatementModel, StatementSegment } from './types'
import { formatVenueDate } from './venueDates'

interface Props {
  model: StatementModel
  formatCurrency: (n: number) => string
}

const SEGMENT_META: Record<StatementSegment['key'], { bar: string; dot: string; labelKey: string }> = {
  cash: { bar: 'bg-emerald-500', dot: 'bg-emerald-500', labelKey: 'salesSummary.paymentTypes.cash' },
  card: { bar: 'bg-blue-500', dot: 'bg-blue-500', labelKey: 'salesSummary.paymentTypes.card' },
  other: { bar: 'bg-orange-500', dot: 'bg-orange-500', labelKey: 'salesSummary.paymentTypes.other' },
}

const CARD_TYPE_LABEL_KEYS: Record<string, string> = {
  CREDIT: 'salesSummary.controls.filterBy.cardType.options.credit',
  DEBIT: 'salesSummary.controls.filterBy.cardType.options.debit',
  AMEX: 'salesSummary.controls.filterBy.cardType.options.amex',
  INTERNATIONAL: 'salesSummary.controls.filterBy.cardType.options.international',
}

/** Below half a cent, a figure is zero (sums of cents in float leave noise). */
const hay = (n: number) => Math.abs(n) >= 0.005

/** A deduction: «−$X», or «+$X» when it came back (a fee a refund reversed), «$0.00» when nothing. Never «−−$X». */
const deduccion = (n: number, formatCurrency: (n: number) => string) =>
  !hay(n) ? formatCurrency(0) : n < 0 ? `+${formatCurrency(-n)}` : `−${formatCurrency(n)}`

/**
 * Statement hero: the period's money story in one place. Big "you keep" number,
 * a flat segmented bar of what was collected by method, the single fee deduction,
 * and where each peso ends up (in hand vs bank). Mercury-style: flat surfaces,
 * tabular numbers, one accent per method — no gradients.
 */
export function StatementFlow({ model, formatCurrency }: Props) {
  const { t, i18n } = useTranslation('reports')
  const [showCardDetail, setShowCardDetail] = useState(false)
  const [showOtherTypes, setShowOtherTypes] = useState(false)
  // D12.3: a type's name is its own name (Rappi, Vales…), else the method's (Transferencia, Tarjeta de otra terminal…).
  const nombreDelTipo = (tipo: StatementModel['otherTypes'][number]) =>
    tipo.label ?? t(`salesSummary.statement.flow.otherTypes.${tipo.method}`, { defaultValue: t('salesSummary.statement.flow.otherTypes.OTHER') })
  const { segments, other, cash, cardNet } = model
  const subBuckets = model.cardSubs

  return (
    <div className="p-5 sm:p-6" data-tour="statement-flow">
      {/* Hero */}
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {t('salesSummary.statement.flow.youKeep')}
      </p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl" data-testid="statement-hero-net">
        {formatCurrency(model.youKeep)}
      </p>

      {/* Collected + segmented bar */}
      <div className="mt-6 flex items-baseline justify-between gap-4">
        <span className="text-sm text-muted-foreground">{t('salesSummary.statement.flow.collected')}</span>
        <span className="text-sm font-semibold tabular-nums" data-testid="statement-collected">
          {formatCurrency(model.collectedTotal)}
        </span>
      </div>

      {segments.length > 0 && (
        <>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {segments.map(seg => (
              <div
                key={seg.key}
                className={cn('h-full', SEGMENT_META[seg.key].bar)}
                style={{ width: `${Math.max(0, seg.pct)}%` }}
                aria-hidden
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {segments.map(seg => (
              <li key={seg.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', SEGMENT_META[seg.key].dot)} aria-hidden />
                <span className="text-foreground">{t(SEGMENT_META[seg.key].labelKey)}</span>
                <span className="tabular-nums">{formatCurrency(seg.amount)}</span>
                <span>· {seg.count} {t('salesSummary.transactionsShort')}</span>
                <span className="tabular-nums">· {seg.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Deductions: refunds (D10.2), Avoqado's fees, and the commission of platforms / own payment types (D1) */}
      <div className="mt-4 space-y-2 border-t border-input pt-4">
        {hay(model.refunds.amount) && (
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {t('salesSummary.statement.flow.refunds', { count: model.refunds.count })}
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground" data-testid="statement-refunds">
              {deduccion(model.refunds.amount, formatCurrency)}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted-foreground">{t('salesSummary.statement.flow.fees')}</span>
          <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground" data-testid="statement-fees">
            {deduccion(model.commissions, formatCurrency)}
          </span>
        </div>
        {hay(model.tenderCommissions) && (
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-muted-foreground">{t('salesSummary.statement.flow.tenderCommissions')}</span>
            <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground" data-testid="statement-tender-commissions">
              {deduccion(model.tenderCommissions, formatCurrency)}
            </span>
          </div>
        )}
        {hay(model.cancelledOrderRefunds) && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="statement-cancelled-refunds">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t('salesSummary.statement.flow.cancelledRefunds', { amount: formatCurrency(model.cancelledOrderRefunds) })}</span>
          </p>
        )}
      </div>

      {/* Where the money ends up */}
      <div className="mt-4 space-y-2">
        {(hay(cash.amount) || cash.count > 0) && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-input p-3" data-testid="statement-cash-row">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span className="break-words">{t('salesSummary.statement.flow.cashRow')}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                · {t('salesSummary.statement.flow.cashTiming')}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(cash.amount)}</span>
          </div>
        )}

        {model.hasCardActivity && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-input p-3" data-testid="statement-bank-row">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Landmark className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
              <span className="break-words">
                {t(cardNet < 0 ? 'salesSummary.statement.flow.bankRowNegative' : 'salesSummary.statement.flow.bankRow')}
              </span>
              {model.lastDepositDate && cardNet >= 0 && (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  ·{' '}
                  {t(
                    model.lastDepositIsPast
                      ? 'salesSummary.statement.flow.lastDepositLanded'
                      : 'salesSummary.statement.flow.lastDepositLands',
                    { date: formatVenueDate(model.lastDepositDate, i18n.language) },
                  )}
                </span>
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="font-semibold tabular-nums">{formatCurrency(cardNet)}</span>
              {hay(model.bankRefunds) && (
                <span className="text-[11px] text-muted-foreground" data-testid="statement-bank-refunds">
                  {t('salesSummary.statement.flow.bankRefunds', { amount: formatCurrency(model.bankRefunds) })}
                </span>
              )}
            </span>
          </div>
        )}

        {(hay(other.net) || other.amount > 0 || model.otherTypes.length > 0) && (
          <div className="rounded-lg border border-input p-3" data-testid="statement-other-row">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
                <span className="break-words">{t('salesSummary.statement.flow.otherRow')}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(other.net)}</span>
            </div>
            {model.otherTypes.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowOtherTypes(v => !v)}
                  aria-expanded={showOtherTypes}
                  data-testid="statement-other-toggle"
                  className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showOtherTypes && '-rotate-90')} aria-hidden />
                  {t('salesSummary.statement.flow.otherTypesToggle')}
                </button>
                {showOtherTypes && (
                  <ul className="mt-2 space-y-1.5 pl-5" data-testid="statement-other-types">
                    {model.otherTypes.map(tipo => (
                      <li key={tipo.key} className="flex items-start justify-between gap-3 text-xs">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-foreground">{nombreDelTipo(tipo)}</span>
                          {hay(tipo.tenderCommissions) && (
                            <span className="text-[11px] text-muted-foreground">
                              {t('salesSummary.statement.flow.otherTypeCommission', { amount: deduccion(tipo.tenderCommissions, formatCurrency) })}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
                          <span>
                            {tipo.count} {t('salesSummary.transactionsShort')}
                          </span>
                          <span className="w-20 text-right font-medium text-foreground">{formatCurrency(tipo.net)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {hay(model.tenderCommissions) && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-input p-3" data-testid="statement-tender-row">
            <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <ReceiptText className="h-4 w-4 shrink-0" aria-hidden />
              <span className="break-words">{t('salesSummary.statement.flow.tenderRow')}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
              {deduccion(model.tenderCommissions, formatCurrency)}
            </span>
          </div>
        )}

        {/* D17: charges in another currency are never summed as pesos: said apart, in their own currency. */}
        {model.foreignCurrency.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="statement-foreign-currency">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {t('salesSummary.statement.flow.foreignCurrency', {
                amounts: model.foreignCurrency
                  .map(f =>
                    t('salesSummary.statement.flow.foreignCurrencyItem', {
                      amount: `${f.currency} ${f.net < 0 ? '−' : ''}${Math.abs(f.net).toFixed(2)}`,
                      charges: t('salesSummary.statement.flow.foreignCurrencyCharges', { count: f.transactionCount }),
                      refunds: t('salesSummary.statement.flow.foreignCurrencyRefunds', { count: f.refundCount }),
                    }),
                  )
                  .join(' · '),
              })}
            </span>
          </p>
        )}
      </div>

      {/* Optional card-type detail */}
      {subBuckets.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCardDetail(v => !v)}
            aria-expanded={showCardDetail}
            data-testid="statement-card-detail-toggle"
            className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showCardDetail && '-rotate-90')} aria-hidden />
            {t('salesSummary.statement.flow.cardDetailToggle')}
          </button>
          {showCardDetail && (
            <ul className="mt-2 space-y-1.5 pl-5">
              {subBuckets.map(sub => (
                <li key={sub.type} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-foreground">{t(CARD_TYPE_LABEL_KEYS[sub.type] ?? sub.type)}</span>
                    {sub.platformFees > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {t('salesSummary.rows.platformFees')}: {formatCurrency(sub.platformFees)}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
                    <span>{sub.count} {t('salesSummary.transactionsShort')}</span>
                    <span className="w-10 text-right">{sub.pct.toFixed(1)}%</span>
                    <span className="w-20 text-right font-medium text-foreground">{formatCurrency(sub.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
