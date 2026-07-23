import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Loader2, PackageCheck, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { PermissionGate } from '@/components/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import {
  interVenueTransferService,
  type InterVenueTransferDetail,
  type InterVenueTransferItem,
  type InterVenueTransferStatus,
  type InterVenueTransferVarianceReason,
} from '@/services/interVenueTransfer.service'

type DecisionKind = 'reject' | 'cancel'
type OperationKind = 'dispatch' | 'receive' | 'variance'

const decisionSchema = z.object({ reason: z.string().trim().min(3).max(2000) })
type DecisionValues = z.infer<typeof decisionSchema>

const operationSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      quantity: z.coerce.number().positive(),
      shortfallReason: z.string().trim().max(1000).optional(),
      reason: z.enum(['NOT_DISPATCHED', 'DAMAGED', 'LOST_IN_TRANSIT', 'QUANTITY_ERROR', 'OTHER']).optional(),
    }),
  ).min(1),
})
type OperationValues = z.infer<typeof operationSchema>

const varianceReasons: InterVenueTransferVarianceReason[] = ['NOT_DISPATCHED', 'DAMAGED', 'LOST_IN_TRANSIT', 'QUANTITY_ERROR', 'OTHER']

function statusVariant(status: InterVenueTransferStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'REJECTED' || status === 'CANCELLED') return 'destructive'
  if (status === 'COMPLETED' || status === 'COMPLETED_WITH_VARIANCE') return 'default'
  if (status === 'REQUESTED' || status === 'APPROVED') return 'secondary'
  return 'outline'
}

function errorMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } }
  return candidate.response?.data?.message || fallback
}

function pendingReceipt(item: InterVenueTransferItem): number {
  return Math.max(0, Number(item.quantityDispatched) - Number(item.quantityReceived))
}

function priorVariance(transfer: InterVenueTransferDetail, itemId: string, notDispatched: boolean): number {
  return transfer.varianceResolutions.reduce(
    (total, resolution) =>
      total + resolution.lines
        .filter(line => line.itemId === itemId && (line.reason === 'NOT_DISPATCHED') === notDispatched)
        .reduce((lineTotal, line) => lineTotal + Number(line.quantity), 0),
    0,
  )
}

function varianceAvailable(transfer: InterVenueTransferDetail, item: InterVenueTransferItem, reason: InterVenueTransferVarianceReason): number {
  if (reason === 'NOT_DISPATCHED') {
    return Math.max(0, Number(item.quantityRequested) - Number(item.quantityDispatched) - priorVariance(transfer, item.id, true))
  }
  return Math.max(0, pendingReceipt(item) - priorVariance(transfer, item.id, false))
}

function receiptAvailable(transfer: InterVenueTransferDetail, item: InterVenueTransferItem): number {
  return Math.max(0, pendingReceipt(item) - priorVariance(transfer, item.id, false))
}

function DecisionDialog({
  kind,
  open,
  pending,
  onClose,
  onSubmit,
}: {
  kind: DecisionKind
  open: boolean
  pending: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const { t } = useTranslation('inventory')
  const form = useForm<DecisionValues>({ resolver: zodResolver(decisionSchema), defaultValues: { reason: '' } })
  useEffect(() => { if (open) form.reset({ reason: '' }) }, [form, open])

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`interVenueTransfers.actions.${kind}`)}</DialogTitle>
          <DialogDescription>{t(`interVenueTransfers.confirm.${kind}`)}</DialogDescription>
        </DialogHeader>
        <form id="transfer-decision-form" onSubmit={form.handleSubmit(values => onSubmit(values.reason))} className="space-y-2">
          <Label htmlFor="transfer-decision-reason">{t('interVenueTransfers.actions.reason')}</Label>
          <Textarea id="transfer-decision-reason" {...form.register('reason')} data-tour={`inter-venue-transfer-${kind}-reason`} />
          {form.formState.errors.reason && <p className="text-sm text-destructive">{t('interVenueTransfers.form.reasonRequired')}</p>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('interVenueTransfers.actions.back')}</Button>
          <Button type="submit" form="transfer-decision-form" variant="destructive" disabled={pending} data-tour={`inter-venue-transfer-${kind}-confirm`}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('interVenueTransfers.actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OperationDialog({
  kind,
  transfer,
  open,
  pending,
  onClose,
  onSubmit,
}: {
  kind: OperationKind
  transfer: InterVenueTransferDetail
  open: boolean
  pending: boolean
  onClose: () => void
  onSubmit: (values: OperationValues) => void
}) {
  const { t } = useTranslation('inventory')
  const form = useForm<OperationValues>({ resolver: zodResolver(operationSchema), defaultValues: { notes: '', items: [] } })
  const { fields, replace } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems = form.watch('items')

  const defaults = useMemo<OperationValues['items']>(() => {
    if (kind === 'dispatch') {
      return transfer.items.map(item => ({ itemId: item.id, quantity: Number(item.quantityRequested), shortfallReason: '' }))
    }
    if (kind === 'receive') {
      return transfer.items
        .filter(item => receiptAvailable(transfer, item) > 0)
        .map(item => ({ itemId: item.id, quantity: receiptAvailable(transfer, item) }))
    }
    const varianceItems: OperationValues['items'] = []
    transfer.items.forEach(item => {
      const notDispatched = varianceAvailable(transfer, item, 'NOT_DISPATCHED')
      const inTransit = varianceAvailable(transfer, item, 'LOST_IN_TRANSIT')
      if (notDispatched > 0) varianceItems.push({ itemId: item.id, quantity: notDispatched, reason: 'NOT_DISPATCHED' })
      else if (inTransit > 0) varianceItems.push({ itemId: item.id, quantity: inTransit, reason: 'LOST_IN_TRANSIT' })
    })
    return varianceItems
  }, [kind, transfer])

  useEffect(() => {
    if (!open) return
    form.reset({ notes: '', items: defaults })
    replace(defaults)
  }, [defaults, form, open, replace])

  const submit = form.handleSubmit(values => {
    let valid = true
    values.items.forEach((value, index) => {
      const item = transfer.items.find(candidate => candidate.id === value.itemId)!
      if (kind === 'dispatch' && value.quantity < Number(item.quantityRequested) && !value.shortfallReason?.trim()) {
        form.setError(`items.${index}.shortfallReason`, { message: t('interVenueTransfers.form.shortfallRequired') })
        valid = false
      }
      if (kind === 'variance') {
        const reason = value.reason ?? 'OTHER'
        if (value.quantity > varianceAvailable(transfer, item, reason)) {
          form.setError(`items.${index}.quantity`, { message: t('interVenueTransfers.form.exceedsPending') })
          valid = false
        }
      }
    })
    if (valid) onSubmit(values)
  })

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(`interVenueTransfers.actions.${kind}`)}</DialogTitle>
          <DialogDescription>{t(`interVenueTransfers.confirm.${kind}`)}</DialogDescription>
        </DialogHeader>
        <form id="transfer-operation-form" onSubmit={submit} className="space-y-4" data-tour={`inter-venue-transfer-${kind}-form`}>
          {fields.map((field, index) => {
            const item = transfer.items.find(candidate => candidate.id === field.itemId)!
            const selectedReason = watchedItems[index]?.reason ?? 'OTHER'
            const available = kind === 'dispatch'
              ? Number(item.quantityRequested)
              : kind === 'receive'
                ? receiptAvailable(transfer, item)
                : varianceAvailable(transfer, item, selectedReason as InterVenueTransferVarianceReason)
            return (
              <div key={field.id} className="space-y-3 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.sourceRawMaterial.name}</p>
                    <p className="text-sm text-muted-foreground">{item.sourceRawMaterial.sku} · {item.unit}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{t('interVenueTransfers.actions.available', { quantity: available })}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${kind}-quantity-${index}`}>{t('interVenueTransfers.form.quantity')}</Label>
                    <Input id={`${kind}-quantity-${index}`} type="number" min="0.001" max={available} step="0.001" {...form.register(`items.${index}.quantity`)} />
                    {form.formState.errors.items?.[index]?.quantity && <p className="text-sm text-destructive">{form.formState.errors.items[index]?.quantity?.message}</p>}
                  </div>
                  {kind === 'variance' && (
                    <div className="space-y-2">
                      <Label>{t('interVenueTransfers.actions.varianceReason')}</Label>
                      <Controller
                        control={form.control}
                        name={`items.${index}.reason`}
                        render={({ field: reasonField }) => (
                          <Select value={reasonField.value} onValueChange={reasonField.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {varianceReasons.map(reason => <SelectItem key={reason} value={reason}>{t(`interVenueTransfers.varianceReasons.${reason}`)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}
                </div>
                {kind === 'dispatch' && Number(watchedItems[index]?.quantity ?? 0) < Number(item.quantityRequested) && (
                  <div className="space-y-2">
                    <Label htmlFor={`shortfall-${index}`}>{t('interVenueTransfers.form.shortfallReason')}</Label>
                    <Textarea id={`shortfall-${index}`} {...form.register(`items.${index}.shortfallReason`)} />
                    {form.formState.errors.items?.[index]?.shortfallReason && <p className="text-sm text-destructive">{form.formState.errors.items[index]?.shortfallReason?.message}</p>}
                  </div>
                )}
              </div>
            )
          })}
          {(kind === 'receive' || kind === 'variance') && (
            <div className="space-y-2">
              <Label htmlFor={`${kind}-notes`}>{t('interVenueTransfers.form.notes')}</Label>
              <Textarea id={`${kind}-notes`} {...form.register('notes')} />
            </div>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('interVenueTransfers.actions.back')}</Button>
          <Button type="submit" form="transfer-operation-form" disabled={pending || fields.length === 0} data-tour={`inter-venue-transfer-${kind}-confirm`}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('interVenueTransfers.actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function InterVenueTransferDetailPage() {
  const { t, i18n } = useTranslation('inventory')
  const { transferId } = useParams<{ transferId: string }>()
  const navigate = useNavigate()
  const { venueId, fullBasePath, venue } = useCurrentVenue()
  const { formatDateTime, formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<DecisionKind | null>(null)
  const [operation, setOperation] = useState<OperationKind | null>(null)

  const transferQuery = useQuery({
    queryKey: ['inter-venue-transfer', venueId, transferId],
    queryFn: () => interVenueTransferService.get(venueId!, transferId!),
    enabled: !!venueId && !!transferId,
  })
  const transfer = transferQuery.data

  const actionMutation = useMutation({
    mutationFn: async (action: { kind: 'approve' | DecisionKind | OperationKind; reason?: string; values?: OperationValues }) => {
      if (!venueId || !transferId) throw new Error('missing transfer context')
      if (action.kind === 'approve') return interVenueTransferService.approve(venueId, transferId)
      if (action.kind === 'reject') return interVenueTransferService.reject(venueId, transferId, action.reason!)
      if (action.kind === 'cancel') return interVenueTransferService.cancel(venueId, transferId, action.reason!)
      if (action.kind === 'dispatch') {
        return interVenueTransferService.dispatch(venueId, transferId, action.values!.items.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity,
          shortfallReason: item.shortfallReason || undefined,
        })))
      }
      if (action.kind === 'receive') {
        return interVenueTransferService.receive(venueId, transferId, {
          notes: action.values!.notes || undefined,
          items: action.values!.items.map(item => ({ itemId: item.itemId, quantity: item.quantity })),
        })
      }
      return interVenueTransferService.resolveVariance(venueId, transferId, {
        notes: action.values!.notes || undefined,
        items: action.values!.items.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity,
          reason: item.reason ?? 'OTHER',
        })),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inter-venue-transfer', venueId, transferId] })
      void queryClient.invalidateQueries({ queryKey: ['inter-venue-transfers'] })
      setDecision(null)
      setOperation(null)
      toast({ description: t('interVenueTransfers.messages.actionSuccess') })
    },
    onError: error => toast({ description: errorMessage(error, t('interVenueTransfers.messages.actionError')), variant: 'destructive' }),
  })

  const timeline = useMemo(() => {
    if (!transfer) return []
    return [
      { key: 'requested', date: transfer.requestedAt },
      { key: 'approved', date: transfer.approvedAt },
      { key: 'dispatched', date: transfer.dispatchedAt },
      ...transfer.receipts.map(receipt => ({ key: 'received', date: receipt.receivedAt })),
      ...transfer.varianceResolutions.map(resolution => ({ key: 'variance', date: resolution.resolvedAt })),
      { key: 'completed', date: transfer.completedAt },
      { key: 'rejected', date: transfer.rejectedAt },
      { key: 'cancelled', date: transfer.cancelledAt },
    ].filter((event): event is { key: string; date: string } => !!event.date).sort((left, right) => left.date.localeCompare(right.date))
  }, [transfer])

  const currency = useMemo(
    () => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: venue?.currency || 'MXN' }),
    [i18n.language, venue?.currency],
  )

  if (transferQuery.isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!transfer) return <Alert variant="destructive"><AlertDescription>{t('interVenueTransfers.messages.notFound')}</AlertDescription></Alert>

  const isSource = transfer.sourceVenueId === venueId
  const isDestination = transfer.destinationVenueId === venueId
  const canCancel = transfer.status === 'REQUESTED' || transfer.status === 'APPROVED'
  const canReceive = transfer.items.some(item => receiptAvailable(transfer, item) > 0)
  const canResolveVariance = transfer.items.some(item =>
    varianceAvailable(transfer, item, 'NOT_DISPATCHED') > 0 || varianceAvailable(transfer, item, 'LOST_IN_TRANSIT') > 0,
  )
  const nextResponsible = transfer.status === 'REQUESTED'
    ? transfer.sourceVenue.name
    : transfer.status === 'APPROVED'
      ? transfer.sourceVenue.name
      : transfer.status === 'IN_TRANSIT' || transfer.status === 'PARTIALLY_RECEIVED'
        ? transfer.destinationVenue.name
        : t('interVenueTransfers.detail.closed')

  return (
    <FeatureGate feature="INVENTORY_TRACKING">
      <div className="space-y-6" data-tour="inter-venue-transfer-detail">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate(`${fullBasePath}/inventory/inter-venue-transfers`)} aria-label={t('interVenueTransfers.actions.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{transfer.number}</h1>
                <Badge variant={statusVariant(transfer.status)}>{t(`interVenueTransfers.statuses.${transfer.status}`)}</Badge>
              </div>
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                {transfer.sourceVenue.name}<ArrowRight className="h-4 w-4" />{transfer.destinationVenue.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" data-tour="inter-venue-transfer-actions">
            {isSource && transfer.status === 'REQUESTED' && (
              <PermissionGate permission="inventory-transfers:approve">
                <Button onClick={() => actionMutation.mutate({ kind: 'approve' })} disabled={actionMutation.isPending}>
                  <Check className="mr-2 h-4 w-4" />{t('interVenueTransfers.actions.approve')}
                </Button>
                <Button variant="destructive" onClick={() => setDecision('reject')} disabled={actionMutation.isPending}>
                  <X className="mr-2 h-4 w-4" />{t('interVenueTransfers.actions.reject')}
                </Button>
              </PermissionGate>
            )}
            {isSource && transfer.status === 'APPROVED' && (
              <PermissionGate permission="inventory-transfers:dispatch">
                <Button onClick={() => setOperation('dispatch')}><Send className="mr-2 h-4 w-4" />{t('interVenueTransfers.actions.dispatch')}</Button>
              </PermissionGate>
            )}
            {isDestination && (transfer.status === 'IN_TRANSIT' || transfer.status === 'PARTIALLY_RECEIVED') && canReceive && (
              <PermissionGate permission="inventory-transfers:receive">
                <Button onClick={() => setOperation('receive')}><PackageCheck className="mr-2 h-4 w-4" />{t('interVenueTransfers.actions.receive')}</Button>
              </PermissionGate>
            )}
            {isDestination && (transfer.status === 'IN_TRANSIT' || transfer.status === 'PARTIALLY_RECEIVED') && canResolveVariance && (
              <PermissionGate permission="inventory-transfers:receive">
                <Button variant="outline" onClick={() => setOperation('variance')}><CircleAlert className="mr-2 h-4 w-4" />{t('interVenueTransfers.actions.variance')}</Button>
              </PermissionGate>
            )}
            {canCancel && (
              <PermissionGate permission={isSource ? 'inventory-transfers:approve' : 'inventory-transfers:request'}>
                <Button variant="outline" onClick={() => setDecision('cancel')}>{t('interVenueTransfers.actions.cancel')}</Button>
              </PermissionGate>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">{t('interVenueTransfers.detail.mode')}</CardTitle></CardHeader><CardContent>{t(`interVenueTransfers.modes.${transfer.mode}`)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">{t('interVenueTransfers.detail.activeVenue')}</CardTitle></CardHeader><CardContent>{venue?.name}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">{t('interVenueTransfers.detail.nextResponsible')}</CardTitle></CardHeader><CardContent>{nextResponsible}</CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t('interVenueTransfers.detail.items')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t('interVenueTransfers.detail.material')}</TableHead>
                <TableHead>{t('interVenueTransfers.detail.requested')}</TableHead>
                <TableHead>{t('interVenueTransfers.detail.dispatched')}</TableHead>
                <TableHead>{t('interVenueTransfers.detail.received')}</TableHead>
                <TableHead>{t('interVenueTransfers.detail.variance')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transfer.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.sourceRawMaterial.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sourceRawMaterial.sku} → {item.destinationRawMaterial.sku} · {item.unit}</p>
                      {item.dispatchShortfallReason && <p className="mt-1 text-xs text-muted-foreground">{item.dispatchShortfallReason}</p>}
                    </TableCell>
                    <TableCell>{item.quantityRequested}</TableCell>
                    <TableCell>{item.quantityDispatched}</TableCell>
                    <TableCell>{item.quantityReceived}</TableCell>
                    <TableCell>{item.quantityVarianceResolved}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {transfer.items.some(item => item.allocations.length > 0) && (
          <Card>
            <CardHeader><CardTitle>{t('interVenueTransfers.detail.fifo')}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t('interVenueTransfers.detail.material')}</TableHead>
                  <TableHead>{t('interVenueTransfers.detail.sourceBatch')}</TableHead>
                  <TableHead>{t('interVenueTransfers.detail.destinationBatch')}</TableHead>
                  <TableHead>{t('interVenueTransfers.detail.dispatched')}</TableHead>
                  <TableHead>{t('interVenueTransfers.detail.received')}</TableHead>
                  <TableHead>{t('interVenueTransfers.detail.unitCost')}</TableHead>
                  <TableHead>{t('interVenueTransfers.detail.expiration')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {transfer.items.flatMap(item => item.allocations.map(allocation => (
                    <TableRow key={allocation.id}>
                      <TableCell>{item.sourceRawMaterial.name}</TableCell>
                      <TableCell>{allocation.sourceBatch.batchNumber}</TableCell>
                      <TableCell>{allocation.destinationBatch?.batchNumber ?? '—'}</TableCell>
                      <TableCell>{allocation.quantityDispatched}</TableCell>
                      <TableCell>{allocation.quantityReceived}</TableCell>
                      <TableCell>{currency.format(Number(allocation.costPerUnit))}</TableCell>
                      <TableCell>{allocation.expirationDate ? formatDate(allocation.expirationDate) : '—'}</TableCell>
                    </TableRow>
                  ))) }
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>{t('interVenueTransfers.detail.timeline')}</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {timeline.map((event, index) => (
                <li key={`${event.key}-${event.date}-${index}`} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <div><p className="font-medium">{t(`interVenueTransfers.timeline.${event.key}`)}</p><p className="text-sm text-muted-foreground">{formatDateTime(event.date)}</p></div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {decision && (
          <DecisionDialog
            kind={decision}
            open
            pending={actionMutation.isPending}
            onClose={() => setDecision(null)}
            onSubmit={reason => actionMutation.mutate({ kind: decision, reason })}
          />
        )}
        {operation && (
          <OperationDialog
            kind={operation}
            transfer={transfer}
            open
            pending={actionMutation.isPending}
            onClose={() => setOperation(null)}
            onSubmit={values => actionMutation.mutate({ kind: operation, values })}
          />
        )}
      </div>
    </FeatureGate>
  )
}
