/**
 * Momento 2 — lo mínimo del negocio: cómo se llama y un teléfono.
 *
 * 🔴 La DIRECCIÓN ya no se pide aquí (§4.1): se captura en «Activar cobros», donde es obligatoria.
 * Aquí solo va lo que el producto necesita para existir: sin nombre no hay local provisional, y sin
 * local provisional no hay tarjeta ni cobro.
 *
 * 🔴 El teléfono es obligatorio desde el 30-oct (founder, «A»): el registro directo sólo pide correo, así que sin él
 * ventas no puede escribirle a quien se queda en «Elige tu plan». Se pide aquí y no en el registro para no frenar el
 * primer paso, y porque aquí también pasa quien entra con Google. Es el teléfono del NEGOCIO (`Venue.phone`).
 * Lleva lada, México (+52) por default, y se guarda como E.164 (`+525512345678`), igual que el resto del panel.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PhoneInput } from '@/components/phone-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DEFAULT_COUNTRY, parsePhoneInput } from '@/pages/PaymentLinks/CountryCodePicker'
import type { SetupData } from '../types'

interface BusinessBasicsStepProps {
  data: SetupData
  onNext: (stepData: { businessName: string; phone: string }) => Promise<void> | void
  saving?: boolean
}

/** El teléfono sugerido por la landing llega sin lada («5512345678»): se le pone la de México. */
function conLada(valor: string): string {
  const digitos = valor.replace(/\D/g, '')
  if (!digitos || valor.trim().startsWith('+')) return valor.trim()
  return `+${DEFAULT_COUNTRY.dial}${digitos}`
}

/** Un teléfono capturado a medias no sirve para llamar a nadie. Se cuentan los dígitos SIN la lada. */
function telefonoValido(e164: string): boolean {
  return (parsePhoneInput(e164)?.localDigits ?? e164.replace(/\D/g, '')).length >= 8
}

export function BusinessBasicsStep({ data, onNext, saving }: BusinessBasicsStepProps) {
  const { t } = useTranslation('setup')
  const [businessName, setBusinessName] = useState(data.businessName ?? '')
  const [phone, setPhone] = useState(() => conLada(data.phone ?? ''))
  const [errores, setErrores] = useState<{ businessName?: string; phone?: string }>({})

  const continuar = () => {
    const nuevos: { businessName?: string; phone?: string } = {}
    if (!businessName.trim()) nuevos.businessName = t('basics.nameRequired', { defaultValue: 'Escribe el nombre de tu negocio' })
    if (!phone.trim()) nuevos.phone = t('basics.phoneRequired', { defaultValue: 'Escribe un teléfono para que podamos ayudarte a empezar' })
    else if (!telefonoValido(phone)) nuevos.phone = t('basics.phoneInvalid', { defaultValue: 'El teléfono necesita al menos 8 dígitos' })
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return
    void onNext({ businessName: businessName.trim(), phone: phone.trim() })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('basics.title', { defaultValue: 'Tu negocio' })}</h1>
        <p className="text-sm text-muted-foreground">
          {t('basics.subtitle', { defaultValue: 'Con esto ya puedes empezar. Lo demás se completa después.' })}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="businessName">{t('basics.nameLabel', { defaultValue: 'Nombre del negocio' })}</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            disabled={saving}
            data-tour="setup-business-name"
            className={cn('rounded-lg h-12 text-base', errores.businessName && 'border-destructive')}
          />
          {errores.businessName && <p className="text-xs text-destructive">{errores.businessName}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="businessPhone">
            {t('basics.phoneLabel', { defaultValue: 'Teléfono del negocio' })}
          </Label>
          {/* La altura se iguala al nombre desde aquí, sin tocar el `PhoneInput` que comparten otras pantallas. */}
          <PhoneInput
            id="businessPhone"
            value={phone}
            onChange={setPhone}
            disabled={saving}
            invalid={!!errores.phone}
            className="[&>button]:h-12 [&>button]:rounded-lg [&_input]:h-12 [&_input]:rounded-lg [&_input]:text-base"
          />
          {errores.phone && <p className="text-xs text-destructive">{errores.phone}</p>}
        </div>
      </div>

      <Button className="w-full rounded-full h-12 text-base" disabled={saving} onClick={continuar}>
        {t('basics.continue', { defaultValue: 'Continuar' })}
      </Button>
    </div>
  )
}
