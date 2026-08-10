import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Currency } from '@/utils/currency'
import { Banknote, CheckCircle2, CircleMinus, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface CashReconciliationSummaryProps {
  cashDeclared: number | null
  cashDifference: number | null
}

export function CashReconciliationSummary({ cashDeclared, cashDifference }: CashReconciliationSummaryProps) {
  const { t } = useTranslation('shifts')

  if (cashDeclared === null && cashDifference === null) return null

  const state = (() => {
    if (cashDifference === null) {
      return {
        label: t('detail.cashReconciliation.notCounted'),
        description: t('detail.cashReconciliation.notCountedDescription'),
        className: 'border-border bg-muted/35 text-muted-foreground',
        icon: CircleMinus,
      }
    }
    if (cashDifference === 0) {
      return {
        label: t('detail.cashReconciliation.balanced'),
        description: t('detail.cashReconciliation.balancedDescription'),
        className: 'status-success',
        icon: CheckCircle2,
      }
    }
    if (cashDifference < 0) {
      return {
        label: t('detail.cashReconciliation.shortage'),
        description: t('detail.cashReconciliation.shortageDescription', {
          amount: Currency(Math.abs(cashDifference)),
        }),
        className: 'status-critical',
        icon: TriangleAlert,
      }
    }
    return {
      label: t('detail.cashReconciliation.overage'),
      description: t('detail.cashReconciliation.overageDescription', {
        amount: Currency(cashDifference),
      }),
      className: 'status-warning',
      icon: Banknote,
    }
  })()

  const StatusIcon = state.icon

  return (
    <Card data-tour="cash-reconciliation-summary" className="border-border">
      <CardHeader className="px-3 py-2.5">
        <CardTitle className="text-sm font-medium">{t('detail.cashReconciliation.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3 pt-0">
        <div className={`rounded-lg border p-2.5 ${state.className}`}>
          <div className="flex items-center gap-2">
            <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold">{state.label}</p>
          </div>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{state.description}</p>
        </div>

        {cashDeclared !== null && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{t('detail.cashReconciliation.countedCash')}</span>
            <span className="font-medium tabular-nums text-foreground">{Currency(cashDeclared)}</span>
          </div>
        )}

        {cashDifference !== null && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-xs">
            <span className="text-muted-foreground">{t('detail.cashReconciliation.difference')}</span>
            <span className="font-semibold tabular-nums text-foreground">{Currency(cashDifference)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
