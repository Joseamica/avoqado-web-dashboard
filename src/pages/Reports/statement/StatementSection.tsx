import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import type { MerchantAccountBreakdown, PaymentMethodDetailedBreakdown, SettlementCalendarDay } from '@/services/reports/salesSummary.service'
import { deriveStatement } from './derive'
import { MerchantStatementRows } from './MerchantStatementRows'
import { PayoutTimeline } from './PayoutTimeline'
import { StatementFlow } from './StatementFlow'
import { todayInVenue } from './venueDates'

interface Props {
  buckets: PaymentMethodDetailedBreakdown[]
  merchants: MerchantAccountBreakdown[]
  calendar: SettlementCalendarDay[]
  /** IANA venue timezone — decides past/upcoming for payout dates. */
  venueTimezone: string
  formatCurrency: (n: number) => string
  className?: string
}

/**
 * The period statement: one cohesive Mercury-style card that answers "how much
 * did I make, how much will I be paid, when and how". Replaces the old money
 * strip + merchant breakdown + settlement calendar + payment-methods blocks.
 * All money math is derived once here (pure) and flows down to three parts that
 * reconcile visibly with each other.
 */
export function StatementSection({ buckets, merchants, calendar, venueTimezone, formatCurrency, className }: Props) {
  const { t } = useTranslation('reports')
  const todayKey = useMemo(() => todayInVenue(venueTimezone), [venueTimezone])
  const model = useMemo(() => deriveStatement({ buckets, merchants, calendar, todayKey }), [buckets, merchants, calendar, todayKey])

  const showMerchants = model.merchants.length > 0
  const showTimeline = model.days.length > 0 || model.unprojected > 1

  return (
    <GlassCard className={cn('overflow-hidden border-input p-0', className)} data-tour="statement">
      <div className="border-b border-input px-5 py-3 sm:px-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('salesSummary.statement.title')}</h2>
      </div>

      <StatementFlow model={model} formatCurrency={formatCurrency} />

      {showMerchants && (
        <div className="border-t border-input">
          <MerchantStatementRows rows={model.merchants} formatCurrency={formatCurrency} />
        </div>
      )}

      {showTimeline && (
        <div className="border-t border-input">
          <PayoutTimeline days={model.days} incoming={model.incoming} unprojected={model.unprojected} formatCurrency={formatCurrency} />
        </div>
      )}
    </GlassCard>
  )
}
