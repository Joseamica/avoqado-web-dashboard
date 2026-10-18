import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { InboxOrder } from '@/types/onlineOrdering'

const MINUTES = [10, 15, 20, 30]

/** Un toque: el tiempo elegido acepta el pedido (la cocina no debe confirmar dos veces). */
export function AcceptDialog({ order, onClose, onAccept }: { order: InboxOrder; onClose: () => void; onAccept: (minutes: number) => void }) {
  const { t } = useTranslation('onlineOrdering')
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('inbox.accept.title', { number: order.orderNumber })}</DialogTitle>
          <DialogDescription>{t('inbox.accept.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {MINUTES.map(m => (
            <Button key={m} variant="outline" className="h-14 text-base" onClick={() => onAccept(m)}>
              {t('inbox.accept.minutes', { minutes: m })}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
