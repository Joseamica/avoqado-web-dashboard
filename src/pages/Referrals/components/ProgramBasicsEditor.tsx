import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import referralsService from '@/services/referrals.service'
import type { UpdateReferralConfigRequest } from '@/types/referrals'

/**
 * Premio al referido y vigencia del cupón, editables con el programa activo o en pausa (D28, hz:be99f328:D28). Dentro de
 * lo que acepta `UpdateReferralConfigSchema` del SERVIDOR, y un poco más estrecho donde la caja no aguanta lo que el
 * SERVIDOR deja pasar: el premio es entero de 0 a 100 (ANDROID y TPV leen `discountPercent` como entero) y la vigencia, de
 * 1 a 3650 días (con más, la fecha del cupón sale inválida al emitirlo). Sólo se manda lo que cambió.
 */
const MAX_EXPIRY_DAYS = 3650

/** ¿La persona cambió el valor? Por número, no por texto: «12.0» sobre «12» no es un cambio (Codex r3 #7). */
function touched(now: string, opened: string): boolean {
  const a = now.trim()
  if (a === opened) return false
  return !(a !== '' && opened !== '' && Number(a) === Number(opened))
}
export default function ProgramBasicsEditor({
  venueId,
  initialDiscountPercent,
  initialExpiryDays,
  onClose,
}: {
  venueId: string
  /** Prisma `Decimal` llega como texto («12»). */
  initialDiscountPercent: number | string | undefined
  initialExpiryDays: number | undefined
  onClose: () => void
}) {
  const { t } = useTranslation('referrals')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Lo que había al ABRIR la ventana. Se compara contra esto, no contra las props: si otra persona guarda mientras la
  // ventana está abierta, lo que esta persona no tocó no se manda (ni se valida: un valor viejo fuera de rango no frena
  // cambiar el otro campo). Codex r2 #3 y #4.
  const [opened] = useState(() => ({
    discount: initialDiscountPercent != null ? String(Number(initialDiscountPercent)) : '',
    expiry: initialExpiryDays != null ? String(initialExpiryDays) : '',
  }))
  const [discount, setDiscount] = useState(opened.discount)
  const [expiry, setExpiry] = useState(opened.expiry)
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    // Sin red se INTENTA y falla con su aviso; con el modo por defecto se quedaba «en espera» y la ventana sin salida
    // (no se cierra mientras guarda). Codex r5 #5.
    networkMode: 'always',
    mutationFn: (patch: UpdateReferralConfigRequest) => referralsService.updateConfig(venueId, patch),
    onSuccess: () => {
      toast({ title: t('basicsEditor.success') })
      queryClient.invalidateQueries({ queryKey: ['referrals-config', venueId] })
      onClose()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.response?.data?.error || t('basicsEditor.error')
      setFormError(message)
      toast({ title: tCommon('common.error'), description: message, variant: 'destructive' })
    },
  })

  const handleSubmit = () => {
    setFormError(null)
    const patch: UpdateReferralConfigRequest = {}

    if (touched(discount, opened.discount)) {
      const discountNum = discount.trim() === '' ? NaN : Number(discount)
      if (!Number.isInteger(discountNum) || discountNum < 0 || discountNum > 100) {
        setFormError(t('basicsEditor.errors.discount'))
        return
      }
      patch.newCustomerDiscountPercent = discountNum
    }
    if (touched(expiry, opened.expiry)) {
      const expiryNum = expiry.trim() === '' ? NaN : Number(expiry)
      if (!Number.isInteger(expiryNum) || expiryNum < 1 || expiryNum > MAX_EXPIRY_DAYS) {
        setFormError(t('basicsEditor.errors.expiry'))
        return
      }
      patch.rewardCouponExpiryDays = expiryNum
    }

    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    mutation.mutate(patch)
  }

  return (
    // Mientras guarda no se cierra: el guardado viejo cerraba la ventana que se volviera a abrir (Codex r4 #3).
    <Dialog open onOpenChange={open => !open && !mutation.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('basicsEditor.title')}</DialogTitle>
          <DialogDescription>{t('basicsEditor.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="basicsDiscount" className="text-xs font-medium">
              {t('activate.newCustomerDiscount')}
            </Label>
            <div className="relative max-w-[160px]">
              <Input
                id="basicsDiscount"
                type="number"
                min={0}
                max={100}
                step={1}
                className="h-9 pr-8"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                disabled={mutation.isPending}
              />
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs text-muted-foreground">%</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t('basicsEditor.discountHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="basicsExpiry" className="text-xs font-medium">
              {t('activate.tierExpiry')}
            </Label>
            <Input
              id="basicsExpiry"
              type="number"
              min={1}
              max={MAX_EXPIRY_DAYS}
              step={1}
              className="h-9 max-w-[160px]"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              disabled={mutation.isPending}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t('basicsEditor.expiryHint')}</p>
          </div>

          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {tCommon('common.cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? t('basicsEditor.saving') : t('basicsEditor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
