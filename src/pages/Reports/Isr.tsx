import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, HandCoins, Info, Landmark, Receipt, TrendingDown } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useIsrProvisional } from '@/hooks/useIsr'
import { useSalesRetention, useSetSalesRetention } from '@/hooks/useSalesRetention'
import { useFiscalLoss, useSetFiscalLoss } from '@/hooks/useFiscalLoss'
import { useToast } from '@/hooks/use-toast'
import type { IsrProvisionalResponse, IsrRegime } from '@/services/fiscal/isr.service'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const SAMPLE: IsrProvisionalResponse = {
  needsFiscalSetup: false, organizationId: null, rfc: 'TESC900101AAA', period: new Date().toISOString().slice(0, 7), regime: 'RESICO',
  venueIds: ['v1'], ingresosMesCents: 4500000, ingresosAcumCents: 27000000, deduccionesAcumCents: 0, costoVentasAcumCents: 0, perdidasFiscalesAplicadaCents: 0, utilidadFiscalCents: 0,
  tasaResico: 0.011, isrCausadoCents: 49500, pagosProvisionalesPreviosCents: 0, retencionesIsrCents: 0, isrAPagarCents: 49500,
  excedeTopeResico: false, zeroActivity: false, computedAt16Percent: true, rfcSpansMultipleOrgs: false, isEstimate: true,
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

/** Input clearable → `undefined` al vaciar / valor no numérico (nunca NaN en el value). */
const parsePesos = (v: string): number | undefined => {
  if (v === '') return undefined
  const n = parseFloat(v)
  return Number.isNaN(n) ? undefined : n
}

/**
 * Captura manual de la retención en ventas del periodo (ISR/IVA que clientes MORALES nos retuvieron).
 * En pesos en la UI; se envía en centavos. Reduce el ISR a pagar y el IVA en flujo. Requiere accounting:manage.
 */
function RetencionCard({ period, enabled }: { period: string; enabled: boolean }) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const query = useSalesRetention(period, { enabled })
  const mutation = useSetSalesRetention()
  const [isr, setIsr] = useState<number | undefined>(undefined)
  const [iva, setIva] = useState<number | undefined>(undefined)
  const [note, setNote] = useState('')

  // Hidrata desde el servidor al llegar el dato / cambiar de periodo.
  useEffect(() => {
    const d = query.data
    setIsr(d?.isrRetenidoCents ? d.isrRetenidoCents / 100 : undefined)
    setIva(d?.ivaRetenidoCents ? d.ivaRetenidoCents / 100 : undefined)
    setNote(d?.note ?? '')
  }, [query.data])

  const onSave = () => {
    mutation.mutate(
      {
        period,
        isrRetenidoCents: Math.round((isr ?? 0) * 100),
        ivaRetenidoCents: Math.round((iva ?? 0) * 100),
        note: note.trim() || null,
      },
      {
        onSuccess: () => toast({ title: t('isr.retencion.saved') }),
        onError: () => toast({ title: t('isr.retencion.saveError'), variant: 'destructive' }),
      },
    )
  }

  return (
    <Card className="border-input">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <HandCoins className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('isr.retencion.title')}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t('isr.retencion.description')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="ret-isr" className="block text-xs text-muted-foreground">{t('isr.retencion.isrLabel')}</label>
            <Input
              id="ret-isr"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              disabled={!enabled}
              value={isr ?? ''}
              onChange={e => setIsr(parsePesos(e.target.value))}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ret-iva" className="block text-xs text-muted-foreground">{t('isr.retencion.ivaLabel')}</label>
            <Input
              id="ret-iva"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              disabled={!enabled}
              value={iva ?? ''}
              onChange={e => setIva(parsePesos(e.target.value))}
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="ret-note" className="block text-xs text-muted-foreground">{t('isr.retencion.noteLabel')}</label>
          <Input
            id="ret-note"
            type="text"
            maxLength={300}
            placeholder={t('isr.retencion.notePlaceholder')}
            disabled={!enabled}
            value={note}
            onChange={e => setNote(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {query.data?.hasEntry ? t('isr.retencion.captured') : t('isr.retencion.notCaptured')}
          </p>
          <Button size="sm" onClick={onSave} disabled={!enabled || mutation.isPending} data-tour="isr-retencion-save">
            {mutation.isPending ? t('isr.retencion.saving') : t('isr.retencion.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Captura del SALDO de pérdidas fiscales de ejercicios anteriores pendiente de amortizar. Solo régimen
 * GENERAL: el ISR lo resta a la utilidad (topado). En pesos; se envía en centavos. Requiere accounting:manage.
 */
function PerdidasCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const query = useFiscalLoss({ enabled })
  const mutation = useSetFiscalLoss()
  const [saldo, setSaldo] = useState<number | undefined>(undefined)
  const [note, setNote] = useState('')

  useEffect(() => {
    const d = query.data
    setSaldo(d?.pendingCents ? d.pendingCents / 100 : undefined)
    setNote(d?.note ?? '')
  }, [query.data])

  const onSave = () => {
    mutation.mutate(
      { pendingCents: Math.round((saldo ?? 0) * 100), note: note.trim() || null },
      {
        onSuccess: () => toast({ title: t('isr.perdidas.saved') }),
        onError: () => toast({ title: t('isr.perdidas.saveError'), variant: 'destructive' }),
      },
    )
  }

  return (
    <Card className="border-input">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('isr.perdidas.title')}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t('isr.perdidas.description')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="loss-saldo" className="block text-xs text-muted-foreground">
              {t('isr.perdidas.saldoLabel')}
            </label>
            <Input
              id="loss-saldo"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              disabled={!enabled}
              value={saldo ?? ''}
              onChange={e => setSaldo(parsePesos(e.target.value))}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="loss-note" className="block text-xs text-muted-foreground">
              {t('isr.perdidas.noteLabel')}
            </label>
            <Input
              id="loss-note"
              type="text"
              maxLength={300}
              placeholder={t('isr.perdidas.notePlaceholder')}
              disabled={!enabled}
              value={note}
              onChange={e => setNote(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {query.data?.hasEntry ? t('isr.perdidas.captured') : t('isr.perdidas.notCaptured')}
          </p>
          <Button size="sm" onClick={onSave} disabled={!enabled || mutation.isPending}>
            {mutation.isPending ? t('isr.perdidas.saving') : t('isr.perdidas.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
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
                  <Row label={t('isr.costoVentasAcum')} cents={data?.costoVentasAcumCents} hint={t('isr.costoVentasHint')} />
                  {(data?.perdidasFiscalesAplicadaCents ?? 0) > 0 && (
                    <Row label={t('isr.perdidasAnteriores')} cents={data?.perdidasFiscalesAplicadaCents} hint={t('isr.perdidasHint')} />
                  )}
                  <Row label={t('isr.utilidadFiscal')} cents={data?.utilidadFiscalCents} strong />
                  <Row label={t('isr.isrCausadoAcum')} cents={data?.isrCausadoCents} />
                  <Row label={t('isr.pagosPrevios')} cents={data?.pagosProvisionalesPreviosCents} hint={t('isr.pagosPreviosHint')} />
                </>
              )}

              {(data?.retencionesIsrCents ?? 0) > 0 && (
                <Row label={t('isr.retencionesIsr')} cents={data?.retencionesIsrCents} hint={t('isr.retencionesIsrHint')} />
              )}

              <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">{t('isr.isrAPagar')}</div>
                <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{Currency(data?.isrAPagarCents ?? 0, true)}</div>
              </div>
            </CardContent>
          </Card>

          <RetencionCard period={period} enabled={!!hasAccess} />
          {regime === 'GENERAL' && <PerdidasCard enabled={!!hasAccess} />}
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
