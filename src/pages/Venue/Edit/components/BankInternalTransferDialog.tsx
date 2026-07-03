/**
 * BankInternalTransferDialog — traspaso interno MG→MG desde una cuenta conectada.
 * MUEVE DINERO: formulario → confirmación explícita → envío. El botón se deshabilita
 * mientras se envía (mitiga doble-envío: el proveedor no soporta idempotencia).
 */
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Currency } from '@/utils/currency'
import { financialConnectionAPI, type FinancialAccountSummary, type InternalTransferResult } from '@/services/financialConnection.service'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  account: FinancialAccountSummary
}

type Phase = 'form' | 'confirm' | 'done'

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { data?: { message?: string }; message?: string } } }
  return e?.response?.data?.data?.message ?? e?.response?.data?.message ?? fallback
}

export function BankInternalTransferDialog({ open, onClose, venueId, account }: Props) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState<Phase>('form')
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('1')
  const [concept, setConcept] = useState('')
  const [result, setResult] = useState<InternalTransferResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [destName, setDestName] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const amountNum = Number(amount)
  // Destino: 4-6 dígitos (paridad con la validación de cuenta interna del dashboard de producción).
  const canReview = /^\d{4,6}$/.test(destination.trim()) && Number.isFinite(amountNum) && amountNum > 0

  // Antes de confirmar, resolvemos el número destino a su NOMBRE de beneficiario: el usuario
  // confirma un nombre, no solo un número (un dígito mal tecleado se cacha a simple vista).
  const resolve = useMutation({
    mutationFn: () => financialConnectionAPI.resolveTransferDestination(venueId, account.id, destination.trim()),
    onSuccess: d => {
      setDestName(d.name)
      setResolveError(null)
      setPhase('confirm')
    },
    onError: err => {
      const status = (err as { response?: { status?: number } })?.response?.status
      setResolveError(status === 404 ? t('transfer.destinationNotFound') : errorMessage(err, t('transfer.destinationError')))
    },
  })

  const send = useMutation({
    mutationFn: () =>
      financialConnectionAPI.internalTransfer(venueId, account.id, {
        destinationAccount: destination.trim(),
        amount: amountNum,
        concept: concept.trim(),
      }),
    onSuccess: r => {
      setResult(r)
      setError(null)
      setPhase('done')
      queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] })
    },
    onError: err => {
      setError(errorMessage(err, t('transfer.errorTitle')))
      setPhase('done')
    },
  })

  const reset = () => {
    setPhase('form')
    setDestination('')
    setAmount('1')
    setConcept('')
    setResult(null)
    setError(null)
    setDestName(null)
    setResolveError(null)
  }
  const handleClose = () => {
    if (send.isPending) return
    reset()
    onClose()
  }

  const amountLabel = useMemo(() => (Number.isFinite(amountNum) ? Currency(amountNum) : '—'), [amountNum])

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-muted-foreground" aria-hidden />
            {t('transfer.title')}
          </DialogTitle>
          <DialogDescription>{t('transfer.description', { label: account.label ?? account.externalId })}</DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              if (canReview && !resolve.isPending) resolve.mutate()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="tr-dest">{t('transfer.destination')}</Label>
              <Input
                id="tr-dest"
                inputMode="numeric"
                autoFocus
                value={destination}
                onChange={e => {
                  setDestination(e.target.value.replace(/\D/g, ''))
                  if (resolveError) setResolveError(null)
                }}
              />
              {resolveError && <p className="text-xs text-destructive">{resolveError}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tr-amount">{t('transfer.amount')}</Label>
              <Input id="tr-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tr-concept">{t('transfer.concept')}</Label>
              <Input id="tr-concept" value={concept} maxLength={40} placeholder={t('transfer.conceptPlaceholder')} onChange={e => setConcept(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!canReview || resolve.isPending}>
                {resolve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {resolve.isPending ? t('transfer.resolving') : t('transfer.review')}
              </Button>
            </DialogFooter>
          </form>
        )}

        {phase === 'confirm' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t('transfer.confirmLead')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{amountLabel}</p>
              <p className="mt-3 text-base font-medium">{destName ?? t('transfer.unnamedAccount')}</p>
              <p className="text-xs text-muted-foreground">{t('transfer.accountLabel', { account: destination })}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t('transfer.irreversibleWarning')}</p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" disabled={send.isPending} onClick={() => setPhase('form')}>
                {t('transfer.cancel')}
              </Button>
              <Button disabled={send.isPending} onClick={() => send.mutate()}>
                {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {send.isPending ? t('transfer.sending') : t('transfer.send')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            {error || (result && !result.ok) ? (
              <>
                <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
                <p className="font-medium">{t('transfer.errorTitle')}</p>
                <p className="text-sm text-muted-foreground">{error ?? result?.message}</p>
                <p className="text-xs text-muted-foreground">{t('transfer.errorHint')}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <p className="font-medium">{t('transfer.successTitle')}</p>
                {result?.movementId && <p className="text-sm text-muted-foreground">{t('transfer.successBody', { id: result.movementId })}</p>}
              </>
            )}
            <DialogFooter className="w-full">
              <Button className="w-full" onClick={handleClose}>
                {t('transfer.close')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
