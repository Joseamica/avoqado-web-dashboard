/**
 * VenueSimCustodyPanel — "Custodia de SIMs" panel for the venue-level Stock
 * Control page (`/wl/venues/:slug/stock`).
 *
 * Surfaces ONLY the SIMs where the current staff is the assignedSupervisor.
 * From here the Supervisor can:
 *   - See a summary by custody state + alerts (rejected, stuck >7 days)
 *   - See a ranking of their own promoters by SIMs in hand
 *   - Assign `SUPERVISOR_HELD` SIMs to a Promoter (bulk)
 *   - Collect from a Promoter (rejected, damaged staff, etc.)
 *   - Inspect timeline of any SIM
 *
 * Data source: reuses `useOrgStockControl(orgId)` — the same overview the
 * admin dashboard consumes. We filter client-side by
 * `item.assignedSupervisorId === currentStaffId`. Backend allows Supervisors
 * to read this endpoint (Asana "Supervisor puede ver SIMs de otros
 * Supervisores"); we narrow to own SIMs for operational focus.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Loader2, Package, Search, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { useAuth } from '@/context/AuthContext'
import { useOrgStockControl } from '../../Organization/StockControl/hooks/useOrgStockControl'
import { CustodyStateBadge } from '../../Organization/StockControl/components/CustodyStateBadge'
import { SimTimelineDrawer } from '../../Organization/StockControl/components/SimTimelineDrawer'
import { CollectSimDialog, type CollectFrom } from '../../Organization/StockControl/components/CollectSimDialog'
import { AssignToPromoterDialog } from '../../Organization/StockControl/components/AssignToPromoterDialog'
import { includesNormalized } from '@/lib/utils'
import { collectFromPromoter, type SimCustodyState } from '@/services/simCustody.service'
import type { OrgStockOverviewItem } from '@/services/stockDashboard.service'

interface Props {
  orgId: string
  // Venue currently being viewed. Sent as `x-venue-id` on org-scoped sim-custody
  // calls so the backend evaluates permissions against the user's role in THIS
  // venue, not the stale `authContext.venueId` from their last switchVenue.
  venueId: string
  /**
   * Optional user-controlled date window (driven by the page-level
   * DateRangePicker in StockControl). When omitted we fall back to the
   * legacy 30-day window frozen at mount time.
   */
  dateRange?: { from: Date; to: Date }
}

// A SIM is "stuck" when it's been with a promoter (pending or accepted, not
// sold) for more than N days. Helps surface inventory that isn't moving.
const STUCK_DAYS_THRESHOLD = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

type FilterKey = 'todos' | 'almacen' | 'pendientes' | 'aceptados' | 'rechazados' | 'vendidos' | 'estancados'

export function VenueSimCustodyPanel({ orgId, venueId, dateRange }: Props) {
  const { user } = useAuth()
  const currentStaffId = user?.id ?? null

  // Memoize ISO string params — using the date refs directly would re-emit on
  // every render of the parent, thrashing react-query. Comparing by ms keeps
  // the query stable as long as the caller passes the same range instance or
  // a structurally identical one.
  const fromMs = dateRange?.from.getTime()
  const toMs = dateRange?.to.getTime()
  const stockParams = useMemo(() => {
    if (fromMs != null && toMs != null) {
      return { dateFrom: new Date(fromMs).toISOString(), dateTo: new Date(toMs).toISOString() }
    }
    // Fallback to a 1-year window so SIMs registered earlier than 30 days but
    // still in Supervisor/Promoter custody remain visible. Matches the parent
    // page default — see custody data drift report 2026-05-04.
    const end = new Date()
    const start = new Date(end)
    start.setFullYear(start.getFullYear() - 1)
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
  }, [fromMs, toMs])
  const { data, isLoading, error } = useOrgStockControl(orgId, stockParams)

  // Narrow to SIMs owned by this supervisor.
  const mySims = useMemo<OrgStockOverviewItem[]>(() => {
    if (!data?.items || !currentStaffId) return []
    return data.items.filter(item => item.assignedSupervisorId === currentStaffId)
  }, [data?.items, currentStaffId])

  // ============================================================
  // Summary counters
  // ============================================================
  const summary = useMemo(() => {
    const acc = { total: 0, almacen: 0, pendientes: 0, aceptados: 0, rechazados: 0, vendidos: 0 }
    for (const s of mySims) {
      acc.total++
      const st = s.custodyState ?? 'ADMIN_HELD'
      if (s.status === 'SOLD') acc.vendidos++
      else if (st === 'SUPERVISOR_HELD') acc.almacen++
      else if (st === 'PROMOTER_PENDING') acc.pendientes++
      else if (st === 'PROMOTER_HELD') acc.aceptados++
      else if (st === 'PROMOTER_REJECTED') acc.rechazados++
    }
    return acc
  }, [mySims])

  // ============================================================
  // Alerts: rejected (need recollection) + stuck (>7 days)
  // ============================================================
  const alerts = useMemo(() => {
    const rejected = mySims.filter(s => s.custodyState === 'PROMOTER_REJECTED')
    const stuckCutoff = Date.now() - STUCK_DAYS_THRESHOLD * MS_PER_DAY
    const stuck = mySims.filter(s => {
      if (s.status === 'SOLD') return false
      if (s.custodyState !== 'PROMOTER_PENDING' && s.custodyState !== 'PROMOTER_HELD') return false
      // Use promoterAcceptedAt when held, assigned timestamp otherwise.
      const ts = s.promoterAcceptedAt ?? s.createdAt
      if (!ts) return false
      return new Date(ts).getTime() < stuckCutoff
    })
    return { rejected, stuck }
  }, [mySims])

  // ============================================================
  // Promoter ranking — every Promotor this Supervisor has touched in the
  // window. Customers reported the previous "top 5" cap hid teammates whenever
  // someone had >5 active Promotores or whenever a Promotor with only sold
  // SIMs sorted below the cutoff (see field report 2026-05-04). Show the full
  // list and let the operator scan; the parent card scrolls if needed.
  // ============================================================
  const promoterRanking = useMemo(() => {
    const byPromoter = new Map<string, { id: string; name: string; pending: number; held: number; sold: number }>()
    for (const s of mySims) {
      if (!s.assignedPromoterId || !s.assignedPromoterName) continue
      const key = s.assignedPromoterId
      const entry = byPromoter.get(key) ?? { id: key, name: s.assignedPromoterName, pending: 0, held: 0, sold: 0 }
      if (s.status === 'SOLD') entry.sold++
      else if (s.custodyState === 'PROMOTER_PENDING') entry.pending++
      else if (s.custodyState === 'PROMOTER_HELD') entry.held++
      byPromoter.set(key, entry)
    }
    return Array.from(byPromoter.values()).sort((a, b) => b.pending + b.held + b.sold - (a.pending + a.held + a.sold))
  }, [mySims])

  // ============================================================
  // UI state: filter + search + dialogs
  // ============================================================
  const [filter, setFilter] = useState<FilterKey>('todos')
  const [search, setSearch] = useState('')
  const [timelineSerial, setTimelineSerial] = useState<string | null>(null)
  const [collectState, setCollectState] = useState<{ serialNumber: string; from: CollectFrom; contextLabel?: string } | null>(null)
  const [assignSerials, setAssignSerials] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const stuckIds = useMemo(() => new Set(alerts.stuck.map(s => s.id)), [alerts.stuck])

  const filtered = useMemo(() => {
    const q = search.trim()
    return mySims.filter(s => {
      const st = s.custodyState ?? 'ADMIN_HELD'
      if (filter === 'almacen' && st !== 'SUPERVISOR_HELD') return false
      if (filter === 'pendientes' && st !== 'PROMOTER_PENDING') return false
      if (filter === 'aceptados' && st !== 'PROMOTER_HELD') return false
      if (filter === 'rechazados' && st !== 'PROMOTER_REJECTED') return false
      if (filter === 'vendidos' && s.status !== 'SOLD') return false
      if (filter === 'estancados' && !stuckIds.has(s.id)) return false
      if (q && !includesNormalized(s.serialNumber ?? '', q)) return false
      return true
    })
  }, [mySims, filter, search, stuckIds])

  const assignableSelection = useMemo(
    () =>
      Array.from(selected).filter(sn => {
        const found = mySims.find(s => s.serialNumber === sn)
        return found && (found.custodyState ?? 'ADMIN_HELD') === 'SUPERVISOR_HELD'
      }),
    [selected, mySims],
  )

  const toggleRow = (sn: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sn)) next.delete(sn)
      else next.add(sn)
      return next
    })

  const clearSelection = () => setSelected(new Set())

  // ============================================================
  // Render
  // ============================================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando custodia…
      </div>
    )
  }

  if (error) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-red-600">No pudimos cargar tus SIMs. Intenta recargar.</p>
      </GlassCard>
    )
  }

  const rangeLabel = dateRange
    ? `${dateRange.from.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} – ${dateRange.to.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Últimos 30 días'

  return (
    <div className="space-y-6">
      {/* Active range indicator — makes it obvious why certain SIMs aren't
          appearing (they're outside the window). */}
      <p className="text-xs text-muted-foreground">
        Mostrando SIMs asignados a ti en el rango: <span className="font-medium text-foreground">{rangeLabel}</span>
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryCard label="Total" value={summary.total} tint="slate" />
        <SummaryCard label="En almacén" value={summary.almacen} tint="blue" />
        <SummaryCard label="Pendientes" value={summary.pendientes} tint="amber" />
        <SummaryCard label="Aceptados" value={summary.aceptados} tint="emerald" />
        <SummaryCard label="Rechazados" value={summary.rechazados} tint="red" />
        <SummaryCard label="Vendidos" value={summary.vendidos} tint="violet" />
      </div>

      {/* Alerts */}
      {(alerts.rejected.length > 0 || alerts.stuck.length > 0) && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Alertas</h3>
          </div>
          <div className="space-y-2 text-sm">
            {alerts.rejected.length > 0 && (
              <div className="flex items-center justify-between rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-3 py-2">
                <span>
                  <span className="font-semibold">{alerts.rejected.length}</span>{' '}
                  {alerts.rejected.length === 1 ? 'SIM rechazado' : 'SIMs rechazados'} — requiere recolección
                </span>
                <Button size="sm" variant="outline" onClick={() => setFilter('rechazados')}>
                  Ver <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}
            {alerts.stuck.length > 0 && (
              <div className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2">
                <span>
                  <span className="font-semibold">{alerts.stuck.length}</span>{' '}
                  {alerts.stuck.length === 1 ? 'SIM estancado' : 'SIMs estancados'} (&gt;{STUCK_DAYS_THRESHOLD} días sin movimiento)
                </span>
                <Button size="sm" variant="outline" onClick={() => setFilter('estancados')}>
                  Revisar <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Promoter ranking + filters side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="p-4 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-foreground" />
            <h3 className="text-sm font-semibold">Mi equipo</h3>
            {promoterRanking.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{promoterRanking.length}</span>}
          </div>
          {promoterRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no has asignado SIMs a tus Promotores.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {promoterRanking.map((p, idx) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{idx + 1}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="flex items-center gap-1 text-xs">
                    {p.pending > 0 && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                        {p.pending} pend.
                      </Badge>
                    )}
                    {p.held > 0 && (
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        {p.held} en poder
                      </Badge>
                    )}
                    {p.sold > 0 && (
                      <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200">
                        {p.sold} ven.
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-foreground" />
            <h3 className="text-sm font-semibold">Mis SIMs</h3>
            <div className="ml-auto flex items-center gap-2">
              {selected.size > 0 && assignableSelection.length > 0 && (
                <Button size="sm" onClick={() => setAssignSerials(assignableSelection)}>
                  Asignar a Promotor ({assignableSelection.length})
                </Button>
              )}
              {selected.size > 0 && (
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Limpiar selección
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por últimos dígitos del ICCID…"
                className="pl-8 h-9"
              />
            </div>
            {(['todos', 'almacen', 'pendientes', 'aceptados', 'rechazados', 'vendidos'] as FilterKey[]).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  filter === key ? 'bg-foreground text-background' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                {filterLabel(key)}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
                <tr className="border-b border-border/50">
                  <th className="w-10 py-2 px-2"></th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">ICCID</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Estado</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Promotor</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Categoría</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {mySims.length === 0
                        ? 'Aún no tienes SIMs asignados. Pide al Admin que te asigne un lote.'
                        : 'Sin resultados con esos filtros.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => (
                    <SupervisorSimRow
                      key={item.id}
                      item={item}
                      checked={selected.has(item.serialNumber)}
                      onToggle={() => toggleRow(item.serialNumber)}
                      onTimeline={() => setTimelineSerial(item.serialNumber)}
                      onCollect={() =>
                        setCollectState({
                          serialNumber: item.serialNumber,
                          from: 'promoter',
                          contextLabel: item.assignedPromoterName ?? undefined,
                        })
                      }
                      onAssign={() => setAssignSerials([item.serialNumber])}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* Dialogs & drawers */}
      <SimTimelineDrawer
        open={Boolean(timelineSerial)}
        onOpenChange={o => !o && setTimelineSerial(null)}
        orgId={orgId}
        serialNumber={timelineSerial}
      />

      {collectState && (
        <CollectSimDialog
          open={Boolean(collectState)}
          onOpenChange={o => !o && setCollectState(null)}
          serialNumber={collectState.serialNumber}
          from={collectState.from}
          contextLabel={collectState.contextLabel}
          onConfirm={async reason => {
            await collectFromPromoter(orgId, { serialNumber: collectState.serialNumber, reason }, venueId)
          }}
        />
      )}

      {assignSerials && (
        <AssignToPromoterDialog
          open={Boolean(assignSerials)}
          onOpenChange={o => {
            if (!o) {
              setAssignSerials(null)
              clearSelection()
            }
          }}
          orgId={orgId}
          venueId={venueId}
          serialNumbers={assignSerials}
        />
      )}
    </div>
  )
}

// ============================================================
// Subcomponents
// ============================================================

function SummaryCard({
  label,
  value,
  tint,
}: {
  label: string
  value: number
  tint: 'slate' | 'blue' | 'amber' | 'emerald' | 'red' | 'violet'
}) {
  const tintMap: Record<typeof tint, string> = {
    slate: 'from-slate-500/20 to-slate-500/5 text-slate-700 dark:text-slate-200',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-700 dark:text-blue-300',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-300',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    red: 'from-red-500/20 to-red-500/5 text-red-700 dark:text-red-300',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-700 dark:text-violet-300',
  }
  return (
    <div className={`rounded-xl border border-input bg-linear-to-br ${tintMap[tint]} p-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function filterLabel(key: FilterKey): string {
  switch (key) {
    case 'todos':
      return 'Todos'
    case 'almacen':
      return 'En almacén'
    case 'pendientes':
      return 'Pendientes'
    case 'aceptados':
      return 'Aceptados'
    case 'rechazados':
      return 'Rechazados'
    case 'vendidos':
      return 'Vendidos'
    case 'estancados':
      return 'Estancados'
  }
}

interface RowProps {
  item: OrgStockOverviewItem
  checked: boolean
  onToggle: () => void
  onTimeline: () => void
  onCollect: () => void
  onAssign: () => void
}

function SupervisorSimRow({ item, checked, onToggle, onTimeline, onCollect, onAssign }: RowProps) {
  const custody = (item.custodyState ?? 'ADMIN_HELD') as SimCustodyState
  const isAssignable = custody === 'SUPERVISOR_HELD'
  const canCollect = custody === 'PROMOTER_PENDING' || custody === 'PROMOTER_HELD' || custody === 'PROMOTER_REJECTED'

  return (
    <tr
      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' } as React.CSSProperties}
    >
      <td className="py-2 px-2">
        {isAssignable && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="h-4 w-4 rounded border-input"
            aria-label={`Seleccionar ${item.serialNumber}`}
          />
        )}
      </td>
      <td className="py-2 px-2">
        <button type="button" onClick={onTimeline} className="text-left" title="Ver historial">
          <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded hover:bg-muted">{item.serialNumber}</code>
        </button>
      </td>
      <td className="py-2 px-2">
        <CustodyStateBadge state={custody} />
      </td>
      <td className="py-2 px-2 text-sm">
        <span className="block max-w-[180px] truncate">
          {item.assignedPromoterName ?? <span className="text-muted-foreground">—</span>}
          {item.promoterRejectedAt && <span className="ml-1 text-red-600 text-xs">(rechazado)</span>}
        </span>
        {item.assignedPromoterEmployeeCode && (
          <span className="block text-[10px] font-mono text-muted-foreground tracking-wide">{item.assignedPromoterEmployeeCode}</span>
        )}
      </td>
      <td className="py-2 px-2 text-sm">
        <span className="block max-w-[160px] truncate">{item.categoryName}</span>
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center justify-end gap-1">
          {isAssignable && (
            <Button size="sm" className="h-7 text-xs" onClick={onAssign}>
              Asignar
            </Button>
          )}
          {canCollect && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCollect}>
              Recolectar
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
