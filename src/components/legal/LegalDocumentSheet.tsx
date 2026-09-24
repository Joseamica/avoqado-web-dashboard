/**
 * La hoja con el texto legal que se abre desde el enlace junto a la casilla del consentimiento.
 *
 * 🔴 SIN scroll forzado, a propósito (§4.1): el alta corta pide una casilla y ofrece el texto;
 * obligar a recorrer 4,000 palabras antes de poder marcarla no hace que nadie las lea, solo mete
 * fricción en el primer minuto del producto.
 */
import { useTranslation } from 'react-i18next'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PrivacyDocument, TermsDocument } from './LegalDocumentContent'

export type LegalDocumentId = 'terms' | 'privacy'

interface LegalDocumentSheetProps {
  open: boolean
  document: LegalDocumentId
  onOpenChange: (open: boolean) => void
}

export function LegalDocumentSheet({ open, document, onOpenChange }: LegalDocumentSheetProps) {
  const { t } = useTranslation('setup')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {document === 'terms'
              ? t('consent.termsTitle', { defaultValue: 'Términos y Condiciones' })
              : t('consent.privacyTitle', { defaultValue: 'Aviso de Privacidad' })}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1 text-sm leading-relaxed text-muted-foreground">
          {document === 'terms' ? <TermsDocument /> : <PrivacyDocument />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
