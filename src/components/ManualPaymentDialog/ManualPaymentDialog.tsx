import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LoadingButton } from '@/components/ui/loading-button'
import { useToast } from '@/hooks/use-toast'

import { manualPaymentService, type PaymentMethod, type PaymentSource } from '@/services/manualPayment.service'
import { ExternalSourceCombobox } from './ExternalSourceCombobox'
import { OrderSelector, type OrderOption } from './OrderSelector'

/**
 * Local Zod schema — mirrors backend validation.
 * Enforces OTHER ↔ externalSource relationship via superRefine.
 */
const schema = z
  .object({
    amount: z
      .string()
      .min(1, 'El monto es requerido')
      .refine(v => !isNaN(Number(v)) && Number(v) > 0, 'El monto debe ser un número mayor a 0'),
    tipAmount: z
      .string()
      .optional()
      .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'La propina debe ser un número positivo'),
    taxAmount: z
      .string()
      .optional()
      .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'El IVA debe ser un número positivo'),
    discountAmount: z
      .string()
      .optional()
      .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'El descuento debe ser un número positivo'),
    method: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET', 'BANK_TRANSFER', 'CRYPTOCURRENCY', 'OTHER'] as const, {
      required_error: 'El método es requerido',
    }),
    source: z.enum(['TPV', 'DASHBOARD_TEST', 'QR', 'WEB', 'APP', 'PHONE', 'POS', 'SDK', 'OTHER'] as const, {
      required_error: 'El origen es requerido',
    }),
    externalSource: z.string().trim().optional(),
    waiterId: z.string().optional(),
    reason: z.string().trim().max(500, 'La razón no puede exceder 500 caracteres').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'OTHER') {
      if (!data.externalSource || data.externalSource.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalSource'],
          message: 'El proveedor externo es requerido cuando el origen es OTHER',
        })
      } else if (data.externalSource.trim().length > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalSource'],
          message: 'El proveedor externo no puede exceder 100 caracteres',
        })
      }
    } else if (data.externalSource && data.externalSource.trim().length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['externalSource'],
        message: 'El proveedor externo solo aplica cuando el origen es OTHER',
      })
    }
  })

type FormValues = z.infer<typeof schema>

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEBIT_CARD: 'Tarjeta de débito',
  DIGITAL_WALLET: 'Billetera digital',
  BANK_TRANSFER: 'Transferencia bancaria',
  CRYPTOCURRENCY: 'Criptomoneda',
  OTHER: 'Otro',
}

const SOURCE_LABELS: Record<PaymentSource, string> = {
  TPV: 'TPV',
  DASHBOARD_TEST: 'Dashboard (prueba)',
  QR: 'QR',
  WEB: 'Web',
  APP: 'App',
  PHONE: 'Teléfono',
  POS: 'POS',
  SDK: 'SDK',
  OTHER: 'Otro (proveedor externo)',
}

interface ManualPaymentDialogProps {
  open: boolean
  onClose: () => void
  venueId: string
  /**
   * Optional pre-selected order. When omitted, the dialog renders an
   * inline OrderSelector so the admin can search & pick without knowing
   * the order ID by heart.
   */
  orderId?: string
  orderCode?: string
}

export function ManualPaymentDialog({ open, onClose, venueId, orderId, orderCode }: ManualPaymentDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // When the caller pre-selects an order (e.g., from Orders row actions),
  // use that. Otherwise let the user pick via the embedded selector.
  const [pickedOrder, setPickedOrder] = useState<OrderOption | null>(null)
  const effectiveOrderId = orderId ?? pickedOrder?.id ?? ''
  const effectiveOrderLabel = orderCode ?? pickedOrder?.orderNumber

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      tipAmount: '',
      taxAmount: '',
      discountAmount: '',
      method: 'CASH',
      // Default to OTHER: primary use case is recording payments arrived via
      // external providers (BUQ, Clip, Mercado Pago...). DASHBOARD_TEST is
      // reserved for superadmin testing and would mislabel real revenue.
      source: 'OTHER',
      externalSource: '',
      waiterId: '',
      reason: '',
    },
  })

  const source = form.watch('source')

  // Reset form + internal picked order when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset()
      setPickedOrder(null)
    }
  }, [open, form])

  // Fetch suggestions for the external source combobox
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['external-sources', venueId],
    queryFn: () => manualPaymentService.getExternalSources(venueId),
    staleTime: 60_000,
    enabled: open,
  })

  // Eligible waiters — loaded lazily when the dialog opens so we don't query
  // unless the user actually needs to pick a staff member.
  const { data: waiters = [], isLoading: waitersLoading } = useQuery({
    queryKey: ['manual-payment-waiters', venueId],
    queryFn: () => manualPaymentService.getWaiters(venueId),
    staleTime: 60_000,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      manualPaymentService.create(venueId, {
        // Send undefined (not '') so the backend Zod's .transform() doesn't
        // trip on empty strings when we're creating a standalone entry.
        orderId: effectiveOrderId ? effectiveOrderId : undefined,
        amount: values.amount,
        tipAmount: values.tipAmount && values.tipAmount.trim().length > 0 ? values.tipAmount : undefined,
        taxAmount: values.taxAmount && values.taxAmount.trim().length > 0 ? values.taxAmount : undefined,
        discountAmount:
          values.discountAmount && values.discountAmount.trim().length > 0 ? values.discountAmount : undefined,
        method: values.method,
        source: values.source,
        externalSource:
          values.source === 'OTHER' && values.externalSource && values.externalSource.trim().length > 0
            ? values.externalSource.trim()
            : undefined,
        waiterId: values.waiterId && values.waiterId.length > 0 ? values.waiterId : undefined,
        reason: values.reason && values.reason.trim().length > 0 ? values.reason.trim() : undefined,
      }),
    onSuccess: () => {
      toast({
        title: 'Pago registrado',
        description: 'El pago manual se registró correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] })
      queryClient.invalidateQueries({ queryKey: ['payments', venueId] })
      queryClient.invalidateQueries({ queryKey: ['order', effectiveOrderId] })
      queryClient.invalidateQueries({ queryKey: ['external-sources', venueId] })
      onClose()
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'No se pudo registrar el pago manual.'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (values: FormValues) => {
    // effectiveOrderId MAY be empty — backend creates a shadow order for
    // standalone bookkeeping entries that never passed through Avoqado.
    mutation.mutate(values)
  }

  // Whether the parent already pinned the order (row-action path). If not,
  // we show the selector inline.
  const orderFromProps = Boolean(orderId)

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Registrar pago manual</DialogTitle>
          <DialogDescription>
            {orderFromProps && effectiveOrderLabel
              ? `Orden ${effectiveOrderLabel}`
              : 'Registra un pago hecho fuera del sistema (efectivo, BUQ, Clip, transferencia, etc.).'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!orderFromProps && (
              <div className="space-y-1.5">
                <Label>Orden (opcional)</Label>
                <OrderSelector venueId={venueId} value={pickedOrder} onChange={setPickedOrder} />
                <p className="text-xs text-muted-foreground">
                  {pickedOrder
                    ? `Saldo pendiente: $${Number(pickedOrder.remainingBalance).toFixed(2)} · Total: $${Number(pickedOrder.total).toFixed(2)}`
                    : 'Déjalo vacío si el pago no corresponde a una orden en Avoqado (asiento contable).'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Propina (opcional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* IVA & descuento — solo aplican al crear la orden fantasma
                (standalone). Cuando hay orden pre-seleccionada, la orden ya
                tiene sus propios impuestos/descuentos y estos se ignoran. */}
            {!effectiveOrderId && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IVA (opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discountAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descuento (opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(m => (
                          <SelectItem key={m} value={m}>
                            {METHOD_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origen</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(SOURCE_LABELS) as PaymentSource[]).map(s => (
                          <SelectItem key={s} value={s}>
                            {SOURCE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {source === 'OTHER' && (
              <FormField
                control={form.control}
                name="externalSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor externo</FormLabel>
                    <FormControl>
                      <ExternalSourceCombobox
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        suggestions={suggestions}
                        isLoading={suggestionsLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="waiterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mesero (opcional)</FormLabel>
                  <Select value={field.value || ''} onValueChange={v => field.onChange(v === '__none__' ? '' : v)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={waitersLoading ? 'Cargando...' : 'Nadie (se atribuye al admin)'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nadie (se atribuye al admin)</SelectItem>
                      {waiters.map(w => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.firstName} {w.lastName} · {w.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    La propina y comisiones se atribuyen a esta persona.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Nota interna: por qué se registró este pago manualmente."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <LoadingButton type="submit" isLoading={mutation.isPending}>
                Registrar pago
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
