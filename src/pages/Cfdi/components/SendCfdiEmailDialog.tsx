import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSendCfdiEmail } from '@/hooks/use-cfdi'
import type { Cfdi } from '@/services/cfdi.service'

interface SendCfdiEmailDialogProps {
  /** Con una factura, el diálogo se abre para ella. Null = cerrado. */
  cfdi: Cfdi | null
  onOpenChange: (open: boolean) => void
}

/**
 * Reenvía por correo una factura timbrada (H24, auditoría 2026-09-30). Sin correo nuevo va al que dio el cliente al facturar;
 * con uno nuevo, a ése (el cliente escribió mal el suyo).
 */
export function SendCfdiEmailDialog({ cfdi, onOpenChange }: SendCfdiEmailDialogProps) {
  const { t } = useTranslation('cfdi')
  const sendMutation = useSendCfdiEmail()
  const [email, setEmail] = useState('')

  // Cada factura que se abre empieza con el campo vacío.
  useEffect(() => {
    if (cfdi) setEmail('')
  }, [cfdi])

  if (!cfdi) return null

  const folio = [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || cfdi.uuid || ''

  // Un formulario: Enter envía y el navegador valida el correo antes de llamar al servidor.
  const handleSend = (e: FormEvent) => {
    e.preventDefault()
    sendMutation.mutate({ cfdiId: cfdi.id, email: email.trim() || undefined }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <AlertDialog open={!!cfdi} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('sendEmailDialog.title', { folio })}</AlertDialogTitle>
          <AlertDialogDescription>{t('sendEmailDialog.description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-2 py-2">
            <Label htmlFor="cfdi-send-email">{t('sendEmailDialog.emailLabel')}</Label>
            <Input
              id="cfdi-send-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('sendEmailDialog.emailPlaceholder')}
              data-tour="cfdi-send-email-input"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={sendMutation.isPending}>
              {t('sendEmailDialog.cancel')}
            </AlertDialogCancel>
            <Button type="submit" disabled={sendMutation.isPending} data-tour="cfdi-send-email-submit">
              {sendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('sendEmailDialog.submit')}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
