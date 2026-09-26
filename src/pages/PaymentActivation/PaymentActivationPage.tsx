/**
 * «Activar cobros» — lo único que el negocio TECLEA para que le abramos la cuenta de cobros.
 *
 * 🔴 Decisión del founder (26-sep): ni CLABE, ni banco, ni titular, ni persona física/moral, ni RFC,
 * CURP o domicilio de quien firma. Todo eso viene en los documentos que el negocio ya sube (INE,
 * Constancia de Situación Fiscal, comprobante de domicilio y carátula bancaria) y los lee quien
 * revisa. Lo medido antes de quitarlo: la CLABE y el banco sólo los veía una persona (la del
 * comerciante la teclea el superadmin en la cuenta de cobros), y el resto no lo leía ningún proceso.
 *
 * Lo que SÍ se teclea es la DIRECCIÓN DEL LOCAL: la Constancia trae el domicilio FISCAL, que puede
 * ser la casa del dueño, y el local es lo que sale en los recibos y a donde se manda la terminal.
 *
 * ⚠️ Lo que se pierde, declarado: el tipo de persona decidía si el acta y el poder son obligatorios
 * al enviar a revisión. Sin él el negocio se trata como persona física; quien revisa ve en la
 * Constancia si es empresa y los pide. Leerlo solo de la Constancia es trabajo aparte.
 *
 * Antes esta pantalla reusaba los pasos del asistente viejo, y el de «Tu negocio» NUNCA guardaba en
 * producción: mandaba el subtipo («SA_DE_CV») y el servidor sólo acepta PERSONA_FISICA/MORAL. Con él
 * se perdía también la dirección, que viajaba en la misma petición.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Circle, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { paymentActivationService, type PaymentActivationStatus } from '@/services/paymentActivation.service'
import { fusionarDireccion, type DireccionCapturada } from './fusionarDireccion'

/** Los cuatro que pide el servidor, en el orden en que se enseñan. */
const DOCUMENTOS = ['ine', 'rfc', 'comprobanteDomicilio', 'caratulaBancaria'] as const

function Seccion({
  titulo,
  descripcion,
  hecho,
  children,
}: {
  titulo: string
  descripcion: string
  hecho?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-input p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        {hecho && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
      </div>
      {children}
    </section>
  )
}

const VACIA: DireccionCapturada = { address: '', city: '', state: '', zipCode: '' }

export default function PaymentActivationPage() {
  const { t } = useTranslation('home')
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [guardando, setGuardando] = useState(false)

  const { data } = useQuery<PaymentActivationStatus | null>({
    queryKey: ['payment-activation', venueId],
    queryFn: async () => {
      const res = await paymentActivationService.get(venueId!)
      return (res.data?.data ?? null) as PaymentActivationStatus | null
    },
    enabled: !!venueId,
    retry: false,
  })

  const [direccion, setDireccion] = useState<DireccionCapturada>(VACIA)
  const [errorDireccion, setErrorDireccion] = useState('')
  // La dirección guardada se pinta UNA vez, al llegar: si el negocio ya la capturó no la teclea otra vez,
  // y si está escribiendo, un refresco de la consulta no le borra lo que lleva.
  const [precargada, setPrecargada] = useState(false)
  useEffect(() => {
    const guardada = data?.profile?.venueAddress
    if (precargada || !guardada) return
    setDireccion(previa => fusionarDireccion(previa, guardada))
    setPrecargada(true)
  }, [data, precargada])

  const direccionHecha = !!data?.profile?.venueAddressPresent
  const faltan = data?.documents?.missing ?? DOCUMENTOS.filter(d => !data?.documents?.uploaded?.includes(d))
  const documentosHechos = !!data && faltan.length === 0

  const guardarDireccion = async () => {
    if (!venueId) return
    if (!direccion.address.trim() || !direccion.city.trim() || !direccion.state.trim() || !direccion.zipCode.trim()) {
      setErrorDireccion(t('paymentActivation.addressRequired', { defaultValue: 'Escribe la dirección completa de tu local' }))
      return
    }
    setGuardando(true)
    try {
      await paymentActivationService.updateProfile(venueId, {
        venueAddress: {
          address: direccion.address.trim(),
          city: direccion.city.trim(),
          state: direccion.state.trim(),
          zipCode: direccion.zipCode.trim(),
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['payment-activation', venueId] })
      toast({ title: t('paymentActivation.saved', { defaultValue: 'Guardado' }) })
    } catch (error) {
      const mensaje =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('paymentActivation.saveError', { defaultValue: 'No pudimos guardar. Revisa los datos e intenta otra vez.' })
      toast({ title: mensaje, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('paymentActivation.title', { defaultValue: 'Activa tus cobros' })}</h1>
        <p className="text-sm text-muted-foreground">
          {t('paymentActivation.pageSubtitle', {
            defaultValue: 'Sólo te pedimos lo que no viene en tus documentos. Tus datos fiscales y bancarios los leemos de lo que subas.',
          })}
        </p>
      </header>

      <Seccion
        titulo={t('paymentActivation.sections.address', { defaultValue: 'Dirección de tu local' })}
        descripcion={t('paymentActivation.sections.addressDesc', {
          defaultValue: 'La que sale en tus recibos y a donde te mandamos la terminal.',
        })}
        hecho={direccionHecha}
      >
        <div className="grid gap-2" data-tour="payment-activation-address">
          <Label htmlFor="venueAddress">{t('paymentActivation.addressLabel', { defaultValue: 'Dirección del local' })}</Label>
          <AddressAutocomplete
            value={direccion.address}
            onAddressSelect={(lugar: PlaceDetails) => {
              setDireccion(previa => fusionarDireccion(previa, lugar))
              setErrorDireccion('')
            }}
            // Lo TECLEADO sin elegir sugerencia: sin esto la calle se veía escrita y la pantalla decía
            // «escribe la dirección completa» (medido en el navegador el 26-sep).
            onTextChange={texto => {
              setDireccion(previa => ({ ...previa, address: texto }))
              setErrorDireccion('')
            }}
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
          <Button
            className="mt-2 self-start rounded-full px-6"
            data-tour="payment-activation-save-address"
            disabled={guardando}
            onClick={() => void guardarDireccion()}
          >
            {guardando
              ? t('paymentActivation.saving', { defaultValue: 'Guardando…' })
              : t('paymentActivation.saveAddress', { defaultValue: 'Guardar dirección' })}
          </Button>
        </div>
      </Seccion>

      <Seccion
        titulo={
          documentosHechos
            ? t('paymentActivation.docsDoneTitle', { defaultValue: 'Ya tenemos tus documentos' })
            : t('paymentActivation.docsPendingTitle', { defaultValue: 'Falta lo más importante: tus documentos' })
        }
        descripcion={
          documentosHechos
            ? t('paymentActivation.docsDoneBody', {
                defaultValue: 'Los revisamos y te avisamos por correo en cuanto tu cuenta de cobros quede abierta.',
              })
            : t('paymentActivation.docsPendingBody', {
                defaultValue:
                  'De aquí sacamos tu RFC, tu CLABE y tus datos: por eso no te los pedimos a mano. Sin ellos no podemos abrir tu cuenta de cobros.',
              })
        }
        hecho={documentosHechos}
      >
        <ul className="flex flex-col gap-2" data-testid="payment-activation-docs">
          {DOCUMENTOS.map(doc => {
            const falta = faltan.includes(doc)
            return (
              <li key={doc} className="flex items-center gap-2 text-sm">
                {falta ? (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                )}
                <span className={falta ? '' : 'text-muted-foreground'}>{t(`paymentActivation.docNames.${doc}`)}</span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {t('paymentActivation.docsCompanyNote', {
            defaultValue:
              'Si tu negocio es una empresa (S.A., S. de R.L., S.C.…), sube también el acta constitutiva y el poder de quien firma.',
          })}
        </p>
        <Button
          className="mt-4 gap-2 rounded-full px-6"
          variant={documentosHechos ? 'outline' : 'default'}
          data-tour="payment-activation-upload-docs"
          onClick={() => navigate(`${fullBasePath}/settings/local/documents`)}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {documentosHechos
            ? t('paymentActivation.docsReview', { defaultValue: 'Ver mis documentos' })
            : t('paymentActivation.docsPendingCta', { defaultValue: 'Subir mis documentos' })}
        </Button>
      </Seccion>

      <Button variant="outline" className="self-start rounded-full" onClick={() => window.history.back()}>
        {t('paymentActivation.back', { defaultValue: 'Volver' })}
      </Button>
    </div>
  )
}
