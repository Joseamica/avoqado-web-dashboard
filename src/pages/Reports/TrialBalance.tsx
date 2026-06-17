import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Landmark, Scale } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useTrialBalance } from '@/hooks/useTrialBalance'
import type { TrialBalanceResponse, TrialBalanceRow } from '@/services/fiscal/trialBalance.service'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const SAMPLE: TrialBalanceResponse = {
  needsFiscalSetup: false, organizationId: null, rfc: 'TESC900101AAA', period: new Date().toISOString().slice(0, 7),
  rows: [
    { code: '101.01', name: 'Caja general', type: 'ACTIVO', nature: 'DEUDORA', saldoInicialCents: 0, debeCents: 1094000, haberCents: 0, saldoFinalCents: 1094000 },
    { code: '102.01', name: 'Bancos nacionales', type: 'ACTIVO', nature: 'DEUDORA', saldoInicialCents: 0, debeCents: 8700, haberCents: 0, saldoFinalCents: 8700 },
    { code: '401.01', name: 'Ventas tasa general', type: 'INGRESO', nature: 'ACREEDORA', saldoInicialCents: 0, debeCents: 0, haberCents: 1102700, saldoFinalCents: -1102700 },
  ],
  totals: { debeCents: 1102700, haberCents: 1102700, saldoInicialDeudorCents: 0, saldoInicialAcreedorCents: 0, saldoFinalDeudorCents: 1102700, saldoFinalAcreedorCents: 1102700 },
  balanced: { movements: true, balances: true },
}

/** Saldo neto con signo → Currency con color (deudor = normal, acreedor = azul). */
function Saldo({ cents }: { cents: number }) {
  if (cents === 0) return <span className="text-muted-foreground">—</span>
  return <span className={cn('tabular-nums', cents < 0 && 'text-blue-600 dark:text-blue-400')}>{Currency(Math.abs(cents), true)}</span>
}

function TrialBalanceInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const query = useTrialBalance(period, { enabled: hasAccess })
  const data = hasAccess ? query.data : SAMPLE
  const needsFiscalSetup = hasAccess && query.data?.needsFiscalSetup
  const rows: TrialBalanceRow[] = data?.rows ?? []
  const cuadra = !!data?.balanced.movements && !!data?.balanced.balances

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('trialBalance.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('trialBalance.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('trialBalance.subtitle')}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="balance-period" className="block text-[10px] text-muted-foreground">{t('trialBalance.period')}</label>
          <Input id="balance-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-44" />
        </div>
      </header>

      {/* Cuadre banner */}
      {!query.isLoading && !needsFiscalSetup && rows.length > 0 && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border p-3 text-sm',
            cuadra ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400',
          )}
        >
          {cuadra ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="font-medium">{cuadra ? t('trialBalance.balancedOk') : t('trialBalance.unbalanced')}</span>
        </div>
      )}

      {query.isLoading && hasAccess ? (
        <Skeleton className="h-64 rounded-2xl" />
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
      ) : rows.length === 0 ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Scale className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('trialBalance.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('trialBalance.emptyBody')}</p>
            <Link to={`${fullBasePath}/contabilidad/libro-diario`}>
              <Button size="sm" variant="outline">
                {t('trialBalance.goToJournal')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-input">
          <CardContent className="py-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2">{t('trialBalance.account')}</th>
                    <th className="py-2 pr-2 text-right">{t('trialBalance.saldoIni')}</th>
                    <th className="py-2 pr-2 text-right">{t('journal.debit')}</th>
                    <th className="py-2 pr-2 text-right">{t('journal.credit')}</th>
                    <th className="py-2 pl-2 text-right">{t('trialBalance.saldoFin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.code} className="border-b border-input/40">
                      <td className="py-1.5 pr-2">
                        <span className="font-mono text-xs text-muted-foreground">{r.code}</span> {r.name}
                      </td>
                      <td className="py-1.5 pr-2 text-right"><Saldo cents={r.saldoInicialCents} /></td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{r.debeCents ? Currency(r.debeCents, true) : '—'}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{r.haberCents ? Currency(r.haberCents, true) : '—'}</td>
                      <td className="py-1.5 pl-2 text-right"><Saldo cents={r.saldoFinalCents} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-input font-medium text-foreground">
                    <td className="py-2 pr-2">{t('trialBalance.totals')}</td>
                    <td className="py-2 pr-2" />
                    <td className="py-2 pr-2 text-right tabular-nums">{Currency(data!.totals.debeCents, true)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{Currency(data!.totals.haberCents, true)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">
                      {Currency(data!.totals.saldoFinalDeudorCents, true)} / {Currency(data!.totals.saldoFinalAcreedorCents, true)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('trialBalance.disclosureSource')}</p>
          <p>{t('trialBalance.disclosureSign')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Balanza de comprobación — read-model sobre las pólizas. Gated PREMIUM (FeatureGate CFDI).
 * Prueba el cuadre: Σcargos = Σabonos y saldo deudor = saldo acreedor.
 */
export default function TrialBalance() {
  return (
    <FeatureGate feature="CFDI">
      <TrialBalanceInner />
    </FeatureGate>
  )
}
