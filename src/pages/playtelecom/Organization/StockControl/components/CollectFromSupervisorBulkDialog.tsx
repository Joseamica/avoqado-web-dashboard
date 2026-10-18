/**
 * CollectFromSupervisorBulkDialog — admin bulk-collects SIMs from their
 * supervisors back to the admin warehouse (Asana 1219467533602693).
 *
 * Eligible SIMs: SUPERVISOR_HELD only — the backend enforces it and returns
 * HAS_DOWNSTREAM_CUSTODY for a SIM a promotor carries (Isaac, "opción A":
 * collect it from the promotor first). The dialog states it up front instead
 * of letting the operator discover it in the error list.
 *
 * Same shape as ReassignSupervisorDialog: three input modes (search / manual /
 * CSV), one reason for the whole batch, and a per-row BulkResult summary.
 */
import { useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { toast } from '@/hooks/use-toast'
import { collectSimsFromSupervisor, type BulkResponse, type SimCustodyCollectionReason } from '@/services/simCustody.service'
import { useOrgStockItemsSearch } from '../hooks/useOrgStockItemsSearch'
import { SimMultiSelect } from './SimMultiSelect'
import { parseSerialList } from './parseSerialList'
import { useDebounce } from '@/hooks/useDebounce'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  venueId?: string
}

const REASON_OPTIONS: { value: SimCustodyCollectionReason; label: string }[] = [
  { value: 'SUPERVISOR_COLLECTION', label: 'Recolección de Supervisor' },
  { value: 'STAFF_TERMINATED', label: 'Baja de promotor' },
  { value: 'DAMAGED_SIM', label: 'SIM defectuoso' },
]

export function CollectFromSupervisorBulkDialog({ open, onOpenChange, orgId, venueId }: Props) {
  const queryClient = useQueryClient()

  const [reason, setReason] = useState<SimCustodyCollectionReason>('SUPERVISOR_COLLECTION')
  const [mode, setMode] = useState<'search' | 'manual' | 'csv'>('manual')
  const [manualSerials, setManualSerials] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [searchSerials, setSearchSerials] = useState<string[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const debouncedItemSearch = useDebounce(itemSearch, 300)
  const [result, setResult] = useState<BulkResponse | null>(null)
  const [onlyErrors, setOnlyErrors] = useState(false)
  // One idempotency key per (list, reason): a manual retry after a lost response replays the
  // first run on the server instead of collecting again whatever moved in between.
  const attemptRef = useRef<{ signature: string; key: string } | null>(null)

  // No date window: it filters by REGISTRATION date, and a SIM registered months ago can
  // still be sitting with a supervisor today. Search + custody state bound the query.
  const stockQuery = useOrgStockItemsSearch(
    open && mode === 'search' ? orgId : undefined,
    { search: debouncedItemSearch || undefined, custodyState: 'SUPERVISOR_HELD' },
    open && mode === 'search',
  )
  const availableItems = useMemo(
    () => (stockQuery.data?.items ?? []).filter(i => (i.custodyState ?? 'ADMIN_HELD') === 'SUPERVISOR_HELD'),
    [stockQuery.data?.items],
  )

  const mutation = useMutation<BulkResponse, Error, void>({
    mutationFn: async () => {
      let serialNumbers: string[] = []
      if (mode === 'search') {
        serialNumbers = searchSerials
      } else if (mode === 'manual') {
        serialNumbers = parseSerialList(manualSerials)
      } else if (csvFile) {
        const text = await csvFile.text()
        serialNumbers = parseSerialList(
          text
            .split(/\r?\n/)
            .map(line => line.split(',')[0])
            .join('\n'),
        )
      }
      if (serialNumbers.length === 0) throw new Error('Agrega al menos un ICCID')
      if (serialNumbers.length > 500) throw new Error(`Son ${serialNumbers.length} ICCIDs: el máximo por vez es 500. Divide la lista.`)

      const signature = JSON.stringify({ serialNumbers, reason })
      if (attemptRef.current?.signature !== signature) attemptRef.current = { signature, key: uuidv4() }
      return collectSimsFromSupervisor(orgId, { serialNumbers, reason }, venueId, attemptRef.current.key)
    },
    onSuccess: r => {
      attemptRef.current = null
      setResult(r)
      // Collecting changes custody: refresh every key that reads it, paginated ones
      // included, or the SIM keeps showing its supervisor (see CollectSimDialog).
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
      queryClient.invalidateQueries({ queryKey: ['org-stock-custody'] })
      queryClient.invalidateQueries({ queryKey: ['org-stock-summary'] })
      queryClient.invalidateQueries({ queryKey: ['org-stock-items'] })
      queryClient.invalidateQueries({ queryKey: ['org-stock-items-search'] })
      queryClient.invalidateQueries({ queryKey: ['org-inventory-by-responsible'] })
      queryClient.invalidateQueries({ queryKey: ['sim-custody-events'] })
      // The store-level stock page (movements, responsibles) also shows who holds each SIM.
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
    onError: err => {
      const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data?.message
      toast({ title: serverMessage ?? err.message ?? 'No se pudieron recolectar los SIMs', variant: 'destructive' })
    },
  })

  const reset = () => {
    attemptRef.current = null
    setReason('SUPERVISOR_COLLECTION')
    setMode('manual')
    setManualSerials('')
    setCsvFile(null)
    setSearchSerials([])
    setItemSearch('')
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
          <DialogTitle>Recolectar del Supervisor</DialogTitle>
          <DialogDescription>
            Regresa al almacén del administrador los SIMs que un Supervisor todavía tiene en bodega. Los que un Promotor ya trae encima NO
            se recolectan: recoléctalos del Promotor primero. El historial de custodia queda registrado.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo de recolección</label>
              <SearchableSelect
                value={reason}
                onValueChange={v => setReason(v as SimCustodyCollectionReason)}
                options={REASON_OPTIONS}
                placeholder="Selecciona un motivo"
                searchPlaceholder="Buscar motivo…"
                className="w-full"
              />
            </div>

            <Tabs value={mode} onValueChange={v => setMode(v as 'search' | 'manual' | 'csv')}>
              <TabsList className="rounded-full bg-muted/60 p-1">
                <TabsTrigger value="manual" className="rounded-full">
                  Manual
                </TabsTrigger>
                <TabsTrigger value="csv" className="rounded-full">
                  Archivo CSV
                </TabsTrigger>
                <TabsTrigger value="search" className="rounded-full">
                  Buscar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="mt-3">
                <Textarea
                  data-tour="sim-collect-bulk-serials"
                  placeholder="8952140063000001111&#10;8952140063000002222&#10;8952140063000003333"
                  rows={6}
                  value={manualSerials}
                  onChange={e => setManualSerials(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Un ICCID por línea, coma o tab. Puedes pegar una columna de Excel directamente, o usar un escáner de códigos de barras.
                  Máximo 500 por vez.
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

              <TabsContent value="search" className="mt-3 space-y-2">
                <SimMultiSelect
                  items={availableItems}
                  allowedStates={['SUPERVISOR_HELD']}
                  value={searchSerials}
                  onChange={setSearchSerials}
                  searchValue={itemSearch}
                  onSearchChange={setItemSearch}
                  isLoading={stockQuery.isFetching}
                  placeholder={availableItems.length === 0 ? 'No hay SIMs en bodega de un Supervisor' : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Solo se muestran SIMs en estado <code>SUPERVISOR_HELD</code>.
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
                <div key={row.serialNumber} className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{row.serialNumber}</span>
                  {row.status === 'ok' ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      Recolectado
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
              <Button data-tour="sim-collect-bulk-submit" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? 'Recolectando…' : 'Recolectar SIMs'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Recolectar más
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Listo</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
