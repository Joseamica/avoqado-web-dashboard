/**
 * OrgBulkUploadDialog — org-level "Cargar Items" flow.
 *
 * The existing `BulkUploadDialog` (Stock/components) was venue-scoped via
 * `useCurrentVenue`, which is null in /wl/organizations/:orgSlug. This variant
 * takes `orgId` directly, lets the user pick any venue in the org as the
 * registration-origin context (required by the backend for audit logging via
 * `registeredFromVenueId`), and calls the existing `orgBulkUploadItems`
 * endpoint so items land at org-level regardless of the selected venue.
 *
 * Plan §1.1 — this is the REGISTRATION step (creates ICCIDs). Assignment to
 * Supervisor is a separate action with its own dialog.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { getItemCategories } from '@/services/stockDashboard.service'
import { orgBulkUploadItems } from '@/services/orgItemCategory.service'
import { useCurrentOrganization } from '@/hooks/use-current-organization'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UploadResult {
  success: boolean
  created: number
  duplicates: string[]
  errors: string[]
  total: number
}

export function OrgBulkUploadDialog({ open, onOpenChange }: Props) {
  const { venues } = useCurrentOrganization()
  const queryClient = useQueryClient()

  const [originVenueId, setOriginVenueId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
  const [manualSerials, setManualSerials] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  // Default to first venue so the user can just hit upload in the common case.
  const effectiveVenueId = originVenueId || venues[0]?.id || ''

  // Categories are org-level; any venue in the org returns the same list
  // (the endpoint merges org + venue scopes).
  const { data: categoriesData } = useQuery({
    queryKey: ['item-categories', effectiveVenueId],
    queryFn: () => getItemCategories(effectiveVenueId, { includeStats: false }),
    enabled: Boolean(effectiveVenueId) && open,
  })
  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData])
  const orgCategories = useMemo(
    () => categories.filter(c => (c as { source?: string }).source === 'organization'),
    [categories],
  )

  const mutation = useMutation<UploadResult, Error, void>({
    mutationFn: async () => {
      if (!effectiveVenueId) throw new Error('Selecciona una sucursal de origen')
      if (!categoryId) throw new Error('Selecciona una categoría')

      const payload: { csvContent?: string; serialNumbers?: string[] } = {}
      if (mode === 'csv' && csvFile) {
        payload.csvContent = await csvFile.text()
      } else if (mode === 'manual' && manualSerials.trim()) {
        payload.serialNumbers = manualSerials
          .split(/[\n,;\t]+/)
          .map(s => s.trim())
          .filter(Boolean)
      } else {
        throw new Error('Agrega al menos un ICCID')
      }

      return orgBulkUploadItems(effectiveVenueId, categoryId, payload)
    },
    onSuccess: r => {
      setResult(r)
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
      queryClient.invalidateQueries({ queryKey: ['item-categories'] })
    },
    onError: err => toast({ title: err.message ?? 'No se pudo cargar', variant: 'destructive' }),
  })

  const reset = () => {
    setOriginVenueId('')
    setCategoryId('')
    setManualSerials('')
    setCsvFile(null)
    setResult(null)
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar Items (registro inicial)</DialogTitle>
          <DialogDescription>
            Registra ICCIDs nuevos en el sistema. Los items se crean a nivel organización y quedan listos para asignarse a un Supervisor
            en el paso siguiente.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal de origen</label>
                <Select value={effectiveVenueId} onValueChange={setOriginVenueId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Solo para auditoría (<code>registeredFromVenueId</code>). Los items se crean a nivel organización.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {(orgCategories.length > 0 ? orgCategories : categories).map(c => (
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
                  placeholder="8952140063000001111&#10;8952140063000002222"
                  rows={6}
                  value={manualSerials}
                  onChange={e => setManualSerials(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Un ICCID por línea, coma o tab. Compatible con escáner.
                </p>
              </TabsContent>
              <TabsContent value="csv" className="mt-3">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-md border border-input bg-background p-2 text-sm"
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
              <span>
                <strong>{result.total}</strong> total
              </span>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {result.created} creados
              </Badge>
              {result.duplicates.length > 0 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                  {result.duplicates.length} duplicados
                </Badge>
              )}
              {result.errors.length > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                  {result.errors.length} errores
                </Badge>
              )}
            </div>
            {result.duplicates.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Duplicados:</p>
                <div className="max-h-32 overflow-y-auto rounded border border-input p-2 text-xs font-mono">
                  {result.duplicates.join(', ')}
                </div>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Errores:</p>
                <div className="max-h-32 overflow-y-auto rounded border border-input p-2 text-xs">
                  {result.errors.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? 'Cargando…' : 'Cargar Items'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Cargar más
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Listo</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
