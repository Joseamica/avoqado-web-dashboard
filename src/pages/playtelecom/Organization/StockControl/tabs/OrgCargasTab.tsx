import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { OrgStockBulkGroupPageItem, OrgStockOverviewParams } from '@/services/stockDashboard.service'
import { useDebounce } from '@/hooks/useDebounce'
import { useOrgStockBulkGroups } from '../hooks/useOrgStockBulkGroups'
import { CategoryChip } from '../components/CategoryChip'

const PAGE_SIZE = 20

interface FilterOption {
  id: string
  name: string
}

interface OrgCargasTabProps {
  orgId: string
  params: OrgStockOverviewParams
  categories: FilterOption[]
  venues: FilterOption[]
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function OrgCargasTab({ orgId, params, categories, venues }: OrgCargasTabProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [registeredFromVenueId, setRegisteredFromVenueId] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => setPage(1), [debouncedSearch, registeredFromVenueId, categoryId])

  const queryParams = useMemo(
    () => ({
      ...params,
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      registeredFromVenueId: registeredFromVenueId === 'all' ? undefined : registeredFromVenueId,
    }),
    [params, page, debouncedSearch, categoryId, registeredFromVenueId],
  )
  const query = useOrgStockBulkGroups(orgId, queryParams, true)
  const groups = query.data?.groups ?? []
  const total = query.data?.pagination.total ?? 0
  const totalPages = query.data?.pagination.totalPages ?? 0
  const isFiltered = Boolean(search || registeredFromVenueId !== 'all' || categoryId !== 'all')

  return (
    <GlassCard className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Cargas masivas</h3>
        {query.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Actualizando cargas" />}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value.replace(/[^A-Za-z0-9]/g, ''))}
            placeholder="Buscar por ICCID..."
            className="h-9 pl-9 font-mono text-sm"
          />
        </div>
        {venues.length > 1 && (
          <Select value={registeredFromVenueId} onValueChange={setRegisteredFromVenueId}>
            <SelectTrigger className="h-9 w-full sm:w-[220px]"><SelectValue placeholder="Sucursal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {venues.map(venue => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {categories.length > 1 && (
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-9 w-full sm:w-[200px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {(isFiltered || total > 0) && (
        <p className="mb-3 text-xs text-muted-foreground">
          {total.toLocaleString('es-MX')} {total === 1 ? 'resultado' : 'resultados'}
        </p>
      )}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              {['Fecha', 'Sucursal', 'Categoría', 'Cantidad', 'ICCID Primero', 'ICCID Último', 'Por', 'Estado'].map(label => (
                <th key={label} className="px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length > 0 ? groups.map(group => <CargaRow key={group.id} group={group} />) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  {query.isLoading ? 'Cargando cargas…' : isFiltered ? 'No se encontraron cargas con esos filtros' : 'No hay cargas en el período seleccionado'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {groups.map(group => (
          <div key={group.id} className="space-y-2 rounded-lg border border-border/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{group.itemCount} SIMs</span>
              <GroupStatus group={group} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Sucursal</span><span className="truncate">{group.registeredFromVenueName ?? '-'}</span>
              <span className="text-muted-foreground">Categoría</span><span className="truncate">{group.categoryName}</span>
              <span className="text-muted-foreground">Fecha</span><span>{fmtDateTime(group.firstCreatedAt)}</span>
              <span className="text-muted-foreground">Por</span><span className="truncate">{group.createdByName ?? '-'}</span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-4">
          <p className="text-xs text-muted-foreground">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString('es-MX')}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />Anterior
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>
              Siguiente<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

function GroupStatus({ group }: { group: OrgStockBulkGroupPageItem }) {
  return group.soldCount > 0 ? (
    <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-600">Parcial ({group.soldCount}/{group.itemCount})</Badge>
  ) : (
    <Badge variant="outline" className="border-green-500/20 bg-green-500/10 text-xs text-green-600">Disponible</Badge>
  )
}

function CargaRow({ group }: { group: OrgStockBulkGroupPageItem }) {
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-muted/30">
      <td className="whitespace-nowrap px-2 py-3 text-sm text-muted-foreground">{fmtDateTime(group.firstCreatedAt)}</td>
      <td className="px-2 py-3 text-sm">{group.registeredFromVenueName ?? '-'}</td>
      <td className="px-2 py-3"><CategoryChip name={group.categoryName} /></td>
      <td className="px-2 py-3 text-right text-sm font-semibold">{group.itemCount}</td>
      <td className="px-2 py-3"><code className="rounded bg-muted/50 px-2 py-1 font-mono text-xs">{group.serialNumberFirst}</code></td>
      <td className="px-2 py-3"><code className="rounded bg-muted/50 px-2 py-1 font-mono text-xs">{group.serialNumberLast}</code></td>
      <td className="px-2 py-3 text-sm">{group.createdByName ?? '-'}</td>
      <td className="px-2 py-3"><GroupStatus group={group} /></td>
    </tr>
  )
}
