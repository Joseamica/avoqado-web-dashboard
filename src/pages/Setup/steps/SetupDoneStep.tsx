/**
 * El cierre del alta corta. Un botón: entrar.
 *
 * 🔴 `complete` puede fallar (términos sin aceptar, cobro en curso), y su mensaje se MUESTRA: el
 * asistente largo solo lo registraba en consola y dejaba a la persona tocando un botón mudo.
 */
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface SetupDoneStepProps {
  onFinish: () => Promise<void> | void
  saving?: boolean
  error?: string | null
  businessName?: string
  /** Cómo termina la prueba de Pro, leído del servidor. Sin estos dos datos la pantalla queda como siempre. */
  trialModality?: 'RENEWS_AS_PRO' | 'ENDS_FREE'
  trialEndsAt?: string
}

export function SetupDoneStep({ onFinish, saving, error, businessName, trialModality, trialEndsAt }: SetupDoneStepProps) {
  const { t, i18n } = useTranslation('setup')
  const fin = trialEndsAt ? new Date(trialEndsAt) : null
  // El alta aún no tiene sucursal activa: la fecha va en la zona de México, como el resto del alta.
  const fecha =
    fin && !Number.isNaN(fin.getTime())
      ? new Intl.DateTimeFormat(getIntlLocale(i18n?.language), { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(
          fin,
        )
      : null

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <CheckCircle2 className="h-14 w-14 text-primary" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('done.title', { defaultValue: 'Todo listo' })}</h1>
        <p className="text-sm text-muted-foreground">
          {businessName
            ? t('done.subtitleNamed', {
                defaultValue: '{{business}} ya está en Avoqado. Entra y empieza a vender.',
                business: businessName,
              })
            : t('done.subtitle', { defaultValue: 'Tu negocio ya está en Avoqado. Entra y empieza a vender.' })}
        </p>
      </div>

      {fecha && trialModality && (
        <div className="flex flex-col gap-1 text-sm" data-testid="done-trial">
          <p>
            {trialModality === 'ENDS_FREE'
              ? t('done.trialEndsFree', {
                  defaultValue: 'Tu prueba de Pro termina el {{date}} sin cobro. Ese día podrás contratar el Básico.',
                  date: fecha,
                })
              : t('done.trialRenews', { defaultValue: 'Tu prueba de Pro se renueva como Pro el {{date}}.', date: fecha })}
          </p>
          <p className="text-muted-foreground">{t('done.trialChange', { defaultValue: 'Cámbialo en «Tu plan»' })}</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        className="w-full max-w-sm rounded-full h-12 text-base"
        disabled={saving}
        onClick={() => void onFinish()}
        data-tour="setup-done-enter"
      >
        {t('done.enter', { defaultValue: 'Entrar a Avoqado' })}
      </Button>
    </div>
  )
}
