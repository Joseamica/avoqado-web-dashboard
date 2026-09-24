/**
 * Momento 2 — lo mínimo del negocio: cómo se llama y, si quiere, un teléfono.
 *
 * 🔴 La DIRECCIÓN ya no se pide aquí (§4.1): se captura en «Activar cobros», donde es obligatoria.
 * Aquí solo va lo que el producto necesita para existir: sin nombre no hay local provisional, y sin
 * local provisional no hay tarjeta ni cobro.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { SetupData } from '../types'

interface BusinessBasicsStepProps {
  data: SetupData
  onNext: (stepData: { businessName: string; phone?: string }) => Promise<void> | void
  saving?: boolean
}

/** Un teléfono capturado a medias no sirve para llamar a nadie; vacío sí es válido. */
function telefonoValido(valor: string): boolean {
  if (!valor.trim()) return true
  return valor.replace(/\D/g, '').length >= 8
}

export function BusinessBasicsStep({ data, onNext, saving }: BusinessBasicsStepProps) {
  const { t } = useTranslation('setup')
  const [businessName, setBusinessName] = useState(data.businessName ?? '')
  const [phone, setPhone] = useState(data.phone ?? '')
  const [errores, setErrores] = useState<{ businessName?: string; phone?: string }>({})

  const continuar = () => {
    const nuevos: { businessName?: string; phone?: string } = {}
    if (!businessName.trim()) nuevos.businessName = t('basics.nameRequired', { defaultValue: 'Escribe el nombre de tu negocio' })
    if (!telefonoValido(phone)) nuevos.phone = t('basics.phoneInvalid', { defaultValue: 'El teléfono necesita al menos 8 dígitos' })
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return
    void onNext({ businessName: businessName.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) })
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
            {t('basics.phoneLabel', { defaultValue: 'Teléfono (opcional)' })}
          </Label>
          <Input
            id="businessPhone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={saving}
            className={cn('rounded-lg h-12 text-base', errores.phone && 'border-destructive')}
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
