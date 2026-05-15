import { useMutation } from '@tanstack/react-query'
import { ExternalLink, Loader2, MessageCircle, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import paymentLinkService, { type PaymentLink } from '@/services/paymentLink.service'

import { CountryCodePicker, DEFAULT_COUNTRY, parsePhoneInput, type Country } from './CountryCodePicker'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  link: PaymentLink | null
  venueId: string
  /** Base URL of the customer-facing checkout (env-specific). Used for the
   *  manual `wa.me` fallback button so operators can still send from their
   *  own WhatsApp account if they prefer. */
  checkoutBaseUrl: string
}

/**
 * "Compartir por WhatsApp" dialog for the payment-links list.
 *
 * Default flow: dashboard-side API send via the approved Meta `payment_link_share`
 * Utility template. The customer receives a transactional message from
 * Avoqado's WABA number with the venue name, concept, and link URL.
 *
 * Fallback flow: a secondary button opens wa.me with a pre-filled message,
 * so the operator can send from their own WhatsApp account instead — useful
 * when they're already chatting with the customer there.
 */
export function SharePaymentLinkDialog({ open, onOpenChange, link, venueId, checkoutBaseUrl }: Props) {
  const { t } = useTranslation('paymentLinks')
  const { toast } = useToast()

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [phone, setPhone] = useState('')

  // Reset on close so the next open is a clean slate. Wait for the close
  // animation by tying the reset to the `open` prop transitioning to false.
  useEffect(() => {
    if (!open) {
      setPhone('')
      setCountry(DEFAULT_COUNTRY)
    }
  }, [open])

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!link) throw new Error('No link selected')
      const localDigits = phone.replace(/\D/g, '')
      const fullPhone = `+${country.dial}${localDigits}`
      return paymentLinkService.shareViaWhatsapp(venueId, link.id, fullPhone)
    },
    onSuccess: () => {
      toast({ title: t('share.sentTitle', { defaultValue: 'Liga enviada' }) })
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast({
        title: t('share.sendFailed', { defaultValue: 'No se pudo enviar' }),
        description: err?.response?.data?.error || err?.message,
        variant: 'destructive',
      })
    },
  })

  const localDigits = phone.replace(/\D/g, '')
  const isValid = localDigits.length >= 7 && !!link

  const handleManualWhatsapp = () => {
    if (!link) return
    const url = `${checkoutBaseUrl}/${link.shortCode}`
    const message = t('share.whatsappMessage', { title: link.title, url })
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('share.dialogTitle', { defaultValue: 'Compartir por WhatsApp' })}</DialogTitle>
          <DialogDescription>
            {t('share.dialogDescription', {
              defaultValue:
                'Envía la liga de pago al WhatsApp del cliente. El mensaje sale del número de Avoqado y solo se usa para esta transacción.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground/80">
              {t('share.phoneLabel', { defaultValue: 'Teléfono del cliente' })}
            </label>
            <div className="mt-1.5 flex gap-2 items-stretch">
              <CountryCodePicker value={country} onChange={setCountry} disabled={sendMutation.isPending} />
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="55 1234 5678"
                value={phone}
                onChange={e => {
                  // Detect leading dial code from autofill / paste (e.g.
                  // "+525512345678") and remap the picker + strip the prefix
                  // so the local digits we send are unambiguous.
                  const raw = e.target.value
                  const parsed = parsePhoneInput(raw, country)
                  if (parsed) {
                    setCountry(parsed.country)
                    setPhone(parsed.localDigits)
                  } else {
                    setPhone(raw)
                  }
                }}
                disabled={sendMutation.isPending}
                className="flex-1 h-10"
                autoFocus
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('share.phoneHint', {
                defaultValue: 'El cliente debe haber dado este número expresamente para recibir la liga.',
              })}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleManualWhatsapp}
            disabled={!link}
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            {t('share.manualFallback', { defaultValue: 'Enviar desde mi WhatsApp' })}
          </Button>
          <Button type="button" onClick={() => sendMutation.mutate()} disabled={!isValid || sendMutation.isPending}>
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {sendMutation.isPending
              ? t('share.sending', { defaultValue: 'Enviando…' })
              : t('share.sendButton', { defaultValue: 'Enviar liga' })}
          </Button>
        </DialogFooter>

        {/* Tiny visual hint that this goes through WhatsApp Business API. */}
        <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground border-t border-border/40 -mb-1 mt-1">
          <MessageCircle className="h-3 w-3 text-emerald-600" />
          <span>
            {t('share.poweredBy', { defaultValue: 'Mensaje enviado vía WhatsApp Business · Plantilla aprobada por Meta' })}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
