/**
 * OrgStockControlPage — Org-level Control de Stock dashboard for white-label organizations.
 *
 * Mirrors the visual patterns of:
 * - playtelecom/Stock/StockControl.tsx (header, summary bar, category cards, table, mobile cards)
 * - playtelecom/Supervisor/SupervisorDashboard.tsx (PageTitleWithInfo + DateRangePicker + underline tabs)
 *
 * 5 tabs (matching the approved Excel export structure):
 * Resumen Ejecutivo · Cargas · Detalle SIMs · Por Sucursal · Por Categoría
 */

import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, CheckCircle2, Layers, Package, Store } from 'lucide-react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/date-range-picker'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useOrgStockControl } from './StockControl/hooks/useOrgStockControl'
import { ExportButton } from './StockControl/components/ExportButton'
import { OrgResumenTab } from './StockControl/tabs/OrgResumenTab'
import { OrgCargasTab } from './StockControl/tabs/OrgCargasTab'
import { OrgDetalleSimsTab } from './StockControl/tabs/OrgDetalleSimsTab'
import { OrgPorSucursalTab } from './StockControl/tabs/OrgPorSucursalTab'
import { OrgPorCategoriaTab } from './StockControl/tabs/OrgPorCategoriaTab'

const TABS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'cargas', label: 'Cargas' },
  { value: 'detalle', label: 'Detalle SIMs' },
  { value: 'sucursal', label: 'Por Sucursal' },
  { value: 'categoria', label: 'Por Categoría' },
] as const

type TabValue = (typeof TABS)[number]['value']

function thirtyDaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d
}

export default function OrgStockControlPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { organization } = useCurrentOrganization()
  const [activeTab, setActiveTab] = useState<TabValue>('resumen')
  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date }>(() => ({
    from: thirtyDaysAgo(),
    to: new Date(),
  }))

  const queryParams = useMemo(
    () => ({
      dateFrom: selectedRange.from.toISOString(),
      dateTo: selectedRange.to.toISOString(),
    }),
    [selectedRange],
  )

  const { data, isLoading, isError, error, refetch } = useOrgStockControl(orgId, queryParams)

  // ─── Loading ─── (matches existing StockControl.tsx skeleton structure)
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-9 w-64" />
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  // ─── Error ───
  if (isError || !data) {
    const message = (error as any)?.response?.data?.message || 'Error al cargar los datos'
    return (
      <GlassCard className="p-8 text-center">
        <h3 className="text-lg font-semibold mb-2">No se pudo cargar Control de Stock</h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <Button onClick={() => refetch()}>Reintentar</Button>
      </GlassCard>
    )
  }

  // ─── Empty state ───
  if (data.summary.totalSims === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <PageTitleWithInfo title="Control de Stock" className="text-xl font-bold tracking-tight" />
          <DateRangePicker
            showCompare={false}
            initialDateFrom={selectedRange.from}
            initialDateTo={selectedRange.to}
            onUpdate={({ range }) => setSelectedRange({ from: range.from, to: range.to ?? range.from })}
          />
        </div>
        <GlassCard className="p-12 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Aún no hay SIMs cargadas</h3>
          <p className="text-sm text-muted-foreground">Cuando alguien cargue inventario serializado en esta organización, lo verás aquí.</p>
        </GlassCard>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="space-y-6">
      {/* Header — matches Supervisor/StockControl pattern */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <PageTitleWithInfo
            title={`Control de Stock${organization?.name ? ` · ${organization.name}` : ''}`}
            className="text-xl font-bold tracking-tight"
          />
          <p className="text-sm text-muted-foreground mt-1">Inventario serializado a nivel organización</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            showCompare={false}
            initialDateFrom={selectedRange.from}
            initialDateTo={selectedRange.to}
            onUpdate={({ range }) => setSelectedRange({ from: range.from, to: range.to ?? range.from })}
          />
          <ExportButton orgId={orgId!} params={queryParams} />
        </div>
      </div>

      {/* Summary Bar — matches StockControl.tsx pattern */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-500/5">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total SIMs</p>
              <p className="text-lg font-semibold">{summary.totalSims.toLocaleString('es-MX')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-green-500/20 to-green-500/5">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disponibles</p>
              <p className="text-lg font-semibold">{summary.available.toLocaleString('es-MX')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-amber-500/20 to-amber-500/5">
              <Box className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vendidos</p>
              <p className="text-lg font-semibold">{summary.sold.toLocaleString('es-MX')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cargas</p>
              <p className="text-lg font-semibold">{summary.totalCargas.toLocaleString('es-MX')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-pink-500/20 to-pink-500/5">
              <Store className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sucursales</p>
              <p className="text-lg font-semibold">{summary.sucursalesInvolucradas}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Underline Tabs — matches SupervisorDashboard pattern */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
        <div className="border-b border-border">
          <nav className="flex items-center gap-3 sm:gap-6 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative pb-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.value ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {activeTab === tab.value && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />}
              </button>
            ))}
          </nav>
        </div>

        <TabsContent value="resumen" className="space-y-6 mt-4">
          <OrgResumenTab data={data} />
        </TabsContent>
        <TabsContent value="cargas" className="space-y-6 mt-4">
          <OrgCargasTab data={data} />
        </TabsContent>
        <TabsContent value="detalle" className="space-y-6 mt-4">
          <OrgDetalleSimsTab data={data} />
        </TabsContent>
        <TabsContent value="sucursal" className="space-y-6 mt-4">
          <OrgPorSucursalTab data={data} />
        </TabsContent>
        <TabsContent value="categoria" className="space-y-6 mt-4">
          <OrgPorCategoriaTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
