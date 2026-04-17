/**
 * AssignSimsDialog — modal that assigns SIMs already in `ADMIN_HELD` to
 * either a Supervisor (normal chain of custody, plan §2.1) or directly to
 * a Promoter (bypass — restricted to OWNER/SUPERADMIN).
 *
 * The "directo a Promotor" path exists for exceptions/emergencies where a
 * Supervisor is not available (vacation, off-shift). It still writes a
 * `SerializedItemCustodyEvent` with `fromState=ADMIN_HELD` so the timeline
 * makes the bypass explicit.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import {
  assignSimsToPromoterDirect,
  assignSimsToSupervisor,
  type BulkResponse,
} from '@/services/simCustody.service'
import { useOrgStaffByRole, useOrgPromoters } from '@/hooks/use-org-staff-by-role'
import { getItemCategories } from '@/services/stockDashboard.service'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useAccess } from '@/hooks/use-access'
import { useAuth } from '@/context/AuthContext'
import { useOrgStockControl } from '../hooks/useOrgStockControl'
import { SimMultiSelect } from './SimMultiSelect'

type AssignTarget = 'supervisor' | 'promoter-direct'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}

export function AssignToSupervisorDialog({ open, onOpenChange, orgId }: Props) {
  const { venues } = useCurrentOrganization()
  const firstVenueId = venues[0]?.id
  const queryClient = useQueryClient()
  const { can } = useAccess()
  const { user, staffInfo } = useAuth()
  // `useAccess` query is gated on venueId and this dialog opens from
  // /organizations/:orgId routes where venueId is null → can() silently
  // returns false. Fall back to the global role (same pattern as the parent
  // OrgStockControlPage.tsx) so OWNER/SUPERADMIN see the bypass toggle.
  const currentUserRole = staffInfo?.role ?? user?.role
  const isSuperOrOwner = currentUserRole === 'SUPERADMIN' || currentUserRole === 'OWNER'
  const canAssignDirect = can('sim-custody:assign-to-promoter-direct') || isSuperOrOwner

  const [target, setTarget] = useState<AssignTarget>('supervisor')
  const [supervisorStaffId, setSupervisorStaffId] = useState('')
  const [promoterStaffId, setPromoterStaffId] = useState('')
  // Category is ONLY a filter inside the Buscar tab — not a required field.
  // Empty string = "Todas".
  const [searchCategoryFilter, setSearchCategoryFilter] = useState('')
  const [mode, setMode] = useState<'search' | 'manual' | 'csv'>('search')
  const [manualSerials, setManualSerials] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [searchSerials, setSearchSerials] = useState<string[]>([])
  const [result, setResult] = useState<BulkResponse | null>(null)
  const [onlyErrors, setOnlyErrors] = useState(false)

  // Load org SIMs for the search combobox. Freeze the date window ONCE per
  // dialog mount — `new Date()` on every render causes the query key to shift
  // each ms and triggers an infinite refetch loop against /stock-control/overview.
  // We also gate on `open` so the query only runs while the dialog is visible.
  const stockParams = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 30)
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
     
  }, [])
  const { data: stockData } = useOrgStockControl(open ? orgId : undefined, stockParams)
  const availableItems = useMemo(() => stockData?.items ?? [], [stockData?.items])

  const supervisors = useOrgStaffByRole(orgId, 'MANAGER')
  const promoters = useOrgPromoters(orgId)

  // Categories used as the optional Buscar filter only.
  const { data: categoriesData } = useQuery({
    queryKey: ['item-categories', firstVenueId],
    queryFn: () => getItemCategories(firstVenueId!, { includeStats: false }),
    enabled: Boolean(firstVenueId) && open,
  })
  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData])
  // Derive categories present in ADMIN_HELD stock so the filter only surfaces
  // options that actually have SIMs available — avoids a dropdown full of
  // never-used categories.
  const categoriesInStock = useMemo(() => {
    const ids = new Set<string>()
    for (const item of availableItems) {
      const state = item.custodyState ?? 'ADMIN_HELD'
      if (state === 'ADMIN_HELD') ids.add(item.categoryId)
    }
    return categories.filter(c => ids.has(c.id))
  }, [availableItems, categories])

  const mutation = useMutation<BulkResponse, Error, void>({
    mutationFn: async () => {
      if (target === 'supervisor' && !supervisorStaffId) throw new Error('Selecciona un Supervisor')
      if (target === 'promoter-direct' && !promoterStaffId) throw new Error('Selecciona un Promotor')

      let rows: { serialNumber: string }[] = []
      if (mode === 'search') {
        rows = searchSerials.map(serialNumber => ({ serialNumber }))
      } else if (mode === 'manual') {
        rows = manualSerials
          .split(/[\n,;\t]+/)
          .map(s => s.trim())
          .filter(Boolean)
          .map(serialNumber => ({ serialNumber }))
      } else if (csvFile) {
        const text = await csvFile.text()
        rows = text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          // CSV format simplified: one ICCID per line. Trailing columns are
          // ignored (category is inferred from each SIM's existing record).
          .map(line => ({ serialNumber: line.split(',')[0].trim() }))
          .filter(r => r.serialNumber.length > 0)
      }
      if (rows.length === 0) throw new Error('Agrega al menos un ICCID')

      if (target === 'promoter-direct') {
        return assignSimsToPromoterDirect(orgId, {
          promoterStaffId,
          serialNumbers: rows.map(r => r.serialNumber),
        })
      }
      return assignSimsToSupervisor(orgId, {
        supervisorStaffId,
        rows,
      })
    },
    onSuccess: r => {
      setResult(r)
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
    },
    onError: err => toast({ title: err.message ?? 'No se pudo asignar', variant: 'destructive' }),
  })

  const reset = () => {
    setTarget('supervisor')
    setSupervisorStaffId('')
    setPromoterStaffId('')
    setSearchCategoryFilter('')
    setManualSerials('')
    setCsvFile(null)
    setSearchSerials([])
    setResult(null)
    setOnlyErrors(false)
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const visibleRows = result ? (onlyErrors ? result.results.filter(r => r.status === 'error') : result.results) : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar SIMs</DialogTitle>
          <DialogDescription>
            Los SIMs deben estar previamente registrados en el sistema (Cargar Items).
            {target === 'supervisor'
              ? ' Se asignarán a un Supervisor para que a su vez los distribuya a Promotores.'
              : ' Se asignarán directamente al Promotor, saltando la cadena normal. Usa esta opción solo cuando no haya Supervisor disponible.'}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Target toggle: Supervisor (default chain) vs Promotor directo (bypass OWNER+) */}
            {canAssignDirect && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Asignar a</label>
                <div className="inline-flex rounded-full border border-input bg-muted/60 p-1">
                  <button
                    type="button"
                    onClick={() => setTarget('supervisor')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      target === 'supervisor'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Supervisor
                  </button>
                  <button
                    type="button"
                    onClick={() => setTarget('promoter-direct')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      target === 'promoter-direct'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Promotor (directo)
                  </button>
                </div>
                {target === 'promoter-direct' && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Bypass de cadena de custodia.</strong> El SIM se asignará directamente al Promotor sin pasar por un
                      Supervisor. Queda registrado en el historial con marca de excepción.
                    </div>
                  </div>
                )}
              </div>
            )}

            {target === 'supervisor' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Supervisor</label>
                <SearchableSelect
                  value={supervisorStaffId}
                  onValueChange={setSupervisorStaffId}
                  options={(supervisors.data ?? []).map(s => ({
                    value: s.id,
                    label: s.fullName,
                  }))}
                  placeholder={supervisors.isLoading ? 'Cargando…' : 'Selecciona un Supervisor'}
                  searchPlaceholder="Buscar por nombre…"
                  emptyMessage="Sin resultados"
                  disabled={supervisors.isLoading}
                  searchThreshold={0}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Promotor</label>
                <SearchableSelect
                  value={promoterStaffId}
                  onValueChange={setPromoterStaffId}
                  options={(promoters.data ?? []).map(s => ({
                    value: s.id,
                    label: s.fullName,
                  }))}
                  placeholder={promoters.isLoading ? 'Cargando…' : 'Selecciona un Promotor'}
                  searchPlaceholder="Buscar por nombre…"
                  emptyMessage="Sin resultados"
                  disabled={promoters.isLoading}
                  searchThreshold={0}
                  className="w-full"
                />
              </div>
            )}

            <Tabs value={mode} onValueChange={v => setMode(v as 'search' | 'manual' | 'csv')}>
              <TabsList className="rounded-full bg-muted/60 p-1">
                <TabsTrigger value="search" className="rounded-full">
                  Buscar
                </TabsTrigger>
                <TabsTrigger value="manual" className="rounded-full">
                  Manual
                </TabsTrigger>
                <TabsTrigger value="csv" className="rounded-full">
                  Archivo CSV
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="mt-3 space-y-3">
                {/* Optional narrow-down filter — "Todas" shows every ADMIN_HELD SIM */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Filtrar por categoría:</span>
                  <SearchableSelect
                    value={searchCategoryFilter}
                    onValueChange={setSearchCategoryFilter}
                    options={[
                      { value: '', label: 'Todas' },
                      ...categoriesInStock.map(c => ({ value: c.id, label: c.name })),
                    ]}
                    placeholder="Todas"
                    searchPlaceholder="Buscar categoría…"
                    emptyMessage="Sin categorías"
                    searchThreshold={5}
                    className="flex-1"
                  />
                </div>
                <SimMultiSelect
                  items={availableItems}
                  categoryId={searchCategoryFilter || undefined}
                  value={searchSerials}
                  onChange={setSearchSerials}
                />
                <p className="text-xs text-muted-foreground">
                  Solo se muestran SIMs en almacén (estado <code>ADMIN_HELD</code>). Cada SIM conserva su categoría original.
                </p>
              </TabsContent>

              <TabsContent value="manual" className="mt-3">
                <Textarea
                  placeholder="8952140063000001111&#10;8952140063000002222&#10;8952140063000003333"
                  rows={6}
                  value={manualSerials}
                  onChange={e => setManualSerials(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Un ICCID por línea, coma o tab. Compatible con escáner de códigos de barras. La categoría se toma del registro de cada
                  SIM.
                </p>
              </TabsContent>

              <TabsContent value="csv" className="mt-3">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-md border border-input bg-background p-2 text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Un ICCID por línea. Columnas adicionales se ignoran (la categoría viene del registro del SIM).
                </p>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
              <span>
                <strong>{result.summary.total}</strong> total
              </span>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {result.summary.succeeded} OK
              </Badge>
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                {result.summary.failed} errores
              </Badge>
              {result.summary.failed > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setOnlyErrors(v => !v)} className="ml-auto">
                  {onlyErrors ? 'Ver todos' : 'Solo errores'}
                </Button>
              )}
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {visibleRows.map(row => (
                <div
                  key={row.serialNumber}
                  className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{row.serialNumber}</span>
                  {row.status === 'ok' ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      Asignado
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                        {row.code}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{row.message}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? 'Asignando…' : 'Asignar SIMs'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Asignar más
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Listo</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
