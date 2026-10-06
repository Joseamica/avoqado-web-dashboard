import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { purchaseOrderInvoiceService, type PurchaseOrderInvoice } from '@/services/purchaseOrderInvoice.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Currency } from '@/utils/currency'

export function InvoiceInventoryDialog({ venueId, invoice, onClose }: { venueId: string; invoice: PurchaseOrderInvoice; onClose: () => void }) {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { getShortLabel } = useUnitTranslation()
  const { toast } = useToast()
  const client = useQueryClient()
  const [includeIeps, setIncludeIeps] = useState(invoice.inventoryIncludeIeps === true)
  const review = useQuery({
    queryKey: ['invoice-inventory-review', venueId, invoice.id, includeIeps],
    queryFn: () => purchaseOrderInvoiceService.previewInventory(venueId, invoice.id, includeIeps),
    staleTime: 30000, retry: false, refetchOnWindowFocus: false,
  })
  const confirmation = useMutation({
    mutationFn: () => purchaseOrderInvoiceService.confirmInventory(venueId, invoice.id, review.data!.confirmationToken, review.data!.includeIepsInCost),
    onSuccess: result => {
      for (const key of ['supplier-invoice-inbox', 'purchase-order-invoices', 'purchase-orders', 'purchase-order', 'raw-materials', 'inventory', 'inventory-summary', 'products']) {
        client.invalidateQueries({ queryKey: [key, venueId] })
      }
      toast({ title: t(result.status === 'PENDING_APPROVAL' ? 'invoices.receipt.prepared' : 'invoices.receipt.received') })
      onClose()
    },
    onError: (error: any) => {
      toast({ title: t('invoices.toasts.errorTitle'), description: error?.response?.data?.message || t('invoices.toasts.errorDesc'), variant: 'destructive' })
      client.invalidateQueries({ queryKey: ['invoice-inventory-review', venueId, invoice.id] })
    },
  })
  const data = review.data
  const error = review.error as { response?: { data?: { message?: string } } } | null
  return <FullScreenModal open onClose={() => { if (!confirmation.isPending) onClose() }} title={t('invoices.receipt.review')} contentClassName="bg-muted/30"
    actions={<Button data-tour="invoice-receipt-confirm" disabled={!data || review.isFetching || confirmation.isPending || !!review.error} onClick={() => confirmation.mutate()}>
      {confirmation.isPending ? t('common:saving') : t(data?.action === 'RECEIVE' ? 'invoices.receipt.confirmReceive' : 'invoices.receipt.confirmPrepare')}
    </Button>}>
    <div className="mx-auto w-full max-w-4xl p-6 space-y-5">
      <p className="text-sm text-muted-foreground">{t(data?.action === 'RECEIVE' ? 'invoices.receipt.receiveHint' : 'invoices.receipt.prepareHint')}</p>
      {!!invoice.iepsCents && <label className="flex items-center gap-3 rounded-xl border border-input bg-card p-4" data-tour="invoice-include-ieps">
        <input type="checkbox" checked={includeIeps} disabled={!!invoice.inventoryPreparedAt || confirmation.isPending} onChange={e => setIncludeIeps(e.target.checked)} />
        <span>{t('invoices.receipt.includeIeps')}</span>
      </label>}
      {review.isLoading && <p>{t('common:loading')}</p>}
      {error && <p role="alert" className="text-destructive">{error.response?.data?.message || t('invoices.receipt.loadError')}</p>}
      {data && <>
        <section className="rounded-2xl border border-input bg-card p-5" data-tour="invoice-receipt-totals">
          <p className="font-medium">{data.supplier}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div><dt className="text-muted-foreground">{t('invoices.receipt.costTotal')}</dt><dd className="font-medium">{Currency(Number(data.subtotal))}</dd></div>
            <div><dt className="text-muted-foreground">{t('invoices.receipt.ivaExcluded')}</dt><dd>{Currency(Number(data.iva))}</dd></div>
            <div><dt className="text-muted-foreground">{t('invoices.receipt.invoiceTotal')}</dt><dd>{Currency(Number(data.total))}</dd></div>
          </dl>
        </section>
        <ul className="space-y-3" data-tour="invoice-receipt-lines">{data.lines.map(line => <li key={line.lineId} className="rounded-xl border border-input bg-card p-5 space-y-2">
          <p className="font-medium">{line.name}</p>
          <p className="text-sm">{line.quantity} {line.presentationName || getShortLabel(line.unit)} → {line.baseQuantity} {getShortLabel(line.baseUnit)}</p>
          <p className="text-sm text-muted-foreground">{t('invoices.receipt.costLine', { cost: Currency(Number(line.costAmount)), unitCost: Number(line.baseUnitCost).toLocaleString(getIntlLocale(), { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 4 }), unit: getShortLabel(line.baseUnit) })}</p>
        </li>)}</ul>
      </>}
    </div>
  </FullScreenModal>
}
