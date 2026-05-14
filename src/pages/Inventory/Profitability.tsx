import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings2, Search, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { pricingApi, type ProfitabilityApiRow } from '@/services/inventory.service'

import { KpiStrip } from './components/profitability/KpiStrip'
import { MarginCurve } from './components/profitability/MarginCurve'
import { CostChangeAlertBanner } from './components/profitability/CostChangeAlertBanner'
import { UnifiedProfitabilityTable } from './components/profitability/UnifiedProfitabilityTable'
import { PolicyDrawer } from './components/profitability/PolicyDrawer'
import { QuickPriceEditDialog } from './components/profitability/QuickPriceEditDialog'

import {
  apiRowToDerived,
  type DerivedRow,
  type ProfitabilityStatus,
  type ProfitabilityType,
} from './types/profitability'

type TabId = 'all' | 'recipe' | 'quantity' | 'review'

const TABS: Array<{ id: TabId; label: string; matcher: (r: DerivedRow) => boolean }> = [
  { id: 'all', label: 'Todos', matcher: () => true },
  { id: 'recipe', label: 'Recetas', matcher: r => r.type === 'RECIPE' },
  { id: 'quantity', label: 'Inventario unitario', matcher: r => r.type === 'QUANTITY' },
  { id: 'review', label: 'Necesitan ajuste', matcher: r => r.status === 'POOR' || r.costDrift },
]

export default function Profitability() {
  const { venueId } = useCurrentVenue()

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['inventory-profitability', venueId],
    queryFn: async () => {
      const res = await pricingApi.getProfitability(venueId!)
      return res.data.data as ProfitabilityApiRow[]
    },
    enabled: !!venueId,
  })

  const allRows = useMemo<DerivedRow[]>(() => (data ?? []).map(apiRowToDerived), [data])

  const [tab, setTab] = useState<TabId>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProfitabilityStatus | null>(null)
  const [typeFilter, setTypeFilter] = useState<ProfitabilityType | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [focusedProduct, setFocusedProduct] = useState<DerivedRow | null>(null)
  const [quickEditRow, setQuickEditRow] = useState<DerivedRow | null>(null)
  const [quickEditOpen, setQuickEditOpen] = useState(false)

  // KPIs are computed over the FULL catalog, not the filtered view.
  // We use the MEDIAN, not the mean — a single broken row (e.g. recipe cost
  // typo'd 100x too high) would otherwise drag the headline KPI to nonsense.
  const kpis = useMemo(() => {
    if (!allRows.length) return { median: 0, atRisk: 0, withoutPolicy: 0, costDrift: 0 }
    const margins = allRows
      .map(r => r.marginPct)
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)
    let median = 0
    if (margins.length) {
      const mid = Math.floor(margins.length / 2)
      median = margins.length % 2 === 0 ? (margins[mid - 1] + margins[mid]) / 2 : margins[mid]
    }
    return {
      median,
      atRisk: allRows.filter(r => r.status === 'POOR').length,
      withoutPolicy: allRows.filter(r => r.strategy === 'NONE').length,
      costDrift: allRows.filter(r => r.costDrift).length,
    }
  }, [allRows])

  // Filtered rows for the table + curve (curve reflects current filter for context)
  const filteredRows = useMemo(() => {
    const tabFn = TABS.find(t => t.id === tab)!.matcher
    return allRows
      .filter(tabFn)
      .filter(r => (statusFilter ? r.status === statusFilter : true))
      .filter(r => (typeFilter ? r.type === typeFilter : true))
      .filter(r => {
        if (!search) return true
        const q = search.toLowerCase()
        return r.name.toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q)
      })
  }, [allRows, tab, statusFilter, typeFilter, search])

  const openPolicyFor = (row?: DerivedRow) => {
    setFocusedProduct(row ?? null)
    setDrawerOpen(true)
  }

  const jumpAtRisk = () => {
    setTab('review')
    setStatusFilter('POOR')
  }
  const jumpCostDrift = () => {
    setTab('review')
    setStatusFilter(null)
  }

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <header className="flex flex-col gap-1 mb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Rentabilidad</h1>
          <p className="text-sm text-muted-foreground">
            Margen unificado: recetas e inventario unitario en una sola vista.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCcw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => openPolicyFor(undefined)} className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            Configurar políticas
          </Button>
        </div>
      </header>

      {/* KPI strip */}
      <KpiStrip
        medianMarginPct={kpis.median}
        atRiskCount={kpis.atRisk}
        withoutPolicyCount={kpis.withoutPolicy}
        costDriftCount={kpis.costDrift}
        onJumpAtRisk={jumpAtRisk}
        onJumpWithoutPolicy={() => openPolicyFor(undefined)}
        onJumpCostDrift={jumpCostDrift}
      />

      {/* Margin curve — the signature visual */}
      <div className="mt-4">
        <MarginCurve
          rows={allRows}
          activeStatus={statusFilter}
          onZoneClick={s => setStatusFilter(prev => (prev === s ? null : s))}
        />
      </div>

      {/* Cost change banner — only shown if drift > 0 */}
      <div className="mt-4">
        <CostChangeAlertBanner rows={allRows} onJump={jumpCostDrift} />
      </div>

      {/* Tabs + filters */}
      <div className="mt-6 border-b border-border">
        <nav className="flex items-center gap-6 overflow-x-auto">
          {TABS.map(t => {
            const count = allRows.filter(t.matcher).length
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative pb-3 text-sm font-medium transition-colors whitespace-nowrap',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                <span className="ml-1.5 text-xs opacity-60 tabular-nums">{count}</span>
                {active && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o categoría"
            className="h-9 w-64 pl-9"
          />
        </div>

        {/* Active filter chips */}
        {statusFilter && (
          <button
            onClick={() => setStatusFilter(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted transition-colors"
          >
            Estatus: <span className="font-medium">{statusFilter}</span>
            <span className="text-muted-foreground">×</span>
          </button>
        )}
        {typeFilter && (
          <button
            onClick={() => setTypeFilter(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted transition-colors"
          >
            Tipo: <span className="font-medium">{typeFilter === 'RECIPE' ? 'Receta' : 'Unitario'}</span>
            <span className="text-muted-foreground">×</span>
          </button>
        )}

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filteredRows.length} de {allRows.length}
        </div>
      </div>

      {/* Table */}
      <div className="mt-3">
        <UnifiedProfitabilityTable
          rows={filteredRows}
          isLoading={isLoading}
          onConfigurePolicy={openPolicyFor}
          onRowClick={r => {
            setQuickEditRow(r)
            setQuickEditOpen(true)
          }}
        />
      </div>

      {!isLoading && allRows.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <h3 className="text-base font-medium">Aún no hay datos de rentabilidad</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrega recetas o productos con costo unitario para empezar a ver tu margen aquí.
          </p>
        </div>
      )}

      {/* Policy drawer */}
      <PolicyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        rows={allRows}
        focusedProduct={focusedProduct}
      />

      {/* Quick price/cost edit on row click */}
      <QuickPriceEditDialog open={quickEditOpen} onOpenChange={setQuickEditOpen} row={quickEditRow} />
    </div>
  )
}
