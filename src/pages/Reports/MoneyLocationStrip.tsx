import { useTranslation } from 'react-i18next'
import { Wallet, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'

interface Props {
  cashInHand: number
  cardNetToReceive: number
  commissionsPaid: number
  formatCurrency: (n: number) => string
  className?: string
}

/**
 * "¿Dónde está tu dinero?" — the at-a-glance answer for a non-technical owner.
 * Entrega 1 (simple): cash in hand + card net to receive + commissions paid.
 * Entrega 2 will split the card bucket into "ya en banco" vs "por caer".
 */
export function MoneyLocationStrip({ cashInHand, cardNetToReceive, commissionsPaid, formatCurrency, className }: Props) {
  const { t } = useTranslation('reports')
  const total = cashInHand + cardNetToReceive

  return (
    <GlassCard className={cn('p-4 sm:p-5 space-y-3 border-input', className)}>
      <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.moneyLocation.title')}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-input p-3">
          <span className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t('salesSummary.moneyLocation.cashInHand')}
          </span>
          <span className="font-semibold tabular-nums">{formatCurrency(cashInHand)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-input p-3">
          <span className="flex items-center gap-2 text-sm">
            <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t('salesSummary.moneyLocation.cardNetToReceive')}
          </span>
          <span className="font-semibold tabular-nums">{formatCurrency(cardNetToReceive)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('salesSummary.moneyLocation.summaryLine', {
          commissions: formatCurrency(commissionsPaid),
          net: formatCurrency(total),
        })}
      </p>
    </GlassCard>
  )
}
