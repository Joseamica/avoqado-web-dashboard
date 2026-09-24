/**
 * «Activar cobros» — la captura que el alta corta dejó de pedir (§4.2).
 *
 * Reutiliza SIN cambios los pasos del asistente (`EntityTypeStep`, `IdentityStep`,
 * `BankAccountStep`): su contrato es `{data, onNext}` y aquí se muestran como secciones seguidas,
 * cada una con su «Guardar». Reescribirlos habría producido dos formularios que capturan lo mismo
 * y se separan al primer arreglo.
 *
 * 🔴 La DIRECCIÓN DEL LOCAL vive en la primera sección y es obligatoria: es la única captura que
 * queda en todo el producto una vez que el alta corta la retira, y sin ella el local no tiene
 * dirección en ninguna parte.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { paymentActivationService, type PaymentActivationStatus } from '@/services/paymentActivation.service'
import { EntityTypeStep } from '@/pages/Setup/steps/EntityTypeStep'
import { IdentityStep } from '@/pages/Setup/steps/IdentityStep'
import { BankAccountStep } from '@/pages/Setup/steps/BankAccountStep'
import type { SetupData } from '@/pages/Setup/types'

function Seccion({ titulo, descripcion, hecho, children }: { titulo: string; descripcion: string; hecho?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-input p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        {hecho && <Check className="h-5 w-5 shrink-0 text-primary" />}
      </div>
      {children}
    </section>
  )
}

export default function PaymentActivationPage() {
  const { t } = useTranslation('home')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [guardando, setGuardando] = useState<string | null>(null)

  const { data } = useQuery<PaymentActivationStatus | null>({
    queryKey: ['payment-activation', venueId],
    queryFn: async () => {
      const res = await paymentActivationService.get(venueId!)
      return (res.data?.data ?? null) as PaymentActivationStatus | null
    },
    enabled: !!venueId,
    retry: false,
  })

  // Dirección del LOCAL: se captura aquí y en ningún otro sitio.
  const [direccion, setDireccion] = useState<{ address: string; city: string; state: string; zipCode: string; country?: string }>({
    address: '',
    city: '',
    state: '',
    zipCode: '',
  })
  const [errorDireccion, setErrorDireccion] = useState('')

  const datosPrevios: SetupData = useMemo(
    () => ({
      entityType: data?.entityType ?? undefined,
      legalFirstName: undefined,
      clabe: undefined,
      bankName: data?.profile?.bankName ?? undefined,
    }),
    [data],
  )

  const guardar = async (seccion: string, cuerpo: Parameters<typeof paymentActivationService.updateProfile>[1]) => {
    if (!venueId) return
    setGuardando(seccion)
    try {
      await paymentActivationService.updateProfile(venueId, cuerpo)
      await queryClient.invalidateQueries({ queryKey: ['payment-activation', venueId] })
      toast({ title: t('paymentActivation.saved', { defaultValue: 'Guardado' }) })
    } catch (error) {
      const mensaje =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('paymentActivation.saveError', { defaultValue: 'No pudimos guardar. Revisa los datos e intenta otra vez.' })
      toast({ title: mensaje, variant: 'destructive' })
    } finally {
      setGuardando(null)
    }
  }

  const tomarDireccion = (place: PlaceDetails) => {
    setDireccion({ address: place.address, city: place.city, state: place.state, zipCode: place.zipCode, country: place.country })
    setErrorDireccion('')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('paymentActivation.title', { defaultValue: 'Activa tus cobros' })}</h1>
        <p className="text-sm text-muted-foreground">
          {t('paymentActivation.pageSubtitle', {
            defaultValue: 'Con estos datos podemos abrirte la cuenta de cobros y depositarte lo que vendas.',
          })}
        </p>
      </header>

      <Seccion
        titulo={t('paymentActivation.sections.business', { defaultValue: 'Tu negocio' })}
        descripcion={t('paymentActivation.sections.businessDesc', { defaultValue: 'Tipo de persona y dirección del local.' })}
        hecho={!!data?.profile?.entityType && !!data?.profile?.venueAddressPresent}
      >
        <div className="mb-6 grid gap-2" data-tour="payment-activation-address">
          <Label htmlFor="venueAddress">{t('paymentActivation.addressLabel', { defaultValue: 'Dirección del local' })}</Label>
          <AddressAutocomplete
            value={direccion.address}
            onAddressSelect={tomarDireccion}
            placeholder={t('paymentActivation.addressPlaceholder', { defaultValue: 'Calle, número, colonia' })}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              aria-label={t('paymentActivation.cityLabel', { defaultValue: 'Ciudad' })}
              placeholder={t('paymentActivation.cityLabel', { defaultValue: 'Ciudad' })}
              value={direccion.city}
              onChange={e => setDireccion(d => ({ ...d, city: e.target.value }))}
            />
            <Input
              aria-label={t('paymentActivation.stateLabel', { defaultValue: 'Estado' })}
              placeholder={t('paymentActivation.stateLabel', { defaultValue: 'Estado' })}
              value={direccion.state}
              onChange={e => setDireccion(d => ({ ...d, state: e.target.value }))}
            />
            <Input
              aria-label={t('paymentActivation.zipLabel', { defaultValue: 'Código postal' })}
              placeholder={t('paymentActivation.zipLabel', { defaultValue: 'Código postal' })}
              value={direccion.zipCode}
              onChange={e => setDireccion(d => ({ ...d, zipCode: e.target.value }))}
            />
          </div>
          {errorDireccion && <p className="text-xs text-destructive">{errorDireccion}</p>}
        </div>

        <EntityTypeStep
          data={datosPrevios}
          onNext={stepData => {
            // 🔴 Sin dirección no se guarda: el servidor la necesita para marcar el perfil completo,
            // y es la única captura de la dirección del local que queda en el producto.
            if (!direccion.address.trim() || !direccion.city.trim() || !direccion.state.trim() || !direccion.zipCode.trim()) {
              setErrorDireccion(t('paymentActivation.addressRequired', { defaultValue: 'Escribe la dirección completa de tu local' }))
              return
            }
            void guardar('entity', {
              entity: {
                entityType: String(stepData.entityType ?? ''),
                entitySubType: stepData.entitySubType,
                commercialName: stepData.commercialName,
              },
              venueAddress: direccion,
            })
          }}
        />
        {guardando === 'entity' && <p className="mt-2 text-xs text-muted-foreground">{t('paymentActivation.saving', { defaultValue: 'Guardando…' })}</p>}
      </Seccion>

      <Seccion
        titulo={t('paymentActivation.sections.identity', { defaultValue: 'Quién es el responsable' })}
        descripcion={t('paymentActivation.sections.identityDesc', { defaultValue: 'RFC, CURP y domicilio de quien firma.' })}
        hecho={!!data?.profile?.rfcMasked}
      >
        <IdentityStep
          data={datosPrevios}
          onNext={stepData =>
            void guardar('identity', {
              identity: {
                legalFirstName: String(stepData.legalFirstName ?? ''),
                legalLastName: String(stepData.legalLastName ?? ''),
                rfc: stepData.rfc,
                curp: stepData.curp,
                birthdate: stepData.birthdate,
                personalPhone: stepData.personalPhone,
                legalAddress: stepData.legalAddress,
                legalCity: stepData.legalCity,
                legalState: stepData.legalState,
                legalCountry: stepData.legalCountry,
                legalZipCode: stepData.legalZipCode,
              },
            })
          }
        />
      </Seccion>

      <Seccion
        titulo={t('paymentActivation.sections.bank', { defaultValue: 'Dónde te depositamos' })}
        descripcion={t('paymentActivation.sections.bankDesc', { defaultValue: 'La CLABE de la cuenta a la que llega tu dinero.' })}
        hecho={!!data?.profile?.clabeLast4}
      >
        {data?.profile?.clabeLast4 && (
          <p className="mb-3 text-sm text-muted-foreground">
            {t('paymentActivation.currentClabe', {
              defaultValue: 'Cuenta guardada: ••••{{last4}} {{bank}}',
              last4: data.profile.clabeLast4,
              bank: data.profile.bankName ?? '',
            })}
          </p>
        )}
        <BankAccountStep
          data={datosPrevios}
          onNext={stepData =>
            void guardar('bank', {
              bank: {
                clabe: String(stepData.clabe ?? ''),
                accountHolder: String(stepData.accountHolder ?? ''),
                accountType: String(stepData.accountType ?? ''),
              },
            })
          }
        />
      </Seccion>

      <Button variant="outline" className="self-start rounded-full" onClick={() => window.history.back()}>
        {t('paymentActivation.back', { defaultValue: 'Volver' })}
      </Button>
    </div>
  )
}
