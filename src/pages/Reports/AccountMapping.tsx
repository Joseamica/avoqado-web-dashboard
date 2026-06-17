import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Landmark, Loader2, Settings2, Sparkles } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { SideBadge } from '@/components/accounting/StatusBadge'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useAccountMapping, useSeedAccountMapping, useSetAccountMapping } from '@/hooks/useAccountMapping'
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts'
import type { MappingRow, MovementGroup } from '@/services/fiscal/accountMapping.service'

const GROUP_ORDER: MovementGroup[] = ['INGRESOS', 'TESORERIA', 'CARTERA', 'INVENTARIO', 'COSTOS_GASTOS', 'RESULTADO']
const NONE = '__none__'

const SAMPLE_MAPPINGS: MappingRow[] = [
  { movementType: 'SALES_REVENUE', label: 'Ingreso por ventas / servicios', side: 'CREDIT', group: 'INGRESOS', defaultCode: '401.01', account: { id: 'a', code: '401.01', name: 'Ventas tasa general', satGroupingCode: '401', isActive: true } },
  { movementType: 'CASH_RECEIPT', label: 'Cobro en efectivo (caja)', side: 'BOTH', group: 'TESORERIA', defaultCode: '101.01', account: { id: 'b', code: '101.01', name: 'Caja general', satGroupingCode: '101', isActive: true } },
  { movementType: 'COST_OF_GOODS_SOLD', label: 'Costo de venta (COGS)', side: 'DEBIT', group: 'COSTOS_GASTOS', defaultCode: '501.01', account: { id: 'c', code: '501.01', name: 'Costo de venta', satGroupingCode: '501', isActive: true } },
]

function AccountMappingInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const canManage = can('accounting:manage')

  const mappingQuery = useAccountMapping({ enabled: hasAccess })
  const chartQuery = useChartOfAccounts({ enabled: hasAccess })
  const seedMutation = useSeedAccountMapping()
  const setMutation = useSetAccountMapping()

  const data = mappingQuery.data
  const mappings = hasAccess ? data?.mappings ?? [] : SAMPLE_MAPPINGS
  const needsFiscalSetup = hasAccess && data?.needsFiscalSetup
  const catalogSeeded = hasAccess ? data?.catalogSeeded ?? false : true
  const anyMapped = mappings.some(m => m.account)

  // Cuentas afectables (hojas activas) del catálogo → opciones de los selectores.
  const accountOptions = useMemo(
    () => (chartQuery.data?.accounts ?? []).filter(a => a.isPostable && a.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    [chartQuery.data],
  )

  const byGroup = useMemo(() => {
    const m = new Map<MovementGroup, MappingRow[]>()
    for (const row of mappings) {
      const list = m.get(row.group) ?? []
      list.push(row)
      m.set(row.group, list)
    }
    return m
  }, [mappings])

  const onPick = (movementType: string, value: string) => {
    if (!canManage) return
    setMutation.mutate({ movementType, ledgerAccountId: value === NONE ? null : value })
  }

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('accountMapping.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('accountMapping.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('accountMapping.subtitle')}
          </p>
        </div>
        {catalogSeeded && canManage && hasAccess && (
          <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-tour="mapping-seed">
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t('accountMapping.generateDefaults')}
          </Button>
        )}
      </header>

      {mappingQuery.isLoading && hasAccess ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : mappingQuery.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => mappingQuery.refetch()} />
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
      ) : !catalogSeeded ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('accountMapping.needsCatalogTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('accountMapping.needsCatalogBody')}</p>
            <Link to={`${fullBasePath}/contabilidad/catalogo`}>
              <Button size="sm" variant="outline">
                {t('accountMapping.goToCatalog')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : !anyMapped ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Settings2 className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">{t('accountMapping.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('accountMapping.emptyBody')}</p>
            {canManage ? (
              <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t('accountMapping.generateDefaults')}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t('chartOfAccounts.emptyNoPermission')}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {GROUP_ORDER.filter(g => byGroup.has(g)).map(g => (
            <Card key={g} className="border-input">
              <CardContent className="py-3">
                <h2 className="mb-2 text-sm font-semibold text-foreground">{t(`accountMapping.groups.${g}`)}</h2>
                <div className="space-y-2">
                  {byGroup.get(g)!.map(row => (
                    <div key={row.movementType} className="flex flex-col gap-2 border-b border-input/50 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground">{row.label}</span>
                          <SideBadge side={row.side}>{t(`accountMapping.side.${row.side}`)}</SideBadge>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('accountMapping.defaultHint', { code: row.defaultCode })}</p>
                      </div>
                      <Select value={row.account?.id ?? NONE} onValueChange={v => onPick(row.movementType, v)} disabled={!canManage || setMutation.isPending}>
                        <SelectTrigger className="h-10 w-full sm:w-[300px]" aria-label={row.label}>
                          <SelectValue placeholder={t('accountMapping.unassigned')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t('accountMapping.unassigned')}</SelectItem>
                          {accountOptions.map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} · {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('accountMapping.disclosureEngine')}</p>
          <p>{t('accountMapping.disclosureTaxes')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Configuración contable (AccountMapping) — el mapa "movimiento → cuenta" que hace que el
 * sistema dicte los asientos. Gated PREMIUM (FeatureGate CFDI). Defaults verificados, editables.
 */
export default function AccountMapping() {
  return (
    <FeatureGate feature="CFDI">
      <AccountMappingInner />
    </FeatureGate>
  )
}
