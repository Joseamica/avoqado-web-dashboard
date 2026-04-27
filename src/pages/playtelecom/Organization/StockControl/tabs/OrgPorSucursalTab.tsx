import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { OrgStockOverview, OrgStockSucursalAggregate } from '@/services/stockDashboard.service'
import { Sparkline } from '../components/Sparkline'
import { includesNormalized } from '@/lib/utils'

interface OrgPorSucursalTabProps {
  data: OrgStockOverview
}

type SortKey = 'totalSims' | 'available' | 'sold' | 'rotacionPct' | 'lastActivity'

function relativeTime(iso: string | null) {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

export function OrgPorSucursalTab({ data }: OrgPorSucursalTabProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('totalSims')

  const filtered = useMemo(() => {
    let result = [...data.aggregatesBySucursal]
    if (search.trim()) {
      result = result.filter(a => includesNormalized(a.venueName ?? '', search))
    }
    result.sort((a, b) => {
      if (sortBy === 'lastActivity') return (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '')
      return (b[sortBy] as number) - (a[sortBy] as number)
    })
    return result
  }, [data.aggregatesBySucursal, search, sortBy])

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold">Por Sucursal</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar sucursal..." className="pl-9 h-9" />
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[200px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalSims">Total SIMs</SelectItem>
            <SelectItem value="available">Disponibles</SelectItem>
            <SelectItem value="sold">Vendidos</SelectItem>
            <SelectItem value="rotacionPct">% Vendido</SelectItem>
            <SelectItem value="lastActivity">Última actividad</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sucursal</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tendencia 7d</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Disponibles</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendidos</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">% Vendido</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Última carga</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((agg, idx) => <SucursalRow key={agg.venueId} agg={agg} rank={idx + 1} />)
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No hay sucursales en el período
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length > 0 ? (
          filtered.map((agg, idx) => (
            <div key={agg.venueId} className="rounded-lg border border-border/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">
                  <span className="text-muted-foreground mr-1">#{idx + 1}</span>
                  {agg.venueName}
                </span>
                <span className="text-sm font-semibold shrink-0">{agg.totalSims}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Disponibles</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">{agg.available}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vendidos</p>
                  <p className="font-semibold text-blue-600 dark:text-blue-400">{agg.sold}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">% Vendido</p>
                  <p className="font-semibold">{agg.rotacionPct.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground text-sm">No hay sucursales</p>
        )}
      </div>
    </GlassCard>
  )
}

function SucursalRow({ agg, rank }: { agg: OrgStockSucursalAggregate; rank: number }) {
  const pct = Math.min(100, agg.rotacionPct)
  return (
    <tr className="border-b border-border/30 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-2 text-sm text-muted-foreground">{rank}</td>
      <td className="py-3 px-2 text-sm">
        <span className="block max-w-[280px] truncate font-medium">{agg.venueName}</span>
      </td>
      <td className="py-3 px-2 text-blue-600 dark:text-blue-400">
        <Sparkline data={agg.salesLast7Days} />
      </td>
      <td className="py-3 px-2 text-sm text-right font-semibold">{agg.totalSims}</td>
      <td className="py-3 px-2 text-sm text-right text-green-600 dark:text-green-400 font-medium">{agg.available}</td>
      <td className="py-3 px-2 text-sm text-right text-blue-600 dark:text-blue-400 font-medium">{agg.sold}</td>
      <td className="py-3 px-2 text-right">
        <div className="inline-flex flex-col items-end gap-0.5">
          <span className="text-sm font-medium">{agg.rotacionPct.toFixed(1)}%</span>
          <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </td>
      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">{relativeTime(agg.lastActivity)}</td>
    </tr>
  )
}
