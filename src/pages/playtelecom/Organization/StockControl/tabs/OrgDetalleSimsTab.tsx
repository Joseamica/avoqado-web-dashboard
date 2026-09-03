import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, History } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { OrgStockOverviewItem, OrgStockOverviewParams } from '@/services/stockDashboard.service'
import { CategoryChip } from '../components/CategoryChip'
import { STATUS_CONFIG } from '../lib/categoryConfig'
import { CustodyStateBadge } from '../components/CustodyStateBadge'
import { SimTimelineDrawer } from '../components/SimTimelineDrawer'
import { CollectSimDialog, type CollectFrom } from '../components/CollectSimDialog'
import { AssignToPromoterDialog } from '../components/AssignToPromoterDialog'
import { ReassignPromoterDialog } from '../components/ReassignPromoterDialog'
import { ReassignSupervisorDialog } from '../components/ReassignSupervisorDialog'
import { ChangeCategoryDialog } from '../components/ChangeCategoryDialog'
import { collectFromPromoter, collectFromSupervisor, type SimCustodyState } from '@/services/simCustody.service'
import { useAccess } from '@/hooks/use-access'
import { useAuth } from '@/context/AuthContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useOrgStockItems } from '../hooks/useOrgStockItems'

interface OrgDetalleSimsTabProps {
  orgId: string
  params: OrgStockOverviewParams
  categories: Array<{ id: string; name: string }>
  venues: Array<{ id: string; name: string }>
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function OrgDetalleSimsTab({ orgId, params, categories, venues }: OrgDetalleSimsTabProps) {
  const { can } = useAccess()
  const { user, staffInfo } = useAuth()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')
  const [sucursalFilter, setSucursalFilter] = useState<string>('all')
  const [timelineSerial, setTimelineSerial] = useState<string | null>(null)
  const [collectState, setCollectState] = useState<{
    serialNumber: string
    from: CollectFrom
    contextLabel?: string
  } | null>(null)
  const [assignPromoterSerials, setAssignPromoterSerials] = useState<string[] | null>(null)
  const [reassignPromoterOpen, setReassignPromoterOpen] = useState(false)
  const [reassignSupervisorOpen, setReassignSupervisorOpen] = useState(false)
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false)

  // Mirror OrgUsersPage pattern: useAccess stays empty on org-level routes
  // (no venueId). staffInfo.role is venue-scoped (null here) → fallback to
  // user.role (global highest). Then combine with canonical perms.
  const currentUserRole = staffInfo?.role ?? user?.role
  const isSuperOrOwner = currentUserRole === 'SUPERADMIN' || currentUserRole === 'OWNER'
  // ADMIN org-role can also use the two new bulk-action buttons; they have the
  // backend permissions but can() returns false here (no venue context).
  const isAdminOrAbove = ['SUPERADMIN', 'OWNER', 'ADMIN'].includes(currentUserRole ?? '')
  const canCollectPromoter = can('sim-custody:collect-from-promoter') || isSuperOrOwner
  const canCollectSupervisor = can('sim-custody:collect-from-supervisor') || isSuperOrOwner
  const canAssignToPromoter = can('sim-custody:assign-to-promoter') || isSuperOrOwner
  const canReassignPromoter = can('sim-custody:reassign') || isAdminOrAbove
  const canReassignSupervisor = can('sim-custody:reassign-supervisor') || isAdminOrAbove
  const canChangeCategory = can('serialized-inventory:change-category') || isAdminOrAbove
  const currentStaffId = user?.id ?? null

  const itemParams = useMemo(
    () => ({
      ...params,
      pageSize: 50,
      search: debouncedSearch || undefined,
      status: statusFilter === 'all' ? undefined : (statusFilter as 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DAMAGED'),
      categoryId: categoriaFilter === 'all' ? undefined : categoriaFilter,
      registeredFromVenueId: sucursalFilter === 'all' ? undefined : sucursalFilter,
    }),
    [params, debouncedSearch, statusFilter, categoriaFilter, sucursalFilter],
  )
  const itemsQuery = useOrgStockItems(orgId, itemParams, true)
  const filtered = useMemo(() => itemsQuery.data?.pages.flatMap(page => page.items) ?? [], [itemsQuery.data])
  const total = itemsQuery.data?.pages[0]?.pagination.total ?? 0

  const isFiltered = search || statusFilter !== 'all' || categoriaFilter !== 'all' || sucursalFilter !== 'all'

  const sentinelRef = useRef<HTMLDivElement>(null)
  const visibleItems = filtered
  const hasMore = Boolean(itemsQuery.hasNextPage)

  // IntersectionObserver to load more when sentinel comes into view
  const loadMore = useCallback(() => {
    if (!itemsQuery.isFetchingNextPage && itemsQuery.hasNextPage) void itemsQuery.fetchNextPage()
  }, [itemsQuery])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold">Detalle SIMs</h3>
        <div className="flex items-center gap-2">
          {canReassignSupervisor && (
            <Button variant="outline" size="sm" onClick={() => setReassignSupervisorOpen(true)}>
              Reasignar a Supervisor
            </Button>
          )}
          {canReassignPromoter && (
            <Button variant="outline" size="sm" onClick={() => setReassignPromoterOpen(true)}>
              Reasignar a Promotor
            </Button>
          )}
          {canChangeCategory && (
            <Button variant="outline" size="sm" onClick={() => setChangeCategoryOpen(true)}>
              Cambiar Categoría
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
            placeholder="Buscar por ICCID..."
            className="pl-9 h-9 font-mono text-sm"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
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
        {categories.length > 1 && (
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {venues.length > 1 && (
          <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
            <SelectTrigger className="w-full sm:w-[220px] h-9">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {venues.map(venue => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Results count */}
      {isFiltered && (
        <p className="text-xs text-muted-foreground mb-3">
          {total.toLocaleString('es-MX')} {total === 1 ? 'resultado' : 'resultados'}
        </p>
      )}

      {/* Desktop table — virtualized via CSS content-visibility */}
      <div className="hidden md:block overflow-x-auto" style={{ maxHeight: 'calc(100vh - 460px)', minHeight: 320 }}>
        <table className="w-full">
          <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">ICCID</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Custodia</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Supervisor</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Promotor</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoría</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha carga</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sucursal receptora</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendido en</th>
              <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length > 0 ? (
              visibleItems.map(item => (
                <SimRow
                  key={item.id}
                  item={item}
                  canCollectPromoter={canCollectPromoter}
                  canCollectSupervisor={canCollectSupervisor}
                  canAssignToPromoter={canAssignToPromoter}
                  currentStaffId={currentStaffId}
                  onTimeline={() => setTimelineSerial(item.serialNumber)}
                  onCollect={(from, contextLabel) => setCollectState({ serialNumber: item.serialNumber, from, contextLabel })}
                  onAssignToPromoter={() => setAssignPromoterSerials([item.serialNumber])}
                />
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  {isFiltered ? 'No se encontraron SIMs con esos filtros' : 'No hay SIMs en el período seleccionado'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Infinite scroll sentinel + loading indicator */}
        <div ref={sentinelRef} className="h-1" />
        {(hasMore || itemsQuery.isFetchingNextPage) && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando más...
          </div>
        )}
        {!hasMore && total > 50 && (
          <p className="text-center text-xs text-muted-foreground py-3">
            Mostrando {filtered.length.toLocaleString('es-MX')} de {total.toLocaleString('es-MX')} SIMs
          </p>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length > 0 ? (
          filtered.map(item => {
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
        {hasMore && (
          <Button variant="outline" size="sm" className="w-full" disabled={itemsQuery.isFetchingNextPage} onClick={loadMore}>
            {itemsQuery.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cargar más
          </Button>
        )}
      </div>

      {orgId && (
        <SimTimelineDrawer
          open={Boolean(timelineSerial)}
          onOpenChange={o => !o && setTimelineSerial(null)}
          orgId={orgId}
          serialNumber={timelineSerial}
        />
      )}

      {orgId && collectState && (
        <CollectSimDialog
          open={Boolean(collectState)}
          onOpenChange={o => !o && setCollectState(null)}
          serialNumber={collectState.serialNumber}
          from={collectState.from}
          contextLabel={collectState.contextLabel}
          onConfirm={async reason => {
            if (collectState.from === 'promoter') {
              await collectFromPromoter(orgId, { serialNumber: collectState.serialNumber, reason })
            } else {
              await collectFromSupervisor(orgId, { serialNumber: collectState.serialNumber, reason })
            }
          }}
        />
      )}

      {orgId && assignPromoterSerials && (
        <AssignToPromoterDialog
          open={Boolean(assignPromoterSerials)}
          onOpenChange={o => !o && setAssignPromoterSerials(null)}
          orgId={orgId}
          serialNumbers={assignPromoterSerials}
        />
      )}

      {orgId && <ReassignSupervisorDialog open={reassignSupervisorOpen} onOpenChange={setReassignSupervisorOpen} orgId={orgId} />}

      {orgId && <ReassignPromoterDialog open={reassignPromoterOpen} onOpenChange={setReassignPromoterOpen} orgId={orgId} />}

      {orgId && <ChangeCategoryDialog open={changeCategoryOpen} onOpenChange={setChangeCategoryOpen} orgId={orgId} />}
    </GlassCard>
  )
}

interface SimRowProps {
  item: OrgStockOverviewItem
  canCollectPromoter: boolean
  canCollectSupervisor: boolean
  canAssignToPromoter: boolean
  currentStaffId: string | null
  onTimeline: () => void
  onCollect: (from: CollectFrom, contextLabel?: string) => void
  onAssignToPromoter: () => void
}

function SimRow({
  item,
  canCollectPromoter,
  canCollectSupervisor,
  canAssignToPromoter,
  currentStaffId,
  onTimeline,
  onCollect,
  onAssignToPromoter,
}: SimRowProps) {
  const status = STATUS_CONFIG[item.status] ?? { label: item.status, className: 'bg-muted text-muted-foreground' }
  const custody = (item.custodyState ?? 'ADMIN_HELD') as SimCustodyState
  const canCollectFromPromoter = canCollectPromoter && Boolean(item.assignedPromoterId) && custody !== 'SOLD'
  const canCollectFromSupervisor = canCollectSupervisor && custody === 'SUPERVISOR_HELD' // plan §1.4 — only valid when nobody downstream
  // Asana requirement §"FLUJO DE ASIGNACIÓN DE SIMS DE SUPERVISOR A PROMOTOR":
  // "El Supervisor ingresa a Dashboard y busca el ID SIM... se asigna a un
  // usuario promotor". The Supervisor owner is the actor; OWNER/SUPERADMIN
  // does NOT bypass — that would break the audit trail 4Play explicitly needs.
  const canShowAssignToPromoter =
    canAssignToPromoter &&
    custody === 'SUPERVISOR_HELD' &&
    (item.assignedSupervisorId === currentStaffId || item.assignedSupervisorId == null)

  return (
    <tr
      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' } as React.CSSProperties}
    >
      <td className="py-3 px-2">
        <button type="button" onClick={onTimeline} className="text-left" title="Ver historial del SIM">
          <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono hover:bg-muted">{item.serialNumber}</code>
        </button>
      </td>
      <td className="py-3 px-2">
        <div className="flex flex-col gap-1">
          <CustodyStateBadge state={custody} />
          <Badge variant="outline" className={`text-[10px] ${status.className}`}>
            {status.label}
          </Badge>
        </div>
      </td>
      <td className="py-3 px-2 text-sm">
        <span className="block max-w-[180px] truncate">
          {item.assignedSupervisorName ?? <span className="text-muted-foreground">—</span>}
        </span>
        {item.assignedSupervisorEmployeeCode && (
          <span className="block text-[10px] font-mono text-muted-foreground tracking-wide">{item.assignedSupervisorEmployeeCode}</span>
        )}
      </td>
      <td className="py-3 px-2 text-sm">
        <span className="block max-w-[180px] truncate">
          {item.assignedPromoterName ?? <span className="text-muted-foreground">—</span>}
          {item.promoterRejectedAt && <span className="ml-1 text-red-600 text-xs">(rechazado)</span>}
        </span>
        {item.assignedPromoterEmployeeCode && (
          <span className="block text-[10px] font-mono text-muted-foreground tracking-wide">{item.assignedPromoterEmployeeCode}</span>
        )}
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
      <td className="py-3 px-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onTimeline} title="Historial">
            <History className="h-4 w-4" />
          </Button>
          {canShowAssignToPromoter && (
            <Button variant="default" size="sm" className="h-8 text-xs" onClick={onAssignToPromoter}>
              Asignar a Promotor
            </Button>
          )}
          {canCollectFromPromoter && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onCollect('promoter', item.assignedPromoterName ?? undefined)}
            >
              Recolectar
            </Button>
          )}
          {canCollectFromSupervisor && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onCollect('supervisor', item.assignedSupervisorName ?? undefined)}
            >
              Recolectar
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
