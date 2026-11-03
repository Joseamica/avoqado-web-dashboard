import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { exchangesKeys, markExchangeReviewed, type ExchangeReviewRow } from '@/services/exchanges.service'

export function ReviewExchangeDialog({
  venueId,
  exchange,
  onClose,
}: {
  venueId: string
  exchange: ExchangeReviewRow
  onClose: () => void
}) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const client = useQueryClient()
  const sending = useRef(false)
  const [failed, setFailed] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm<{ note: string }>({
    resolver: zodResolver(z.object({ note: z.string().trim().min(3).max(500) })),
    defaultValues: { note: '' },
    mode: 'onChange',
  })
  const note = watch('note')
  const mutation = useMutation({ mutationFn: (value: string) => markExchangeReviewed(venueId, exchange.id, value), retry: false })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: exchangesKeys.all(venueId) })
    void client.invalidateQueries({ queryKey: ['exchange', venueId, exchange.id] })
    for (const id of [exchange.originalPaymentId, exchange.chargePaymentId]) {
      if (id) void client.invalidateQueries({ queryKey: ['payment', id] })
    }
    for (const id of [exchange.originalOrderId, exchange.newOrderId]) {
      void client.invalidateQueries({ queryKey: ['order', venueId, id] })
    }
    // Other payments of these orders may already have an open/cached drawer.
    void client.invalidateQueries({
      queryKey: ['payment'],
      predicate: query => {
        const payment = query.state.data as { orderId?: string } | undefined
        return payment?.orderId === exchange.originalOrderId || payment?.orderId === exchange.newOrderId
      },
    })
  }
  const submit = handleSubmit(async ({ note: value }) => {
    if (sending.current) return
    sending.current = true
    setFailed(false)
    try {
      await mutation.mutateAsync(value)
      toast({ title: t('refunds.exchangesToReview.reviewed') })
      refresh()
      onClose()
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: { code?: string } } })?.response
      const code = response?.data?.code
      if (response?.status === 409 && (code === 'EXCHANGE_ALREADY_REVIEWED' || code === 'EXCHANGE_NOT_IN_REVIEW')) {
        toast({
          title: t(
            code === 'EXCHANGE_ALREADY_REVIEWED' ? 'refunds.exchangesToReview.alreadyReviewed' : 'refunds.exchangesToReview.notInReview',
          ),
        })
        refresh()
        onClose()
      } else {
        setFailed(true)
      }
    } finally {
      sending.current = false
    }
  })
  const close = () => {
    if (!sending.current) onClose()
  }

  return (
    <AlertDialog
      open
      onOpenChange={open => {
        if (!open) close()
      }}
    >
      <AlertDialogContent
        data-tour="exchange-review-dialog"
        onEscapeKeyDown={event => {
          if (sending.current) event.preventDefault()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t('refunds.exchangesToReview.markReviewed')}</AlertDialogTitle>
          <AlertDialogDescription>{t('refunds.exchangesToReview.noteHelp')}</AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={submit}>
          <fieldset disabled={mutation.isPending} className="space-y-3" data-tour="exchange-review-note-section">
            <Label htmlFor="exchange-review-note">{t('refunds.exchangesToReview.note')}</Label>
            <Textarea
              id="exchange-review-note"
              data-tour="exchange-review-note"
              aria-describedby="exchange-review-counter"
              {...register('note')}
            />
            <p id="exchange-review-counter" className="text-sm text-muted-foreground">
              {t('refunds.exchangesToReview.counter', { count: note.trim().length })}
            </p>
            {failed && (
              <p role="alert" className="text-destructive">
                {t('refunds.exchangesToReview.saveError')}
              </p>
            )}
          </fieldset>
          <AlertDialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={close} disabled={mutation.isPending}>
              {t('refunds.exchangesToReview.cancel')}
            </Button>
            <Button type="submit" data-tour="exchange-review-submit" disabled={!isValid || mutation.isPending}>
              {t(mutation.isPending ? 'refunds.exchangesToReview.saving' : 'refunds.exchangesToReview.markReviewed')}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
