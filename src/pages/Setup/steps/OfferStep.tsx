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
 *
 * Planes editables (B2, Task 11) — **sólo con `planQuote.oferta`** (una versión del editor); sin ella todo es como hoy:
 *  - cada compra manda el comprobante (`quoteToken`) de la opción que el SERVIDOR cotizó, y la ventana enseña SU precio y
 *    SU fecha de fin de prueba;
 *  - el SetupIntent se pide sólo al abrir una ventana que pide tarjeta, nunca al montar;
 *  - la prueba sin tarjeta no monta el formulario de Stripe y, al abrirse, pregunta qué tarjeta cobraría Stripe;
 *  - el Básico no se ofrece (§11.2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { AlertCircle, MessageCircle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { PlanComparison } from '@/components/billing/PlanComparison'
import { salesWhatsAppLink } from '@/config/plan-catalog'
import { deriveBusinessCategory } from '@/config/sector-terminology'
import { setupService } from '@/services/setup.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { pedidoCompartido, type PedidoEnVuelo } from './pedidoCompartido'
import { track } from '@/lib/posthog'
import { trackPurchase } from '@/lib/gtag'
import { focoPerdido } from '../offer/focoPerdido'
import { formatMXN } from '../offer/formatMXN'
import { textoDeRechazo } from '../offer/mensajeDeRechazo'
import { expectedStandardFirstChargeCents, opcionDelAlta } from '../offer/standardQuote'
import { marcaLegible } from '../offer/marcaLegible'
import { textoDePrecio } from '../offer/textoDePrecio'
import { BACKEND_STEP_BY_ID } from '../stepRegistry'
import {
  isOfferAvailable,
  type ActivatePlanBody,
  type ActivatePlanResult,
  type ActivatePlanSinTarjetaBody,
  type LaunchOfferState,
  type PlanQuote,
  type TarjetaDeLaPrueba,
} from '../launchOffer.types'
import { PlanCardForm } from './PlanCardForm'
import { FUENTES_DE_TARJETA, localeDeTarjeta, useAparienciaDeTarjeta } from '../offer/stripeAppearance'
import { HybridOnboardingButton } from '@/components/billing/HybridOnboardingButton'
import { usePublicBasicPlan } from '@/hooks/usePublicBasicPlan'
import { readHybridOffer } from '@/lib/hybridIntent'
import { fmtPesos } from '@/utils/pesos'
import { TarjetasDePlanes, type JuegoDeBeneficios } from './planes/TarjetasDePlanes'
import { VentanaDePago } from './planes/VentanaDePago'
import type { SetupData } from '../types'
import type { BusinessCategory } from '@/types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

/** Espera entre reintentos de un desenlace desconocido, y cuántos se hacen antes de rendirse. */
const REINTENTO_MS = 10_000
const MAX_REINTENTOS = 3

const DIA_MS = 24 * 60 * 60 * 1000
// Nombres de marca: iguales en español e inglés (como en `TarjetasDePlanes`).
const NOMBRE_DEL_PLAN = { PRO: 'Pro', PREMIUM: 'Premium' } as const

type PlanDePago = 'PRO' | 'PREMIUM'

const BENEFICIOS_POR_CATEGORIA: Partial<Record<BusinessCategory, JuegoDeBeneficios>> = {
  FOOD_SERVICE: 'restaurante',
  RETAIL: 'comercio',
  SERVICES: 'servicios',
}

/**
 * Las viñetas de Pro/Premium hablan el idioma del giro del paso 3. Sin giro va el genérico: el default de
 * `deriveBusinessCategory` es restaurante (lo usan otras pantallas) y aquí le hablaría de «Mesas» a cualquiera.
 */
function beneficiosDelGiro(businessType: string | undefined): JuegoDeBeneficios {
  if (!businessType) return 'generico'
  return BENEFICIOS_POR_CATEGORIA[deriveBusinessCategory(businessType)] ?? 'generico'
}

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
  /**
   * Planes editables (B2, b2-r3 #3): la prueba sin tarjeta terminó antes de cerrar el alta y el negocio quedó en Gratis. Se
   * avisa ANTES de pedir el progreso, para que el cierre del asistente diga lo mismo.
   */
  onPruebaTerminada?: (mensaje: string) => void
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
  // Planes editables (B2, b2-r3 #3): la prueba sin tarjeta terminó; el alta quedó en Gratis. No se cobró nada.
  | { tipo: 'prueba-terminada'; mensaje: string }

/**
 * Lo que la ventana sin tarjeta sabe de la tarjeta que cobraría Stripe (§18), leído al abrirse. 🔴 `desconocida` (la lectura
 * falló) NUNCA se dice «sin tarjeta»: si la tiene, se le cobraría al terminar la prueba.
 */
type LecturaDeTarjeta = { estado: 'cargando' } | { estado: 'lista'; tarjeta: TarjetaDeLaPrueba['tarjeta'] } | { estado: 'desconocida' }

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
  onPruebaTerminada,
}: OfferStepProps) {
  const { t, i18n } = useTranslation('setup')
  const idioma = i18n?.language?.startsWith('en') ? 'en' : 'es'

  const oferta = isOfferAvailable(launchOffer) ? launchOffer : null
  const noDisponible = launchOffer && !launchOffer.available ? launchOffer : null
  // Planes editables (B2): la versión del editor que publica el SERVIDOR. Sin ella, el alta de hoy.
  const ofertaDelAlta = planQuote?.oferta ?? null

  // «Ignorar la oferta»: lo pone la caída tras un 409 (`caerAEstandar`). Las tarjetas pasan a la prueba
  // de 30 días y el precio normal hay que volver a tocarlo.
  const [verEstandar, setVerEstandar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  // El plan cuya ventana para pagar está abierta (null = viendo las 3 tarjetas).
  const [planElegido, setPlanElegido] = useState<PlanDePago | null>(null)
  // Plan Básico: se elige como una tarjeta más (a la izquierda de Pro), pero por dentro es Pro mensual, sin pagar hoy.
  // 🔴 Con una versión del editor el Básico no se vende (§11.2): ni su tarjeta ni su cuerpo, aunque esté publicado.
  const { plan: basicoPublicado } = usePublicBasicPlan(!ofertaDelAlta)
  const planBasico = ofertaDelAlta ? null : basicoPublicado
  const [basicoElegido, setEsBasico] = useState(data?.plan?.basicPlan === true)
  const esBasico = !ofertaDelAlta && basicoElegido
  const slugRecomendado = data?.hybridOfferSlug ?? readHybridOffer()
  const basicoRecomendado = !!planBasico && !!slugRecomendado && slugRecomendado === planBasico.slug
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
    cuerpo: ActivatePlanBody | ActivatePlanSinTarjetaBody
    plan: NonNullable<SetupData['plan']>
    opciones?: OpcionesDeCobro
  } | null>(null)
  // Tras una RECARGA con un cobro sin cerrar en el servidor (`activacionEnCurso`), el candado arranca
  // puesto: la pantalla se pintó de cero y no sabe del cobro que ya salió (Codex ronda 10).
  // 🔴 Planes editables (b2-r2 #2): con una versión del editor la recarga NO apaga las tarjetas: cualquier plan cotizado se
  // puede elegir y su cuerpo va a `activate-plan`, donde el SERVIDOR primero recupera el intento anterior (si cobró, cierra
  // con lo que cobró; si no, lo descarta). Un cobro de ESTA pantalla en vuelo sigue apagando todo. Sin versión, como hoy.
  const recargaApagaLosPlanes = !!activacionEnCurso && !ofertaDelAlta
  const pagoEnVuelo = cobroEnCurso || tarjetaTrabajando || recargaApagaLosPlanes
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
  // La ventana abierta es la de la campaña (cuerpo LAUNCH), no la de un plan de la lista.
  const ventanaDeOferta = !!planElegido && !esBasico && mostrarOferta && planElegido === oferta!.planTier
  // Planes editables: la opción cotizada (y firmada) de la ventana abierta. Sin versión del editor, `null`.
  const opcionElegida = planElegido && ofertaDelAlta && !ventanaDeOferta ? opcionDelAlta(planQuote, planElegido, 'monthly') : null
  const planCotizado = planElegido && ofertaDelAlta ? ofertaDelAlta.planes[planElegido] : null
  // La prueba SIN tarjeta: su ventana no monta el formulario de Stripe ni pide un SetupIntent.
  const ventanaSinTarjeta = !!opcionElegida && planCotizado?.requiresCard === false

  /** ¿La ventana de este plan pide una tarjeta? Sin versión del editor, siempre (como hoy). */
  const ventanaPideTarjeta = (tier: PlanDePago) =>
    !ofertaDelAlta ||
    (mostrarOferta && tier === oferta!.planTier) ||
    (ofertaDelAlta.planes[tier]?.requiresCard === true && !!opcionDelAlta(planQuote, tier, 'monthly'))
  // 🔴 b2-r1 #4: con una versión del editor el SetupIntent se pide la PRIMERA vez que se abre una ventana que pide tarjeta (y
  // después se reusa, como hoy), nunca al montar: elegir un plan sin tarjeta no le pide nada a Stripe. Sin versión, al montar.
  const [tarjetaPedida, setTarjetaPedida] = useState(false)
  const pideSetupIntent = !ofertaDelAlta || tarjetaPedida

  // SetupIntent para la tarjeta, para cualquier plan (oferta o prueba): se pide al montar, no al abrir
  // la ventana, para que el formulario aparezca ya listo. (Con la versión del editor, ver `pideSetupIntent`.)
  useEffect(() => {
    if (!pideSetupIntent) return
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
  }, [venueId, retryToken, pideSetupIntent])

  // 🔴 §18 (b2-r8): al abrir la ventana sin tarjeta se pregunta EN ESE MOMENTO qué tarjeta cobraría Stripe al terminar la
  // prueba (nunca de un `progress` leído antes: la persona pudo guardar una tarjeta en otra pestaña). Sólo informa: el cuerpo
  // no lleva nada de ella y nada se compara al cobrar. Mientras carga, el botón está apagado.
  const [lecturaDeTarjeta, setLecturaDeTarjeta] = useState<LecturaDeTarjeta>({ estado: 'cargando' })
  const [releerTarjeta, setReleerTarjeta] = useState(0)
  useEffect(() => {
    if (!ventanaSinTarjeta) return
    let vivo = true
    setLecturaDeTarjeta({ estado: 'cargando' })
    setupService
      .tarjetaDeLaPrueba(organizationId)
      .then(respuesta => {
        if (!vivo) return
        // `{ tarjeta: null }` es «sin tarjeta guardada»; una respuesta sin la llave no dice nada (= no se sabe).
        const tarjeta = respuesta?.tarjeta
        setLecturaDeTarjeta(tarjeta !== undefined && typeof tarjeta === 'object' ? { estado: 'lista', tarjeta } : { estado: 'desconocida' })
      })
      .catch(() => {
        if (vivo) setLecturaDeTarjeta({ estado: 'desconocida' })
      })
    return () => {
      vivo = false
      // Al cerrar (o al releer) se olvida: la ventana que se abra después nunca enseña una lectura vieja, ni por un instante.
      setLecturaDeTarjeta({ estado: 'cargando' })
    }
  }, [ventanaSinTarjeta, planElegido, organizationId, releerTarjeta])

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
   * 🔴 b2-r3 #3: la prueba sin tarjeta terminó antes de cerrar el alta y el SERVIDOR la cerró en Gratis. No se cobró nada: el
   * plan se suelta, la ventana se cierra, se dice por qué y se vuelve a pedir el progreso (con el alta terminada, el asistente
   * sale como con cualquier alta terminada).
   */
  const terminarPorPrueba = useCallback(
    async (mensaje: string) => {
      marcarCobroEnCurso(false)
      setPlanElegido(null)
      setDesenlace({ tipo: 'prueba-terminada', mensaje })
      onPruebaTerminada?.(mensaje)
      await onRefreshProgress()
    },
    [marcarCobroEnCurso, onPruebaTerminada, onRefreshProgress],
  )

  /**
   * Cobra. `cuerpo` viaja idéntico en cada reintento: es el MISMO cobro, no uno nuevo.
   *
   * 🔴 NO lanza: **devuelve** el desenlace (la ventana pinta el suyo desde `desenlace`). Lanzar desde
   * dentro no servía: el reintento del 503 se dispara en un `setTimeout` y su rechazo no lo
   * capturaría nadie.
   */
  const cobrar = useCallback(
    async (
      cuerpo: ActivatePlanBody | ActivatePlanSinTarjetaBody,
      plan: NonNullable<SetupData['plan']>,
      opciones?: OpcionesDeCobro,
    ): Promise<ResultadoDeCobro> => {
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
          // La prueba sin tarjeta no tiene método de pago (y no debería pedir reto): sin él, el reto es de la tarjeta del cobro.
          const metodoDelCobro = 'paymentMethodId' in cuerpo ? cuerpo.paymentMethodId : undefined
          await stripePromise
            .then(stripe =>
              metodoDelCobro
                ? stripe?.confirmCardPayment(secretoDelCobro, { payment_method: metodoDelCobro })
                : stripe?.confirmCardPayment(secretoDelCobro),
            )
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

        // 🔴 b2-r3 #3 y T6: la prueba sin tarjeta terminó y el alta quedó en Gratis. Llega como `PLAN_TRIAL_ENDED` o, si el
        // alta ya se había cerrado en Gratis, como `PLAN_ALREADY_ACTIVATED` con `currentTier: 'FREE'` (sin versión del editor
        // ese caso no existe: sólo el cierre de esta prueba deja el alta activa en Gratis). Las dos salen igual.
        const planActual = (details as { currentTier?: string } | undefined)?.currentTier
        if (code === 'PLAN_TRIAL_ENDED' || (code === 'PLAN_ALREADY_ACTIVATED' && planActual === 'FREE')) {
          const mensaje =
            (code === 'PLAN_TRIAL_ENDED' && message) ||
            t('offer.trialEnded', { defaultValue: 'Tu prueba terminó sin tarjeta y tu negocio quedó en Gratis. No se te cobró nada.' })
          await terminarPorPrueba(mensaje)
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

        // Planes editables: un plan que salió de venta o un comprobante que ya no sirve (vencido, de otra versión, roto) es
        // la misma situación que una oferta cambiada: no se cobró nada y el precio nuevo exige un consentimiento NUEVO.
        const ofertaDeLaVersionCambio = code === 'PLAN_NOT_ON_SALE' || code === 'QUOTE_EXPIRED' || code === 'QUOTE_INVALID'
        if (
          code === 'LAUNCH_OFFER_UNAVAILABLE' ||
          code === 'OFFER_CHANGED' ||
          code === 'LAUNCH_OFFER_NOT_APPLICABLE' ||
          ofertaDeLaVersionCambio
        ) {
          const mensaje =
            code === 'OFFER_CHANGED' || ofertaDeLaVersionCambio
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
    [caerAEstandar, marcarCobroEnCurso, onActivated, onRefreshProgress, organizationId, t, terminarPorPrueba],
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
      if (!esBasico && oferta && !verEstandar && tier === oferta.planTier) return pagarLaOferta(paymentMethodId)
      // Planes editables (B2): la opción que el SERVIDOR cotizó, con su comprobante. Con prueba hoy se paga $0; con 0 días se
      // paga hoy su `firstChargeCents` (y el 3D Secure va por el mismo `cobrar`). Nunca un monto calculado aquí, ni el Básico.
      if (ofertaDelAlta) {
        const opcion = opcionDelAlta(planQuote, tier, 'monthly')
        if (!opcion) {
          setDesenlace({
            tipo: 'rechazo',
            mensaje: t('offer.noQuote', { defaultValue: 'No pudimos cargar los precios. Recarga la página e intenta de nuevo.' }),
          })
          setRetryToken(n => n + 1)
          return
        }
        const pagaHoy = opcion.trialEndsAt === null
        const cuerpo: ActivatePlanBody = {
          tier,
          interval: 'monthly',
          payNow: pagaHoy,
          paymentMethodId,
          offer: { kind: 'STANDARD', expectedFirstChargeCents: opcion.firstChargeCents, quoteToken: opcion.quoteToken },
          language: idioma,
        }
        const plan: NonNullable<SetupData['plan']> = {
          tier,
          paymentMethodId,
          interval: 'monthly',
          payNow: pagaHoy,
          acceptedAt: new Date().toISOString(),
        }
        await cobrar(cuerpo, plan)
        return
      }
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
      // Plan Básico: si el plan guardado lo eligió (la prueba de Pro que termina sola sin cobrar), viaja en el cuerpo. El
      // servidor fija la modalidad en el PRIMER create y responde la REAL (`trialModality`).
      const basico = tier === 'PRO' && esBasico ? ({ basicPlan: true } as const) : {}
      const cuerpo: ActivatePlanBody = {
        tier,
        interval: 'monthly',
        payNow: false,
        paymentMethodId,
        offer: { kind: 'STANDARD', expectedFirstChargeCents: esperado },
        language: idioma,
        ...basico,
      }
      const plan: NonNullable<SetupData['plan']> = {
        tier,
        paymentMethodId,
        interval: 'monthly',
        payNow: false,
        acceptedAt: new Date().toISOString(),
        ...basico,
      }
      await cobrar(cuerpo, plan)
    },
    [cobrar, esBasico, idioma, oferta, ofertaDelAlta, pagarLaOferta, planQuote, t, verEstandar],
  )

  /**
   * 🔴 La prueba SIN tarjeta (§16, §18): su propio cuerpo, por el MISMO `cobrar` (el mismo candado, los mismos reintentos del
   * 503 o la red con el MISMO cuerpo, y el respaldo `PUT step/10` sólo tras el 200, con `sinTarjeta` en el plan). No lleva
   * nada de la tarjeta que enseñó la ventana: esa sólo informa.
   */
  const empezarSinTarjeta = useCallback(
    async (tier: PlanDePago) => {
      if (cobroEnCursoRef.current) return
      const opcion = opcionDelAlta(planQuote, tier, 'monthly')
      if (!opcion) {
        setDesenlace({
          tipo: 'rechazo',
          mensaje: t('offer.noQuote', { defaultValue: 'No pudimos cargar los precios. Recarga la página e intenta de nuevo.' }),
        })
        return
      }
      const cuerpo: ActivatePlanSinTarjetaBody = {
        tier,
        interval: 'monthly',
        payNow: false,
        offer: { kind: 'STANDARD_SIN_TARJETA', expectedFirstChargeCents: 0, quoteToken: opcion.quoteToken },
        language: idioma,
      }
      const plan: NonNullable<SetupData['plan']> = {
        tier,
        interval: 'monthly',
        payNow: false,
        sinTarjeta: true,
        acceptedAt: new Date().toISOString(),
      }
      await cobrar(cuerpo, plan)
    },
    [cobrar, idioma, planQuote, t],
  )

  // Abrir la ventana de un plan. Con un cobro sin cerrar no se elige otro (las tarjetas ya están apagadas).
  const elegir = (tier: PlanDePago, basico = false) => {
    if (planBloqueado()) return
    // Con la tarjeta Básico a la vista, cada clic es una elección explícita; sin ella manda el plan guardado.
    if (planBasico) setEsBasico(basico && tier === 'PRO')
    setDesenlace({ tipo: 'nada' })
    if (ofertaDelAlta && ventanaPideTarjeta(tier)) setTarjetaPedida(true)
    setPlanElegido(tier)
    // La pantalla de la tarjeta es donde se cae casi todo el alta (7 de 8 el 26-oct): abrirla y cerrarla sin pagar son
    // los pasos del embudo, y el cierre dispara la encuesta «¿qué te detuvo?» de PostHog.
    abiertaDesde.current = Date.now()
    track('plan_card_opened', { tier, launch_offer_code: mostrarOferta ? oferta?.code : undefined, flow: 'short' })
  }
  const abiertaDesde = useRef(0)
  // Tras una recarga con un cobro sin cerrar: la ventana del plan de la campaña (o Pro sin campaña) con el
  // formulario HABILITADO. El servidor recupera el cobro del intento anterior y entrega lo cobrado, sin cobrar
  // de nuevo. Sólo se bloquea con un cobro de ESTA pantalla en vuelo.
  const abrirVentanaDeRecuperacion = () => {
    setDesenlace({ tipo: 'nada' })
    // Con la versión del editor, el primer plan que siga en venta (Pro sale de venta ⇒ Premium); sin ella, Pro como hoy.
    const sinPro = !!ofertaDelAlta && !opcionDelAlta(planQuote, 'PRO', 'monthly') && !!opcionDelAlta(planQuote, 'PREMIUM', 'monthly')
    const tier: PlanDePago = mostrarOferta ? oferta!.planTier : sinPro ? 'PREMIUM' : 'PRO'
    if (ofertaDelAlta && ventanaPideTarjeta(tier)) setTarjetaPedida(true)
    setPlanElegido(tier)
    // También es abrir la tarjeta: sin esto, cerrarla contaba un «cerró» sin «abrió» y medía el tiempo desde 1970 (Codex r1).
    abiertaDesde.current = Date.now()
    track('plan_card_opened', { tier, launch_offer_code: mostrarOferta ? oferta?.code : undefined, flow: 'short', recovery: true })
  }
  // 🔴 b2-r9 #2: con la versión del editor, «Confirmar mi pago» primero pregunta por el intento a medio pago, sin depender de
  // ninguna opción cotizada (una versión nueva pudo dejar los planes fuera de venta). `RETO` ⇒ el MISMO reto del banco, sobre la
  // tarjeta que ya tiene el cobro (sin `payment_method`), y después otra vez `retomarPago` y el progreso (si Stripe todavía no
  // activa la suscripción, queda el aviso «sin confirmar» y lo cierra el aviso de Stripe o el barrido). `CERRADA` ⇒ el progreso
  // (el asistente avanza solo). `NADA` o un error ⇒ la ventana de hoy.
  // M2: con NINGÚN plan a la venta (y sin campaña) esa ventana sólo podría decir «recarga la página», que no ayuda: en su lugar
  // se dice que se vuelva a comprobar en unos minutos (el aviso conserva «Volver a comprobar mi pago») y se pide el progreso
  // una vez, por si el barrido ya cerró el intento.
  const [retomando, setRetomando] = useState(false)
  const retomandoRef = useRef(false)
  const [avisoDeRecuperacion, setAvisoDeRecuperacion] = useState<string | null>(null)
  const confirmarMiPago = () => {
    if (cobroEnCursoRef.current) return
    if (!ofertaDelAlta) return abrirVentanaDeRecuperacion()
    if (retomandoRef.current) return
    retomandoRef.current = true
    setRetomando(true)
    setAvisoDeRecuperacion(null)
    void (async () => {
      let abrirLaVentana = false
      try {
        const retoma = await setupService.retomarPago(organizationId)
        if (!montado.current) return
        if (retoma?.estado === 'RETO' && retoma.clientSecret) {
          await stripePromise.then(stripe => stripe?.confirmCardPayment(retoma.clientSecret)).catch(() => undefined)
          if (!montado.current) return
          await setupService.retomarPago(organizationId).catch(() => undefined)
          if (!montado.current) return
          await onRefreshProgress()
        } else if (retoma?.estado === 'CERRADA') {
          await onRefreshProgress()
        } else {
          abrirLaVentana = true
        }
      } catch {
        abrirLaVentana = true
      } finally {
        retomandoRef.current = false
        if (montado.current) setRetomando(false)
      }
      if (!abrirLaVentana || !montado.current || cobroEnCursoRef.current) return
      const hayQueCobrar = mostrarOferta || !!opcionDelAlta(planQuote, 'PRO', 'monthly') || !!opcionDelAlta(planQuote, 'PREMIUM', 'monthly')
      if (hayQueCobrar) {
        abrirVentanaDeRecuperacion()
        return
      }
      setAvisoDeRecuperacion(
        t('offer.confirmLater', {
          defaultValue: 'Todavía no podemos confirmar tu pago. Vuelve a comprobarlo en unos minutos; no se te cobrará dos veces.',
        }),
      )
      await Promise.resolve(onRefreshProgress()).catch(() => undefined)
    })()
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
              {avisoDeRecuperacion && <span className="mt-2 block">{avisoDeRecuperacion}</span>}
            </>
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap gap-2">
        {desenlace.tipo !== 'sin-confirmar' && !planElegido && (
          <Button className="rounded-full" data-tour="offer-confirm-payment" onClick={confirmarMiPago} disabled={retomando}>
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
  // La prueba sin tarjeta que terminó (b2-r3 #3) sale por la misma puerta: el alta ya quedó en Gratis y se entra.
  if (desenlace.tipo === 'ya-activo' || desenlace.tipo === 'prueba-terminada') {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {desenlace.tipo === 'prueba-terminada'
            ? t('offer.trialEndedTitle', { defaultValue: 'Tu prueba terminó' })
            : t('offer.alreadyActiveTitle', { defaultValue: 'Tu plan ya está activo' })}
        </h1>
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
  // hz:c24ea658:D15 (founder, 28-oct): casi todos se iban de esta pantalla sin un clic; quien tenga una duda, que escriba.
  const escribirConDudas = () => {
    const codigo = mostrarOferta ? oferta?.code : undefined
    const negocio = data?.businessName?.trim() || t('plans.doubtsMyBusiness')
    track('setup_whatsapp_click', { step_id: 'offer', launch_offer_code: codigo, motivo: 'dudas' })
    abrirWhatsApp(
      codigo ? t('plans.doubtsWhatsAppOffer', { business: negocio, offer: codigo }) : t('plans.doubtsWhatsApp', { business: negocio }),
    )
  }

  // ── Lo que dice la ventana del plan elegido. Sólo formatea montos del servidor; no calcula ninguno ──
  const cotizado = planElegido ? planQuote?.tiers?.[planElegido] : undefined
  // Informativa: la fecha real del primer cobro la fija Stripe al terminar la prueba.
  const fechaDelCobro = cotizado ? new Date(Date.now() + planQuote!.trialDays * DIA_MS) : null
  const fechaDelCobroTexto =
    fechaDelCobro &&
    new Intl.DateTimeFormat(getIntlLocale(i18n?.language), { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(
      fechaDelCobro,
    )
  const formatearFecha = (fecha: Date) =>
    new Intl.DateTimeFormat(getIntlLocale(i18n?.language), { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(fecha)
  /**
   * Planes editables (B2): la ventana de un plan de la versión del editor. El monto es SIEMPRE el precio de la versión
   * (`precioCents`), con tarjeta o sin ella, de prueba o de 0 días (b2-r8 #1-#2, #4); la fecha, la `trialEndsAt` del SERVIDOR.
   * Sin opción cotizada (el plan salió de venta) no hay monto ni legal que consentir.
   */
  const ventanaDeLaVersion = () => {
    const nombre = planCotizado?.displayName ?? (planElegido ? NOMBRE_DEL_PLAN[planElegido] : '')
    if (!opcionElegida || !planCotizado) {
      return {
        titulo: t('plans.trialTitle', { plan: nombre }),
        subtitulo: '',
        hoyPagasCents: 0,
        primerCobro: undefined,
        legal: '',
        boton: '',
      }
    }
    const precio = formatMXN(opcionElegida.precioCents)
    const fin = opcionElegida.trialEndsAt ? new Date(opcionElegida.trialEndsAt) : null
    const finTexto = fin && !Number.isNaN(fin.getTime()) ? formatearFecha(fin) : ''
    if (!planCotizado.requiresCard) {
      const tarjeta = lecturaDeTarjeta.estado === 'lista' ? lecturaDeTarjeta.tarjeta : undefined
      return {
        titulo: t('plans.noCardTitle', { plan: nombre }),
        subtitulo: t('plans.noCardSubtitle', { count: planCotizado.trialDays }),
        hoyPagasCents: 0,
        primerCobro: undefined,
        // §18: se avisa ANTES de confirmar qué tarjeta se cobraría; sin saberlo (cargando o fallida), no se dice nada.
        legal: tarjeta
          ? t('plans.noCardWithCardLegal', {
              fecha: finTexto,
              monto: precio,
              brand: marcaLegible(tarjeta.brand) ?? '',
              last4: tarjeta.last4 ?? '',
            }).replace(/\s{2,}/g, ' ')
          : tarjeta === null
            ? t('plans.noCardLegal', { fecha: finTexto, plan: nombre })
            : '',
        boton: t('plans.startNoCard', { count: planCotizado.trialDays }),
      }
    }
    if (fin) {
      return {
        titulo: t('plans.trialTitle', { plan: nombre }),
        subtitulo: t('plans.trialSubtitleDays', { count: planCotizado.trialDays }),
        hoyPagasCents: 0,
        primerCobro: { fecha: fin, texto: textoDePrecio(t, opcionElegida.precioCents, opcionElegida.netCents) },
        legal: t('plans.trialLegal', { fecha: finTexto, monto: precio }),
        boton: t('plans.startTrialDays', { count: planCotizado.trialDays }),
      }
    }
    return {
      titulo: t('plans.payTodayTitle', { plan: nombre }),
      subtitulo: t('offer.planLine', { defaultValue: 'Plan {{plan}} · IVA incluido', plan: nombre }),
      hoyPagasCents: opcionElegida.firstChargeCents,
      primerCobro: undefined,
      legal: t('plans.payTodayLegal', { monto: precio, periodo: t('plans.periodMonthly') }),
      boton: t('plans.payToday', { price: precio }),
    }
  }
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
    : ofertaDelAlta
      ? ventanaDeLaVersion()
      : {
          titulo:
            esBasico && planBasico ? planBasico.name : t('plans.trialTitle', { plan: planElegido ? NOMBRE_DEL_PLAN[planElegido] : '' }),
          // El Básico no tiene cobro que cancelar: su texto aprobado, no «Cancela antes y no se te cobra».
          subtitulo:
            esBasico && planBasico
              ? t('billing:plan.basic.trialCopy', { price: fmtPesos(planBasico.priceWithoutTax) })
              : t('plans.trialSubtitle'),
          // Prueba de 30 días: hoy no se cobra nada.
          hoyPagasCents: 0,
          primerCobro:
            cotizado && !esBasico
              ? { fecha: fechaDelCobro!, texto: textoDePrecio(t, cotizado.monthlyCents, cotizado.monthlyNetCents) }
              : undefined,
          // Sin cotización no hay monto que consentir (y el cobro tampoco sale): no se inventa un legal.
          legal: !cotizado
            ? ''
            : esBasico && planBasico
              ? t('plans.basicLegal', { fecha: fechaDelCobroTexto, precio: fmtPesos(planBasico.priceWithoutTax) })
              : t('plans.trialLegal', { fecha: fechaDelCobroTexto, monto: formatMXN(cotizado.monthlyCents) }),
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
          <Button
            type="button"
            variant="outline"
            data-tour="setup-offer-whatsapp"
            className="mt-1 w-fit gap-2 rounded-full"
            onClick={escribirConDudas}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {t('plans.doubts')}
          </Button>
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

        <TarjetasDePlanes
          oferta={mostrarOferta ? oferta : null}
          planQuote={planQuote}
          bloqueado={pagoEnVuelo}
          onElegir={tier => elegir(tier)}
          planBasico={planBasico}
          basicoRecomendado={basicoRecomendado}
          onElegirBasico={() => elegir('PRO', true)}
          beneficios={beneficiosDelGiro(data?.businessType)}
        />

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
            // La compra híbrida cierra el paso sin cobrar: con un intento sin cerrar tras recargar sigue apagada, como hoy.
            disabled={pagoEnVuelo || !!activacionEnCurso}
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
          if (pagoBloqueado) return
          if (abiertaDesde.current > 0)
            track('plan_card_closed', {
              tier: planElegido,
              seconds_open: Math.round((Date.now() - abiertaDesde.current) / 1000),
              launch_offer_code: mostrarOferta ? oferta?.code : undefined,
              flow: 'short',
            })
          abiertaDesde.current = 0
          setPlanElegido(null)
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

        {/* b2-r8 #4: el precio de la versión no incluye el saldo de la cuenta en Stripe; se dice, nunca se compara. */}
        {!!opcionElegida && (
          <p data-testid="nota-del-saldo" className="text-xs text-muted-foreground">
            {t('plans.balanceNote')}
          </p>
        )}

        {!ventanaDeOferta && !(ofertaDelAlta ? opcionElegida : cotizado) ? (
          // M2: sin la cotización del servidor no hay monto ni legal que consentir, así que no se pide la tarjeta
          // (guardarla sin ese texto era recabar un método de pago sin consentimiento). `pagarPlan` sigue negándose solo.
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('offer.noQuote', { defaultValue: 'No pudimos cargar los precios. Recarga la página e intenta de nuevo.' })}</span>
          </div>
        ) : ventanaSinTarjeta ? (
          // 🔴 La prueba sin tarjeta: sin <Elements> ni SetupIntent. El botón espera a saber qué tarjeta cobraría Stripe.
          <div className="flex flex-col gap-3">
            {lecturaDeTarjeta.estado === 'cargando' && (
              <p className="text-sm text-muted-foreground">{t('plan.loading', { defaultValue: 'Cargando…' })}</p>
            )}
            {lecturaDeTarjeta.estado === 'desconocida' && (
              <div className="flex flex-col gap-3">
                <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('plans.cardUnknown')}</span>
                </div>
                <Button variant="outline" className="w-fit gap-2 rounded-full" onClick={() => setReleerTarjeta(n => n + 1)}>
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                  {t('plan.retry', { defaultValue: 'Reintentar' })}
                </Button>
              </div>
            )}
            {desenlace.tipo === 'rechazo' && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {desenlace.mensaje}
              </p>
            )}
            <Button
              data-tour="setup-plan-start-no-card"
              disabled={pagoBloqueado || lecturaDeTarjeta.estado !== 'lista'}
              aria-busy={cobroEnCurso}
              onClick={() => {
                if (lecturaDeTarjeta.estado === 'lista' && planElegido) void empezarSinTarjeta(planElegido)
              }}
              className="h-12 rounded-full text-base transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              {ventana.boton}
            </Button>
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
