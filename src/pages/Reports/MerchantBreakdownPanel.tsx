import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import type { MerchantAccountBreakdown } from '@/services/reports/salesSummary.service'

interface Props {
  items: MerchantAccountBreakdown[]
  formatCurrency: (n: number) => string
  className?: string
}

/** Format a bare YYYY-MM-DD (already venue-local) without a timezone shift. */
function formatLands(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Per-merchant-account card breakdown (Cobrado · Comisión · Neto a recibir).
 * Mirrors the visual language of AvailableBalance/CardTypeBreakdownStrip but
 * sliced by merchant account instead of card type. Read-only / info panel.
 */
export function MerchantBreakdownPanel({ items, formatCurrency, className }: Props) {
  const { t, i18n } = useTranslation('reports')
  const total = useMemo(() => items.reduce((s, m) => s + m.netToReceive, 0), [items])

  if (items.length === 0) return null

  return (
    <GlassCard className={cn('p-4 sm:p-5 space-y-4 border-input', className)}>
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.merchantBreakdown.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('salesSummary.merchantBreakdown.description')}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('salesSummary.merchantBreakdown.totalNet')}
          </p>
          <p className="text-base font-semibold tabular-nums">{formatCurrency(total)}</p>
        </div>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-2 text-left font-medium">{t('salesSummary.merchantBreakdown.cols.merchant')}</th>
            <th className="py-2 px-2 text-right font-medium">{t('salesSummary.merchantBreakdown.cols.collected')}</th>
            <th className="hidden py-2 px-2 text-right font-medium md:table-cell">
              {t('salesSummary.merchantBreakdown.cols.commission')}
            </th>
            <th className="py-2 pl-2 text-right font-medium">{t('salesSummary.merchantBreakdown.cols.net')}</th>
            <th className="py-2 pl-2 text-right font-medium">{t('salesSummary.merchantBreakdown.cols.share')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => {
            const share = total > 0 ? (m.netToReceive / total) * 100 : 0
            return (
            <tr key={m.merchantAccountId} className="border-b border-border/20 last:border-0">
              <td className="py-2 pr-2">
                <div className="flex flex-col">
                  <span className="font-medium">{m.displayName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {[m.provider, m.affiliation && `${t('salesSummary.controls.merchant.affiliation')}: ${m.affiliation}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {m.estimatedSettlement?.nextDate && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden />
                      {t('salesSummary.merchantBreakdown.lands', { date: formatLands(m.estimatedSettlement.nextDate, i18n.language) })}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(m.collectedOnCard)}</td>
              <td className="hidden py-2 px-2 text-right tabular-nums text-muted-foreground md:table-cell">
                -{formatCurrency(m.platformFee)}
              </td>
              <td className="py-2 pl-2 text-right font-medium tabular-nums">{formatCurrency(m.netToReceive)}</td>
              <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">{share.toFixed(0)}%</td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </GlassCard>
  )
}
