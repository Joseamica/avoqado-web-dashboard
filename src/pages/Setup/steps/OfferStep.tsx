/**
 * OfferStep — el momento 3 del alta corta: Pro, Premium y Enterprise a lo ancho, y una ventana para
 * pagar el que se elija (diseño D, spec 2026-10-17). Con campaña, la tarjeta de su plan lleva la oferta
 * y se paga hoy; el otro plan de pago es la prueba de 30 días con tarjeta. Gratis no se ofrece.
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
 *  - **Una oferta agotada o cambiada no se reintenta sola.** Se cierra la ventana, se vuelve a pedir
 *    el progreso y las tarjetas pasan a la prueba: el precio normal exige un consentimiento NUEVO.
 *  - **Con un cobro sin respuesta definitiva el plan no se cambia:** las tarjetas se apagan y la
 *    ventana no se cierra (ni Esc ni la X).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { AlertCircle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { PlanComparison } from '@/components/billing/PlanComparison'
import { salesWhatsAppLink } from '@/config/plan-catalog'
import { setupService } from '@/services/setup.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { pedidoCompartido, type PedidoEnVuelo } from './pedidoCompartido'
import { track } from '@/lib/posthog'
import { trackPurchase } from '@/lib/gtag'
import { focoPerdido } from '../offer/focoPerdido'
import { formatMXN } from '../offer/formatMXN'
import { textoDeRechazo } from '../offer/mensajeDeRechazo'
import { expectedStandardFirstChargeCents } from '../offer/standardQuote'
import { textoDePrecio } from '../offer/textoDePrecio'
import { BACKEND_STEP_BY_ID } from '../stepRegistry'
import {
  isOfferAvailable,
  type ActivatePlanBody,
  type ActivatePlanResult,
  type LaunchOfferState,
  type PlanQuote,
} from '../launchOffer.types'
import { PlanCardForm } from './PlanCardForm'
import { FUENTES_DE_TARJETA, localeDeTarjeta, useAparienciaDeTarjeta } from '../offer/stripeAppearance'
import { HybridOnboardingButton } from '@/components/billing/HybridOnboardingButton'
import { TarjetasDePlanes } from './planes/TarjetasDePlanes'
import { VentanaDePago } from './planes/VentanaDePago'
import type { SetupData } from '../types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

/** Espera entre reintentos de un desenlace desconocido, y cuántos se hacen antes de rendirse. */
const REINTENTO_MS = 10_000
const MAX_REINTENTOS = 3

const DIA_MS = 24 * 60 * 60 * 1000
// Nombres de marca: iguales en español e inglés (como en `TarjetasDePlanes`).
const NOMBRE_DEL_PLAN = { PRO: 'Pro', PREMIUM: 'Premium' } as const

type PlanDePago = 'PRO' | 'PREMIUM'

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
  /**
   * Cierra el paso con un plan que NO se cobra aquí: la compra híbrida («Ver ofertas y funciones»), cuyos
   * contratos dan el acceso. Gratis ya no se ofrece en el alta.
   */
  onFreePlan?: (plan: NonNullable<SetupData['plan']>) => void | Promise<boolean | void>
  /**
   * El servidor tiene un cobro de este alta SIN cerrar (`planActivation.status === 'IN_PROGRESS'`).
   * Llega así tras una recarga: el plan arranca bloqueado y se ofrece volver a comprobar.
   */
  activacionEnCurso?: boolean
}

type Desenlace =
  | { tipo: 'nada' }
  | { tipo: 'rechazo'; mensaje: string }
  | { tipo: 'esperando' }
  | { tipo: 'sin-confirmar' }
  | { tipo: 'ya-activo'; mensaje: string }
  // D2 (3D Secure): el banco pide autorizar el primer cobro. 'autorizando' = su reto está abierto; 'autorizar' = el
  // servidor sigue esperando tras el reto de ESTE clic y la salida es «Autorizar el pago».
  | { tipo: 'autorizando' }
  | { tipo: 'autorizar' }

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

/**
 * 🔴 Viajan con el cobro (Codex r1 #5): el reintento del 503/red y «Volver a comprobar» las reenvían tal cual. Si se
 * perdieran, `409 → reto → 503 → reintento → 409` abriría otro reto del banco solo. Sólo «Autorizar el pago» las quita.
 */
type OpcionesDeCobro = { yaAutorizo?: boolean }

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
  activacionEnCurso = false,
}: OfferStepProps) {
  const { t, i18n } = useTranslation('setup')
  const idioma = i18n?.language?.startsWith('en') ? 'en' : 'es'

  const oferta = isOfferAvailable(launchOffer) ? launchOffer : null
  const noDisponible = launchOffer && !launchOffer.available ? launchOffer : null

  // «Ignorar la oferta»: lo pone la caída tras un 409 (`caerAEstandar`). Las tarjetas pasan a la prueba
  // de 30 días y el precio normal hay que volver a tocarlo.
  const [verEstandar, setVerEstandar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  // El plan cuya ventana para pagar está abierta (null = viendo las 3 tarjetas).
  const [planElegido, setPlanElegido] = useState<PlanDePago | null>(null)
  const [comparando, setComparando] = useState(false)
  const [desenlace, setDesenlace] = useState<Desenlace>({ tipo: 'nada' })
  // 🔴 UNA regla para el candado del plan: desde que sale el cobro hasta que hay RESPUESTA DEFINITIVA,
  // nada puede cambiar el plan (ni otra tarjeta de plan, ni cerrar la ventana para pagar, ni la compra
  // híbrida). Codex encontró el hueco por partes — el reintento del 503 (ronda 8), el `saveStep` tras
  // el éxito, el primer cobro de la oferta y el «sin confirmar» (ronda 9) — porque el candado colgaba
  // de «¿está reintentando?». Ahora cuelga del cobro:
  //   · se prende al llamar `cobrar`;
  //   · se apaga SÓLO con un no definitivo (rechazo del banco, oferta que ya no aplica, error claro);
  //   · con éxito se queda puesto (el plan ya está activo);
  //   · sin confirmar también se queda: el servidor pudo haber cobrado. La salida es «Volver a
  //     comprobar», que pregunta por el MISMO cobro, nunca uno nuevo.
  // El ref es para las guardas (sin cierres de estado viejos); el estado, para pintar.
  const [cobroEnCurso, setCobroEnCurso] = useState(false)
  const cobroEnCursoRef = useRef(false)
  // Mientras Stripe guarda la tarjeta todavía no se llamó a `cobrar`, pero ya viene un cobro: también
  // bloquea (Codex ronda 10). Lo reporta el formulario (sólo su trabajo propio, ver PlanCardForm).
  const [tarjetaTrabajando, setTarjetaTrabajando] = useState(false)
  const marcarCobroEnCurso = useCallback((enCurso: boolean) => {
    cobroEnCursoRef.current = enCurso
    setCobroEnCurso(enCurso)
  }, [])
  const ultimoCobro = useRef<{
    cuerpo: ActivatePlanBody
    plan: NonNullable<SetupData['plan']>
    opciones?: OpcionesDeCobro
  } | null>(null)
  // Tras una RECARGA con un cobro sin cerrar en el servidor (`activacionEnCurso`), el candado arranca
  // puesto: la pantalla se pintó de cero y no sabe del cobro que ya salió (Codex ronda 10).
  const pagoEnVuelo = cobroEnCurso || tarjetaTrabajando || !!activacionEnCurso
  // El formulario de tarjeta NO se bloquea por `activacionEnCurso`: tras una recarga no hay cuerpo que
  // reenviar, y la única forma de cerrar el cobro colgado es confirmar otra vez. El servidor recupera la
  // suscripción del intento anterior por su id y entrega el plan, sin cobrar dos veces (revisión
  // independiente, 26-sep: bloquearlo dejaba el alta sin salida).
  const pagoBloqueado = cobroEnCurso || tarjetaTrabajando
  const bloqueoRef = useRef(false)
  bloqueoRef.current = pagoEnVuelo
  const planBloqueado = () => cobroEnCursoRef.current || bloqueoRef.current
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentStatus, setIntentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const setupIntentEnVuelo = useRef<PedidoEnVuelo<Awaited<ReturnType<typeof setupService.planSetupIntent>>>>(null)
  const reintentos = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Si la pantalla se va, ni se agenda otro reintento ni una respuesta tardía mueve el alta.
  const montado = useRef(false)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  const mostrarOferta = !!oferta && !verEstandar

  // SetupIntent para la tarjeta, para cualquier plan (oferta o prueba): se pide al montar, no al abrir
  // la ventana, para que el formulario aparezca ya listo.
  useEffect(() => {
    if (!venueId) {
      setIntentStatus('error')
      return
    }
    let vivo = true
    setIntentStatus('loading')
    // 🔴 El SetupIntent anterior puede estar GASTADO (tras un rechazo quedó confirmado con esa tarjeta): no se deja
    // a la vista mientras llega el nuevo, o un clic rápido lo confirmaría otra vez y Stripe respondería 400.
    setClientSecret(null)
    pedidoCompartido(setupIntentEnVuelo, `${venueId}:${retryToken}`, () => setupService.planSetupIntent(venueId))
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
  }, [venueId, retryToken])

  // El iframe de Stripe no hereda nuestro CSS: el tema y la tipografía se le pasan aquí, y se
  // actualizan solos si la persona cambia de tema con la pantalla abierta.
  const apariencia = useAparienciaDeTarjeta()
  const idiomaDeTarjeta = useTranslation().i18n?.language
  const options = useMemo(
    () =>
      clientSecret
        ? { clientSecret, appearance: apariencia, fonts: FUENTES_DE_TARJETA, locale: localeDeTarjeta(idiomaDeTarjeta) }
        : undefined,
    [clientSecret, apariencia, idiomaDeTarjeta],
  )

  const caerAEstandar = useCallback(
    async (mensaje: string) => {
      setAviso(mensaje)
      // La oferta ya no aplica: ese cobro NO ocurrió, el plan se puede volver a elegir.
      marcarCobroEnCurso(false)
      setVerEstandar(true)
      setDesenlace({ tipo: 'nada' })
      // La ventana mostraba un precio que ya no aplica: se cierra y el cliente vuelve a elegir.
      setPlanElegido(null)
      // 🔴 SetupIntent NUEVO: el anterior pudo quedar confirmado con esta tarjeta antes del 409, y volver a pagar
      // con él da 400 en Stripe (antes lo renovaba de rebote el montaje de `PlanStep`).
      setRetryToken(n => n + 1)
      await onRefreshProgress()
    },
    [marcarCobroEnCurso, onRefreshProgress],
  )

  /**
   * Cobra. `cuerpo` viaja idéntico en cada reintento: es el MISMO cobro, no uno nuevo.
   *
   * 🔴 NO lanza: **devuelve** el desenlace (la ventana pinta el suyo desde `desenlace`). Lanzar desde
   * dentro no servía: el reintento del 503 se dispara en un `setTimeout` y su rechazo no lo
   * capturaría nadie.
   */
  const cobrar = useCallback(
    async (cuerpo: ActivatePlanBody, plan: NonNullable<SetupData['plan']>, opciones?: OpcionesDeCobro): Promise<ResultadoDeCobro> => {
      marcarCobroEnCurso(true)
      ultimoCobro.current = { cuerpo, plan, opciones }
      try {
        const res = await setupService.activatePlan(organizationId, cuerpo)
        if (!montado.current) return { ok: false, mensaje: '' }
        const result = (res.data?.data ?? res.data) as ActivatePlanResult
        reintentos.current = 0
        setDesenlace({ tipo: 'nada' })

        // Respaldo del paso 10 — SOLO aquí, con el cobro ya confirmado.
        try {
          await setupService.saveStep(organizationId, BACKEND_STEP_BY_ID.offer, { plan })
        } catch {
          /* el respaldo no manda: la autoridad es `activate-plan`, que ya respondió 200 */
        }
        // Segundo `await`: si la pantalla se fue mientras se guardaba el respaldo, no se avanza desde aquí.
        if (!montado.current) return { ok: false, mensaje: '' }

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
        if (!montado.current) return { ok: false, mensaje: '' }
        const { status, code, message, details } = leerError(error)

        // 🔴 D2: el banco pide autorizar el primer cobro (3D Secure). Se abre SU reto con la tarjeta ya guardada y se
        // vuelve a mandar el MISMO cuerpo: lo que diga Stripe.js no decide, decide el servidor (200 · 409 · 402 · 503).
        // El candado sigue puesto todo el tiempo y el formulario NO se remonta (la autorización es sobre ESA tarjeta).
        if (code === 'PLAN_PAYMENT_REQUIRES_ACTION') {
          // El secreto del cobro nunca va a un log ni a la pantalla.
          const secretoDelCobro = (details as { clientSecret?: string } | undefined)?.clientSecret
          // Un reto por clic: si ya hubo uno (o no vino secreto), la salida es «Autorizar el pago», nunca otro reto solo.
          if (opciones?.yaAutorizo || !secretoDelCobro) {
            setDesenlace({ tipo: 'autorizar' })
            return { ok: false, mensaje: t('offer.authorizePending') }
          }
          setDesenlace({ tipo: 'autorizando' })
          await stripePromise
            .then(stripe => stripe?.confirmCardPayment(secretoDelCobro, { payment_method: cuerpo.paymentMethodId }))
            .catch(() => undefined)
          if (!montado.current) return { ok: false, mensaje: '' }
          return cobrar(cuerpo, plan, { yaAutorizo: true })
        }

        if (status === 402) {
          // 🔴 NUNCA el `message` de Stripe: viene en inglés y esta pantalla está en español
          // («Your card was declined.» en medio del resumen en español, medido el 18-sep).
          const declineCode = (details as { declineCode?: string | null } | undefined)?.declineCode
          const texto = textoDeRechazo(declineCode)
          const mensaje = t(texto.clave, { defaultValue: texto.porDefecto })
          setDesenlace({ tipo: 'rechazo', mensaje })
          marcarCobroEnCurso(false) // el banco dijo que no: no hay cobro
          // Tarjeta nueva ⇒ SetupIntent nuevo.
          setRetryToken(n => n + 1)
          // 🔴 I1: si la pantalla se ocultó durante el reto (la app del banco, otra pestaña), react-query releyó el progreso
          // con el cobro todavía IN_PROGRESS y nadie más lo pregunta: los planes quedaban apagados con «sin confirmar».
          void onRefreshProgress()
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
          const tier = String((details as { currentTier?: string } | undefined)?.currentTier ?? '')
          // 🔴 26-sep: el plan activo puede venir de un cobro de un intento ANTERIOR (lo entrega el servidor al
          // recuperarlo). A quien ya pagó no se le dice «no te cobramos nada».
          const pagado = (details as { charged?: boolean } | undefined)?.charged === true
          const mensaje = pagado
            ? t('offer.activeWithoutOfferPaid', {
                defaultValue:
                  'Ya tienes activo el plan {{tier}} que pagaste en un intento anterior, así que la oferta no se puede aplicar encima. No te cobramos otra vez.',
                tier,
              })
            : t('offer.activeWithoutOffer', {
                defaultValue:
                  'Tu plan {{tier}} ya está activo con los días de prueba, así que la oferta no se puede aplicar encima. No te cobramos nada ahora.',
                tier,
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
          code !== 'PLAN_NOT_CONFIGURED' &&
          // Sin respuesta del servidor (red caída, timeout) NO es un «no»: la petición pudo llegar y
          // cobrar. Se trata igual que un 503 — mismo cuerpo, mismo cobro (Codex ronda 10, P1).
          // Y CUALQUIER 5xx, no sólo el 503: un 500 o un 502 del proxy (Render/Cloudflare) llega sin código y pudo ocurrir
          // DESPUÉS del cargo. Tratarlo como error llano dejaba volver a pagar o elegir Gratis (full-testing 26-sep).
          (status === undefined || status >= 500 || code === 'PLAN_ACTIVATION_PENDING' || code === 'PLAN_ACTIVATION_IN_PROGRESS')
        if (ambiguoDeCobro) {
          if (reintentos.current >= MAX_REINTENTOS) {
            reintentos.current = 0
            setDesenlace({ tipo: 'sin-confirmar' })
            return { ok: false, mensaje: t('offer.pending', { defaultValue: 'Tu pago se está confirmando; vuelve en unos minutos.' }) }
          }
          reintentos.current += 1
          setDesenlace({ tipo: 'esperando' })
          temporizador.current = setTimeout(() => {
            if (!montado.current) return
            void cobrar(cuerpo, plan, opciones)
          }, REINTENTO_MS)
          // Un reintento EN CURSO tampoco es un cobro: el alta no avanza. Si el reintento
          // confirma, quien avanza es `onActivated`, no este retorno.
          return { ok: false, mensaje: t('offer.confirming', { defaultValue: 'Confirmando tu pago…' }) }
        }

        const mensaje = message || t('offer.genericError', { defaultValue: 'No pudimos procesar el pago. Intenta de nuevo.' })
        setDesenlace({ tipo: 'rechazo', mensaje })
        marcarCobroEnCurso(false) // error claro (incluido PLAN_NOT_CONFIGURED): el servidor no cobró
        // 🔴 Codex R12: la tarjeta YA confirmó este SetupIntent. Volver a pagar con él da 400 en Stripe; se pide uno
        // nuevo, igual que tras un rechazo del banco (y como ya hace `PlanStep` ante cualquier fallo).
        setRetryToken(n => n + 1)
        return { ok: false, mensaje }
      }
    },
    [caerAEstandar, marcarCobroEnCurso, onActivated, onRefreshProgress, organizationId, t],
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

  /**
   * Cobra el plan de la ventana por el MISMO endpoint: un solo camino que crea dinero. El plan de la
   * campaña (sin haberla ignorado) es el cuerpo LAUNCH de `pagarLaOferta`; cualquier otro es la prueba
   * de 30 días con tarjeta (STANDARD, `payNow:false`, hoy se cobran 0).
   */
  const pagarPlan = useCallback(
    async (tier: PlanDePago, paymentMethodId: string) => {
      if (oferta && !verEstandar && tier === oferta.planTier) return pagarLaOferta(paymentMethodId)
      const esperado = expectedStandardFirstChargeCents(planQuote, tier, 'monthly', false)
      if (esperado === null) {
        // 🔴 Sin la cotización del servidor no hay monto que consentir, así que NO se cobra ni se avanza.
        setDesenlace({
          tipo: 'rechazo',
          mensaje: t('offer.noQuote', { defaultValue: 'No pudimos cargar los precios. Recarga la página e intenta de nuevo.' }),
        })
        // La tarjeta ya confirmó este SetupIntent: el siguiente intento necesita uno nuevo.
        setRetryToken(n => n + 1)
        return
      }
      const cuerpo: ActivatePlanBody = {
        tier,
        interval: 'monthly',
        payNow: false,
        paymentMethodId,
        offer: { kind: 'STANDARD', expectedFirstChargeCents: esperado },
        language: idioma,
      }
      const plan: NonNullable<SetupData['plan']> = {
        tier,
        paymentMethodId,
        interval: 'monthly',
        payNow: false,
        acceptedAt: new Date().toISOString(),
      }
      await cobrar(cuerpo, plan)
    },
    [cobrar, idioma, oferta, pagarLaOferta, planQuote, t, verEstandar],
  )

  // Abrir la ventana de un plan. Con un cobro sin cerrar no se elige otro (las tarjetas ya están apagadas).
  const elegir = (tier: PlanDePago) => {
    if (planBloqueado()) return
    setDesenlace({ tipo: 'nada' })
    setPlanElegido(tier)
  }
  // Tras una recarga con un cobro sin cerrar: la ventana del plan de la campaña (o Pro sin campaña) con el
  // formulario HABILITADO. El servidor recupera el cobro del intento anterior y entrega lo cobrado, sin cobrar
  // de nuevo. Sólo se bloquea con un cobro de ESTA pantalla en vuelo.
  const confirmarMiPago = () => {
    if (cobroEnCursoRef.current) return
    setDesenlace({ tipo: 'nada' })
    setPlanElegido(mostrarOferta ? oferta!.planTier : 'PRO')
  }

  // Sin respuesta definitiva tras los reintentos: el plan sigue bloqueado (pudo cobrarse). La única
  // salida es preguntar otra vez por el MISMO cobro — mismo cuerpo, así que nunca es un cargo nuevo.
  // 🔴 Mientras una comprobación está en vuelo el botón se apaga: dos toques eran dos peticiones y dos reintentos
  // en paralelo sobre el mismo cobro (full-testing 26-sep).
  const [comprobando, setComprobando] = useState(false)
  const comprobandoRef = useRef(false)
  // «Autorizar el pago» (`otroReto`) comparte esta guarda, pero reenvía el cobro SIN opciones: es la única llamada que
  // permite abrir otro reto del banco. «Volver a comprobar» reenvía las guardadas (Codex r1 #5).
  const preguntarOtraVez = useCallback(
    (otroReto: boolean) => {
      if (comprobandoRef.current) return
      comprobandoRef.current = true
      setComprobando(true)
      const ultimo = ultimoCobro.current
      // Tras una recarga no hay cuerpo que reenviar (la tarjeta no se guarda en el navegador): se le
      // pregunta al servidor cómo quedó. Si ya está activo, el asistente avanza solo.
      let pregunta: Promise<unknown>
      if (!ultimo) {
        pregunta = Promise.resolve(onRefreshProgress())
      } else {
        reintentos.current = 0
        pregunta = cobrar(ultimo.cuerpo, ultimo.plan, otroReto ? undefined : ultimo.opciones)
      }
      void pregunta
        .catch(() => undefined)
        .finally(() => {
          comprobandoRef.current = false
          if (montado.current) setComprobando(false)
        })
    },
    [cobrar, onRefreshProgress],
  )
  const volverAComprobar = () => preguntarOtraVez(false)
  const autorizarOtraVez = () => preguntarOtraVez(true)

  // M6: tras rendirse de confirmar (o con el banco esperando la autorización), el botón de pagar sigue apagado y el foco
  // se queda en el aire: va a la única salida.
  const volverAComprobarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if ((desenlace.tipo === 'sin-confirmar' || desenlace.tipo === 'autorizar') && focoPerdido()) volverAComprobarRef.current?.focus()
  }, [desenlace.tipo])
  // A dónde vuelve el foco al cerrar la ventana si el botón que la abrió ya no está («Confirmar mi pago» se desmonta).
  const tituloRef = useRef<HTMLHeadingElement>(null)

  // Un cobro sin respuesta definitiva: el que ESTA pantalla se rindió de confirmar, o el que el servidor tiene
  // abierto tras una recarga. Va dentro de la ventana si está abierta (no se puede cerrar con un cobro en vuelo) y,
  // si no, encima de las tarjetas.
  const hayPendiente = desenlace.tipo === 'sin-confirmar' || desenlace.tipo === 'autorizar' || (activacionEnCurso && !cobroEnCurso)
  const avisoPendiente = hayPendiente ? (
    <div
      role="status"
      data-testid="offer-pending-locked"
      className="flex flex-col gap-3 rounded-xl border border-input p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          {desenlace.tipo === 'autorizar' ? (
            t('offer.authorizePending')
          ) : desenlace.tipo === 'sin-confirmar' ? (
            <>
              {t('offer.pending', { defaultValue: 'Tu pago se está confirmando; vuelve en unos minutos.' })}{' '}
              {t('offer.pendingNoChange', {
                defaultValue: 'Mientras tanto no puedes cambiar de plan: el cobro puede haberse hecho.',
              })}
            </>
          ) : (
            // Tras una recarga: la salida es confirmar otra vez con la tarjeta (el servidor recupera el cobro).
            <>
              <span className="block font-semibold">{t('plans.pendingTitle')}</span>
              {t('offer.pendingAfterReload', {
                defaultValue:
                  'Tu último pago quedó sin confirmar. Vuelve a confirmar con tu tarjeta: si ya se había cobrado, lo recuperamos y no se cobra dos veces.',
              })}
            </>
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap gap-2">
        {desenlace.tipo !== 'sin-confirmar' && !planElegido && (
          <Button className="rounded-full" data-tour="offer-confirm-payment" onClick={confirmarMiPago}>
            {t('plans.confirmPayment')}
          </Button>
        )}
        <Button
          ref={volverAComprobarRef}
          variant="outline"
          className="gap-2 rounded-full"
          data-tour="offer-recheck-payment"
          onClick={desenlace.tipo === 'autorizar' ? autorizarOtraVez : volverAComprobar}
          disabled={comprobando}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {desenlace.tipo === 'autorizar' ? t('offer.authorizeAgain') : t('offer.recheck', { defaultValue: 'Volver a comprobar mi pago' })}
        </Button>
      </span>
    </div>
  ) : null

  // ── Callejón sin salida: NUNCA. Un plan ya activo se cierra con un botón que termina el alta ──
  if (desenlace.tipo === 'ya-activo') {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('offer.alreadyActiveTitle', { defaultValue: 'Tu plan ya está activo' })}</h1>
        <p className="text-sm text-muted-foreground">{desenlace.mensaje}</p>
        {/* M6: la ventana se desmonta con el foco adentro; sin esto se perdía en el <body>. */}
        <Button className="rounded-full" onClick={onFinish} data-tour="offer-enter" autoFocus>
          {t('offer.enter', { defaultValue: 'Entrar a Avoqado' })}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t('offer.changePlanNote', { defaultValue: 'Para cambiar de plan, entra a Facturación.' })}
        </p>
      </div>
    )
  }

  const abrirWhatsApp = (texto: string) => window.open(salesWhatsAppLink(texto), '_blank', 'noopener,noreferrer')

  // ── Lo que dice la ventana del plan elegido. Sólo formatea montos del servidor; no calcula ninguno ──
  const ventanaDeOferta = !!planElegido && mostrarOferta && planElegido === oferta!.planTier
  const cotizado = planElegido ? planQuote?.tiers?.[planElegido] : undefined
  // Informativa: la fecha real del primer cobro la fija Stripe al terminar la prueba.
  const fechaDelCobro = cotizado ? new Date(Date.now() + planQuote!.trialDays * DIA_MS) : null
  const fechaDelCobroTexto =
    fechaDelCobro &&
    new Intl.DateTimeFormat(getIntlLocale(i18n?.language), { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(
      fechaDelCobro,
    )
  const ventana = ventanaDeOferta
    ? {
        titulo: t('plans.offerTitle', { price: formatMXN(oferta!.promo.monthlyCents), count: oferta!.promo.months }),
        subtitulo: t('offer.planLine', { defaultValue: 'Plan {{plan}} · IVA incluido', plan: oferta!.planName }),
        hoyPagasCents: oferta!.firstChargeCents,
        primerCobro: undefined,
        legal: t('offer.legal', {
          defaultValue:
            'Al pagar autorizas a Avoqado a cobrar {{promo}} al mes durante {{count}} meses y después {{renewal}} al mes a esta tarjeta hasta que canceles. Cancela cuando quieras desde Facturación.',
          promo: formatMXN(oferta!.promo.monthlyCents),
          count: oferta!.promo.months,
          renewal: formatMXN(oferta!.renewal.monthlyCents),
          total: formatMXN(oferta!.promo.periodTotalCents),
        }),
        boton: t('offer.payAndEnter', { defaultValue: 'Pagar {{price}} y entrar', price: formatMXN(oferta!.firstChargeCents) }),
      }
    : {
        titulo: t('plans.trialTitle', { plan: planElegido ? NOMBRE_DEL_PLAN[planElegido] : '' }),
        subtitulo: t('plans.trialSubtitle'),
        // Prueba de 30 días: hoy no se cobra nada.
        hoyPagasCents: 0,
        primerCobro: cotizado
          ? { fecha: fechaDelCobro!, texto: textoDePrecio(t, cotizado.monthlyCents, cotizado.monthlyNetCents) }
          : undefined,
        // Sin cotización no hay monto que consentir (y el cobro tampoco sale): no se inventa un legal.
        legal: cotizado ? t('plans.trialLegal', { fecha: fechaDelCobroTexto, monto: formatMXN(cotizado.monthlyCents) }) : '',
        boton: t('plans.startTrial'),
      }

  return (
    <>
      {/* 🔴 `inert` con la ventana abierta: es `modal={false}` (por el 3D Secure de Stripe), así que sin esto el Tab
          llegaba a «Elegir…» y al pie debajo de un cobro. React 18 no conoce `inert`: va como texto vacío (en React 19
          es booleano y `''` contaría como apagado). */}
      <div
        data-testid="planes-del-alta"
        className="flex flex-col gap-6"
        // ponytail: React 18 sólo pinta `inert` como texto (''); al subir a React 19 aquí va `inert: true` ('' lo apagaría en silencio).
        {...(planElegido ? { inert: '' } : {})}
      >
        <div className="flex flex-col gap-2">
          <h1 ref={tituloRef} tabIndex={-1} className="text-2xl font-semibold outline-none sm:text-3xl">
            {mostrarOferta ? (oferta!.copy.headline ?? t('plans.title')) : t('plans.title')}
          </h1>
          {mostrarOferta ? (
            oferta!.copy.subheadline && <p className="text-sm text-muted-foreground">{oferta!.copy.subheadline}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('plans.subtitle')}</p>
          )}
        </div>

        {(aviso || noDisponible) && (
          <div className="flex items-start gap-2 rounded-xl border border-input p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1">
              {aviso ??
                t('offer.claimedUnavailable', {
                  defaultValue: 'La oferta {{code}} ya no está disponible.',
                  code: noDisponible?.code ?? '',
                })}
            </span>
          </div>
        )}
        {!planElegido && avisoPendiente}

        <TarjetasDePlanes oferta={mostrarOferta ? oferta : null} planQuote={planQuote} bloqueado={pagoEnVuelo} onElegir={elegir} />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
          <button
            type="button"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => setComparando(true)}
          >
            {t('plans.compare')}
          </button>
          <button
            type="button"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => abrirWhatsApp(t('plans.noCardWhatsApp'))}
          >
            {t('plans.noCard')}
          </button>
          <HybridOnboardingButton
            initialSlug={data?.hybridOfferSlug}
            venueId={venueId ?? ''}
            disabled={pagoEnVuelo}
            onNext={step => onFreePlan?.(step.plan!)}
          />
        </div>
      </div>

      <Dialog open={comparando} onOpenChange={setComparando}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogTitle>{t('plans.compareTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('plans.compare')}</DialogDescription>
          <PlanComparison ocultarGratis siempreAbierta />
        </DialogContent>
      </Dialog>

      <VentanaDePago
        abierta={!!planElegido}
        // 🔴 No se cierra con un cobro de esta pantalla en vuelo. Tras una recarga (`activacionEnCurso`) sí: no hay
        // nada en vuelo aquí y las tarjetas siguen apagadas, así que cerrar no deja cambiar de plan.
        puedeCerrar={!pagoBloqueado}
        focoDeRespaldo={tituloRef}
        onCerrar={() => {
          if (!pagoBloqueado) setPlanElegido(null)
        }}
        titulo={ventana.titulo}
        subtitulo={ventana.subtitulo}
        hoyPagasCents={ventana.hoyPagasCents}
        primerCobro={ventana.primerCobro}
        legal={ventana.legal}
      >
        {desenlace.tipo === 'esperando' && (
          <p className="text-sm text-muted-foreground">{t('offer.confirming', { defaultValue: 'Confirmando tu pago…' })}</p>
        )}
        {desenlace.tipo === 'autorizando' && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('offer.authorizing')}
          </p>
        )}
        {avisoPendiente}

        {!ventanaDeOferta && !cotizado ? (
          // M2: sin la cotización del servidor no hay monto ni legal que consentir, así que no se pide la tarjeta
          // (guardarla sin ese texto era recabar un método de pago sin consentimiento). `pagarPlan` sigue negándose solo.
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('offer.noQuote', { defaultValue: 'No pudimos cargar los precios. Recarga la página e intenta de nuevo.' })}</span>
          </div>
        ) : intentStatus === 'error' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('plans.setupIntentError')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="gap-2 rounded-full" onClick={() => setRetryToken(n => n + 1)}>
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                {t('plan.retry', { defaultValue: 'Reintentar' })}
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => abrirWhatsApp(t('plans.problemsWhatsApp'))}
              >
                {t('plans.problems')}
              </button>
            </div>
          </div>
        ) : !options ? (
          <p className="text-sm text-muted-foreground">{t('plan.loading', { defaultValue: 'Cargando…' })}</p>
        ) : (
          // `key`: el `clientSecret` de <Elements> es INMUTABLE. Sin remontar, el SetupIntent nuevo que se pide tras un
          // rechazo nunca llegaba al formulario y el reintento confirmaba el gastado (full-testing, 26-sep).
          <Elements key={clientSecret ?? 'sin-intent'} stripe={stripePromise} options={options}>
            <PlanCardForm
              dataTourPrefix={ventanaDeOferta ? 'setup-offer' : 'setup-plan'}
              payNowLabel={ventana.boton}
              busy={pagoBloqueado}
              onBusyChange={setTarjetaTrabajando}
              errorMessage={desenlace.tipo === 'rechazo' ? desenlace.mensaje : null}
              onConfirmed={pm => pagarPlan(planElegido!, pm)}
              // Stripe no cargó el formulario: se muestra el «Reintentar» de arriba, que pide un SetupIntent nuevo.
              onLoadError={() => setIntentStatus('error')}
            />
          </Elements>
        )}
      </VentanaDePago>
    </>
  )
}
