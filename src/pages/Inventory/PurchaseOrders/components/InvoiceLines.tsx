import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  type PurchaseOrderInvoice,
  type PurchaseOrderInvoiceLine,
} from '@/services/purchaseOrderInvoice.service'
import { Currency } from '@/utils/currency'
import { InvoiceLineEditor } from './InvoiceLineEditor'

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
        {t('invoices.lines.toggle', { count: invoice._count?.lines ?? lines.length })}
        {pending > 0 && (
          <Badge variant="outline" className="ml-2 rounded-full text-[10px]">
            {t('invoices.lines.pending', { count: pending })}
          </Badge>
        )}
      </Button>

      {open && (invoice._count?.lines ?? lines.length) > 200 && <p className="text-sm text-muted-foreground">{t('invoices.receipt.tooManyLines', { total: invoice._count?.lines })}</p>}
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
  const [editing, setEditing] = useState(false)
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

      {!matched && editable && <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-tour="invoice-identify-line">{t('invoices.receipt.identify')}</Button>}
      {editing && <InvoiceLineEditor venueId={venueId} invoiceId={invoice.id} line={line} onClose={() => setEditing(false)} />}
    </li>
  )
}
