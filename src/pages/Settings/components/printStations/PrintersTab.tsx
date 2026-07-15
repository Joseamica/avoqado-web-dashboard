import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { createPrinter, deletePrinter, getPrinters, updatePrinter, type Printer } from '@/services/printStations.service'

const FORM_ID = 'printer-form'
const DEFAULT_CHARSET = 'CP858'

// Only these two connection types are servable by the POS gateway today —
// USB_SPOOLER (Windows desktop POS) and TERMINAL_INTERNAL (PAX internal printer)
// are backend-rejected and must never be offered here.
const CONNECTION_TYPES = ['NETWORK', 'BLUETOOTH'] as const
type FormConnectionType = (typeof CONNECTION_TYPES)[number]

// Mirrors the backend's address shape validation per connection type so the
// user gets an inline error instead of a 400.
// NETWORK: host or host:port (e.g. 192.168.1.50:9100) — a MAC is rejected.
const NETWORK_ADDRESS_REGEX = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/
// BLUETOOTH: 6-octet MAC, ':' or '-' separators, case-insensitive.
const BLUETOOTH_MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/

const apiError = (e: any, fallback: string): string =>
  e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

export function PrintersTab({ venueId }: { venueId: string }) {
  const { t } = useTranslation('printStations')

  const [editing, setEditing] = useState<Printer | null>(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Printer | null>(null)

  const { data: printers, isLoading } = useQuery({
    queryKey: ['printers', venueId],
    queryFn: () => getPrinters(venueId),
    enabled: !!venueId,
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (printer: Printer) => {
    setEditing(printer)
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('printers.intro')}</p>

      <div className="flex justify-end">
        <Button onClick={openCreate} data-tour="printer-add">
          <Plus className="mr-2 h-4 w-4" /> {t('printers.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      ) : (printers?.length ?? 0) === 0 ? (
        <Card className="border-input">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t('printers.empty')}</CardContent>
        </Card>
      ) : (
        <Card className="border-input">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('printers.colName')}</TableHead>
                  <TableHead>{t('printers.colAddress')}</TableHead>
                  <TableHead>{t('printers.colWidth')}</TableHead>
                  <TableHead>{t('printers.colStatus')}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {printers!.map(printer => (
                  <TableRow key={printer.id}>
                    <TableCell className="font-medium">{printer.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{printer.address ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{t('printers.widthValue', { mm: printer.paperWidthMm })}</TableCell>
                    <TableCell>
                      <Badge variant={printer.active ? 'default' : 'outline'}>
                        {printer.active ? t('printers.statusActive') : t('printers.statusInactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => openEdit(printer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer text-destructive"
                          onClick={() => setToDelete(printer)}
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

      {isFormOpen && <PrinterFormModal venueId={venueId} printer={editing} onClose={() => setFormOpen(false)} />}

      <DeletePrinterDialog venueId={venueId} printer={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}

// ── Form modal ────────────────────────────────────────────────────────────────

const printerSchema = z
  .object({
    name: z.string().trim().min(1),
    connectionType: z.enum(CONNECTION_TYPES),
    address: z.string().trim().min(1, { message: 'addressRequired' }),
    paperWidthMm: z.number(),
    charset: z.string().trim().min(1),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const address = data.address.trim()
    if (!address) return // already caught by address.min(1)

    if (data.connectionType === 'NETWORK' && !NETWORK_ADDRESS_REGEX.test(address)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'addressInvalidNetwork' })
    }
    if (data.connectionType === 'BLUETOOTH' && !BLUETOOTH_MAC_REGEX.test(address)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'addressInvalidBluetooth' })
    }
  })
type PrinterForm = z.infer<typeof printerSchema>

function PrinterFormModal({ venueId, printer, onClose }: { venueId: string; printer: Printer | null; onClose: () => void }) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const qc = useQueryClient()

  const initialConnectionType: FormConnectionType = printer?.connectionType === 'BLUETOOTH' ? 'BLUETOOTH' : 'NETWORK'

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PrinterForm>({
    resolver: zodResolver(printerSchema),
    defaultValues: {
      name: printer?.name ?? '',
      connectionType: initialConnectionType,
      address: printer?.address ?? '',
      paperWidthMm: printer?.paperWidthMm ?? 80,
      charset: printer?.charset ?? DEFAULT_CHARSET,
      active: printer?.active ?? true,
    },
  })

  const connectionType = watch('connectionType')
  const paperWidthMm = watch('paperWidthMm')
  const active = watch('active')

  const handleConnectionTypeChange = (value: string) => {
    setValue('connectionType', value as FormConnectionType, { shouldDirty: true })
    // Clear the address so a stale IP isn't submitted as a MAC (and vice versa).
    setValue('address', '', { shouldDirty: true, shouldValidate: false })
  }

  const mutation = useMutation({
    mutationFn: (values: PrinterForm) => {
      const body = {
        name: values.name.trim(),
        connectionType: values.connectionType,
        address: values.address.trim(),
        paperWidthMm: values.paperWidthMm,
        charset: values.charset.trim(),
      }
      return printer
        ? updatePrinter(venueId, printer.id, { ...body, active: values.active })
        : createPrinter(venueId, body)
    },
    onSuccess: () => {
      toast({ title: t('printers.saved') })
      qc.invalidateQueries({ queryKey: ['printers', venueId] })
      qc.invalidateQueries({ queryKey: ['printStations', venueId] })
      onClose()
    },
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={printer ? t('printers.editTitle') : t('printers.createTitle')}
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
            <Label htmlFor="printer-name">{t('printers.fields.name')}</Label>
            <Input
              id="printer-name"
              className="h-12 text-base"
              placeholder={t('printers.fields.namePlaceholder')}
              data-tour="printer-name"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{t('printers.validation.nameRequired')}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('printers.fields.connection')}</Label>
            <Select value={connectionType} onValueChange={handleConnectionTypeChange}>
              <SelectTrigger className="h-12 text-base" data-tour="printer-connection-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NETWORK">{t('printers.connectionNetwork')}</SelectItem>
                <SelectItem value="BLUETOOTH">{t('printers.connectionBluetooth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-address">
              {connectionType === 'BLUETOOTH' ? t('printers.fields.addressBluetooth') : t('printers.fields.addressNetwork')}
            </Label>
            <Input
              id="printer-address"
              className="h-12 font-mono text-base"
              placeholder={
                connectionType === 'BLUETOOTH'
                  ? t('printers.fields.addressBluetoothPlaceholder')
                  : t('printers.fields.addressNetworkPlaceholder')
              }
              {...register('address')}
            />
            <p className="text-xs text-muted-foreground">
              {connectionType === 'BLUETOOTH' ? t('printers.fields.addressBluetoothHint') : t('printers.fields.addressNetworkHint')}
            </p>
            {errors.address && (
              <p className="text-xs text-destructive">
                {t(`printers.validation.${errors.address.message ?? 'addressRequired'}`)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('printers.fields.paperWidth')}</Label>
              <Select
                value={String(paperWidthMm)}
                onValueChange={v => setValue('paperWidthMm', parseInt(v, 10), { shouldDirty: true })}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">{t('printers.widthValue', { mm: 58 })}</SelectItem>
                  <SelectItem value="80">{t('printers.widthValue', { mm: 80 })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="printer-charset">{t('printers.fields.charset')}</Label>
              <Input id="printer-charset" className="h-12 text-base" {...register('charset')} />
            </div>
          </div>

          {printer && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
              <p className="text-sm font-medium">{t('printers.fields.active')}</p>
              <Switch checked={active} onCheckedChange={v => setValue('active', v, { shouldDirty: true })} />
            </div>
          )}
        </div>
      </form>
    </FullScreenModal>
  )
}

// ── Delete dialog ──────────────────────────────────────────────────────────────

function DeletePrinterDialog({ venueId, printer, onClose }: { venueId: string; printer: Printer | null; onClose: () => void }) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => deletePrinter(venueId, printer!.id),
    onSuccess: () => {
      toast({ title: t('printers.deleted') })
      qc.invalidateQueries({ queryKey: ['printers', venueId] })
      qc.invalidateQueries({ queryKey: ['printStations', venueId] })
      onClose()
    },
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  return (
    <AlertDialog open={!!printer} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('printers.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('printers.deleteMessage', { name: printer?.name ?? '' })}</AlertDialogDescription>
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
