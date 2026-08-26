import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FileText, HelpCircle, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import {
  purchaseOrderInvoiceService,
  type InvoiceMatchStatus,
  type PurchaseOrderInvoice,
} from '@/services/purchaseOrderInvoice.service'

/**
 * Facturas del proveedor sobre esta orden.
 *
 * 🔴 Subir una factura NUNCA cambia el costo de la mercancía. Si el proveedor cobró otro
 * precio, se avisa aquí — corregirlo alteraría el costo de ventas que ya ocurrieron.
 */

interface Props {
  venueId: string
  purchaseOrderId: string
}

const STATUS_TONE: Record<InvoiceMatchStatus, 'ok' | 'warn'> = {
  MATCHED: 'ok',
  PENDING: 'warn',
  SUPPLIER_MISMATCH: 'warn',
  AMOUNT_MISMATCH: 'warn',
  LINES_MISMATCH: 'warn',
}

export function InvoiceSection({ venueId, purchaseOrderId }: Props) {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isReading, setIsReading] = useState(false)

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['purchase-order-invoices', venueId, purchaseOrderId],
    queryFn: () => purchaseOrderInvoiceService.list(venueId, purchaseOrderId),
    enabled: !!venueId && !!purchaseOrderId,
  })

  const attachMutation = useMutation({
    mutationFn: (xml: string) => purchaseOrderInvoiceService.attach(venueId, purchaseOrderId, xml),
    onSuccess: invoice => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-invoices', venueId, purchaseOrderId] })
      const cuadra = invoice.matchStatus === 'MATCHED'
      toast({
        title: cuadra ? t('invoices.toasts.matchedTitle') : t('invoices.toasts.mismatchTitle'),
        description: cuadra ? t('invoices.toasts.matchedDesc') : t('invoices.toasts.mismatchDesc'),
        variant: cuadra ? undefined : 'destructive',
      })
    },
    onError: (error: any) => {
      toast({
        title: t('invoices.toasts.errorTitle'),
        description: error?.response?.data?.message || t('invoices.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // El input se limpia siempre: sin esto, elegir el MISMO archivo otra vez no dispara change.
    event.target.value = ''
    if (!file) return

    setIsReading(true)
    try {
      const xml = await file.text()
      await attachMutation.mutateAsync(xml)
    } catch {
      // El error de red ya lo reporta onError; aquí sólo cae un archivo ilegible.
    } finally {
      setIsReading(false)
    }
  }

  const busy = isReading || attachMutation.isPending

  return (
    <Card className="border-input mt-8">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{t('invoices.title')}</h3>
            {invoices.length > 0 && (
              <Badge variant="secondary" className="rounded-full">
                {invoices.length}
              </Badge>
            )}
          </div>

          <PermissionGate permission="inventory:update">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {busy ? t('invoices.uploading') : t('invoices.upload')}
            </Button>
          </PermissionGate>
        </div>

        <p className="text-xs text-muted-foreground">{t('invoices.hint')}</p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('invoices.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map(invoice => (
              <InvoiceRow key={invoice.id} invoice={invoice} formatDate={formatDate} t={t} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function InvoiceRow({
  invoice,
  formatDate,
  t,
}: {
  invoice: PurchaseOrderInvoice
  formatDate: (d: string) => string
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const tone = STATUS_TONE[invoice.matchStatus] ?? 'warn'
  const notes = invoice.matchNotes
  const diff = notes?.totalDifferenceCents ?? 0

  return (
    <li className="rounded-lg border border-input p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {invoice.serie ? `${invoice.serie}-` : ''}
            {invoice.folio ?? invoice.uuid.slice(0, 8)}
          </p>
          <p className="text-xs text-muted-foreground">
            {invoice.emisorNombre} · {invoice.emisorRfc} · {formatDate(invoice.fechaEmision)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums">{Currency(invoice.totalCents / 100)}</span>
          {tone === 'ok' ? (
            <Badge variant="secondary" className="rounded-full gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t(`invoices.status.${invoice.matchStatus}`)}
            </Badge>
          ) : (
            <Badge variant="destructive" className="rounded-full gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t(`invoices.status.${invoice.matchStatus}`)}
            </Badge>
          )}
        </div>
      </div>

      {/* Sólo se explica lo que NO cuadra: si todo está bien, la insignia ya lo dijo. */}
      {diff !== 0 && (
        <p className="text-xs text-destructive">
          {t(diff > 0 ? 'invoices.diffOver' : 'invoices.diffUnder', { amount: Currency(Math.abs(diff) / 100) })}
        </p>
      )}
      {!!notes?.unmatchedConceptos && (
        <p className="text-xs text-muted-foreground">{t('invoices.unmatchedLines', { count: notes.unmatchedConceptos })}</p>
      )}
      {!!notes?.unmatchedOrderItemIds?.length && (
        <p className="text-xs text-muted-foreground">
          {t('invoices.uninvoicedItems', { count: notes.unmatchedOrderItemIds.length })}
        </p>
      )}
      {notes?.supplierUnverified && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          {t('invoices.supplierUnverified')}
        </p>
      )}
    </li>
  )
}
