/**
 * ChangeCategoryDialog — admin bulk-move SIMs to a different ItemCategory.
 *
 * Eligible SIMs: any non-SOLD state — the backend enforces this and returns
 * SIM_SOLD for already-sold items.
 *
 * Category options come from the venue-scoped `/stock/item-categories` endpoint
 * (same source used by AssignToSupervisorDialog and OrgBulkUploadDialog),
 * filtered to `source === 'organization'` so only org-level categories appear
 * (venue-local categories are not valid targets for org-wide SIM management).
 *
 * Pattern mirrors ReassignPromoterDialog / AssignToSupervisorDialog: three
 * input modes (search / manual / CSV) + a per-row BulkResult summary on submit.
 *
 * Plan §T10 — Phase 2, avoqado-web-dashboard.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { changeSimsCategory, type BulkResponse } from '@/services/simCustody.service'
import { getItemCategories } from '@/services/stockDashboard.service'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useOrgStockControl } from '../hooks/useOrgStockControl'
import { SimMultiSelect } from './SimMultiSelect'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  venueId?: string
  preselectedSerials?: string[]
  onDone?: () => void
}

export function ChangeCategoryDialog({ open, onOpenChange, orgId, venueId, preselectedSerials, onDone }: Props) {
  const queryClient = useQueryClient()
  const { venues } = useCurrentOrganization()
  // Any venue in the org returns the same org-level category list; first is fine.
  const firstVenueId = venues[0]?.id

  const [categoryId, setCategoryId] = useState('')
  const [mode, setMode] = useState<'search' | 'manual' | 'csv'>('search')
  const [manualSerials, setManualSerials] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [searchSerials, setSearchSerials] = useState<string[]>(preselectedSerials ?? [])
  const [result, setResult] = useState<BulkResponse | null>(null)
  const [onlyErrors, setOnlyErrors] = useState(false)

  // Org-level ItemCategories — same query key + fn used by AssignToSupervisorDialog
  // and OrgBulkUploadDialog. Filter to source==='organization' to surface only
  // categories valid for org-wide operations (venue-local ones would be rejected
  // by the backend with CATEGORY_NOT_FOUND).
  const { data: categoriesData } = useQuery({
    queryKey: ['item-categories', firstVenueId],
    queryFn: () => getItemCategories(firstVenueId!, { includeStats: false }),
    enabled: Boolean(firstVenueId) && open,
  })
  const orgCategories = useMemo(
    () => (categoriesData?.categories ?? []).filter(c => (c as { source?: string }).source === 'organization'),
    [categoriesData],
  )

  // Load org SIMs for the search combobox. Freeze the date window ONCE per
  // dialog mount to avoid infinite refetch loop.
  const stockParams = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 30)
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() }

  }, [])
  const { data: stockData } = useOrgStockControl(open ? orgId : undefined, stockParams)
  // Only show non-sold items in the search combobox (SOLD SIMs can't be moved).
  const availableItems = useMemo(
    () => (stockData?.items ?? []).filter(i => i.status !== 'SOLD'),
    [stockData?.items],
  )

  const mutation = useMutation<BulkResponse, Error, void>({
    mutationFn: async () => {
      if (!categoryId) throw new Error('Selecciona una categoría destino')

      let serialNumbers: string[] = []
      if (mode === 'search') {
        serialNumbers = searchSerials
      } else if (mode === 'manual') {
        serialNumbers = manualSerials
          .split(/[\n,;\t]+/)
          .map(s => s.trim())
          .filter(Boolean)
      } else if (csvFile) {
        const text = await csvFile.text()
        serialNumbers = text
          .split(/\r?\n/)
          .map(line => line.split(',')[0].trim())
          .filter(Boolean)
      }
      if (serialNumbers.length === 0) throw new Error('Agrega al menos un ICCID')

      return changeSimsCategory(orgId, { categoryId, serialNumbers }, venueId)
    },
    onSuccess: r => {
      setResult(r)
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
      if (r.summary.failed === 0) onDone?.()
    },
    onError: err => toast({ title: err.message ?? 'No se pudo cambiar la categoría', variant: 'destructive' }),
  })

  const reset = () => {
    setCategoryId('')
    setMode('search')
    setManualSerials('')
    setCsvFile(null)
    setSearchSerials(preselectedSerials ?? [])
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
          <DialogTitle>Cambiar Categoría</DialogTitle>
          <DialogDescription>
            Mueve SIMs a una categoría diferente. Los SIMs ya vendidos no pueden moverse. El historial de cambios queda registrado en el
            ActivityLog.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría destino</label>
              <SearchableSelect
                value={categoryId}
                onValueChange={setCategoryId}
                options={orgCategories.map(c => ({ value: c.id, label: c.name }))}
                placeholder={
                  orgCategories.length === 0
                    ? 'No hay categorías org-level disponibles'
                    : 'Selecciona una categoría'
                }
                searchPlaceholder="Buscar categoría…"
                emptyMessage="Sin resultados"
                disabled={orgCategories.length === 0}
                searchThreshold={0}
                className="w-full"
              />
              {orgCategories.length === 0 && firstVenueId && (
                <p className="text-xs text-amber-600">
                  Configura categorías org-level en "Configurar Categorías" → "Org-level".
                </p>
              )}
            </div>

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

              <TabsContent value="search" className="mt-3 space-y-2">
                <SimMultiSelect
                  items={availableItems}
                  allowedStates={['ADMIN_HELD', 'SUPERVISOR_HELD', 'PROMOTER_PENDING', 'PROMOTER_HELD', 'PROMOTER_REJECTED']}
                  value={searchSerials}
                  onChange={setSearchSerials}
                  placeholder={availableItems.length === 0 ? 'No hay SIMs disponibles' : undefined}
                />
                <p className="text-xs text-muted-foreground">Solo se muestran SIMs no vendidos.</p>
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
                  Un ICCID por línea, coma o tab. Compatible con escáner de códigos de barras.
                </p>
              </TabsContent>

              <TabsContent value="csv" className="mt-3">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-md border border-input bg-background p-2 text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">Un ICCID por línea. Columnas adicionales se ignoran.</p>
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
                      Actualizado
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
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || orgCategories.length === 0}>
                {mutation.isPending ? 'Cambiando…' : 'Cambiar Categoría'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Cambiar más
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Listo</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
