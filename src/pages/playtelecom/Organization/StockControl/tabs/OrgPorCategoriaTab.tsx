import { useMemo, useState } from 'react'
import { Search, Package } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { OrgStockOverview, OrgStockCategoriaAggregate } from '@/services/stockDashboard.service'
import { CategoryChip } from '../components/CategoryChip'
import { includesNormalized } from '@/lib/utils'

interface OrgPorCategoriaTabProps {
  data: OrgStockOverview
}

export function OrgPorCategoriaTab({ data }: OrgPorCategoriaTabProps) {
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'with' | 'without'>('all')

  const filtered = useMemo(() => {
    let result = [...data.aggregatesByCategoria]
    if (search.trim()) {
      result = result.filter(c => includesNormalized(c.categoryName ?? '', search))
    }
    if (stockFilter === 'with') result = result.filter(c => c.available > 0)
    if (stockFilter === 'without') result = result.filter(c => c.available === 0)
    return result
  }, [data.aggregatesByCategoria, search, stockFilter])

  return (
    <>
      {/* Category Summary Cards — matches StockControl pattern */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.aggregatesByCategoria.length > 0 ? (
          data.aggregatesByCategoria.slice(0, 4).map(category => (
            <GlassCard key={category.categoryId} className="p-4" hover>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm truncate pr-2">{category.categoryName}</h3>
                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Disponibles</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{category.available.toLocaleString('es-MX')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Vendidos</span>
                  <span className="font-medium">{category.sold.toLocaleString('es-MX')}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">% Rotación</span>
                  <span className="font-bold">{category.rotacionPct.toFixed(2)}%</span>
                </div>
              </div>
            </GlassCard>
          ))
        ) : (
          <GlassCard className="col-span-full p-8 text-center">
            <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No hay categorías en el período</p>
          </GlassCard>
        )}
      </div>

      {/* Detailed table */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold">Detalle por Categoría</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoría..." className="pl-9 h-9" />
          </div>
          <Select value={stockFilter} onValueChange={v => setStockFilter(v as typeof stockFilter)}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="with">Con stock</SelectItem>
              <SelectItem value="without">Sin stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoría</th>
                <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">% del total</th>
                <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Disponibles</th>
                <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendidos</th>
                <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">% Rotación</th>
                <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sucursales con stock
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(agg => <CategoriaRow key={agg.categoryId} agg={agg} />)
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No hay categorías que coincidan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {filtered.length > 0 ? (
            filtered.map(agg => (
              <div key={agg.categoryId} className="rounded-lg border border-border/50 p-3 space-y-2">
                <CategoryChip name={agg.categoryName} />
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold">{agg.totalSims.toLocaleString('es-MX')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Disponibles</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">{agg.available.toLocaleString('es-MX')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rotación</p>
                    <p className="font-semibold">{agg.rotacionPct.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-muted-foreground text-sm">No hay categorías</p>
          )}
        </div>
      </GlassCard>
    </>
  )
}

function CategoriaRow({ agg }: { agg: OrgStockCategoriaAggregate }) {
  const pct = Math.min(100, agg.rotacionPct)
  return (
    <tr className="border-b border-border/30 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-2">
        <CategoryChip name={agg.categoryName} />
      </td>
      <td className="py-3 px-2 text-sm text-right font-semibold">{agg.totalSims.toLocaleString('es-MX')}</td>
      <td className="py-3 px-2 text-sm text-right text-muted-foreground">{agg.pctOfTotal.toFixed(1)}%</td>
      <td className="py-3 px-2 text-sm text-right text-green-600 dark:text-green-400 font-medium">
        {agg.available.toLocaleString('es-MX')}
      </td>
      <td className="py-3 px-2 text-sm text-right text-blue-600 dark:text-blue-400 font-medium">{agg.sold.toLocaleString('es-MX')}</td>
      <td className="py-3 px-2 text-right">
        <div className="inline-flex flex-col items-end gap-0.5">
          <span className="text-sm font-medium">{agg.rotacionPct.toFixed(2)}%</span>
          <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </td>
      <td className="py-3 px-2 text-sm text-right">{agg.sucursalesConStock}</td>
    </tr>
  )
}
