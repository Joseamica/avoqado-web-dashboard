import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, CheckCircle2, FileCode, FileDown, Landmark, Loader2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { useAccountingReports } from '@/hooks/useAccountingReports'
import type { AccountingReportsResponse, ReportLine } from '@/services/fiscal/accountingReports.service'
import { getCatalogoXml, getBalanzaXml, downloadXml } from '@/services/fiscal/contabilidadElectronica.service'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const SAMPLE: AccountingReportsResponse = {
  needsFiscalSetup: false, organizationId: null, rfc: 'TESC900101AAA', period: new Date().toISOString().slice(0, 7), fiscalYearStart: `${new Date().getFullYear()}-01`,
  incomeStatement: {
    ingresos: { lines: [{ code: '401.01', name: 'Ventas tasa general', amountCents: 1000000 }], totalCents: 1000000 },
    costos: { lines: [{ code: '501.01', name: 'Costo de venta', amountCents: 400000 }], totalCents: 400000 },
    utilidadBrutaCents: 600000,
    gastos: { lines: [{ code: '601.01', name: 'Sueldos y salarios', amountCents: 200000 }], totalCents: 200000 },
    resultadoCents: 400000,
  },
  balanceSheet: {
    activo: { lines: [{ code: '102.01', name: 'Bancos nacionales', amountCents: 560000 }], totalCents: 560000 },
    pasivo: { lines: [{ code: '208.01', name: 'IVA trasladado cobrado', amountCents: 160000 }], totalCents: 160000 },
    capital: { lines: [{ code: '~RESULT', name: 'Resultado del ejercicio', amountCents: 400000 }], totalCents: 400000 },
    resultadoEjercicioCents: 400000, balanced: true,
  },
}

/** Líneas de una sección + su total. */
function Section({ title, lines, totalCents, strong }: { title: string; lines: ReportLine[]; totalCents: number; strong?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
      </div>
      {lines.map(l => (
        <div key={l.code} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {!l.code.startsWith('~') && <span className="font-mono text-xs">{l.code}</span>} {l.name}
          </span>
          <span className="tabular-nums text-foreground">{Currency(l.amountCents, true)}</span>
        </div>
      ))}
      <div className={cn('flex items-center justify-between border-t border-input pt-1 text-sm', strong ? 'font-semibold' : 'font-medium')}>
        <span>{`Total ${title.toLowerCase()}`}</span>
        <span className="tabular-nums text-foreground">{Currency(totalCents, true)}</span>
      </div>
    </div>
  )
}

function AccountingReportsInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const query = useAccountingReports(period, { enabled: hasAccess })
  const data = hasAccess ? query.data : SAMPLE
  const needsFiscalSetup = hasAccess && query.data?.needsFiscalSetup
  const is = data?.incomeStatement
  const bs = data?.balanceSheet
  const hasData = !!is && (is.ingresos.lines.length > 0 || is.costos.lines.length > 0 || is.gastos.lines.length > 0 || (bs?.activo.lines.length ?? 0) > 0)

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('accountingReports.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('accountingReports.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('accountingReports.subtitle')}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="reports-period" className="block text-[10px] text-muted-foreground">{t('trialBalance.period')}</label>
          <Input id="reports-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-44" />
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
              <Button size="sm" variant="outline">
                {t('chartOfAccounts.goToFiscalConfig')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('accountingReports.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('accountingReports.emptyBody')}</p>
            <Link to={`${fullBasePath}/contabilidad/libro-diario`}>
              <Button size="sm" variant="outline">
                {t('trialBalance.goToJournal')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Estado de resultados */}
          <Card className="border-input">
            <CardContent className="py-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">{t('accountingReports.incomeStatement')}</h2>
              <Section title={t('accountingReports.ingresos')} lines={is!.ingresos.lines} totalCents={is!.ingresos.totalCents} />
              <Section title={t('accountingReports.costos')} lines={is!.costos.lines} totalCents={is!.costos.totalCents} />
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-sm font-medium">
                <span>{t('accountingReports.utilidadBruta')}</span>
                <span className="tabular-nums text-foreground">{Currency(is!.utilidadBrutaCents, true)}</span>
              </div>
              <Section title={t('accountingReports.gastos')} lines={is!.gastos.lines} totalCents={is!.gastos.totalCents} />
              <div className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-base font-semibold', is!.resultadoCents >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400')}>
                <span>{is!.resultadoCents >= 0 ? t('accountingReports.utilidad') : t('accountingReports.perdida')}</span>
                <span className="tabular-nums">{Currency(Math.abs(is!.resultadoCents), true)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Balance general */}
          <Card className="border-input">
            <CardContent className="py-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">{t('accountingReports.balanceSheet')}</h2>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2 text-xs',
                  bs!.balanced ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400',
                )}
              >
                {bs!.balanced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                <span className="font-medium">{bs!.balanced ? t('accountingReports.equationOk') : t('accountingReports.equationBad')}</span>
              </div>
              <Section title={t('accountingReports.activo')} lines={bs!.activo.lines} totalCents={bs!.activo.totalCents} strong />
              <Section title={t('accountingReports.pasivo')} lines={bs!.pasivo.lines} totalCents={bs!.pasivo.totalCents} />
              <Section title={t('accountingReports.capital')} lines={bs!.capital.lines} totalCents={bs!.capital.totalCents} />
            </CardContent>
          </Card>
        </div>
      )}

      {!needsFiscalSetup && <ContaElectronicaCard period={period} hasAccess={hasAccess} />}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('accountingReports.disclosureSource')}</p>
          <p>{t('accountingReports.disclosureEquation')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/** Descarga de los XML de Contabilidad electrónica (SAT, Anexo 24): catálogo + balanza del periodo. */
function ContaElectronicaCard({ period, hasAccess }: { period: string; hasAccess: boolean }) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const [loading, setLoading] = useState<'catalogo' | 'balanza' | null>(null)

  const download = async (kind: 'catalogo' | 'balanza') => {
    if (!venueId || !hasAccess) return
    setLoading(kind)
    try {
      const r = kind === 'catalogo' ? await getCatalogoXml(venueId, period) : await getBalanzaXml(venueId, period)
      if (r.needsFiscalSetup) toast({ title: t('chartOfAccounts.needsFiscalSetupTitle'), variant: 'destructive' })
      else if (r.empty || !r.xml || !r.filename) toast({ title: t('electronicAccounting.empty'), variant: 'destructive' })
      else downloadXml(r.xml, r.filename)
    } catch (err: any) {
      toast({ title: t('electronicAccounting.error'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className="border-input">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('electronicAccounting.title')}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t('electronicAccounting.body')}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!hasAccess || loading !== null} onClick={() => download('catalogo')}>
            {loading === 'catalogo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {t('electronicAccounting.catalogo')}
          </Button>
          <Button size="sm" variant="outline" disabled={!hasAccess || loading !== null} onClick={() => download('balanza')}>
            {loading === 'balanza' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {t('electronicAccounting.balanza')}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{t('electronicAccounting.disclaimer')}</p>
      </CardContent>
    </Card>
  )
}

/**
 * Reportes contables — Estado de resultados + Balance general, derivados de las pólizas.
 * Gated PREMIUM (FeatureGate CFDI). El balance cuadra con la ecuación contable (A = P + C).
 */
export default function AccountingReports() {
  return (
    <FeatureGate feature="CFDI">
      <AccountingReportsInner />
    </FeatureGate>
  )
}
