/**
 * ShortSetupWizard — el alta en TRES momentos: cuenta, negocio y oferta (§4.1).
 *
 * Se monta cuando el SERVIDOR dice `featureFlags.shortOnboarding === true`. La bandera se lee del
 * servidor y no de una variable de build a propósito: así encenderla no necesita otro despliegue
 * del dashboard, que es lo que produjo el desfase de dos meses del interruptor anterior.
 *
 * 🔴 Tres diferencias con el asistente largo, y las tres nacen de defectos medidos:
 *  1. **Cada guardado se ESPERA y, si falla, no se avanza.** El largo se tragaba el error
 *     (`console.error` + seguir), así que el alta moría al final sin explicación.
 *  2. **El mensaje de `complete` se MUESTRA.** El largo solo lo registraba en consola.
 *  3. **Se reanuda por PREDICADOS sobre los datos, no por `currentStep`**: ese contador lo mueven
 *     `acceptV2Terms` (lo fija en 7) y `saveV2StepData` (stepNumber + 1), así que no describe el
 *     alta corta.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { SetupWizardLayout } from '@/components/layouts/SetupWizardLayout'
import { Icons } from '@/components/icons'
import { setupService } from '@/services/setup.service'
import { useToast } from '@/hooks/use-toast'
import { track } from '@/lib/posthog'
import { LEGAL_DOCS_VERSION } from '@/config/legal'
import { capturarAtribucion, leerAtribucion } from '@/lib/acquisition'
import { BACKEND_STEP_BY_ID, resolveShortResumeStep, type ShortSetupStepId } from './stepRegistry'
import { BusinessBasicsStep } from './steps/BusinessBasicsStep'
import { BusinessTypeStep } from './steps/BusinessTypeStep'
import { ConsentStep } from './steps/ConsentStep'
import { OfferStep } from './steps/OfferStep'
import { SetupDoneStep } from './steps/SetupDoneStep'
import type { LaunchOfferState, PlanQuote } from './launchOffer.types'
import type { SetupData } from './types'

/** Pantallas visibles del contador «Paso X de N» (la cuenta ya ocurrió: cuenta como una más). */
const PANTALLAS_VISIBLES: ShortSetupStepId[] = ['businessBasics', 'businessType', 'offer']

interface ShortSetupWizardProps {
  organizationId: string
}

function aplanarV2(raw: unknown): Partial<SetupData> {
  if (!raw || typeof raw !== 'object') return {}
  return Object.values(raw as Record<string, unknown>).reduce<Partial<SetupData>>((acc, stepData) => {
    if (stepData && typeof stepData === 'object') return { ...acc, ...(stepData as Partial<SetupData>) }
    return acc
  }, {})
}

export default function ShortSetupWizard({ organizationId }: ShortSetupWizardProps) {
  const { t, i18n } = useTranslation('setup')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [pantalla, setPantalla] = useState<ShortSetupStepId | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorFinal, setErrorFinal] = useState<string | null>(null)
  const reclamoIntentado = useRef(false)

  const { data: progressData, isLoading, refetch } = useQuery({
    queryKey: ['onboarding-progress', organizationId],
    queryFn: async () => {
      const response = await setupService.getProgress(organizationId)
      return response.data
    },
    enabled: !!organizationId,
    retry: false,
  })

  const progress = (progressData as { progress?: Record<string, any> } | undefined)?.progress
  const datos = useMemo(() => aplanarV2(progress?.v2SetupData), [progress?.v2SetupData])
  const launchOffer = (progress?.launchOffer ?? null) as LaunchOfferState | null
  const planQuote = (progress?.planQuote ?? null) as PlanQuote | null
  const venueId: string | undefined = progress?.venueId ?? undefined

  // Alguien que YA tenía cuenta y llega por un anuncio: el código viene en la URL (§3.5). Se
  // reclama una sola vez y solo si el progreso todavía no tiene campaña.
  useEffect(() => {
    if (!progress || reclamoIntentado.current) return
    capturarAtribucion()
    const atribucion = leerAtribucion()
    if (!atribucion?.offerParam) return
    if (progress.launchCampaignId || progress.launchOffer) return
    reclamoIntentado.current = true
    const valor = atribucion.offerParam
    const cuerpo = /^[a-z0-9-]+$/.test(valor) ? { slug: valor } : { code: valor.toUpperCase() }
    setupService
      .attachLaunchCampaign(organizationId, { ...cuerpo, ...(Object.keys(atribucion.utm).length ? { utm: atribucion.utm } : {}) })
      .then(() => refetch())
      // Una campaña que no se pudo asociar NUNCA bloquea el alta: se sigue sin oferta.
      .catch(() => undefined)
  }, [organizationId, progress, refetch])

  // Pantalla inicial: se resuelve UNA vez, cuando llega el progreso. Después manda la navegación.
  useEffect(() => {
    if (pantalla !== null) return
    if (isLoading || !progress) return
    setPantalla(resolveShortResumeStep(progress as never))
  }, [isLoading, progress, pantalla])

  useEffect(() => {
    if (!pantalla) return
    track('setup_step_viewed', {
      step_id: pantalla,
      flow: 'short',
      launch_offer_code: launchOffer && launchOffer.available ? launchOffer.code : undefined,
    })
  }, [pantalla, launchOffer])

  const avisarFallo = useCallback(
    (error: unknown) => {
      const mensaje =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('wizard.saveError', { defaultValue: 'No pudimos guardar. Revisa tu conexión e intenta otra vez.' })
      toast({ title: mensaje, variant: 'destructive' })
    },
    [t, toast],
  )

  /** Guarda y AVANZA solo si el servidor confirmó. Nada de tragarse el error. */
  const guardarYAvanzar = useCallback(
    async (accion: () => Promise<unknown>, siguiente: ShortSetupStepId) => {
      setGuardando(true)
      try {
        await accion()
        track('setup_step_completed', { step_id: pantalla, flow: 'short' })
        await refetch()
        setPantalla(siguiente)
      } catch (error) {
        avisarFallo(error)
      } finally {
        setGuardando(false)
      }
    },
    [avisarFallo, pantalla, refetch],
  )

  const terminar = useCallback(async () => {
    setGuardando(true)
    setErrorFinal(null)
    try {
      await setupService.completeSetup(organizationId, i18n.language?.startsWith('en') ? 'en' : 'es')
      track('setup_completed', { flow: 'short' })
      await queryClient.refetchQueries({ queryKey: ['status'], type: 'active' })
      navigate('/', { replace: true })
    } catch (error) {
      const mensaje =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('done.completeError', { defaultValue: 'No pudimos terminar tu alta. Intenta de nuevo en un momento.' })
      setErrorFinal(mensaje)
    } finally {
      setGuardando(false)
    }
  }, [i18n.language, navigate, organizationId, queryClient, t])

  if (isLoading || pantalla === null) {
    return (
      <SetupWizardLayout hideFinishLater>
        <div className="flex items-center justify-center py-20">
          <Icons.spinner className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SetupWizardLayout>
    )
  }

  const indiceVisible = PANTALLAS_VISIBLES.indexOf(pantalla)
  const contador =
    indiceVisible >= 0
      ? t('wizard.step', { current: indiceVisible + 2, total: PANTALLAS_VISIBLES.length + 1 })
      : null

  return (
    <SetupWizardLayout hideFinishLater wide={false}>
      {guardando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <Icons.spinner className="h-8 w-8 animate-spin text-foreground" />
        </div>
      )}
      <div className="relative">
        {contador && <p className="mb-6 text-xs text-muted-foreground">{contador}</p>}

        {pantalla === 'consent' && (
          <ConsentStep
            saving={guardando}
            onAccept={() =>
              guardarYAvanzar(
                () =>
                  setupService.acceptTerms(organizationId, {
                    termsAccepted: true,
                    privacyAccepted: true,
                    termsVersion: LEGAL_DOCS_VERSION,
                  }),
                'businessBasics',
              )
            }
          />
        )}

        {pantalla === 'businessBasics' && (
          <BusinessBasicsStep
            data={datos}
            saving={guardando}
            onNext={stepData => guardarYAvanzar(() => setupService.saveStep(organizationId, BACKEND_STEP_BY_ID.businessBasics, stepData), 'businessType')}
          />
        )}

        {pantalla === 'businessType' && (
          <BusinessTypeStep
            data={datos}
            onNext={stepData => void guardarYAvanzar(() => setupService.saveStep(organizationId, BACKEND_STEP_BY_ID.businessType, stepData), 'offer')}
          />
        )}

        {pantalla === 'offer' && (
          <OfferStep
            organizationId={organizationId}
            venueId={venueId}
            launchOffer={launchOffer}
            planQuote={planQuote}
            data={datos}
            onActivated={() => setPantalla('done')}
            onFinish={() => void terminar()}
            onRefreshProgress={() => void refetch()}
            onFreePlan={plan =>
              void guardarYAvanzar(() => setupService.saveStep(organizationId, BACKEND_STEP_BY_ID.offer, { plan }), 'done')
            }
          />
        )}

        {pantalla === 'done' && (
          <SetupDoneStep onFinish={terminar} saving={guardando} error={errorFinal} businessName={datos.businessName} />
        )}
      </div>
    </SetupWizardLayout>
  )
}
