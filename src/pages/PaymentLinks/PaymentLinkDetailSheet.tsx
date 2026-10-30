import { useQuery } from '@tanstack/react-query'
import { Copy, Pencil, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import paymentLinkService, { type PaymentLink } from '@/services/paymentLink.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'

import { etiquetaDelEstado, varianteDelEstado } from './paymentLinkStatus'

type Props = {
  link: PaymentLink
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (linkId: string) => void
  onCopy: (shortCode: string) => void
}

/**
 * Detalle de una liga: su estado («Pagada» si es de un solo uso y ya se cobró) y sus pagos, cada uno con «Ver recibo»,
 * que lleva al detalle del pago (ahí vive su recibo, se ve y se reenvía). Founder, 28-oct.
 */
export function PaymentLinkDetailSheet({ link, open, onOpenChange, onEdit, onCopy }: Props) {
  const { t, i18n } = useTranslation('paymentLinks')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const navigate = useNavigate()
  const { formatDateTime } = useVenueDateTime()

  const detalle = useQuery({
    queryKey: ['payment-link', venueId, link.id],
    queryFn: () => paymentLinkService.getPaymentLink(venueId, link.id),
    enabled: open,
  })
  const pagos = detalle.data?.data.completedPayments ?? []
  const totalDePagos = detalle.data?.data.completedPaymentsTotal ?? pagos.length

  const precio = (monto: number) =>
    new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: link.currency }).format(Number(monto))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-2 border-b border-border p-6 text-left">
          <div className="flex items-start justify-between gap-3 pr-6">
            <SheetTitle className="text-lg">{link.title}</SheetTitle>
            <Badge variant={varianteDelEstado(link)}>{t(etiquetaDelEstado(link))}</Badge>
          </div>
          {link.description && <SheetDescription>{link.description}</SheetDescription>}
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('list.columns.amount')}</dt>
              <dd className="font-medium">{link.amountType === 'FIXED' && link.amount ? precio(link.amount) : t('list.openAmount')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('list.columns.totalCollected')}</dt>
              <dd className="font-medium">{precio(link.totalCollected)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('list.columns.payments')}</dt>
              <dd className="font-medium">{link.paymentCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('list.columns.lastPaidAt')}</dt>
              <dd className="font-medium">{link.lastPaidAt ? formatDateTime(link.lastPaidAt) : '—'}</dd>
            </div>
          </dl>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">{t('detail.paymentsTitle')}</h3>
            {detalle.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : detalle.isError ? (
              <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
                <p className="text-muted-foreground">{t('detail.loadError')}</p>
                <Button size="sm" variant="outline" onClick={() => detalle.refetch()}>
                  {t('detail.retry')}
                </Button>
              </div>
            ) : pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('detail.noPayments')}</p>
            ) : (
              <>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {pagos.map(pago => (
                    <li key={pago.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{precio(pago.amount)}</p>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {pago.completedAt ? formatDateTime(pago.completedAt) : '—'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!pago.paymentId}
                        onClick={() => pago.paymentId && navigate(`${fullBasePath}/payments/${pago.paymentId}`)}
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        {t('detail.viewReceipt')}
                      </Button>
                    </li>
                  ))}
                </ul>
                {totalDePagos > pagos.length && (
                  <p className="text-xs text-muted-foreground">{t('detail.shownOf', { shown: pagos.length, total: totalDePagos })}</p>
                )}
              </>
            )}
          </section>
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border p-4 sm:justify-start">
          {/* Una liga archivada ya no se edita (el servidor lo rechaza). */}
          {link.status !== 'ARCHIVED' && can('payment-link:create') && (
            <Button onClick={() => onEdit(link.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('detail.edit')}
            </Button>
          )}
          <Button variant="outline" onClick={() => onCopy(link.shortCode)}>
            <Copy className="mr-2 h-4 w-4" />
            {t('share.copyLink')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
