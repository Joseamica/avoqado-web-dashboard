import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Building2,
  Percent,
  Users,
  Pencil,
  Trash2,
  Layers,
  Loader2,
  ToggleLeft,
  Link2,
  Copy,
  X,
  PanelRightOpen,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import { getAllVenues } from '@/services/superadmin.service'
import {
  aggregatorAPI,
  type Aggregator,
  type VenueCommissionWithVenue,
  type CreateVenueCommissionInput,
} from '@/services/aggregator.service'
import RevenueShareReportSection from './components/RevenueShareReportSection'
import AggregatorDetailSheet from './components/AggregatorDetailSheet'

// ─── Types ────────────────────────────────────────────────────

interface AggregatorFormData {
  name: string
  ivaRate: string
  baseFees: {
    DEBIT: string
    CREDIT: string
    AMEX: string
    INTERNATIONAL: string
  }
}

interface CommissionFormData {
  venueId: string
  aggregatorId: string
  rate: string
  referredBy: 'EXTERNAL' | 'AGGREGATOR'
}

const DEFAULT_AGG_FORM: AggregatorFormData = {
  name: '',
  ivaRate: '16',
  baseFees: { DEBIT: '', CREDIT: '', AMEX: '', INTERNATIONAL: '' },
}

const DEFAULT_COMM_FORM: CommissionFormData = {
  venueId: '',
  aggregatorId: '',
  rate: '',
  referredBy: 'EXTERNAL',
}

// ─── Aggregator Dialog ────────────────────────────────────────

function AggregatorDialog({
  open,
  onOpenChange,
  aggregator,
  onSave,
  isSaving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  aggregator: Aggregator | null
  onSave: (data: AggregatorFormData) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<AggregatorFormData>(DEFAULT_AGG_FORM)

  useEffect(() => {
    if (open) {
      setForm(
        aggregator
          ? {
              name: aggregator.name,
              ivaRate:
                aggregator.ivaRate != null
                  ? String(parseFloat((parseFloat(aggregator.ivaRate) * 100).toFixed(6)))
                  : '16',
              // toPct evita el drift de punto flotante (p.ej. 0.035 * 100 = 3.5000000000000004)
              // usando un redondeo a 6 decimales antes de convertir a string.
              baseFees: (() => {
                const toPct = (d: number | null | undefined) =>
                  d == null ? '' : String(parseFloat((d * 100).toFixed(6)))
                return {
                  DEBIT: toPct(aggregator.baseFees.DEBIT),
                  CREDIT: toPct(aggregator.baseFees.CREDIT),
                  AMEX: toPct(aggregator.baseFees.AMEX),
                  INTERNATIONAL: toPct(aggregator.baseFees.INTERNATIONAL),
                }
              })(),
            }
          : DEFAULT_AGG_FORM,
      )
    }
  }, [open, aggregator])

  const setFee = (key: keyof AggregatorFormData['baseFees'], val: string) => {
    setForm(f => ({ ...f, baseFees: { ...f.baseFees, [key]: val } }))
  }

  const isValid = form.name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{aggregator ? 'Editar Agregador' : 'Nuevo Agregador'}</DialogTitle>
        </DialogHeader>

        {/* Banner explicativo — el agregador es solo CATÁLOGO. Las tarifas reales (% por
            tipo de tarjeta + reparto Avoqado/agregador) se configuran POR MERCHANT en el
            reporte de revenue-share o vía el wizard de AngelPay. */}
        <div className="rounded-lg border border-input bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>
            Esto solo registra al agregador en el catálogo (nombre + IVA del CFDI).
            Las <strong>tarifas reales por tipo de tarjeta</strong> y el <strong>reparto Avoqado / agregador</strong>{' '}
            se configuran <strong>por merchant</strong> en el "Reporte de revenue-share" (abajo en esta página)
            o en el paso 9 del wizard de AngelPay.
          </p>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              placeholder="ej. Nombre del agregador"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Tarifa de referencia (informativa, no afecta cálculos)</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL'] as const).map(key => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{key}</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={form.baseFees[key]}
                    onChange={e => setFee(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Solo memo. Las tarifas que realmente se cobran viven en <code>MerchantRevenueShare</code> por merchant.
              Porcentaje (ej. 3.5 = 3.5%).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Tasa IVA (%)</Label>
            <Input
              type="number"
              placeholder="16"
              step="0.01"
              value={form.ivaRate}
              onChange={e => setForm(f => ({ ...f, ivaRate: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">IVA aplicado sobre la comision (default 16%)</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(form)} disabled={!isValid || isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {aggregator ? 'Guardar Cambios' : 'Crear Agregador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Commission Dialog ────────────────────────────────────────

function CommissionDialog({
  open,
  onOpenChange,
  commission,
  aggregators,
  selectedAggregatorId,
  onSave,
  isSaving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  commission: VenueCommissionWithVenue | null
  aggregators: Aggregator[]
  selectedAggregatorId: string | null
  onSave: (data: CommissionFormData) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<CommissionFormData>({ ...DEFAULT_COMM_FORM })

  const { data: venues = [] } = useQuery({
    queryKey: ['superadmin-venues-list'],
    queryFn: () => getAllVenues(),
    enabled: open,
  })

  const venueOptions = venues.map(v => ({
    value: v.id,
    label: `${v.name} (${v.slug})`,
  }))

  useEffect(() => {
    if (open) {
      setForm(
        commission
          ? {
              venueId: commission.venueId,
              aggregatorId: commission.aggregatorId,
              rate: String(parseFloat(commission.rate) * 100),
              referredBy: commission.referredBy,
            }
          : { ...DEFAULT_COMM_FORM, aggregatorId: selectedAggregatorId || '' },
      )
    }
  }, [open, commission])

  const isValid = form.venueId.length > 0 && form.aggregatorId.length > 0 && form.rate.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{commission ? 'Editar Comision' : 'Nueva Comision por Venue'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Venue *</Label>
            <SearchableSelect
              options={venueOptions}
              value={form.venueId}
              onValueChange={v => setForm(f => ({ ...f, venueId: v }))}
              placeholder="Buscar venue..."
              searchPlaceholder="Buscar por nombre o slug..."
              emptyMessage="No se encontraron venues"
              disabled={!!commission}
              searchThreshold={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Agregador *</Label>
            <Select
              value={form.aggregatorId}
              onValueChange={v => setForm(f => ({ ...f, aggregatorId: v }))}
              disabled={!!commission}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar agregador" />
              </SelectTrigger>
              <SelectContent>
                {aggregators.map(agg => (
                  <SelectItem key={agg.id} value={agg.id}>
                    {agg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tasa de Comisión (%) *</Label>
            <Input
              type="number"
              placeholder="ej. 30"
              step="0.01"
              value={form.rate}
              onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Ingresa el valor como porcentaje (ej. 30 = 30%)</p>
          </div>
          <div className="space-y-2">
            <Label>Referido por *</Label>
            <Select
              value={form.referredBy}
              onValueChange={v => setForm(f => ({ ...f, referredBy: v as 'EXTERNAL' | 'AGGREGATOR' }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXTERNAL">Externo (70/30)</SelectItem>
                <SelectItem value="AGGREGATOR">Agregador (30/70)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(form)} disabled={!isValid || isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {commission ? 'Guardar Cambios' : 'Crear Comisión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function Aggregators() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedAggId, setSelectedAggId] = useState<string | null>(null)
  // Sheet de detalle del agregador — separate state from selectedAggId so
  // clicking the card body filters the commissions table (existing behavior)
  // while a dedicated "Ver detalle" button opens the sheet (new behavior).
  const [detailAggId, setDetailAggId] = useState<string | null>(null)

  // Aggregator dialog state
  const [aggDialogOpen, setAggDialogOpen] = useState(false)
  const [editingAgg, setEditingAgg] = useState<Aggregator | null>(null)

  // Commission dialog state
  const [commDialogOpen, setCommDialogOpen] = useState(false)
  const [editingComm, setEditingComm] = useState<VenueCommissionWithVenue | null>(null)

  // Aggregator delete state — AlertDialog para confirmar (regla UI: destructivo = AlertDialog).
  const [deletingAgg, setDeletingAgg] = useState<Aggregator | null>(null)

  // ─── Queries ──────────────────────────────────────────────

  const { data: aggregators = [], isLoading: loadingAgg } = useQuery({
    queryKey: ['aggregators'],
    queryFn: () => aggregatorAPI.getAll(),
  })

  const { data: commissions = [], isLoading: loadingComm } = useQuery({
    queryKey: ['venue-commissions', selectedAggId],
    queryFn: () => aggregatorAPI.getCommissions(selectedAggId ? { aggregatorId: selectedAggId } : undefined),
  })

  // ─── Aggregator Mutations ─────────────────────────────────

  const createAggMutation = useMutation({
    mutationFn: (data: AggregatorFormData) =>
      aggregatorAPI.create({
        name: data.name,
        baseFees: {
          DEBIT: data.baseFees.DEBIT ? parseFloat(data.baseFees.DEBIT) / 100 : 0,
          CREDIT: data.baseFees.CREDIT ? parseFloat(data.baseFees.CREDIT) / 100 : 0,
          AMEX: data.baseFees.AMEX ? parseFloat(data.baseFees.AMEX) / 100 : 0,
          INTERNATIONAL: data.baseFees.INTERNATIONAL ? parseFloat(data.baseFees.INTERNATIONAL) / 100 : 0,
        },
        ivaRate: data.ivaRate ? parseFloat(data.ivaRate) / 100 : 0.16,
      }),
    onSuccess: created => {
      queryClient.invalidateQueries({ queryKey: ['aggregators'] })
      toast({
        title: `Agregador "${created.name}" creado`,
        description:
          'Solo metadata por ahora. Para que afecte cálculos, asígnalo a un merchant (en el wizard de AngelPay paso 6) y configura el reparto en el reporte de abajo ↓',
      })
      setAggDialogOpen(false)
      // Scroll al reporte para que el operador vea de inmediato dónde asignar
      // el revenue-share — guía visual sutil sin redirect ni modal extra.
      setTimeout(() => {
        document
          .getElementById('revenue-share-report-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || 'Error al crear', variant: 'destructive' })
    },
  })

  const updateAggMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AggregatorFormData }) =>
      aggregatorAPI.update(id, {
        name: data.name,
        baseFees: {
          DEBIT: data.baseFees.DEBIT ? parseFloat(data.baseFees.DEBIT) / 100 : 0,
          CREDIT: data.baseFees.CREDIT ? parseFloat(data.baseFees.CREDIT) / 100 : 0,
          AMEX: data.baseFees.AMEX ? parseFloat(data.baseFees.AMEX) / 100 : 0,
          INTERNATIONAL: data.baseFees.INTERNATIONAL ? parseFloat(data.baseFees.INTERNATIONAL) / 100 : 0,
        },
        ivaRate: data.ivaRate ? parseFloat(data.ivaRate) / 100 : 0.16,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregators'] })
      toast({ title: 'Agregador actualizado' })
      setAggDialogOpen(false)
      setEditingAgg(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.error || 'Error al actualizar',
        variant: 'destructive',
      })
    },
  })

  const toggleAggMutation = useMutation({
    mutationFn: (id: string) => aggregatorAPI.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregators'] })
      toast({ title: 'Estado actualizado' })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || 'Error', variant: 'destructive' })
    },
  })

  const deleteAggMutation = useMutation({
    mutationFn: (id: string) => aggregatorAPI.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregators'] })
      toast({ title: 'Agregador eliminado' })
      setDeletingAgg(null)
    },
    onError: (error: any) => {
      // El backend manda mensaje claro si hay merchants o comisiones ligadas.
      toast({
        title: 'No se pudo eliminar',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Error',
        variant: 'destructive',
      })
    },
  })

  // ─── Token Mutations ─────────────────────────────────────

  const generateTokenMutation = useMutation({
    mutationFn: (id: string) => aggregatorAPI.generateToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregators'] })
      toast({ title: 'Link de reporte generado' })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || 'Error', variant: 'destructive' })
    },
  })

  const revokeTokenMutation = useMutation({
    mutationFn: (id: string) => aggregatorAPI.revokeToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregators'] })
      toast({ title: 'Link revocado' })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || 'Error', variant: 'destructive' })
    },
  })

  // ─── Commission Mutations ─────────────────────────────────

  const createCommMutation = useMutation({
    mutationFn: (data: CommissionFormData) => {
      const input: CreateVenueCommissionInput = {
        venueId: data.venueId,
        aggregatorId: data.aggregatorId,
        rate: parseFloat(data.rate) / 100,
        referredBy: data.referredBy,
      }
      return aggregatorAPI.createCommission(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-commissions'] })
      toast({ title: 'Comisión creada' })
      setCommDialogOpen(false)
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || 'Error al crear', variant: 'destructive' })
    },
  })

  const updateCommMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CommissionFormData }) =>
      aggregatorAPI.updateCommission(id, {
        rate: parseFloat(data.rate) / 100,
        referredBy: data.referredBy,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-commissions'] })
      toast({ title: 'Comisión actualizada' })
      setCommDialogOpen(false)
      setEditingComm(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.error || 'Error al actualizar',
        variant: 'destructive',
      })
    },
  })

  const deleteCommMutation = useMutation({
    mutationFn: (id: string) => aggregatorAPI.deleteCommission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-commissions'] })
      toast({ title: 'Comisión eliminada' })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || 'Error al eliminar', variant: 'destructive' })
    },
  })

  // ─── Handlers ─────────────────────────────────────────────

  const handleSaveAgg = (data: AggregatorFormData) => {
    if (editingAgg) {
      updateAggMutation.mutate({ id: editingAgg.id, data })
    } else {
      createAggMutation.mutate(data)
    }
  }

  const handleEditAgg = (agg: Aggregator) => {
    setEditingAgg(agg)
    setAggDialogOpen(true)
  }

  const handleNewAgg = () => {
    setEditingAgg(null)
    setAggDialogOpen(true)
  }

  const handleSaveComm = (data: CommissionFormData) => {
    if (editingComm) {
      updateCommMutation.mutate({ id: editingComm.id, data })
    } else {
      createCommMutation.mutate(data)
    }
  }

  const handleEditComm = (comm: VenueCommissionWithVenue) => {
    setEditingComm(comm)
    setCommDialogOpen(true)
  }

  const handleNewComm = () => {
    setEditingComm(null)
    setCommDialogOpen(true)
  }

  const isSavingAgg = createAggMutation.isPending || updateAggMutation.isPending
  const isSavingComm = createCommMutation.isPending || updateCommMutation.isPending

  const selectedAgg = aggregators.find(a => a.id === selectedAggId) ?? null

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Section 1: Aggregators ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agregadores</h1>
            <p className="text-sm text-muted-foreground">
              Un agregador es un intermediario de pago. Sus tarifas reales viven{' '}
              <strong className="text-foreground">por proveedor</strong> — un mismo agregador puede cobrar distinto
              para AngelPay y para Blumon. Cada tarjeta muestra esas tarifas; se editan en la sección de abajo.
            </p>
          </div>
          <Button onClick={handleNewAgg}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Agregador
          </Button>
        </div>

        {loadingAgg ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground text-sm">Cargando agregadores...</span>
          </div>
        ) : aggregators.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No hay agregadores registrados</p>
            <Button onClick={handleNewAgg} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Crear el primero
            </Button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {aggregators.map(agg => {
              const isSelected = agg.id === selectedAggId
              return (
                <GlassCard
                  key={agg.id}
                  className={`p-5 cursor-pointer transition-all border-2 ${
                    isSelected ? 'border-primary' : 'border-transparent hover:border-primary/30'
                  }`}
                  onClick={() => setSelectedAggId(isSelected ? null : agg.id)}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Layers className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{agg.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={agg.active ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                            {agg.active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Las tasas reales viven por merchant en MerchantRevenueShare;
                      el desglose se ve en el "Reporte de revenue-share" debajo. */}

                  {/* IVA rate */}
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">IVA:</span>
                    <span className="font-mono font-medium">
                      {agg.ivaRate != null ? (parseFloat(agg.ivaRate) * 100).toFixed(0) : 16}%
                    </span>
                  </div>

                  {/* Report link */}
                  <div className="mb-3">
                    {agg.reportToken ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 truncate rounded bg-muted/50 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                          {window.location.origin}/reports/settlement/{agg.reportToken.slice(0, 8)}...
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          title="Copiar link"
                          onClick={e => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(`${window.location.origin}/reports/settlement/${agg.reportToken}`)
                            toast({ title: 'Link copiado' })
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                          title="Revocar link"
                          onClick={e => {
                            e.stopPropagation()
                            revokeTokenMutation.mutate(agg.id)
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] gap-1"
                        onClick={e => {
                          e.stopPropagation()
                          generateTokenMutation.mutate(agg.id)
                        }}
                      >
                        <Link2 className="w-3 h-3" />
                        Generar Link Reporte
                      </Button>
                    )}
                  </div>

                  {/* Counts + actions */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {agg._count?.merchants ?? 0} comercios
                      </span>
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {agg._count?.venueCommissions ?? 0} comisiones
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={e => {
                          e.stopPropagation()
                          toggleAggMutation.mutate(agg.id)
                        }}
                        title={agg.active ? 'Desactivar' : 'Activar'}
                      >
                        <ToggleLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 cursor-pointer"
                        onClick={e => {
                          e.stopPropagation()
                          setDetailAggId(agg.id)
                        }}
                        title="Ver detalle (merchants asignados, reparto)"
                      >
                        <PanelRightOpen className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 cursor-pointer"
                        onClick={e => {
                          e.stopPropagation()
                          handleEditAgg(agg)
                        }}
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 cursor-pointer text-destructive hover:text-destructive"
                        onClick={e => {
                          e.stopPropagation()
                          setDeletingAgg(agg)
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Revenue-share report (modelo nuevo) ── */}
      {/* id used by post-create-aggregator toast to scrollIntoView, guiding the
          operator to the next step. */}
      <div id="revenue-share-report-section">
        <RevenueShareReportSection />
      </div>

      {/* ── Section 3: Venue Commissions (LEGACY, RETIRADO DE LA UI) ──
          La sección original mostraba `VenueCommission` rows — un modelo viejo
          de comisión de REFERIDO que conviven en la DB con `MerchantRevenueShare`
          pero modelan cosas distintas. El settlement job que las consumiría está
          deshabilitado en producción (server.ts línea ~350). Decisión de Jose:
          retirar la UI por ahora, dejar las rows en DB como histórico, y migrar
          eventualmente a `MerchantRevenueShare` (ver
          `docs/guides/VENUE_COMMISSION_MIGRATION.md`).

          El código backend (controller/service/routes/job) sigue intacto por si
          alguna vez se reactiva. */}
      <div className="space-y-4 hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Comisiones por Venue
              {selectedAgg && (
                <span className="ml-2 text-base font-normal text-muted-foreground">— {selectedAgg.name}</span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              Comisión de <strong className="text-foreground">referido</strong> por venue — cuánto cobra el agregador
              por cada venue que refirió. No son tasas de tarjeta.{' '}
              {selectedAgg ? `Filtrado: ${selectedAgg.name}.` : 'Haz clic en un agregador para filtrar.'}
            </p>
          </div>
          <Button onClick={handleNewComm}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Comisión
          </Button>
        </div>

        {loadingComm ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground text-sm">Cargando comisiones...</span>
          </div>
        ) : commissions.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No hay comisiones registradas</p>
            <Button onClick={handleNewComm} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Crear comisión
            </Button>
          </GlassCard>
        ) : (
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Venue</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agregador</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tasa</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Referido por</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {commissions.map(comm => (
                    <tr key={comm.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{comm.venue.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{comm.venue.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {comm.aggregator?.name ?? aggregators.find(a => a.id === comm.aggregatorId)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-foreground">
                          {(parseFloat(comm.rate) * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {comm.referredBy === 'EXTERNAL' ? (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs">
                            Externo 70/30
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0 text-xs">
                            Agregador 30/70
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={comm.active ? 'default' : 'secondary'} className="text-xs">
                          {comm.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditComm(comm)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteCommMutation.mutate(comm.id)}
                            disabled={deleteCommMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>

      {/* ── Dialogs ── */}
      <AggregatorDialog
        open={aggDialogOpen}
        onOpenChange={v => {
          setAggDialogOpen(v)
          if (!v) setEditingAgg(null)
        }}
        aggregator={editingAgg}
        onSave={handleSaveAgg}
        isSaving={isSavingAgg}
      />

      <CommissionDialog
        open={commDialogOpen}
        onOpenChange={v => {
          setCommDialogOpen(v)
          if (!v) setEditingComm(null)
        }}
        commission={editingComm}
        aggregators={aggregators}
        selectedAggregatorId={selectedAggId}
        onSave={handleSaveComm}
        isSaving={isSavingComm}
      />

      {/* Confirmación de eliminación (regla UI: destructivo = AlertDialog). */}
      <AlertDialog open={!!deletingAgg} onOpenChange={open => !open && setDeletingAgg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar agregador "{deletingAgg?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es <strong>permanente</strong>. Solo se puede eliminar si el agregador no tiene
              comercios ni comisiones ligadas — si los tiene, mejor desactívalo (toggle).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAggMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAgg && deleteAggMutation.mutate(deletingAgg.id)}
              disabled={deleteAggMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAggMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aggregator detail sheet — opens from the per-card "Ver detalle" button.
          Shows assigned merchants with per-merchant revenue-share status and a
          button to open the existing edit dialog. The `key` forces a clean
          remount per aggregator so internal queries are scoped correctly. */}
      <AggregatorDetailSheet
        key={detailAggId ?? 'closed'}
        open={!!detailAggId}
        onOpenChange={o => !o && setDetailAggId(null)}
        aggregatorId={detailAggId}
        onEditAggregator={agg => {
          setDetailAggId(null)
          handleEditAgg(agg)
        }}
      />
    </div>
  )
}
