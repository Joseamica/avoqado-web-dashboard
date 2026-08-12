import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ExternalIncidentKind, ExternalIncidentStatus, ExternalSettlementStatus } from '@/services/areaTickets.service'

/**
 * `variance` (externalAmount − referenceAmount) llega YA derivado y formateado del
 * server (§caja externa fase 1, Task 15) — nunca se recalcula aquí, sólo se
 * presenta con signo: "+" explícito cuando es positivo, "−" ya viene incluido en el
 * string cuando es negativo (mismo criterio que el resto del repo formatea Decimal).
 */
export function VarianceValue({ variance }: { variance: string | null }) {
  const { t } = useTranslation('settings')
  if (variance === null) {
    return <span className="text-muted-foreground">{t('areaTickets.externalSettlements.noValue')}</span>
  }
  const numeric = Number(variance)
  const isNegative = numeric < 0
  const isPositive = numeric > 0
  return (
    <span className={cn('font-medium tabular-nums', isNegative && 'text-destructive')}>
      {isPositive ? `+${variance}` : variance}
    </span>
  )
}

const SETTLEMENT_BADGE_VARIANT: Record<ExternalSettlementStatus, 'outline' | 'secondary' | 'destructive'> = {
  PENDING: 'outline',
  ASSUMED: 'outline',
  CONFIRMED: 'secondary',
  DISCREPANCY: 'destructive',
  NOT_CHARGED: 'outline',
}

export function SettlementStatusBadge({ status, label }: { status: ExternalSettlementStatus; label: string }) {
  if (status === 'PENDING') {
    return (
      <Badge variant="outline" className="border-warning-border bg-warning-muted text-warning-foreground">
        {label}
      </Badge>
    )
  }
  return <Badge variant={SETTLEMENT_BADGE_VARIANT[status]}>{label}</Badge>
}

export function IncidentStatusBadge({ status, label }: { status: ExternalIncidentStatus; label: string }) {
  if (status === 'OPEN') {
    return (
      <Badge variant="outline" className="border-warning-border bg-warning-muted text-warning-foreground">
        {label}
      </Badge>
    )
  }
  if (status === 'RESOLVED') return <Badge variant="secondary">{label}</Badge>
  return <Badge variant="outline">{label}</Badge>
}

/**
 * `detail` es JSON libre por `kind` (§caja externa fase 1, Task 15) — hoy sólo dos
 * kinds tienen productor real (`UNCONFIRMED_CHARGE` desde el job de conciliación,
 * `AMOUNT_VARIANCE` desde `confirmExternalSettlement`); los otros tres
 * (`NEGATIVE_STOCK`, `CODE_MISMATCH`, `REPRINT_RISK`) ya existen como valores del
 * enum pero ningún camino los produce todavía — el fallback genérico es lo que se
 * ve si eso cambia sin que esta pantalla se actualice.
 */
export function IncidentDetailSummary({ kind, detail }: { kind: ExternalIncidentKind; detail: Record<string, unknown> }) {
  const { t } = useTranslation('settings')

  if (kind === 'UNCONFIRMED_CHARGE' && typeof detail.referenceAmount === 'string') {
    return <span>{t('areaTickets.externalSettlements.incidentDetail.unconfirmedCharge', { amount: detail.referenceAmount })}</span>
  }
  if (kind === 'AMOUNT_VARIANCE' && typeof detail.variance === 'string') {
    return <span>{t('areaTickets.externalSettlements.incidentDetail.amountVariance', { variance: detail.variance })}</span>
  }

  const entries = Object.entries(detail).filter(([, value]) => typeof value === 'string' || typeof value === 'number')
  if (entries.length === 0) {
    return <span className="text-muted-foreground">{t('areaTickets.externalSettlements.incidentDetail.generic')}</span>
  }
  return <span className="text-xs text-muted-foreground">{entries.map(([key, value]) => `${key}: ${value}`).join(' · ')}</span>
}
