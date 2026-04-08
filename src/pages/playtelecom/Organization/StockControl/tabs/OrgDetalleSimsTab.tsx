import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { OrgStockOverview, OrgStockOverviewItem } from '@/services/stockDashboard.service'
import { CategoryChip } from '../components/CategoryChip'
import { STATUS_CONFIG } from '../lib/categoryConfig'

interface OrgDetalleSimsTabProps {
  data: OrgStockOverview
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function OrgDetalleSimsTab({ data }: OrgDetalleSimsTabProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')
  const [sucursalFilter, setSucursalFilter] = useState<string>('all')

  const categorias = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of data.items) map.set(i.categoryId, i.categoryName)
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [data.items])

  const sucursales = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of data.items) {
      if (i.registeredFromVenueId && i.registeredFromVenueName) {
        map.set(i.registeredFromVenueId, i.registeredFromVenueName)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [data.items])

  const filtered = useMemo(() => {
    return data.items.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (categoriaFilter !== 'all' && item.categoryId !== categoriaFilter) return false
      if (sucursalFilter !== 'all' && item.registeredFromVenueId !== sucursalFilter) return false
      if (search.trim() && !item.serialNumber.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [data.items, statusFilter, categoriaFilter, sucursalFilter, search])

  const isFiltered = search || statusFilter !== 'all' || categoriaFilter !== 'all' || sucursalFilter !== 'all'

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold">Detalle SIMs</h3>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ICCID..."
            className="pl-9 h-9 font-mono text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="AVAILABLE">Disponible</SelectItem>
            <SelectItem value="SOLD">Vendido</SelectItem>
            <SelectItem value="RETURNED">Devuelto</SelectItem>
            <SelectItem value="DAMAGED">Dañado</SelectItem>
          </SelectContent>
        </Select>
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
      </div>

      {/* Results count */}
      {isFiltered && (
        <p className="text-xs text-muted-foreground mb-3">
          {filtered.length.toLocaleString('es-MX')} {filtered.length === 1 ? 'resultado' : 'resultados'}
        </p>
      )}

      {/* Desktop table — virtualized via CSS content-visibility */}
      <div className="hidden md:block overflow-x-auto" style={{ maxHeight: 'calc(100vh - 460px)', minHeight: 320 }}>
        <table className="w-full">
          <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">ICCID</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoría</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha carga</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sucursal receptora</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendido en</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha venta</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map(item => <SimRow key={item.id} item={item} />)
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  {isFiltered ? 'No se encontraron SIMs con esos filtros' : 'No hay SIMs en el período seleccionado'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length > 0 ? (
          filtered.slice(0, 200).map(item => {
            const status = STATUS_CONFIG[item.status] ?? { label: item.status, className: 'bg-muted text-muted-foreground' }
            return (
              <div key={item.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono truncate">{item.serialNumber}</code>
                  <Badge variant="outline" className={`text-xs shrink-0 ${status.className}`}>
                    {status.label}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Categoría</span>
                  <span className="truncate">{item.categoryName}</span>
                  <span className="text-muted-foreground">Fecha carga</span>
                  <span>{fmtDateTime(item.createdAt)}</span>
                  <span className="text-muted-foreground">Sucursal receptora</span>
                  <span className="truncate">{item.registeredFromVenueName ?? '-'}</span>
                  {item.sellingVenueName && (
                    <>
                      <span className="text-muted-foreground">Vendido en</span>
                      <span className="truncate">{item.sellingVenueName}</span>
                    </>
                  )}
                  {item.soldAt && (
                    <>
                      <span className="text-muted-foreground">Fecha venta</span>
                      <span>{fmtDateTime(item.soldAt)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <p className="py-8 text-center text-muted-foreground text-sm">{isFiltered ? 'Sin resultados' : 'No hay SIMs en el período'}</p>
        )}
        {filtered.length > 200 && (
          <p className="py-4 text-center text-muted-foreground text-xs">
            Mostrando 200 de {filtered.length.toLocaleString('es-MX')}. Filtra para refinar.
          </p>
        )}
      </div>
    </GlassCard>
  )
}

function SimRow({ item }: { item: OrgStockOverviewItem }) {
  const status = STATUS_CONFIG[item.status] ?? { label: item.status, className: 'bg-muted text-muted-foreground' }
  return (
    <tr
      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' } as React.CSSProperties}
    >
      <td className="py-3 px-2">
        <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">{item.serialNumber}</code>
      </td>
      <td className="py-3 px-2">
        <Badge variant="outline" className={`text-xs ${status.className}`}>
          {status.label}
        </Badge>
      </td>
      <td className="py-3 px-2">
        <CategoryChip name={item.categoryName} />
      </td>
      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">{fmtDateTime(item.createdAt)}</td>
      <td className="py-3 px-2 text-sm">
        <span className="block max-w-[220px] truncate">
          {item.registeredFromVenueName ?? <span className="text-muted-foreground">-</span>}
        </span>
      </td>
      <td className="py-3 px-2 text-sm">
        <span className="block max-w-[200px] truncate">{item.sellingVenueName ?? <span className="text-muted-foreground">-</span>}</span>
      </td>
      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">{fmtDateTime(item.soldAt)}</td>
    </tr>
  )
}
