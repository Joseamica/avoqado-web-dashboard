import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { OrgStockOverview, OrgStockBulkGroup } from '@/services/stockDashboard.service'
import { CategoryChip } from '../components/CategoryChip'

interface OrgCargasTabProps {
  data: OrgStockOverview
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function OrgCargasTab({ data }: OrgCargasTabProps) {
  const [search, setSearch] = useState('')
  const [sucursalFilter, setSucursalFilter] = useState<string>('all')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')

  const sucursales = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of data.bulkGroups) {
      if (g.registeredFromVenueId && g.registeredFromVenueName) {
        map.set(g.registeredFromVenueId, g.registeredFromVenueName)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [data.bulkGroups])

  const categorias = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of data.bulkGroups) map.set(g.categoryId, g.categoryName)
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [data.bulkGroups])

  const filtered = useMemo(() => {
    return data.bulkGroups.filter(g => {
      if (sucursalFilter !== 'all' && g.registeredFromVenueId !== sucursalFilter) return false
      if (categoriaFilter !== 'all' && g.categoryId !== categoriaFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const hit =
          g.serialNumberFirst.toLowerCase().includes(q) ||
          g.serialNumberLast.toLowerCase().includes(q) ||
          g.serialNumbers.some(s => s.toLowerCase().includes(q))
        if (!hit) return false
      }
      return true
    })
  }, [data.bulkGroups, sucursalFilter, categoriaFilter, search])

  const isFiltered = search || sucursalFilter !== 'all' || categoriaFilter !== 'all'

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold">Cargas masivas</h3>
      </div>

      {/* Filters — matches StockControl pattern */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ICCID..." className="pl-9 h-9" />
        </div>
        {sucursales.length > 1 && (
          <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
            <SelectTrigger className="w-full sm:w-[220px] h-9">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {sucursales.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {categorias.length > 1 && (
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categorias.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Results count */}
      {isFiltered && (
        <p className="text-xs text-muted-foreground mb-3">
          {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
        </p>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sucursal</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoría</th>
              <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cantidad</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">ICCID Primero</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">ICCID Último</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Por</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map(g => <CargaRow key={g.id} group={g} />)
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  {isFiltered ? 'No se encontraron cargas con esos filtros' : 'No hay cargas en el período seleccionado'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length > 0 ? (
          filtered.map(g => (
            <div key={g.id} className="rounded-lg border border-border/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{g.itemCount} SIMs</span>
                {g.soldCount > 0 ? (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Parcial ({g.soldCount}/{g.itemCount})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                    Disponible
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Sucursal</span>
                <span className="truncate">{g.registeredFromVenueName ?? '-'}</span>
                <span className="text-muted-foreground">Categoría</span>
                <span className="truncate">{g.categoryName}</span>
                <span className="text-muted-foreground">Fecha</span>
                <span>{fmtDateTime(g.firstCreatedAt)}</span>
                <span className="text-muted-foreground">Por</span>
                <span className="truncate">{g.createdByName ?? '-'}</span>
              </div>
              <div className="flex items-center gap-1 text-xs flex-wrap">
                <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">{g.serialNumberFirst}</code>
                <span className="text-muted-foreground">→</span>
                <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">{g.serialNumberLast}</code>
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground text-sm">{isFiltered ? 'Sin resultados' : 'No hay cargas en el período'}</p>
        )}
      </div>
    </GlassCard>
  )
}

function CargaRow({ group }: { group: OrgStockBulkGroup }) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">{fmtDateTime(group.firstCreatedAt)}</td>
      <td className="py-3 px-2 text-sm">
        <span className="block max-w-[220px] truncate">{group.registeredFromVenueName ?? '-'}</span>
      </td>
      <td className="py-3 px-2">
        <CategoryChip name={group.categoryName} />
      </td>
      <td className="py-3 px-2 text-sm text-right font-semibold">{group.itemCount}</td>
      <td className="py-3 px-2">
        <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">{group.serialNumberFirst}</code>
      </td>
      <td className="py-3 px-2">
        <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">{group.serialNumberLast}</code>
      </td>
      <td className="py-3 px-2 text-sm">{group.createdByName ?? <span className="text-muted-foreground">-</span>}</td>
      <td className="py-3 px-2">
        {group.soldCount > 0 ? (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
            Parcial ({group.soldCount}/{group.itemCount})
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
            Disponible
          </Badge>
        )}
      </td>
    </tr>
  )
}
