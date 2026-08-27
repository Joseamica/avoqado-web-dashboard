import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getProducts } from '@/services/menu.service'
import { rawMaterialsApi } from '@/services/inventory.service'
import {
  purchaseOrderInvoiceService,
  type PurchaseOrderInvoice,
  type PurchaseOrderInvoiceLine,
} from '@/services/purchaseOrderInvoice.service'
import { Currency } from '@/utils/currency'

/**
 * Los renglones de una factura, con el flujo de la fase 2: lo que el código del proveedor ya
 * reconoce sale identificado solo; lo demás lo confirma UNA persona UNA vez (insumo O
 * producto) — y el sistema lo aprende para la siguiente factura. Nunca se adivina por texto.
 */

interface Props {
  venueId: string
  invoice: PurchaseOrderInvoice
  /** Con permiso de edición: permite identificar renglones pendientes. */
  editable: boolean
}

export function InvoiceLines({ venueId, invoice, editable }: Props) {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const [open, setOpen] = useState(false)
  const lines = invoice.lines ?? []
  const pending = lines.filter(l => !l.purchaseOrderItemId && !l.rawMaterialId && !l.productId).length

  if (lines.length === 0) return null

  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => setOpen(v => !v)}>
        {open ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
        {t('invoices.lines.toggle', { count: lines.length })}
        {pending > 0 && (
          <Badge variant="outline" className="ml-2 rounded-full text-[10px]">
            {t('invoices.lines.pending', { count: pending })}
          </Badge>
        )}
      </Button>

      {open && (
        <ul className="space-y-2">
          {lines.map(line => (
            <LineRow key={line.id} venueId={venueId} invoice={invoice} line={line} editable={editable} t={t} />
          ))}
        </ul>
      )}
    </div>
  )
}

function LineRow({
  venueId,
  invoice,
  line,
  editable,
  t,
}: {
  venueId: string
  invoice: PurchaseOrderInvoice
  line: PurchaseOrderInvoiceLine
  editable: boolean
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const identified = !!line.rawMaterialId || !!line.productId
  const matched = !!line.purchaseOrderItemId

  return (
    <li className="rounded-md border border-input p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {line.descripcion}
            {line.supplierItemCode && <span className="ml-1 text-muted-foreground">· {line.supplierItemCode}</span>}
          </p>
          <p className="text-muted-foreground tabular-nums">
            {Number(line.cantidad)} × {Currency(line.valorUnitarioCents / 100)} = {Currency(line.importeCents / 100)}
          </p>
        </div>
        {matched ? (
          <Badge variant="secondary" className="rounded-full gap-1">
            <Check className="h-3 w-3" />
            {t('invoices.lines.matched')}
          </Badge>
        ) : identified ? (
          <Badge variant="secondary" className="rounded-full gap-1">
            <Check className="h-3 w-3" />
            {t('invoices.lines.identified')}
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-full">
            {t('invoices.lines.unidentified')}
          </Badge>
        )}
      </div>

      {!matched && !identified && editable && <IdentifyControls venueId={venueId} invoiceId={invoice.id} lineId={line.id} t={t} />}
    </li>
  )
}

function IdentifyControls({
  venueId,
  invoiceId,
  lineId,
  t,
}: {
  venueId: string
  invoiceId: string
  lineId: string
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<'RAW' | 'PRODUCT'>('RAW')
  const [targetId, setTargetId] = useState<string>('')

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['raw-materials', venueId, 'for-invoice-identify'],
    queryFn: async () => {
      const response = await rawMaterialsApi.getAll(venueId, { active: true })
      return (response.data?.data ?? response.data ?? []) as Array<{ id: string; name: string }>
    },
    enabled: kind === 'RAW',
  })
  const { data: products = [] } = useQuery({
    queryKey: ['products', venueId, 'for-invoice-identify'],
    queryFn: () => getProducts(venueId, { orderBy: 'name' }),
    enabled: kind === 'PRODUCT',
  })

  const identify = useMutation({
    mutationFn: () =>
      purchaseOrderInvoiceService.identifyLine(
        venueId,
        invoiceId,
        lineId,
        kind === 'RAW' ? { rawMaterialId: targetId } : { productId: targetId },
      ),
    onSuccess: () => {
      // La misma consulta alimenta la sección de la orden y la de facturas sin orden.
      queryClient.invalidateQueries({ queryKey: ['purchase-order-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      toast({ title: t('invoices.lines.learnedTitle'), description: t('invoices.lines.learnedDesc') })
    },
    onError: (error: any) => {
      toast({ title: t('invoices.toasts.errorTitle'), description: error?.response?.data?.message, variant: 'destructive' })
    },
  })

  const options = kind === 'RAW' ? rawMaterials : products

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
      <div className="space-y-1">
        <Label className="text-[11px]">{t('invoices.lines.kind')}</Label>
        <Select
          value={kind}
          onValueChange={v => {
            setKind(v as 'RAW' | 'PRODUCT')
            setTargetId('')
          }}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RAW">{t('invoices.lines.raw')}</SelectItem>
            <SelectItem value="PRODUCT">{t('invoices.lines.product')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">{t('invoices.lines.target')}</Label>
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder={t('invoices.lines.targetPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o: { id: string; name: string }) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" className="h-8 cursor-pointer text-xs" disabled={!targetId || identify.isPending} onClick={() => identify.mutate()}>
        {identify.isPending ? t('common:saving', { defaultValue: '...' }) : t('invoices.lines.confirm')}
      </Button>
    </div>
  )
}
