import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, Landmark, Receipt } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useIsrProvisional } from '@/hooks/useIsr'
import type { IsrProvisionalResponse, IsrRegime } from '@/services/fiscal/isr.service'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const SAMPLE: IsrProvisionalResponse = {
  needsFiscalSetup: false, organizationId: null, rfc: 'TESC900101AAA', period: new Date().toISOString().slice(0, 7), regime: 'RESICO',
  venueIds: ['v1'], ingresosMesCents: 4500000, ingresosAcumCents: 27000000, deduccionesAcumCents: 0, utilidadFiscalCents: 0,
  tasaResico: 0.011, isrCausadoCents: 49500, pagosProvisionalesPreviosCents: 0, isrAPagarCents: 49500,
  excedeTopeResico: false, zeroActivity: false, computedAt16Percent: true, rfcSpansMultipleOrgs: false,
}

function Row({ label, cents, hint, strong, badge }: { label: string; cents?: number | null; hint?: string; strong?: boolean; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0">
        <span className={strong ? 'text-sm font-semibold text-foreground' : 'text-sm text-muted-foreground'}>{label}</span>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={`shrink-0 tabular-nums ${strong ? 'text-base font-semibold text-foreground' : 'text-sm text-foreground'}`}>{Currency(cents ?? 0, true)}</span>
    </div>
  )
}

function IsrInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [regime, setRegime] = useState<IsrRegime>('RESICO')

  const query = useIsrProvisional(period, regime, { enabled: hasAccess })
  const data = hasAccess ? query.data : SAMPLE
  const needsFiscalSetup = hasAccess && query.data?.needsFiscalSetup

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('isr.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('isr.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('isr.subtitle')}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="isr-period" className="block text-[10px] text-muted-foreground">{t('trialBalance.period')}</label>
          <Input id="isr-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-44" />
        </div>
      </header>

      {/* Selector de régimen — pills */}
      <div className="inline-flex rounded-full border border-input bg-muted/60 p-1">
        {(['RESICO', 'GENERAL'] as IsrRegime[]).map(r => (
          <button
            key={r}
            onClick={() => setRegime(r)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              regime === r ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`isr.regime.${r}`)}
          </button>
        ))}
      </div>

      {query.isLoading && hasAccess ? (
        <Skeleton className="h-72 rounded-2xl" />
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
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-medium">{t('isr.preliminarBanner')}</p>
          </div>

          {data?.zeroActivity && (
            <div className="flex items-start gap-2 rounded-lg border border-input bg-muted/40 p-3 text-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs font-medium">{t('isr.zeroBody')}</p>
            </div>
          )}

          {regime === 'RESICO' && data?.excedeTopeResico && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-red-700 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-medium">{t('isr.excedeTope')}</p>
            </div>
          )}

          <Card className="border-input">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">{t(`isr.regime.${regime}`)}</h2>
              </div>

              {regime === 'RESICO' ? (
                <>
                  <Row label={t('isr.ingresosMes')} cents={data?.ingresosMesCents} hint={t('isr.ingresosMesHint')} />
                  <div className="flex items-center justify-between py-1 text-sm">
                    <span className="text-muted-foreground">{t('isr.tasaAplicada')}</span>
                    <span className="font-medium tabular-nums text-foreground">{((data?.tasaResico ?? 0) * 100).toFixed(2)}%</span>
                  </div>
                </>
              ) : (
                <>
                  <Row label={t('isr.ingresosAcum')} cents={data?.ingresosAcumCents} />
                  <Row label={t('isr.deduccionesAcum')} cents={data?.deduccionesAcumCents} hint={t('isr.deduccionesHint')} />
                  <Row label={t('isr.utilidadFiscal')} cents={data?.utilidadFiscalCents} strong />
                  <Row label={t('isr.isrCausadoAcum')} cents={data?.isrCausadoCents} />
                  <Row label={t('isr.pagosPrevios')} cents={data?.pagosProvisionalesPreviosCents} hint={t('isr.pagosPreviosHint')} />
                </>
              )}

              <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">{t('isr.isrAPagar')}</div>
                <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{Currency(data?.isrAPagarCents ?? 0, true)}</div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('isr.disclosureEstimate')}</p>
          <p>{t('isr.disclosureRegime')}</p>
          <p>{t('isr.disclosureTariff')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * ISR · Pago provisional — estimación del ISR del periodo (PF). RESICO (tasa por tramo) o GENERAL
 * (utilidad × tarifa art-96). Gated PREMIUM (FeatureGate CFDI). Es estimación; lo valida el contador.
 */
export default function Isr() {
  return (
    <FeatureGate feature="CFDI">
      <IsrInner />
    </FeatureGate>
  )
}
