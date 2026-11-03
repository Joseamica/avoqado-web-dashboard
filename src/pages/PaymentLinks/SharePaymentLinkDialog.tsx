import { ExternalLink, Loader2, MessageCircle, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import paymentLinkService, { type PaymentLink } from '@/services/paymentLink.service'

import { CountryCodePicker, DEFAULT_COUNTRY, type Country } from './CountryCodePicker'
import { customerPhoneNumber, parseStoredCustomerPhone } from './stored-customer-phone'

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
export function SharePaymentLinkDialog(props: Props) {
  const { user } = useAuth()
  return props.open ? <SharePaymentLinkForm key={`${props.venueId}:${user?.id}:${props.link?.id}`} {...props} /> : null
}

function SharePaymentLinkForm({ open, onOpenChange, link, venueId, checkoutBaseUrl }: Props) {
  const { t } = useTranslation('paymentLinks')
  const { toast } = useToast()

  const parsedPhone = parseStoredCustomerPhone(link?.customer?.phone)
  const [country, setCountry] = useState<Country>(parsedPhone?.country ?? DEFAULT_COUNTRY)
  const [phone, setPhone] = useState(parsedPhone?.localDigits ?? '')
  const [isSending, setIsSending] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)
  const inFlight = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const changeOpen = (next: boolean) => {
    if (!next) alive.current = false
    onOpenChange(next)
  }
  const recipient = customerPhoneNumber(phone, country)
  const isValid = !!recipient && !!link

  async function send() {
    if (!link || !isValid || inFlight.current) return
    inFlight.current = true
    setIsSending(true)
    setSendFailed(false)
    try {
      await paymentLinkService.shareViaWhatsapp(venueId, link.id, recipient)
      if (!alive.current) return
      toast({ title: t('share.sentTitle') })
      changeOpen(false)
    } catch {
      if (alive.current) setSendFailed(true)
    } finally {
      inFlight.current = false
      if (alive.current) setIsSending(false)
    }
  }

  const handleManualWhatsapp = () => {
    if (!link) return
    const url = `${checkoutBaseUrl}/${link.shortCode}`
    const message = t('share.whatsappMessage', { title: link.title, url })
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
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
          {((link?.customer?.phone && !parsedPhone) || (phone.trim() && !recipient)) && (
            <p className="text-sm text-muted-foreground">{t('customer.reviewPhone')}</p>
          )}
          <div>
            <label htmlFor="pl-share-phone" className="text-sm font-medium text-foreground/80">
              {t('share.phoneLabel', { defaultValue: 'Teléfono del cliente' })}
            </label>
            <div className="mt-1.5 flex gap-2 items-stretch">
              <CountryCodePicker value={country} onChange={setCountry} disabled={isSending} />
              <Input
                id="pl-share-phone"
                data-tour="payment-link-share-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="55 1234 5678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={isSending}
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

        {sendFailed && (
          <p role="alert" className="text-sm text-destructive">
            {t('share.sendFailed')}
          </p>
        )}

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
          <Button type="button" data-tour="payment-link-share-send" onClick={send} disabled={!isValid || isSending}>
            {isSending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
            {isSending ? t('share.sending', { defaultValue: 'Enviando…' }) : t('share.sendButton', { defaultValue: 'Enviar liga' })}
          </Button>
        </DialogFooter>

        {/* Tiny visual hint that this goes through WhatsApp Business API. */}
        <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground border-t border-border/40 -mb-1 mt-1">
          <MessageCircle className="h-3 w-3 text-emerald-600" />
          <span>{t('share.poweredBy', { defaultValue: 'Mensaje enviado vía WhatsApp Business · Plantilla aprobada por Meta' })}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
