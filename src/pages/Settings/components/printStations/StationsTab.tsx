import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Printer as PrinterIcon, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { useToast } from '@/hooks/use-toast'
import { useTerminology } from '@/hooks/use-terminology'
import {
  createPrintStation,
  deletePrintStation,
  getPrinters,
  getPrintStations,
  updatePrintStation,
  type PrintStation,
} from '@/services/printStations.service'

const NONE = '__none__'
const FORM_ID = 'print-station-form'

const apiError = (e: any, fallback: string): string =>
  e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

export function StationsTab({ venueId }: { venueId: string }) {
  const { t } = useTranslation('printStations')
  const { term } = useTerminology()

  const [editing, setEditing] = useState<PrintStation | null>(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const [toDelete, setToDelete] = useState<PrintStation | null>(null)

  const { data: stations, isLoading } = useQuery({
    queryKey: ['printStations', venueId],
    queryFn: () => getPrintStations(venueId),
    enabled: !!venueId,
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (station: PrintStation) => {
    setEditing(station)
    setFormOpen(true)
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
        <Card className="border-input">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('stations.colName')}</TableHead>
                  <TableHead>{t('stations.colPrinter')}</TableHead>
                  <TableHead>{t('stations.colCopies')}</TableHead>
                  <TableHead>{t('stations.colStatus')}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations!.map(station => (
                  <TableRow key={station.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{station.name}</span>
                        {station.isDefault && <Badge variant="secondary">{t('stations.defaultBadge')}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {station.printer?.name ?? t('stations.noPrinter')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{station.copies}</TableCell>
                    <TableCell>
                      <Badge variant={station.active ? 'default' : 'outline'}>
                        {station.active ? t('stations.statusActive') : t('stations.statusInactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => openEdit(station)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer text-destructive"
                          onClick={() => setToDelete(station)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isFormOpen && (
        <StationFormModal venueId={venueId} station={editing} onClose={() => setFormOpen(false)} />
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
  active: z.boolean(),
})
type StationForm = z.infer<typeof stationSchema>

function StationFormModal({
  venueId,
  station,
  onClose,
}: {
  venueId: string
  station: PrintStation | null
  onClose: () => void
}) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const qc = useQueryClient()

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
      active: station?.active ?? true,
    },
  })

  const printerId = watch('printerId')
  const isDefault = watch('isDefault')
  const active = watch('active')
  const copies = watch('copies')

  const mutation = useMutation({
    mutationFn: (values: StationForm) => {
      const body = {
        name: values.name.trim(),
        printerId: values.printerId,
        copies: values.copies ?? 1,
        isDefault: values.isDefault,
      }
      return station
        ? updatePrintStation(venueId, station.id, { ...body, active: values.active })
        : createPrintStation(venueId, body)
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
      <form
        id={FORM_ID}
        onSubmit={handleSubmit(values => mutation.mutate(values))}
        className="mx-auto max-w-xl space-y-6 p-4 md:p-6"
      >
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
            <Select
              value={printerId ?? NONE}
              onValueChange={v => setValue('printerId', v === NONE ? null : v, { shouldDirty: true })}
            >
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

function DeleteStationDialog({
  venueId,
  station,
  onClose,
}: {
  venueId: string
  station: PrintStation | null
  onClose: () => void
}) {
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
