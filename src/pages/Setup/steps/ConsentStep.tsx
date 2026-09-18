/**
 * Momento 1b — la casilla del consentimiento, cuando el alta ya existía sin él.
 *
 * El registro (paso 1) ya la pide. Esta pantalla solo aparece cuando el SERVIDOR dice
 * `legal.consentRequired` — porque la cuenta nació antes de que existiera la versión actual, o
 * porque el dashboard viejo mandó una fecha en vez de una versión (§4.1).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { LegalConsentCheckbox } from '@/components/legal/LegalConsentCheckbox'

interface ConsentStepProps {
  onAccept: () => Promise<void> | void
  saving?: boolean
}

export function ConsentStep({ onAccept, saving }: ConsentStepProps) {
  const { t } = useTranslation('setup')
  const [aceptado, setAceptado] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('consent.title', { defaultValue: 'Antes de empezar' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('consent.subtitle', { defaultValue: 'Necesitamos tu confirmación para crear tu negocio en Avoqado.' })}
        </p>
      </div>

      <LegalConsentCheckbox id="setupConsent" checked={aceptado} onCheckedChange={setAceptado} disabled={saving} />

      <Button className="w-full rounded-full h-12 text-base" disabled={!aceptado || saving} onClick={() => void onAccept()}>
        {t('consent.continue', { defaultValue: 'Continuar' })}
      </Button>
    </div>
  )
}
