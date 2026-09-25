/**
 * OfferStep — el momento 3 del alta corta: la oferta del anuncio, o el selector de planes (§4.5).
 *
 * 🔴 Las reglas de dinero de esta pantalla, todas con prueba:
 *  - **No calcula nada.** Cada monto sale de `launchOffer` / `planQuote`, que los entrega el
 *    servidor en centavos con IVA incluido. Aquí solo se formatean.
 *  - **El respaldo `PUT step/10` se escribe SOLO después de un 200 de `activate-plan`.** Escribirlo
 *    tras un rechazo dejaría `v2SetupData.plan` con `{payNow:true}` y, si se apagara el
 *    interruptor del alta corta, el camino legacy cobraría el precio de LISTA con el cupón viejo:
 *    un cargo distinto del que la persona vio y aceptó.
 *  - **Ningún error es un callejón.** Los dos «ya tienes un plan activo» ofrecen un botón que
 *    termina el alta; nunca se presentan como si el cobro hubiera ocurrido.
 *  - **Una oferta agotada o cambiada no se reintenta sola.** Se vuelve a pedir el progreso y se
 *    enseña la vista estándar: el precio normal exige un consentimiento NUEVO.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { AlertCircle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { setupService } from '@/services/setup.service'
import { track } from '@/lib/posthog'
import { trackPurchase } from '@/lib/gtag'
import { formatMXN } from '../offer/formatMXN'
import { FalloDeCobro } from '../offer/falloDeCobro'
import { textoDeRechazo } from '../offer/mensajeDeRechazo'
import { expectedStandardFirstChargeCents } from '../offer/standardQuote'
import { BACKEND_STEP_BY_ID } from '../stepRegistry'
import {
  isOfferAvailable,
  type ActivatePlanBody,
  type ActivatePlanResult,
  type LaunchOfferState,
  type PlanQuote,
} from '../launchOffer.types'
import { PlanCardForm } from './PlanCardForm'
import { FUENTES_DE_TARJETA, useAparienciaDeTarjeta } from '../offer/stripeAppearance'
import { PlanStep } from './PlanStep'
import type { SetupData } from '../types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

/** Espera entre reintentos de un desenlace desconocido, y cuántos se hacen antes de rendirse. */
const REINTENTO_MS = 10_000
const MAX_REINTENTOS = 3

export interface OfferStepProps {
  organizationId: string
  venueId?: string
  launchOffer: LaunchOfferState | null
  planQuote?: PlanQuote | null
  data?: SetupData
  /** Un 200 de `activate-plan`: el asistente avanza al cierre. */
  onActivated: (result: ActivatePlanResult, plan: NonNullable<SetupData['plan']>) => void
  /** «Entrar a Avoqado» cuando ya había plan activo: termina el alta sin cobrar de nuevo. */
  onFinish: () => void
  /** Vuelve a pedir el progreso (la oferta pudo agotarse o cambiar mientras se capturaba). */
  onRefreshProgress: () => void | Promise<void>
  /** El plan GRATIS de la vista estándar: se guarda sin tarjeta. */
  onFreePlan?: (plan: NonNullable<SetupData['plan']>) => void
  /** Avisa si se están mostrando los planes (4 tarjetas): el asistente ensancha su columna. */
  onVistaDePlanes?: (viendoPlanes: boolean) => void
}

type Desenlace =
  | { tipo: 'nada' }
  | { tipo: 'rechazo'; mensaje: string }
  | { tipo: 'esperando' }
  | { tipo: 'sin-confirmar' }
  | { tipo: 'ya-activo'; mensaje: string }

/**
 * Lo que `cobrar` le contesta a quien lo llamó. 🔴 Solo un 200 CONFIRMADO es `ok`: cualquier otra
 * cosa —rechazo, 409, reintento en curso, red caída— tiene que poder frenar el alta.
 *
 * El `mensaje?: undefined` del caso bueno no es adorno: este repo compila con `strict: false`
 * (`tsconfig.app.json`), y sin `strictNullChecks` TypeScript NO estrecha uniones discriminadas —
 * `resultado.mensaje` tras un `if (!resultado.ok)` daba TS2339. Declarándolo en las DOS ramas la
 * lectura compila, y devolver un fallo SIN motivo sigue siendo un error de tipos, que es la parte
 * que importa: un fallo mudo es justo el defecto que se está cerrando.
 */
type ResultadoDeCobro = { ok: true; mensaje?: undefined } | { ok: false; mensaje: string }

function leerError(error: unknown): { status?: number; code?: string; message?: string; details?: Record<string, unknown> } {
  const resp = (error as { response?: { status?: number; data?: Record<string, unknown> } })?.response
  const data = (resp?.data ?? {}) as { code?: string; message?: string; details?: Record<string, unknown> }
  return { status: resp?.status, code: data.code, message: data.message, details: data.details }
}

export function OfferStep({
  organizationId,
  venueId,
  launchOffer,
  planQuote,
  data,
  onActivated,
  onFinish,
  onRefreshProgress,
  onFreePlan,
  onVistaDePlanes,
}: OfferStepProps) {
  const { t, i18n } = useTranslation('setup')
  const idioma = i18n?.language?.startsWith('en') ? 'en' : 'es'

  const oferta = isOfferAvailable(launchOffer) ? launchOffer : null
  const noDisponible = launchOffer && !launchOffer.available ? launchOffer : null

  // «Ver otros planes» (D1) y la caída a la vista estándar tras un 409 comparten estado: en los dos
  // casos la oferta deja de estar enfrente y el precio normal hay que volver a tocarlo.
  const [verEstandar, setVerEstandar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  // Sólo quien SE FUE por gusto («Ver otros planes») puede volver. Tras un 409 la oferta ya no
  // aplica, y ofrecer el regreso sería mandarlo a una tarjeta que el servidor va a rechazar.
  const [puedeVolver, setPuedeVolver] = useState(false)
  const [desenlace, setDesenlace] = useState<Desenlace>({ tipo: 'nada' })
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentStatus, setIntentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const reintentos = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  const mostrarOferta = !!oferta && !verEstandar

  useEffect(() => {
    onVistaDePlanes?.(!mostrarOferta)
  }, [mostrarOferta, onVistaDePlanes])

  // Pro ES el plan de la oferta: sin este regreso, quien mira los planes por curiosidad se queda
  // frente a Pro a precio de lista, pagando mucho más por lo mismo.
  const volverALaOferta = useCallback(() => {
    setPuedeVolver(false)
    setAviso(null)
    setDesenlace({ tipo: 'nada' })
    setVerEstandar(false)
  }, [])

  // SetupIntent para la tarjeta. Solo hace falta en el camino de la oferta: la vista estándar es
  // `PlanStep`, que pide el suyo.
  useEffect(() => {
    if (!mostrarOferta) return
    if (!venueId) {
      setIntentStatus('error')
      return
    }
    let vivo = true
    setIntentStatus('loading')
    setupService
      .planSetupIntent(venueId)
      .then(res => {
        if (!vivo) return
        setClientSecret(res.data.data.clientSecret)
        setIntentStatus('ready')
      })
      .catch(() => {
        if (!vivo) return
        setIntentStatus('error')
      })
    return () => {
      vivo = false
    }
  }, [mostrarOferta, venueId, retryToken])

  // El iframe de Stripe no hereda nuestro CSS: el tema y la tipografía se le pasan aquí, y se
  // actualizan solos si la persona cambia de tema con la pantalla abierta.
  const apariencia = useAparienciaDeTarjeta()
  const options = useMemo(
    () => (clientSecret ? { clientSecret, appearance: apariencia, fonts: FUENTES_DE_TARJETA } : undefined),
    [clientSecret, apariencia],
  )

  const caerAEstandar = useCallback(
    async (mensaje: string) => {
      setPuedeVolver(false)
      setAviso(mensaje)
      setVerEstandar(true)
      setDesenlace({ tipo: 'nada' })
      await onRefreshProgress()
    },
    [onRefreshProgress],
  )

  /**
   * Cobra. `cuerpo` viaja idéntico en cada reintento: es el MISMO cobro, no uno nuevo.
   *
   * 🔴 NO lanza: **devuelve** el desenlace. La pantalla de la oferta pinta el suyo desde
   * `desenlace`, pero la vista estándar es `PlanStep`, que solo frena si su
   * `activateBeforeContinue` lanza — por eso el resultado tiene que salir de aquí en vez de
   * perderse en el `catch`. Lanzar desde dentro tampoco servía: el reintento del 503 se dispara
   * en un `setTimeout` y su rechazo no lo capturaría nadie.
   */
  const cobrar = useCallback(
    async (cuerpo: ActivatePlanBody, plan: NonNullable<SetupData['plan']>): Promise<ResultadoDeCobro> => {
      try {
        const res = await setupService.activatePlan(organizationId, cuerpo)
        const result = (res.data?.data ?? res.data) as ActivatePlanResult
        reintentos.current = 0
        setDesenlace({ tipo: 'nada' })

        // Respaldo del paso 10 — SOLO aquí, con el cobro ya confirmado.
        try {
          await setupService.saveStep(organizationId, BACKEND_STEP_BY_ID.offer, { plan })
        } catch {
          /* el respaldo no manda: la autoridad es `activate-plan`, que ya respondió 200 */
        }

        // El código de la campaña sale de la respuesta y, si el servidor no lo repite (es
        // opcional en el contrato), del cuerpo que MANDAMOS. Sin esto la conversión de una oferta
        // se reportaría sin campaña y el anuncio no podría optimizarse.
        const codigoDeCampana = result.launchOffer?.code ?? (cuerpo.offer.kind === 'LAUNCH' ? cuerpo.offer.code : undefined)

        track('plan_activated', {
          tier: result.tier,
          interval: result.interval,
          launch_offer_code: codigoDeCampana,
          first_charge_cents: result.firstChargeCents,
          flow: 'short',
        })
        // GA4 espera PESOS: mandar centavos multiplicaría por 100 el valor de cada conversión.
        trackPurchase(result.firstChargeCents / 100, codigoDeCampana)

        onActivated(result, plan)
        return { ok: true }
      } catch (error) {
        const { status, code, message, details } = leerError(error)

        if (status === 402) {
          // 🔴 NUNCA el `message` de Stripe: viene en inglés y esta pantalla está en español
          // («Your card was declined.» en medio del resumen en español, medido el 18-sep).
          const declineCode = (details as { declineCode?: string | null } | undefined)?.declineCode
          const texto = textoDeRechazo(declineCode)
          const mensaje = t(texto.clave, { defaultValue: texto.porDefecto })
          setDesenlace({ tipo: 'rechazo', mensaje })
          // Tarjeta nueva ⇒ SetupIntent nuevo.
          setRetryToken(n => n + 1)
          return { ok: false, mensaje }
        }

        if (code === 'PLAN_ALREADY_ACTIVATED') {
          const mensaje = t('offer.alreadyActivated', {
            defaultValue: 'Ya tienes el plan {{tier}} activo en este negocio.',
            tier: String((details as { currentTier?: string } | undefined)?.currentTier ?? ''),
          })
          setDesenlace({ tipo: 'ya-activo', mensaje })
          return { ok: false, mensaje }
        }

        if (code === 'PLAN_ACTIVE_WITHOUT_OFFER') {
          const mensaje = t('offer.activeWithoutOffer', {
            defaultValue:
              'Tu plan {{tier}} ya está activo con los días de prueba, así que la oferta no se puede aplicar encima. No te cobramos nada ahora.',
            tier: String((details as { currentTier?: string } | undefined)?.currentTier ?? ''),
          })
          setDesenlace({ tipo: 'ya-activo', mensaje })
          return { ok: false, mensaje }
        }

        if (code === 'LAUNCH_OFFER_UNAVAILABLE' || code === 'OFFER_CHANGED' || code === 'LAUNCH_OFFER_NOT_APPLICABLE') {
          const mensaje =
            code === 'OFFER_CHANGED'
              ? t('offer.changed', { defaultValue: 'La oferta cambió. Revisa el precio nuevo antes de continuar.' })
              : t('offer.unavailable', { defaultValue: 'La oferta ya no está disponible.' })
          await caerAEstandar(mensaje)
          return { ok: false, mensaje }
        }

        // 🔴 Un 503 NO siempre es ambigüedad de cobro. `PLAN_NOT_CONFIGURED` ocurre ANTES de que
        // el servidor toque Stripe: no hay nada que confirmar, ningún reintento lo arregla, y
        // prometer una confirmación que nunca llegará es mentirle a quien está pagando. Cae al
        // camino de abajo, que muestra el mensaje del servidor («no se te cobró nada»).
        const ambiguoDeCobro =
          code !== 'PLAN_NOT_CONFIGURED' && (status === 503 || code === 'PLAN_ACTIVATION_PENDING' || code === 'PLAN_ACTIVATION_IN_PROGRESS')
        if (ambiguoDeCobro) {
          if (reintentos.current >= MAX_REINTENTOS) {
            reintentos.current = 0
            setDesenlace({ tipo: 'sin-confirmar' })
            return { ok: false, mensaje: t('offer.pending', { defaultValue: 'Tu pago se está confirmando; vuelve en unos minutos.' }) }
          }
          reintentos.current += 1
          setDesenlace({ tipo: 'esperando' })
          temporizador.current = setTimeout(() => {
            void cobrar(cuerpo, plan)
          }, REINTENTO_MS)
          // Un reintento EN CURSO tampoco es un cobro: el alta no avanza. Si el reintento
          // confirma, quien avanza es `onActivated`, no este retorno.
          return { ok: false, mensaje: t('offer.confirming', { defaultValue: 'Confirmando tu pago…' }) }
        }

        const mensaje = message || t('offer.genericError', { defaultValue: 'No pudimos procesar el pago. Intenta de nuevo.' })
        setDesenlace({ tipo: 'rechazo', mensaje })
        return { ok: false, mensaje }
      }
    },
    [caerAEstandar, onActivated, organizationId, t],
  )

  const pagarLaOferta = useCallback(
    async (paymentMethodId: string) => {
      if (!oferta) return
      const cuerpo: ActivatePlanBody = {
        tier: oferta.planTier,
        interval: 'monthly',
        payNow: true,
        paymentMethodId,
        offer: { kind: 'LAUNCH', code: oferta.code, offerVersion: oferta.offerVersion, expectedFirstChargeCents: oferta.firstChargeCents },
        language: idioma,
      }
      const plan: NonNullable<SetupData['plan']> = {
        tier: oferta.planTier,
        paymentMethodId,
        interval: 'monthly',
        payNow: true,
        acceptedAt: new Date().toISOString(),
      }
      // Esta pantalla pinta su propio desenlace (`errorMessage={desenlace.mensaje}`), así que
      // aquí el resultado no se convierte en excepción: se vería el mismo texto dos veces.
      await cobrar(cuerpo, plan)
    },
    [cobrar, idioma, oferta],
  )

  /** La vista estándar cobra por el MISMO endpoint: un solo camino que crea dinero. */
  const activarEstandar = useCallback(
    async (args: { tier: 'PRO' | 'PREMIUM'; interval: 'monthly' | 'annual'; payNow: boolean; paymentMethodId: string }) => {
      const esperado = expectedStandardFirstChargeCents(planQuote, args.tier, args.interval, args.payNow)
      if (esperado === null) {
        // 🔴 Sin la cotización del servidor no hay monto que consentir, así que NO se cobra. Lo que
        // no puede pasar —y pasaba— es que además se avance: este `return` era mudo y el asistente
        // guardaba un plan de PAGO sin que nadie hubiera llamado a `activate-plan` ni una vez.
        throw new FalloDeCobro(t('offer.noQuote', { defaultValue: 'No pudimos cargar los precios. Recarga la página e intenta de nuevo.' }))
      }
      const cuerpo: ActivatePlanBody = {
        tier: args.tier,
        interval: args.interval,
        payNow: args.payNow,
        paymentMethodId: args.paymentMethodId,
        offer: { kind: 'STANDARD', expectedFirstChargeCents: esperado },
        language: idioma,
      }
      const plan: NonNullable<SetupData['plan']> = {
        tier: args.tier,
        paymentMethodId: args.paymentMethodId,
        interval: args.interval,
        payNow: args.payNow,
        acceptedAt: new Date().toISOString(),
      }
      // 🔴 `PlanStep` solo frena si esto LANZA. Sin el throw, un rechazo del banco avanzaba el
      // alta y guardaba `plan.payNow = true` sin cargo detrás.
      const resultado = await cobrar(cuerpo, plan)
      if (!resultado.ok) throw new FalloDeCobro(resultado.mensaje)
    },
    [cobrar, idioma, planQuote, t],
  )

  // ── Callejón sin salida: NUNCA. Un plan ya activo se cierra con un botón que termina el alta ──
  if (desenlace.tipo === 'ya-activo') {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('offer.alreadyActiveTitle', { defaultValue: 'Tu plan ya está activo' })}</h1>
        <p className="text-sm text-muted-foreground">{desenlace.mensaje}</p>
        <Button className="rounded-full" onClick={onFinish} data-tour="offer-enter">
          {t('offer.enter', { defaultValue: 'Entrar a Avoqado' })}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t('offer.changePlanNote', { defaultValue: 'Para cambiar de plan, entra a Facturación.' })}
        </p>
      </div>
    )
  }

  if (!mostrarOferta) {
    return (
      <div className="flex flex-col gap-6">
        {(aviso || noDisponible) && (
          <div className="flex items-start gap-2 rounded-xl border border-input p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">
              {aviso ??
                t('offer.claimedUnavailable', {
                  defaultValue: 'La oferta {{code}} ya no está disponible.',
                  code: noDisponible?.code ?? '',
                })}
            </span>
            {puedeVolver && oferta && (
              <button
                type="button"
                className="shrink-0 font-medium underline underline-offset-4 hover:text-foreground"
                onClick={volverALaOferta}
              >
                {t('offer.backToOffer', {
                  defaultValue: 'Volver a la oferta de {{promo}}',
                  promo: formatMXN(oferta.promo.monthlyCents),
                })}
              </button>
            )}
          </div>
        )}
        <PlanStep
          data={data ?? {}}
          venueId={venueId ?? ''}
          organizationId={organizationId}
          quote={planQuote ?? null}
          activateBeforeContinue={activarEstandar}
          onNext={stepData => {
            const plan = stepData.plan
            if (plan && plan.tier === 'FREE') {
              onFreePlan?.(plan)
              return
            }
            // Los planes de pago ya pasaron por `activateBeforeContinue`; aquí solo se cierra.
            if (plan) onFreePlan?.(plan)
          }}
        />
      </div>
    )
  }

  const promoTotal = oferta!.promo.periodTotalCents
  const cobrando = desenlace.tipo === 'esperando'

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {oferta!.copy.headline ?? t('offer.title', { defaultValue: 'Avoqado {{plan}}', plan: oferta!.planName })}
        </h1>
        {oferta!.copy.subheadline && <p className="text-sm text-muted-foreground">{oferta!.copy.subheadline}</p>}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-input p-5">
        <div>
          <p className="text-3xl font-semibold">
            {t('offer.pricePerMonth', { defaultValue: '{{price}} al mes', price: formatMXN(oferta!.promo.monthlyCents) })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('offer.planLine', { defaultValue: 'Plan {{plan}} · IVA incluido', plan: oferta!.planName })}
          </p>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">
              {t('offer.firstMonths', { defaultValue: 'Primeros {{count}} meses', count: oferta!.promo.months })}
            </dt>
            <dd>{t('offer.perMonth', { defaultValue: '{{price}}/mes', price: formatMXN(oferta!.promo.monthlyCents) })}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{t('offer.afterwards', { defaultValue: 'Después' })}</dt>
            <dd>{t('offer.perMonth', { defaultValue: '{{price}}/mes', price: formatMXN(oferta!.renewal.monthlyCents) })}</dd>
          </div>
          {oferta!.promo.ivaCents > 0 && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{t('offer.ivaIncluded', { defaultValue: 'IVA incluido en el precio promocional' })}</dt>
              <dd>{formatMXN(oferta!.promo.ivaCents)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2 font-semibold">
            <dt>{t('offer.todayYouPay', { defaultValue: 'Hoy pagas' })}</dt>
            <dd>{formatMXN(oferta!.firstChargeCents)}</dd>
          </div>
        </dl>

        {oferta!.copy.bullets.length > 0 && (
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            {oferta!.copy.bullets.map(b => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          {t('offer.legal', {
            defaultValue:
              'Al pagar autorizas a Avoqado a cobrar {{promo}} al mes durante {{count}} meses y después {{renewal}} al mes a esta tarjeta hasta que canceles. Cancela cuando quieras desde Facturación.',
            promo: formatMXN(oferta!.promo.monthlyCents),
            count: oferta!.promo.months,
            renewal: formatMXN(oferta!.renewal.monthlyCents),
            total: formatMXN(promoTotal),
          })}
        </p>

        {desenlace.tipo === 'esperando' && (
          <p className="text-sm text-muted-foreground">{t('offer.confirming', { defaultValue: 'Confirmando tu pago…' })}</p>
        )}
        {desenlace.tipo === 'sin-confirmar' && (
          <p className="text-sm text-destructive">
            {t('offer.pending', { defaultValue: 'Tu pago se está confirmando; vuelve en unos minutos.' })}
          </p>
        )}

        {intentStatus === 'error' || !options ? (
          intentStatus === 'error' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t('plan.setupIntentErrorBody', { defaultValue: 'No pudimos preparar el pago con tarjeta. Vuelve a intentarlo.' })}
                </span>
              </div>
              <Button variant="outline" className="rounded-full gap-2" onClick={() => setRetryToken(n => n + 1)}>
                <RotateCw className="h-4 w-4" />
                {t('plan.retry', { defaultValue: 'Reintentar' })}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('plan.loading', { defaultValue: 'Cargando…' })}</p>
          )
        ) : (
          <Elements stripe={stripePromise} options={options}>
            <PlanCardForm
              dataTourPrefix="setup-offer"
              payNowLabel={t('offer.payAndEnter', { defaultValue: 'Pagar {{price}} y entrar', price: formatMXN(oferta!.firstChargeCents) })}
              busy={cobrando}
              errorMessage={desenlace.tipo === 'rechazo' ? desenlace.mensaje : null}
              onConfirmed={pm => pagarLaOferta(pm)}
            />
          </Elements>
        )}
      </div>

      <button
        type="button"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        onClick={() =>
          void caerAEstandar(
            t('offer.otherPlansNote', {
              defaultValue: 'La oferta de {{promo}} no aplica a otros planes.',
              promo: formatMXN(oferta!.promo.monthlyCents),
            }),
          ).then(() => setPuedeVolver(true))
        }
      >
        {t('offer.seeOtherPlans', { defaultValue: 'Ver otros planes' })}
      </button>
    </div>
  )
}
