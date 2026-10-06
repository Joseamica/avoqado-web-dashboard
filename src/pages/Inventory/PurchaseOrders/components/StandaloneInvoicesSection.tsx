import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useAccess } from '@/hooks/use-access'
import { useDebounce } from '@/hooks/useDebounce'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { purchaseOrderInvoiceService } from '@/services/purchaseOrderInvoice.service'
import { InvoiceRow } from './InvoiceSection'

/**
 * Fase 2 — las facturas que llegaron SIN orden de compra. Se registran como evidencia, los
 * códigos aprendidos identifican lo conocido, y lo nuevo lo confirma una persona una vez.
 * La carga sólo guarda evidencia; preparar y recibir requieren confirmaciones separadas.
 */

export function StandaloneInvoicesSection({ venueId }: { venueId: string }) {
  const { hasAccess: inventory } = useTierFeatureAccess('INVENTORY_TRACKING')
  const { hasAccess: cfdi } = useTierFeatureAccess('CFDI')
  const { can } = useAccess()
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { formatCalendarDate: formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isReading, setIsReading] = useState(false)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search, 300)
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['supplier-invoice-inbox', venueId, page, debounced],
    queryFn: () => purchaseOrderInvoiceService.inbox(venueId, page, debounced),
    placeholderData: keepPreviousData, staleTime: 30000, retry: 1, refetchOnWindowFocus: false,
    enabled: !!venueId && inventory && cfdi && can('inventory:read'),
  })

  const register = useMutation({
    mutationFn: (xml: string) => purchaseOrderInvoiceService.registerStandalone(venueId, xml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoice-inbox', venueId] })
      toast({ title: t('invoices.toasts.matchedTitle'), description: t('invoices.standalone.hint') })
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
    event.target.value = ''
    if (!file) return
    setIsReading(true)
    try {
      await register.mutateAsync(await file.text())
    } catch {
      // onError ya lo reportó
    } finally {
      setIsReading(false)
    }
  }

  const invoices = data?.rows ?? []
  const busy = isReading || register.isPending

  return (
    <Card className="border-input mt-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{t('invoices.standalone.title')}</h3>
            {invoices.length > 0 && (
              <Badge variant="secondary" className="rounded-full">
                {data?.total ?? 0}
              </Badge>
            )}
          </div>
          <PermissionGate permission="inventory:update">
            <input ref={fileInputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" className="cursor-pointer" data-tour="supplier-invoice-upload" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {busy ? t('invoices.uploading') : t('invoices.standalone.upload')}
            </Button>
          </PermissionGate>
        </div>

        <p className="text-xs text-muted-foreground">{t('invoices.standalone.hint')}</p>

        <Input aria-label={t('invoices.receipt.searchInvoices')} placeholder={t('invoices.receipt.searchInvoices')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} data-tour="supplier-invoice-search" />
        {isError ? <p role="alert">{t('invoices.receipt.loadError')}</p> : isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('invoices.standalone.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map(invoice => (
              <InvoiceRow key={invoice.id} venueId={venueId} invoice={invoice} formatDate={formatDate} t={t} />
            ))}
          </ul>
        )}
        <div className="flex justify-between items-center gap-2 text-sm">
          <span>{t('invoices.receipt.page', { page, pages: Math.max(1, data?.totalPages ?? 1), total: data?.total ?? 0 })}</span>
          <div className="flex gap-2"><Button variant="outline" disabled={page === 1 || isFetching} onClick={() => setPage(p => p - 1)}>{t('invoices.receipt.previous')}</Button>
            <Button variant="outline" disabled={!data || page >= data.totalPages || isFetching} onClick={() => setPage(p => p + 1)}>{t('invoices.receipt.next')}</Button></div>
        </div>
      </CardContent>
    </Card>
  )
}
