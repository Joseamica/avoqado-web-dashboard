import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
 * Nunca tocan inventario ni costos.
 */

export function StandaloneInvoicesSection({ venueId }: { venueId: string }) {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isReading, setIsReading] = useState(false)

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['supplier-invoices', venueId, 'no-order'],
    queryFn: () => purchaseOrderInvoiceService.listAll(venueId, { onlyNoOrder: true }),
    enabled: !!venueId,
  })

  const register = useMutation({
    mutationFn: (xml: string) => purchaseOrderInvoiceService.registerStandalone(venueId, xml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices', venueId] })
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
                {invoices.length}
              </Badge>
            )}
          </div>
          <PermissionGate permission="inventory:update">
            <input ref={fileInputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" className="cursor-pointer" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {busy ? t('invoices.uploading') : t('invoices.standalone.upload')}
            </Button>
          </PermissionGate>
        </div>

        <p className="text-xs text-muted-foreground">{t('invoices.standalone.hint')}</p>

        {isLoading ? (
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
      </CardContent>
    </Card>
  )
}
