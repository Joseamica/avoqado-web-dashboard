import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Landmark, Wallet } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useAccountsPayable } from '@/hooks/useAccountsPayable'
import type { AccountsPayableResponse } from '@/services/fiscal/accountsPayable.service'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

const SAMPLE: AccountsPayableResponse = {
  needsFiscalSetup: false,
  organizationId: null,
  rfc: 'TESC900101AAA',
  asOf: today(),
  suppliers: [
    { proveedorRfc: 'AAA010101AAA', proveedorNombre: 'Distribuidora del Centro', comprobantes: 4, pendienteCents: 1860000, corrienteCents: 900000, d31_60Cents: 600000, d61_90Cents: 360000, mas90Cents: 0, maxDiasVencido: 78 },
    { proveedorRfc: 'BBB020202BB2', proveedorNombre: 'Carnes Selectas SA', comprobantes: 2, pendienteCents: 740000, corrienteCents: 240000, d31_60Cents: 0, d61_90Cents: 0, mas90Cents: 500000, maxDiasVencido: 132 },
  ],
  totals: { proveedores: 2, comprobantes: 6, pendienteCents: 2600000, corrienteCents: 1140000, d31_60Cents: 600000, d61_90Cents: 360000, mas90Cents: 500000 },
}

function AccountsPayableInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const [asOf, setAsOf] = useState(today)

  const query = useAccountsPayable(asOf, { enabled: hasAccess })
  const data = hasAccess ? query.data : SAMPLE
  const needsFiscalSetup = hasAccess && query.data?.needsFiscalSetup

  const Bucket = ({ label, cents, tone }: { label: string; cents: number; tone?: string }) => (
    <div className="rounded-xl border border-input bg-muted/40 px-3 py-2">
      <div className={cn('text-[10px] uppercase tracking-wide text-muted-foreground', tone)}>{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{Currency(cents, true)}</div>
    </div>
  )

  return (
    <div className="space-y-5 p-4 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('accountsPayable.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('accountsPayable.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('accountsPayable.subtitle')}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="ap-asof" className="block text-[10px] text-muted-foreground">
            {t('accountsPayable.asOf')}
          </label>
          <Input id="ap-asof" type="date" value={asOf} onChange={e => setAsOf(e.target.value || today())} className="h-10 w-44" />
        </div>
      </header>

      {query.isLoading && hasAccess ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : query.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => query.refetch()} />
      ) : needsFiscalSetup ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.needsFiscalSetupTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.needsFiscalSetupBody')}</p>
            <Link to={`${fullBasePath}/cfdi/configuracion`}>
              <Button size="sm" variant="outline">
                {t('chartOfAccounts.goToFiscalConfig')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Totales por cubeta */}
          <Card className="border-input">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {t('accountsPayable.totalPending')}: {Currency(data?.totals.pendienteCents ?? 0, true)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({t('accountsPayable.suppliersCount', { n: data?.totals.proveedores ?? 0 })})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Bucket label={t('accountsPayable.current')} cents={data?.totals.corrienteCents ?? 0} />
                <Bucket label="31-60" cents={data?.totals.d31_60Cents ?? 0} />
                <Bucket label="61-90" cents={data?.totals.d61_90Cents ?? 0} />
                <Bucket label={t('accountsPayable.over90')} cents={data?.totals.mas90Cents ?? 0} tone="text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>

          {/* Por proveedor */}
          {data && data.suppliers.length === 0 ? (
            <Card className="border-input">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">{t('accountsPayable.empty')}</CardContent>
            </Card>
          ) : (
            <Card className="border-input">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-input text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">{t('accountsPayable.supplier')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('accountsPayable.pending')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('accountsPayable.current')}</th>
                      <th className="px-3 py-2 text-right font-medium">31-60</th>
                      <th className="px-3 py-2 text-right font-medium">61-90</th>
                      <th className="px-3 py-2 text-right font-medium">{t('accountsPayable.over90')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.suppliers.map(s => (
                      <tr key={s.proveedorRfc} className="border-b border-input/60 last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{s.proveedorNombre}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {s.proveedorRfc} · {t('accountsPayable.docsAndDays', { docs: s.comprobantes, days: s.maxDiasVencido })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{Currency(s.pendienteCents, true)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Currency(s.corrienteCents, true)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Currency(s.d31_60Cents, true)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Currency(s.d61_90Cents, true)}</td>
                        <td className={cn('px-3 py-2 text-right tabular-nums', s.mas90Cents > 0 ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                          {Currency(s.mas90Cents, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <Card className="border-input">
            <CardContent className="py-3 text-xs text-muted-foreground">
              <p>{t('accountsPayable.disclosure')}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/**
 * Cuentas por pagar — antigüedad de saldos a proveedores (CxP) desde el Buzón de gastos. Saldo
 * pendiente por proveedor en cubetas 0-30/31-60/61-90/90+. Read-only. Gated PREMIUM (FeatureGate CFDI).
 */
export default function AccountsPayable() {
  return (
    <FeatureGate feature="CFDI">
      <AccountsPayableInner />
    </FeatureGate>
  )
}
