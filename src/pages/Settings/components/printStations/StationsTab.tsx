import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Printer as PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useTerminology } from '@/hooks/use-terminology'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { StaffRole } from '@/types'
import {
  createPrintStation,
  deletePrintStation,
  getPrinters,
  getPrintStationsConfig,
  updatePrintStation,
  type PrintStation,
} from '@/services/printStations.service'
import { KitchenDisplayToggle } from './KitchenDisplayToggle'
import { StationCard } from './StationCard'

const NONE = '__none__'
const FORM_ID = 'print-station-form'

const apiError = (e: any, fallback: string): string => e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

export function StationsTab({ venueId }: { venueId: string }) {
  const { t } = useTranslation('printStations')
  const { term } = useTerminology()
  const { hasAccess: tieneAccesoPro } = useTierFeatureAccess('KITCHEN_DISPLAY')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const [toDelete, setToDelete] = useState<PrintStation | null>(null)

  // Estaciones + puerta de lanzamiento de la pantalla (servidor, fase 3.1). Toda mutación invalida el prefijo
  // ['printStations', venueId], que también refresca esta clave.
  const { data: config, isLoading } = useQuery({
    queryKey: ['printStations', venueId, 'config'],
    queryFn: () => getPrintStationsConfig(venueId),
    enabled: !!venueId,
  })
  const stations = config?.stations
  const abiertaAClientes = config?.kitchenDisplayOpenToClients ?? false
  // La estación que se edita se lee VIVA de la lista: si su pantalla cambia desde el formulario, el formulario lo ve.
  const editing = editingId ? (stations?.find(s => s.id === editingId) ?? null) : null

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }
  const openEdit = (station: PrintStation) => {
    setEditingId(station.id)
    setFormOpen(true)
  }
  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('stations.intro', { kitchen: term('kitchen') })}</p>

      <div className="flex justify-end">
        <Button onClick={openCreate} data-tour="print-station-add">
          <Plus className="mr-2 h-4 w-4" /> {t('stations.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      ) : (stations?.length ?? 0) === 0 ? (
        <Card className="border-input">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t('stations.empty')}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {stations!.map(station => (
            <StationCard
              key={station.id}
              venueId={venueId}
              station={station}
              abiertaAClientes={abiertaAClientes}
              tieneAccesoPro={tieneAccesoPro}
              onEdit={() => openEdit(station)}
              onDelete={() => setToDelete(station)}
            />
          ))}
        </div>
      )}

      {isFormOpen && (editingId === null || editing) && (
        <StationFormModal venueId={venueId} station={editing} abiertaAClientes={abiertaAClientes} onClose={closeForm} />
      )}

      <DeleteStationDialog venueId={venueId} station={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}

// ── Form modal ────────────────────────────────────────────────────────────────

const stationSchema = z.object({
  name: z.string().trim().min(1),
  printerId: z.string().nullable(),
  copies: z.number().int().min(1).optional(),
  isDefault: z.boolean(),
  isPacking: z.boolean(),
  active: z.boolean(),
})
type StationForm = z.infer<typeof stationSchema>

function StationFormModal({
  venueId,
  station,
  abiertaAClientes,
  onClose,
}: {
  venueId: string
  station: PrintStation | null
  abiertaAClientes: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const qc = useQueryClient()
  const { role } = useAccess()
  const esSuperadmin = role === StaffRole.SUPERADMIN

  const { data: printers } = useQuery({
    queryKey: ['printers', venueId],
    queryFn: () => getPrinters(venueId),
    enabled: !!venueId,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StationForm>({
    resolver: zodResolver(stationSchema),
    defaultValues: {
      name: station?.name ?? '',
      printerId: station?.printerId ?? null,
      copies: station?.copies ?? 1,
      isDefault: station?.isDefault ?? false,
      isPacking: station?.isPacking ?? false,
      active: station?.active ?? true,
    },
  })

  const printerId = watch('printerId')
  const isDefault = watch('isDefault')
  const isPacking = watch('isPacking')
  const active = watch('active')
  const copies = watch('copies')

  const mutation = useMutation({
    mutationFn: (values: StationForm) => {
      const body = {
        name: values.name.trim(),
        printerId: values.printerId,
        copies: values.copies ?? 1,
        isDefault: values.isDefault,
        isPacking: values.isPacking,
      }
      return station ? updatePrintStation(venueId, station.id, { ...body, active: values.active }) : createPrintStation(venueId, body)
    },
    onSuccess: () => {
      toast({ title: t('stations.saved') })
      qc.invalidateQueries({ queryKey: ['printStations', venueId] })
      qc.invalidateQueries({ queryKey: ['printRouting', venueId] })
      onClose()
    },
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={station ? t('stations.editTitle') : t('stations.createTitle')}
      contentClassName="bg-muted/30"
      actions={
        <Button type="submit" form={FORM_ID} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {mutation.isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(values => mutation.mutate(values))} className="mx-auto max-w-xl space-y-6 p-4 md:p-6">
        <div className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="station-name">{t('stations.fields.name')}</Label>
            <Input
              id="station-name"
              className="h-12 text-base"
              placeholder={t('stations.fields.namePlaceholder')}
              data-tour="print-station-name"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{t('stations.validation.nameRequired')}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('stations.fields.printer')}</Label>
            <Select value={printerId ?? NONE} onValueChange={v => setValue('printerId', v === NONE ? null : v, { shouldDirty: true })}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('stations.fields.printerNone')}</SelectItem>
                {printers?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="station-copies">{t('stations.fields.copies')}</Label>
            <Input
              id="station-copies"
              type="number"
              min={1}
              className="h-12 w-32 text-base"
              value={copies ?? ''}
              onChange={e => {
                const raw = e.target.value
                setValue('copies', raw === '' ? undefined : parseInt(raw, 10), { shouldDirty: true })
              }}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-input p-3">
            <div>
              <p className="text-sm font-medium">{t('stations.fields.isDefault')}</p>
              <p className="text-xs text-muted-foreground">{t('stations.fields.isDefaultHint')}</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={v => setValue('isDefault', v, { shouldDirty: true })} />
          </div>

          {/* El ticket de EMPAQUE no es una comanda más: lleva el pedido completo en una hoja
              para quien mete todo en la bolsa. Va aparte de "estación por default" a
              propósito — mandarlo ahí haría que la cocina reciba DOS papeles del mismo
              pedido, que es el doble-impreso clásico de los pedidos en línea. */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-4">
            <div>
              <p className="text-sm font-medium">{t('stations.fields.isPacking')}</p>
              <p className="text-xs text-muted-foreground">{t('stations.fields.isPackingHint')}</p>
            </div>
            <Switch
              data-tour="print-station-packing"
              checked={isPacking}
              onCheckedChange={v => setValue('isPacking', v, { shouldDirty: true })}
            />
          </div>

          {/* Pantalla de cocina (etapa 3): se prende/apaga al momento, con su propia confirmación; no espera a «Guardar».
              Una estación nueva no existe todavía en el servidor: primero se guarda. */}
          {station ? (
            <KitchenDisplayToggle venueId={venueId} station={station} abiertaAClientes={abiertaAClientes} />
          ) : abiertaAClientes || esSuperadmin ? (
            <p className="text-xs text-muted-foreground">{t('kitchenDisplay.saveFirst')}</p>
          ) : null}

          {station && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
              <p className="text-sm font-medium">{t('stations.fields.active')}</p>
              <Switch checked={active} onCheckedChange={v => setValue('active', v, { shouldDirty: true })} />
            </div>
          )}
        </div>
      </form>
    </FullScreenModal>
  )
}

// ── Delete dialog ──────────────────────────────────────────────────────────────

function DeleteStationDialog({ venueId, station, onClose }: { venueId: string; station: PrintStation | null; onClose: () => void }) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => deletePrintStation(venueId, station!.id),
    onSuccess: () => {
      toast({ title: t('stations.deleted') })
      qc.invalidateQueries({ queryKey: ['printStations', venueId] })
      qc.invalidateQueries({ queryKey: ['printRouting', venueId] })
      onClose()
    },
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  return (
    <AlertDialog open={!!station} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <PrinterIcon className="h-5 w-5" /> {t('stations.deleteTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('stations.deleteMessage', { name: station?.name ?? '' })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={e => {
              e.preventDefault()
              mutation.mutate()
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('actions.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
