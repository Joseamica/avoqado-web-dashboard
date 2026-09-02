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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Package, Upload } from 'lucide-react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/date-range-picker'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useOrgStockSummary } from './StockControl/hooks/useOrgStockSummary'
import { useInventoryByResponsible } from './StockControl/hooks/useInventoryByResponsible'
import { InventoryResponsibleFilters } from './StockControl/components/InventoryResponsibleFilters'
import { ExportDashboardButton } from './StockControl/components/ExportDashboardButton'
import { ExportButton } from './StockControl/components/ExportButton'
import { OrgResumenTab } from './StockControl/tabs/OrgResumenTab'
import { OrgCargasTab } from './StockControl/tabs/OrgCargasTab'
import { OrgDetalleSimsTab } from './StockControl/tabs/OrgDetalleSimsTab'
import { OrgSolicitudesTab } from './StockControl/tabs/OrgSolicitudesTab'
import { AssignToSupervisorDialog } from './StockControl/components/AssignToSupervisorDialog'
import { OrgBulkUploadDialog } from './StockControl/components/OrgBulkUploadDialog'
import { ReassignPromoterDialog } from './StockControl/components/ReassignPromoterDialog'
import { useAccess } from '@/hooks/use-access'
import { useAuth } from '@/context/AuthContext'
import { useSimRegistrationRequestsCount } from './StockControl/hooks/useSimRegistrationRequests'
import { useStockApprovalsCount } from './StockControl/hooks/useStockApprovals'

const TABS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'cargas', label: 'Cargas' },
  { value: 'detalle', label: 'Detalle SIMs' },
  { value: 'solicitudes', label: 'Solicitudes' },
] as const

type TabValue = (typeof TABS)[number]['value']

// Default range covers a full year so SIMs registered before the rolling 30-day
// window (e.g. PlayTelecom's bulk uploads from semanas atrás) remain visible
// when the OWNER lands on Control de Stock. The user can still narrow the
// range via the DateRangePicker. Filtering by createdAt would otherwise hide
// items currently in custody whose registration is older than the window.
function defaultRangeStart(): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function todayEndOfDay(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export default function OrgStockControlPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { organization, venues } = useCurrentOrganization()
  const { can } = useAccess()
  const { user, staffInfo } = useAuth()
  const [activeTab, setActiveTab] = useState<TabValue>('resumen')
  const [assignOpen, setAssignOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  // Role fallback pattern copied from OrgUsersPage: staffInfo.role is
  // venue-scoped (null on org-level routes like /wl/organizations/:slug where
  // useAccess also stays empty because there's no venueId). Fall back to
  // user.role (global highest role) to gate the button for SUPERADMIN/OWNER.
  const currentUserRole = staffInfo?.role ?? user?.role
  const isSuperOrOwner = currentUserRole === 'SUPERADMIN' || currentUserRole === 'OWNER'
  const isAdminOrAbove = ['SUPERADMIN', 'OWNER', 'ADMIN'].includes(currentUserRole ?? '')
  const canAssignToSupervisor = can('sim-custody:assign-to-supervisor') || can('inventory:org-manage') || isSuperOrOwner
  // Mirrors OrgDetalleSimsTab.tsx's canReassignPromoter exactly — same action, same door.
  const canReassignPromoter = can('sim-custody:reassign') || isAdminOrAbove
  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date }>(() => ({
    from: defaultRangeStart(),
    to: todayEndOfDay(),
  }))

  // IMPORTANT: guard against infinite re-renders. DateRangePicker re-emits
  // onUpdate whenever its `initialDate*` props change identity, and the `to`
  // side arrives as `new Date()` (current instant) each time. Comparing by
  // ms always differs. Compare by DAY so only real user-selected range
  // changes update state.
  const handleDateRangeUpdate = useCallback(({ range }: { range: { from: Date; to?: Date } }) => {
    const nextFrom = range.from
    const nextTo = range.to ?? range.from
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
    setSelectedRange(prev => {
      if (sameDay(prev.from, nextFrom) && sameDay(prev.to, nextTo)) {
        return prev
      }
      return { from: nextFrom, to: nextTo }
    })
  }, [])

  const queryParams = useMemo(
    () => ({
      dateFrom: selectedRange.from.toISOString(),
      dateTo: selectedRange.to.toISOString(),
    }),
    [selectedRange],
  )

  // Filtros de la tabla por responsable. `undefined` = todavía no se inicializa
  // con el default que manda el server; `null` = el usuario eligió "todas".
  // Distinguirlos importa: sin ese tercer estado, el efecto que aplica el default
  // pisaría la elección del usuario en cada refetch.
  const [receivingVenueId, setReceivingVenueId] = useState<string | null | undefined>(undefined)
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const byResponsibleParams = useMemo(
    () => ({ ...queryParams, receivingVenueId: receivingVenueId ?? null, categoryId }),
    [queryParams, receivingVenueId, categoryId],
  )

  const { data, isLoading, isError, error, refetch } = useOrgStockSummary(orgId, queryParams)
  const { data: byResponsible, isLoading: isLoadingByResponsible } = useInventoryByResponsible(orgId, byResponsibleParams)
  const categoryOptions = useMemo(
    () => (data?.aggregatesByCategoria ?? []).map(category => ({ id: category.categoryId, name: category.categoryName })),
    [data?.aggregatesByCategoria],
  )
  const venueOptions = useMemo(
    () =>
      (data?.aggregatesBySucursal ?? [])
        .filter(venue => venue.venueId !== '__unassigned__')
        .map(venue => ({ id: venue.venueId, name: venue.venueName })),
    [data?.aggregatesBySucursal],
  )

  // El almacén de entrada con el que abre la pantalla lo decide el server desde
  // la configuración del módulo. Se aplica UNA vez; a partir de ahí manda el
  // usuario, incluso si elige "todas" (por eso `null` cuenta como elegido).
  const defaultReceivingVenueId = byResponsible?.filters?.defaultReceivingVenueId ?? null
  useEffect(() => {
    if (receivingVenueId === undefined && byResponsible) setReceivingVenueId(defaultReceivingVenueId)
  }, [byResponsible, defaultReceivingVenueId, receivingVenueId])
  const { data: simRegCount = 0 } = useSimRegistrationRequestsCount(orgId)
  const { data: stockApprovalCount = 0 } = useStockApprovalsCount(orgId)
  const pendingCount = simRegCount + stockApprovalCount

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
            onUpdate={handleDateRangeUpdate}
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
            onUpdate={handleDateRangeUpdate}
          />
          <ExportButton orgId={orgId!} params={queryParams} />
          {/* If the user already reached /stock-control they're implicitly on a
              PlayTelecom-style org; keep this button gated by permissions +
              org venues only. */}
          {canAssignToSupervisor && venues.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setUploadOpen(true)}
              title="Cargar ICCIDs nuevos al sistema (registro inicial). La asignación a Supervisor es el paso siguiente."
            >
              <Upload className="mr-2 h-4 w-4" />
              Cargar Items
            </Button>
          )}
          {canReassignPromoter && (
            <Button variant="warning" onClick={() => setReassignOpen(true)}>
              Reasignar SIMs
            </Button>
          )}
          {canAssignToSupervisor && <Button onClick={() => setAssignOpen(true)}>Asignar SIMs</Button>}
        </div>
      </div>

      {orgId && canAssignToSupervisor && <AssignToSupervisorDialog open={assignOpen} onOpenChange={setAssignOpen} orgId={orgId} />}

      {orgId && canReassignPromoter && <ReassignPromoterDialog open={reassignOpen} onOpenChange={setReassignOpen} orgId={orgId} />}

      {canAssignToSupervisor && venues.length > 0 && <OrgBulkUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />}

      {/* Underline Tabs — matches SupervisorDashboard pattern */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
        <div className="border-b border-border">
          <nav className="flex items-center gap-3 sm:gap-6 overflow-x-auto" aria-label="Secciones de control de stock">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative pb-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.value ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.value === 'solicitudes' && pendingCount > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">{pendingCount}</span>
                )}
                {activeTab === tab.value && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />}
              </button>
            ))}
          </nav>
        </div>

        <TabsContent value="resumen" className="space-y-6 mt-4">
          <InventoryResponsibleFilters
            filters={byResponsible?.filters}
            receivingVenueId={receivingVenueId ?? null}
            categoryId={categoryId}
            onReceivingVenueChange={setReceivingVenueId}
            onCategoryChange={setCategoryId}
            disabled={isLoadingByResponsible}
          />
          <div className="flex justify-end">
            <ExportDashboardButton
              data={byResponsible}
              orgId={orgId!}
              params={queryParams}
              receivingVenueId={receivingVenueId ?? null}
              categoryId={categoryId}
              disabled={isLoadingByResponsible}
            />
          </div>
          <OrgResumenTab data={data} byResponsible={byResponsible} isLoadingByResponsible={isLoadingByResponsible} />
        </TabsContent>
        <TabsContent value="cargas" className="space-y-6 mt-4">
          <OrgCargasTab orgId={orgId!} params={queryParams} categories={categoryOptions} venues={venueOptions} />
        </TabsContent>
        <TabsContent value="detalle" className="space-y-6 mt-4">
          <OrgDetalleSimsTab orgId={orgId!} params={queryParams} categories={categoryOptions} venues={venueOptions} />
        </TabsContent>
        <TabsContent value="solicitudes" className="space-y-6 mt-4">
          <OrgSolicitudesTab orgId={orgId!} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
