import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { changeStoreCreditPhone } from '@/services/giftCard.service'
import { limpiarTelefono } from '@/pages/GiftCards/giftCardText'
import type { Customer } from '@/types/customer'
import { Currency } from '@/utils/currency'

/**
 * Saldo a favor del cliente (spec 2026-10-30 §6). Sin `storeCredit` (server viejo o cliente sin sobre) no pinta nada.
 * «Cambiar» el teléfono con que se gasta el saldo es de gerente (`giftCards:manage`; el server lo vuelve a pedir) y manda SIEMPRE
 * los últimos 4 que se mostraron (`expectedPhoneLast4`): si otro gerente ya lo cambió, el server responde 409 y aquí se pide recargar.
 * `blocked` = sobre congelado: se dice «congelado» con su razón, nunca «$0».
 */
export function StoreCreditSection({
  venueId,
  customerId,
  storeCredit,
}: {
  venueId: string
  customerId: string
  storeCredit: Customer['storeCredit']
}) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { fullBasePath } = useCurrentVenue()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cambiar = useMutation({
    mutationFn: (p: { phone: string }) =>
      changeStoreCreditPhone(venueId, storeCredit!.giftCardId, { phone: p.phone, ...(storeCredit!.phoneLast4 ? { expectedPhoneLast4: storeCredit!.phoneLast4 } : {}) }),
    onSuccess: () => {
      toast({ title: t('storeCredit.changed') })
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['customer', venueId, customerId] })
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      setError(
        code === 'STORE_CREDIT_PHONE_OUTDATED'
          ? t('storeCredit.outdated')
          : code === 'STORE_CREDIT_PHONE_NOT_ALLOWED'
            ? t('storeCredit.notAllowed')
            : t('storeCredit.error'),
      )
      // Tras CUALQUIER error se relee la ficha: lo que se ve debe ser lo que hay (y el siguiente intento lleva los 4 vigentes).
      void queryClient.invalidateQueries({ queryKey: ['customer', venueId, customerId] })
    },
  })

  if (!storeCredit) return null

  const abrir = () => {
    setPhone('')
    setError(null)
    setOpen(true)
  }
  const guardar = () => {
    const limpio = limpiarTelefono(phone)
    if (!limpio) return setError(t('storeCredit.invalidPhone'))
    setError(null)
    cambiar.mutate({ phone: limpio })
  }

  return (
    <Card className="border-input" data-tour="customer-store-credit">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-sm">
            {storeCredit.blocked ? (
              <>
                <p className="font-semibold">{t('storeCredit.blocked')}</p>
                <p className="text-muted-foreground">{t('storeCredit.blockedWhy')}</p>
                {/* El server no manda la razón del bloqueo: la tarjeta de ese sobre la muestra en su detalle. */}
                <Link className="underline underline-offset-4" to={`${fullBasePath}/gift-cards?card=${storeCredit.giftCardId}`}>
                  {t('storeCredit.seeCard')}
                </Link>
              </>
            ) : (
              <p className="font-semibold">{t('storeCredit.balance', { amount: Currency(storeCredit.balanceCents, true) })}</p>
            )}
            <p className="text-muted-foreground">{t('storeCredit.phone', { last4: storeCredit.phoneLast4 })}</p>
          </div>
        </div>
        <PermissionGate permission="giftCards:manage">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={abrir}>
            {t('storeCredit.change')}
          </Button>
        </PermissionGate>
      </CardContent>
      <Dialog open={open} onOpenChange={o => !cambiar.isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('storeCredit.changeTitle')}</DialogTitle>
            <DialogDescription>{t('storeCredit.changeDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="store-credit-phone">{t('storeCredit.newPhone')}</Label>
            <Input
              id="store-credit-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="55 1234 5678"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={cambiar.isPending}>
              {t('storeCredit.cancel')}
            </Button>
            <Button onClick={guardar} disabled={cambiar.isPending}>
              {t('storeCredit.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
