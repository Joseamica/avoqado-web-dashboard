/**
 * ReassignSupervisorDialog — admin bulk-move SIMs from one supervisor to another.
 *
 * Eligible SIMs: SUPERVISOR_HELD only — the backend enforces this and returns
 * NOT_IN_SUPERVISOR_STATE for anything else. A SIM a promotor already carries
 * keeps its old supervisor (collect it from the promotor first); that is a
 * deliberate product decision, so the dialog states it up front instead of
 * letting the operator discover it in the error list.
 *
 * Pattern mirrors ReassignPromoterDialog one level up the chain: three input
 * modes (search / manual / CSV) + a per-row BulkResult summary on submit.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { reassignSimsToSupervisor, type BulkResponse } from '@/services/simCustody.service'
import { useOrgStaffByRole } from '@/hooks/use-org-staff-by-role'
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

export function ReassignSupervisorDialog({ open, onOpenChange, orgId, venueId, preselectedSerials, onDone }: Props) {
  const queryClient = useQueryClient()

  const [toSupervisorStaffId, setToSupervisorStaffId] = useState('')
  const [mode, setMode] = useState<'search' | 'manual' | 'csv'>('search')
  const [manualSerials, setManualSerials] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [searchSerials, setSearchSerials] = useState<string[]>(preselectedSerials ?? [])
  const [result, setResult] = useState<BulkResponse | null>(null)
  const [onlyErrors, setOnlyErrors] = useState(false)

  // Same role the backend validates (active MANAGER of the org) — the dropdown can
  // never propose a target that comes back as SUPERVISOR_NOT_FOUND.
  const supervisors = useOrgStaffByRole(orgId, 'MANAGER')

  // Load org SIMs for the search combobox. Freeze the date window ONCE per dialog
  // mount to avoid an infinite refetch loop (same trick as AssignToSupervisorDialog).
  const stockParams = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 30)
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
  }, [])
  const { data: stockData } = useOrgStockControl(open ? orgId : undefined, stockParams)
  // Only SUPERVISOR_HELD SIMs can move — filter the picker to match the backend.
  const availableItems = useMemo(
    () => (stockData?.items ?? []).filter(i => (i.custodyState ?? 'ADMIN_HELD') === 'SUPERVISOR_HELD'),
    [stockData?.items],
  )

  const mutation = useMutation<BulkResponse, Error, void>({
    mutationFn: async () => {
      if (!toSupervisorStaffId) throw new Error('Selecciona un Supervisor destino')

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

      return reassignSimsToSupervisor(orgId, { toSupervisorStaffId, serialNumbers }, venueId)
    },
    onSuccess: r => {
      setResult(r)
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
      if (r.summary.failed === 0) onDone?.()
    },
    onError: err => toast({ title: err.message ?? 'No se pudo reasignar', variant: 'destructive' }),
  })

  const reset = () => {
    setToSupervisorStaffId('')
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
          <DialogTitle>Reasignar a otro Supervisor</DialogTitle>
          <DialogDescription>
            Mueve SIMs que un Supervisor todavía tiene en bodega hacia otro Supervisor. Los que un Promotor ya trae encima NO se mueven:
            recolectalos del Promotor primero. El historial de custodia queda registrado.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Supervisor destino</label>
              <SearchableSelect
                value={toSupervisorStaffId}
                onValueChange={setToSupervisorStaffId}
                options={(supervisors.data ?? []).map(s => ({
                  value: s.id,
                  label: s.employeeCode ? `${s.fullName} (${s.employeeCode})` : s.fullName,
                }))}
                placeholder={supervisors.isLoading ? 'Cargando…' : 'Selecciona un Supervisor'}
                searchPlaceholder="Buscar por nombre…"
                emptyMessage="Sin resultados"
                disabled={supervisors.isLoading}
                searchThreshold={0}
                className="w-full"
              />
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
                  allowedStates={['SUPERVISOR_HELD']}
                  value={searchSerials}
                  onChange={setSearchSerials}
                  placeholder={availableItems.length === 0 ? 'No hay SIMs en bodega de un Supervisor' : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Solo se muestran SIMs en estado <code>SUPERVISOR_HELD</code>.
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
                  Un ICCID por línea, coma o tab. Puedes pegar una columna de Excel directamente, o usar un escáner de códigos de barras.
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
                <div key={row.serialNumber} className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{row.serialNumber}</span>
                  {row.status === 'ok' ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      Reasignado
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
                {mutation.isPending ? 'Reasignando…' : 'Reasignar SIMs'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Reasignar más
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Listo</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
