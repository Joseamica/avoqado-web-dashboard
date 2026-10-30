import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PaymentLink } from '@/services/paymentLink.service'
import { Currency } from '@/utils/currency'

interface Props {
  link: Pick<PaymentLink, 'discount' | 'discountStatus'>
  /** Quien puede editar ligas (`payment-link:update`) ve las acciones. */
  canUpdate: boolean
  onRemove: () => void
  onReplace: () => void
  onArchive: () => void
}

/** Etiqueta del descuento en la lista: «−15 %» si está vigente, «⚠ motivo» + acciones si no. */
export function PaymentLinkDiscountStatus({ link, canUpdate, onRemove, onReplace, onArchive }: Props) {
  const { t } = useTranslation('paymentLinks')
  const { discount, discountStatus } = link
  if (!discount || !discountStatus) return null

  if (discountStatus === 'OK') {
    const text = discount.type === 'PERCENTAGE' ? `−${Number(discount.value)} %` : `−${Currency(Number(discount.value))}`
    return (
      <Badge variant="secondary" className="mt-1 w-fit">
        {text}
      </Badge>
    )
  }

  return (
    <div className="mt-1 space-y-1">
      <Badge variant="outline" className="w-fit border-amber-500/50 text-amber-700 dark:text-amber-300">
        ⚠ {t(`discountStatus.${discountStatus}`)}
      </Badge>
      {canUpdate && (
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <Button variant="link" size="sm" className="h-auto p-0 text-xs cursor-pointer" onClick={onRemove}>
            {t('discountStatus.remove')}
          </Button>
          <span aria-hidden>·</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs cursor-pointer" onClick={onReplace}>
            {t('discountStatus.replace')}
          </Button>
          <span aria-hidden>·</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive cursor-pointer" onClick={onArchive}>
            {t('discountStatus.archive')}
          </Button>
        </div>
      )}
    </div>
  )
}
