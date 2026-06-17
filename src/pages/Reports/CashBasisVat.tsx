import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, Landmark, Receipt } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useIvaCashflow } from '@/hooks/useIvaCashflow'
import type { IvaCashflowResponse } from '@/services/fiscal/ivaFlujo.service'
import { Currency } from '@/utils/currency'

const SAMPLE: IvaCashflowResponse = {
  needsFiscalSetup: false, organizationId: null, rfc: 'TESC900101AAA', period: new Date().toISOString().slice(0, 7),
  venueIds: ['v1'], baseGravableCents: 1116380, ivaTrasladadoCobradoCents: 178620, ivaAmparadoPorCfdiCents: 0, cfdiCount: 0,
  acreditablePagadoCents: null, retencionesCents: null, saldoAFavorAplicadoCents: null,
  ivaAPagarPreliminarCents: 178620, saldoAFavorDelPeriodoCents: 0,
  computedAt16Percent: true, acreditableDisponible: false, diotDisponible: false, incompletoPorFaltaDeGastos: true,
  rfcSpansMultipleOrgs: false, zeroActivity: false, diot: { disponible: false, motivo: '' },
}

/** Una fila monto. `pending` muestra el placeholder honesto (— sin datos, Fase 2). */
function Row({ label, cents, hint, strong, pending, badge }: { label: string; cents?: number | null; hint?: string; strong?: boolean; pending?: boolean; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={strong ? 'text-sm font-semibold text-foreground' : 'text-sm text-muted-foreground'}>{label}</span>
          {badge && <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{badge}</Badge>}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={`shrink-0 tabular-nums ${pending ? 'text-muted-foreground' : strong ? 'text-base font-semibold text-foreground' : 'text-sm text-foreground'}`}>
        {pending ? '—' : Currency(cents ?? 0, true)}
      </span>
    </div>
  )
}

function CashBasisVatInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const query = useIvaCashflow(period, { enabled: hasAccess })
  const data = hasAccess ? query.data : SAMPLE
  const needsFiscalSetup = hasAccess && query.data?.needsFiscalSetup

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('cashBasisVat.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('cashBasisVat.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('cashBasisVat.subtitle')}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="vat-period" className="block text-[10px] text-muted-foreground">{t('trialBalance.period')}</label>
          <Input id="vat-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-44" />
        </div>
      </header>

      {query.isLoading && hasAccess ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : query.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => query.refetch()} />
      ) : needsFiscalSetup ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.needsFiscalSetupTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.needsFiscalSetupBody')}</p>
            <Link to={`${fullBasePath}/cfdi/configuracion`}>
              <Button size="sm" variant="outline">{t('chartOfAccounts.goToFiscalConfig')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Banner PRELIMINAR — prominente, no en letra chica */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-medium">{t('cashBasisVat.preliminarBanner')}</p>
          </div>

          {data?.zeroActivity && (
            <div className="flex items-start gap-2 rounded-lg border border-input bg-muted/40 p-3 text-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs font-medium">{t('cashBasisVat.zeroBody')}</p>
            </div>
          )}

          {data?.rfcSpansMultipleOrgs && (
            <div className="flex items-start gap-2 rounded-lg border border-input bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('cashBasisVat.multiOrg')}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* IVA en flujo de efectivo */}
            <Card className="border-input">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">{t('cashBasisVat.cardTitle')}</h2>
                </div>

                {/* Headline */}
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t('cashBasisVat.ivaTrasladado')}
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{t('cashBasisVat.estimado16')}</Badge>
                  </div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{Currency(data?.ivaTrasladadoCobradoCents ?? 0, true)}</div>
                  <p className="text-xs text-muted-foreground">{t('cashBasisVat.baseGravable')}: {Currency(data?.baseGravableCents ?? 0, true)}</p>
                </div>

                <Row label={t('cashBasisVat.ivaAcreditable')} pending badge={t('cashBasisVat.fase2')} hint={t('cashBasisVat.ivaAcreditableHint')} />
                <Row label={t('cashBasisVat.retenciones')} pending badge={t('cashBasisVat.fase2')} />

                <Row label={t('cashBasisVat.ivaAPagar')} cents={data?.ivaAPagarPreliminarCents} strong hint={t('cashBasisVat.ivaAPagarHint')} />
                {(data?.saldoAFavorDelPeriodoCents ?? 0) > 0 && (
                  <Row label={t('cashBasisVat.saldoAFavor')} cents={data?.saldoAFavorDelPeriodoCents} />
                )}

                <div className="border-t border-input pt-2">
                  <Row label={t('cashBasisVat.cfdiContraste')} cents={data?.ivaAmparadoPorCfdiCents} hint={t('cashBasisVat.cfdiContrasteHint')} />
                </div>
              </CardContent>
            </Card>

            {/* DIOT — stub honesto */}
            <Card className="border-input">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{t('cashBasisVat.diotTitle')}</h2>
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{t('cashBasisVat.fase2')}</Badge>
                </div>
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Landmark className="h-7 w-7 text-muted-foreground" />
                  <p className="max-w-xs text-sm text-muted-foreground">{t('cashBasisVat.diotBody')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('cashBasisVat.disclosureCashBasis')}</p>
          <p>{t('cashBasisVat.disclosureNotInvoiced')}</p>
          <p>{t('cashBasisVat.disclosureSaldoFavor')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * IVA en flujo de efectivo · DIOT — resumen HONESTO del IVA trasladado cobrado del contribuyente.
 * Gated PREMIUM (FeatureGate CFDI). Lado ventas computable hoy; acreditable/DIOT = Fase 2 (placeholders, no 0).
 */
export default function CashBasisVat() {
  return (
    <FeatureGate feature="CFDI">
      <CashBasisVatInner />
    </FeatureGate>
  )
}
