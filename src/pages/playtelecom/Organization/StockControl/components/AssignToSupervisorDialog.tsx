/**
 * AssignToSupervisorDialog — ADMIN-only modal that assigns SIMs already in
 * `ADMIN_HELD` to a Supervisor (plan §2.1).
 *
 * Separated from `BulkUploadDialog` to keep both flows clean:
 *   - Cargar Items  → BulkUploadDialog (registration, existing code)
 *   - Asignar SIMs  → this file (custody, net-new)
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { assignSimsToSupervisor, type BulkResponse } from '@/services/simCustody.service'
import { useOrgStaffByRole } from '@/hooks/use-org-staff-by-role'
import { getItemCategories } from '@/services/stockDashboard.service'
import { useCurrentOrganization } from '@/hooks/use-current-organization'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}

export function AssignToSupervisorDialog({ open, onOpenChange, orgId }: Props) {
  const { venues } = useCurrentOrganization()
  const firstVenueId = venues[0]?.id
  const queryClient = useQueryClient()

  const [supervisorStaffId, setSupervisorStaffId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
  const [manualSerials, setManualSerials] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [result, setResult] = useState<BulkResponse | null>(null)
  const [onlyErrors, setOnlyErrors] = useState(false)

  const supervisors = useOrgStaffByRole(orgId, 'MANAGER')

  const { data: categoriesData } = useQuery({
    queryKey: ['item-categories', firstVenueId],
    queryFn: () => getItemCategories(firstVenueId!, { includeStats: false }),
    enabled: Boolean(firstVenueId) && open,
  })
  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData])

  const mutation = useMutation<BulkResponse, Error, void>({
    mutationFn: async () => {
      if (!supervisorStaffId) throw new Error('Selecciona un Supervisor')
      if (!categoryId) throw new Error('Selecciona una categoría')

      let rows: { serialNumber: string; categoryId?: string | null }[] = []
      if (mode === 'manual') {
        rows = manualSerials
          .split(/[\n,;\t]+/)
          .map(s => s.trim())
          .filter(Boolean)
          .map(serialNumber => ({ serialNumber, categoryId }))
      } else if (csvFile) {
        const text = await csvFile.text()
        rows = text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [serialNumber, catName] = line.split(',').map(s => s.trim())
            const matchedCategory = catName ? categories.find(c => c.name.toLowerCase() === catName.toLowerCase()) : null
            return { serialNumber, categoryId: matchedCategory?.id ?? categoryId }
          })
      }
      if (rows.length === 0) throw new Error('Agrega al menos un ICCID')

      return assignSimsToSupervisor(orgId, {
        supervisorStaffId,
        fallbackCategoryId: categoryId,
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
    setSupervisorStaffId('')
    setCategoryId('')
    setManualSerials('')
    setCsvFile(null)
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
          <DialogTitle>Asignar SIMs a Supervisor</DialogTitle>
          <DialogDescription>
            Los SIMs deben estar previamente registrados en el sistema (Cargar Items). Aquí los asignas a un Supervisor para que a su vez los
            distribuya a Promotores.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Supervisor</label>
                <Select value={supervisorStaffId} onValueChange={setSupervisorStaffId}>
                  <SelectTrigger>
                    <SelectValue placeholder={supervisors.isLoading ? 'Cargando…' : 'Selecciona un Supervisor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.data?.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs value={mode} onValueChange={v => setMode(v as 'manual' | 'csv')}>
              <TabsList className="rounded-full bg-muted/60 p-1">
                <TabsTrigger value="manual" className="rounded-full">
                  Manual
                </TabsTrigger>
                <TabsTrigger value="csv" className="rounded-full">
                  Archivo CSV
                </TabsTrigger>
              </TabsList>
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
                <p className="mt-2 text-xs text-muted-foreground">
                  Formato aceptado: <code>serialNumber</code> o <code>serialNumber,categoryName</code>. Si la categoría no coincide con la
                  del SIM, la fila fallará con <code>CATEGORY_MISMATCH</code>.
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
