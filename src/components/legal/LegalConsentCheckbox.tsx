/**
 * La casilla «Acepto Términos y Aviso de Privacidad», con sus dos enlaces a la hoja del texto.
 *
 * Se usa en el registro (paso 1) y en la pantalla de consentimiento del asistente corto (1b): es
 * literalmente la misma casilla, y tenerla una sola vez evita que una de las dos se quede con un
 * texto viejo.
 */
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { LegalDocumentSheet, type LegalDocumentId } from './LegalDocumentSheet'

interface LegalConsentCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  disabled?: boolean
}

export function LegalConsentCheckbox({ checked, onCheckedChange, id = 'legal-consent', disabled }: LegalConsentCheckboxProps) {
  const { t } = useTranslation('setup')
  const [documento, setDocumento] = useState<LegalDocumentId | null>(null)

  const enlace = (doc: LegalDocumentId, texto: string) => (
    <button
      type="button"
      className="underline underline-offset-4 hover:text-foreground"
      onClick={() => setDocumento(doc)}
      data-tour={doc === 'terms' ? 'legal-terms-link' : 'legal-privacy-link'}
    >
      {texto}
    </button>
  )

  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={v => onCheckedChange(v === true)} data-tour="legal-consent" />
      <Label htmlFor={id} className="text-sm font-normal leading-relaxed text-muted-foreground cursor-pointer">
        <Trans
          i18nKey="consent.checkbox"
          ns="setup"
          defaults="Acepto los <terms>Términos y Condiciones</terms> y el <privacy>Aviso de Privacidad</privacy>"
          components={{
            terms: enlace('terms', t('consent.termsTitle', { defaultValue: 'Términos y Condiciones' })),
            privacy: enlace('privacy', t('consent.privacyTitle', { defaultValue: 'Aviso de Privacidad' })),
          }}
        />
      </Label>
      <LegalDocumentSheet open={documento !== null} document={documento ?? 'terms'} onOpenChange={abierto => !abierto && setDocumento(null)} />
    </div>
  )
}
