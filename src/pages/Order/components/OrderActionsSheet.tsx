import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import type { Order } from '@/types'
import { Currency } from '@/utils/currency'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

interface Props {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  fullBasePath: string
}

type View = 'menu' | 'select-for-view' | 'select-for-receipt' | 'send-receipt'

export function OrderActionsSheet({ order, open, onOpenChange, fullBasePath }: Props) {
  const { t } = useTranslation('orders')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('menu')
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [email, setEmail] = useState(order.customerEmail ?? '')

  const payments = order.payments ?? []
  const hasOne = payments.length === 1
  const reset = () => {
    setView('menu')
    setSelectedPaymentId(null)
    setEmail(order.customerEmail ?? '')
  }

  const sendMutation = useMutation({
    mutationFn: async ({ paymentId, recipientEmail }: { paymentId: string; recipientEmail: string }) => {
      return api.post(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/send-receipt`, { recipientEmail })
    },
    onSuccess: () => {
      toast({ title: t('drawer.toast.receiptSent', { defaultValue: 'Recibo enviado' }) })
      onOpenChange(false)
      reset()
    },
    onError: () => {
      toast({
        title: t('drawer.toast.receiptError', { defaultValue: 'No se pudo enviar el recibo' }),
        variant: 'destructive',
      })
    },
  })

  const goToTransaction = (paymentId: string) => {
    navigate(`${fullBasePath}/payments/${paymentId}`)
    onOpenChange(false)
    reset()
  }

  const handleViewTransaction = () => {
    if (hasOne) goToTransaction(payments[0].id)
    else setView('select-for-view')
  }
  const handleSendReceipt = () => {
    if (hasOne) {
      setSelectedPaymentId(payments[0].id)
      setView('send-receipt')
    } else setView('select-for-receipt')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {view === 'menu' && t('drawer.actions.title', { defaultValue: 'Acciones' })}
            {(view === 'select-for-view' || view === 'select-for-receipt') && t('drawer.actions.selectPayment')}
            {view === 'send-receipt' && t('drawer.actions.sendReceipt')}
          </DialogTitle>
        </DialogHeader>

        {view === 'menu' && (
          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full justify-center h-12 rounded-full"
              onClick={handleViewTransaction}
              disabled={payments.length === 0}
            >
              {t('drawer.actions.viewTransaction')}
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-center h-12 rounded-full"
              onClick={handleSendReceipt}
              disabled={payments.length === 0}
            >
              {t('drawer.actions.sendReceipt')}
            </Button>
          </div>
        )}

        {(view === 'select-for-view' || view === 'select-for-receipt') && (
          <div className="space-y-2">
            {payments.map(p => (
              <Button
                key={p.id}
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  if (view === 'select-for-view') goToTransaction(p.id)
                  else {
                    setSelectedPaymentId(p.id)
                    setView('send-receipt')
                  }
                }}
              >
                <span>{(p as any).cardBrand || (p as any).method}</span>
                <span>{Currency(Number((p as any).amount) + Number((p as any).tipAmount))}</span>
              </Button>
            ))}
          </div>
        )}

        {view === 'send-receipt' && selectedPaymentId && (
          <div className="space-y-3">
            <Label htmlFor="recipient-email">{t('drawer.details.email')}</Label>
            <Input
              id="recipient-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
            <Button
              className="w-full"
              disabled={!email || sendMutation.isPending}
              onClick={() => sendMutation.mutate({ paymentId: selectedPaymentId, recipientEmail: email })}
            >
              {sendMutation.isPending ? '...' : t('drawer.actions.sendReceipt')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
