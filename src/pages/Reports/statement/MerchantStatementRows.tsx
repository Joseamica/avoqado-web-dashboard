import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MerchantSettlementRule } from '@/services/reports/salesSummary.service'
import type { MerchantStatementRowModel, PayoutStatus } from './types'
import { formatBusinessDays, formatVenueDate } from './venueDates'

interface Props {
  rows: MerchantStatementRowModel[]
  formatCurrency: (n: number) => string
}

const CARD_TYPE_LABEL_KEYS: Record<string, string> = {
  CREDIT: 'salesSummary.controls.filterBy.cardType.options.credit',
  DEBIT: 'salesSummary.controls.filterBy.cardType.options.debit',
  AMEX: 'salesSummary.controls.filterBy.cardType.options.amex',
  INTERNATIONAL: 'salesSummary.controls.filterBy.cardType.options.international',
}

const PAYOUT_TESTID: Record<PayoutStatus, string> = {
  lands: 'payout-chip-lands',
  landed: 'payout-chip-landed',
  next: 'payout-chip-next',
  noRule: 'payout-chip-no-rule',
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

/**
 * Estimated-payout chip. Everything is a supposition from settlement rules (no bank
 * confirmation exists yet) — the copy stays in "~/debió" tense and never claims a
 * deposit is done. When money is estimated across several days, it shows only the
 * NEXT upcoming slice (amount + date) so it never implies the full net lands at once.
 */
function PayoutChip({ row, locale, formatCurrency, t }: { row: MerchantStatementRowModel; locale: string; formatCurrency: (n: number) => string; t: TFn }) {
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap'
  const blue = 'border-blue-600/40 text-blue-600 dark:border-blue-400/40 dark:text-blue-400'
  if (row.payoutStatus === 'noRule' || !row.payoutDate) {
    return (
      <span className={cn(base, 'border-input text-muted-foreground')} data-testid={PAYOUT_TESTID.noRule}>
        {t('salesSummary.statement.merchants.payout.noRule')}
      </span>
    )
  }
  const date = formatVenueDate(row.payoutDate, locale)
  if (row.payoutStatus === 'landed') {
    return (
      <span className={cn(base, 'border-amber-600/40 text-amber-600 dark:border-amber-400/40 dark:text-amber-400')} data-testid={PAYOUT_TESTID.landed}>
        {t('salesSummary.statement.merchants.payout.landed', { date })}
      </span>
    )
  }
  if (row.payoutStatus === 'next') {
    return (
      <span className={cn(base, blue)} data-testid={PAYOUT_TESTID.next}>
        {t('salesSummary.statement.merchants.payout.nextEstimated', { amount: formatCurrency(row.payoutAmount ?? 0), date })}
      </span>
    )
  }
  return (
    <span className={cn(base, blue)} data-testid={PAYOUT_TESTID.lands}>
      {t('salesSummary.statement.merchants.payout.lands', { date })}
    </span>
  )
}

/** Group per-card-type rules into readable copy: "Visa/MC: 1 día hábil · Amex: 3 días hábiles". */
function formatRules(rules: MerchantSettlementRule[], t: TFn): string {
  const byType = (ct: string) => rules.find(r => r.cardType === ct)
  const credit = byType('CREDIT')
  const debit = byType('DEBIT')
  const amex = byType('AMEX')
  const intl = byType('INTERNATIONAL')
  const parts: string[] = []
  if (credit && debit && credit.settlementDays === debit.settlementDays) {
    parts.push(`${t('salesSummary.statement.merchants.rules.visaMc')}: ${formatBusinessDays(credit.settlementDays, t)}`)
  } else {
    if (debit) parts.push(`${t(CARD_TYPE_LABEL_KEYS.DEBIT)}: ${formatBusinessDays(debit.settlementDays, t)}`)
    if (credit) parts.push(`${t(CARD_TYPE_LABEL_KEYS.CREDIT)}: ${formatBusinessDays(credit.settlementDays, t)}`)
  }
  if (amex) parts.push(`${t(CARD_TYPE_LABEL_KEYS.AMEX)}: ${formatBusinessDays(amex.settlementDays, t)}`)
  if (intl) parts.push(`${t(CARD_TYPE_LABEL_KEYS.INTERNATIONAL)}: ${formatBusinessDays(intl.settlementDays, t)}`)
  return parts.join(' · ')
}

/** Expanded detail shared by desktop rows and mobile cards. */
function MerchantDetail({ row, formatCurrency, locale, t }: { row: MerchantStatementRowModel; formatCurrency: (n: number) => string; locale: string; t: TFn }) {
  const rules = row.settlementRules?.length ? formatRules(row.settlementRules, t) : null
  return (
    <div className="space-y-2 py-1 text-xs text-muted-foreground">
      <p>
        {row.transactionCount} {t('salesSummary.transactionsLabel')}
      </p>
      {rules && (
        <p>
          <span className="font-medium text-foreground">{t('salesSummary.statement.merchants.rules.title')}:</span> {rules}
        </p>
      )}
      {row.deposits.length > 0 && (
        <div>
          <p className="font-medium text-foreground">{t('salesSummary.statement.merchants.deposits')}</p>
          <ul className="mt-1 space-y-0.5">
            {row.deposits.map(d => (
              <li key={d.date} className="flex items-center justify-between gap-3">
                <span className="capitalize">{formatVenueDate(d.date, locale)}</span>
                <span className="tabular-nums">{formatCurrency(d.netToReceive)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Per-merchant statement rows. Semantic table on md+, stacked cards on mobile.
 * Each row shows what the merchant collected, the fee (with effective rate), the
 * net, its share of the total, and when it lands. Expand for settlement rules
 * and the per-day deposits.
 */
export function MerchantStatementRows({ rows, formatCurrency }: Props) {
  const { t, i18n } = useTranslation('reports')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const locale = i18n.language

  if (rows.length === 0) return null

  const showShare = rows.length > 1
  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const feeLabel = (row: MerchantStatementRowModel) =>
    row.effectiveRatePct != null
      ? `−${formatCurrency(row.platformFee)} · ${row.effectiveRatePct.toFixed(1)}%`
      : `−${formatCurrency(row.platformFee)}`

  return (
    <div className="p-5 sm:p-6" data-tour="statement-merchants">
      <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.statement.merchants.title')}</h3>

      {/* Desktop table */}
      <table className="mt-3 hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-input text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-2 text-left font-medium">{t('salesSummary.statement.merchants.cols.merchant')}</th>
            <th className="px-2 py-2 text-right font-medium">{t('salesSummary.statement.merchants.cols.collected')}</th>
            <th className="px-2 py-2 text-right font-medium">{t('salesSummary.statement.merchants.cols.commission')}</th>
            <th className="px-2 py-2 text-right font-medium">{t('salesSummary.statement.merchants.cols.net')}</th>
            {showShare && <th className="px-2 py-2 text-right font-medium">{t('salesSummary.statement.merchants.cols.share')}</th>}
            <th className="py-2 pl-2 text-right font-medium">{t('salesSummary.statement.merchants.cols.payout')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const isOpen = expanded.has(row.merchantAccountId)
            return (
              <Fragment key={row.merchantAccountId}>
                <tr
                  className="cursor-pointer border-b border-input/60 last:border-0 hover:bg-muted/30"
                  onClick={() => toggle(row.merchantAccountId)}
                  data-testid="merchant-statement-row"
                  data-merchant-id={row.merchantAccountId}
                >
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium" title={row.displayName}>
                          {row.displayName}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {[row.provider, row.affiliation && `${t('salesSummary.controls.merchant.affiliation')}: ${row.affiliation}`].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(row.collectedOnCard)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{feeLabel(row)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(row.netToReceive)}</td>
                  {showShare && (
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, row.shareOfNetPct))}%` }} />
                        </span>
                        <span className="w-9 text-right tabular-nums text-muted-foreground">{row.shareOfNetPct.toFixed(0)}%</span>
                      </div>
                    </td>
                  )}
                  <td className="py-2.5 pl-2 text-right">
                    <PayoutChip row={row} locale={locale} formatCurrency={formatCurrency} t={t} />
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-input/60 last:border-0">
                    <td colSpan={showShare ? 6 : 5} className="bg-muted/20 px-2 pb-3 pl-9">
                      <MerchantDetail row={row} formatCurrency={formatCurrency} locale={locale} t={t} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="mt-3 space-y-2 md:hidden">
        {rows.map(row => {
          const isOpen = expanded.has(row.merchantAccountId)
          return (
            <div key={row.merchantAccountId} className="rounded-lg border border-input p-3" data-testid="merchant-statement-card" data-merchant-id={row.merchantAccountId}>
              <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => toggle(row.merchantAccountId)} aria-expanded={isOpen}>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium" title={row.displayName}>
                    {row.displayName}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">{row.provider}</span>
                </div>
                <PayoutChip row={row} locale={locale} formatCurrency={formatCurrency} t={t} />
              </button>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t('salesSummary.statement.merchants.cols.collected')}</dt>
                <dd className="text-right tabular-nums">{formatCurrency(row.collectedOnCard)}</dd>
                <dt className="text-muted-foreground">{t('salesSummary.statement.merchants.cols.commission')}</dt>
                <dd className="text-right tabular-nums text-muted-foreground">{feeLabel(row)}</dd>
                <dt className="text-muted-foreground">{t('salesSummary.statement.merchants.cols.net')}</dt>
                <dd className="text-right font-semibold tabular-nums">{formatCurrency(row.netToReceive)}</dd>
              </dl>
              {isOpen && <MerchantDetail row={row} formatCurrency={formatCurrency} locale={locale} t={t} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
