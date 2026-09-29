/**
 * PlanStep — V2 wizard final step (mandatory, no skip).
 *
 * 4-tier selection (FREE / PRO / PREMIUM / ENTERPRISE) driven by PLAN_TIERS via the
 * shared billing PlanPicker (same integration pattern as ConversionWizard):
 *   - FREE        → continue without a card; the venue simply stays on the Free plan.
 *   - PRO/PREMIUM → card captured via Stripe Elements against a customer-scoped
 *                   SetupIntent, then two CTAs: "Empezar 30 días gratis" (payNow:false)
 *                   or "Pagar hoy" (payNow:true). PRO monthly pay-now keeps the
 *                   $599×3 intro promo (INTRO_PRO_3M on the backend).
 *   - ENTERPRISE  → contact sales (no self-serve).
 * On confirm, persists v2SetupData.plan = { tier, paymentMethodId?, interval, payNow?, acceptedAt }.
 * Old payloads have no `tier`; the backend defaults them to PRO for back-compat.
 * Spec: docs/superpowers/specs/2026-06-02-venue-base-subscription-design.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { AlertCircle, ArrowLeft, Check, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanPicker } from '@/components/billing/PlanPicker'
import { PlanComparison } from '@/components/billing/PlanComparison'
import { HybridOnboardingButton } from '@/components/billing/HybridOnboardingButton'
import { FeatureCatalogBrowser } from '@/components/billing/FeatureCatalogBrowser'
import { getTierDef, salesWhatsAppLink, type TierId } from '@/config/plan-catalog'
import { novedadesDelPlan, valorDeCelda } from '@/config/plan-comparison'
import { setupService } from '@/services/setup.service'
import { pedidoCompartido, type PedidoEnVuelo } from './pedidoCompartido'
import { useToast } from '@/hooks/use-toast'
import { PlanCardForm } from './PlanCardForm'
import { FUENTES_DE_TARJETA, localeDeTarjeta, useAparienciaDeTarjeta } from '../offer/stripeAppearance'
import { formatMXN } from '../offer/formatMXN'
import { mensajeDeFalloDeCobro } from '../offer/falloDeCobro'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { PlanQuote } from '../launchOffer.types'
import type { StepProps } from '../types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

interface PlanStepProps extends StepProps {
  venueId: string
  organizationId: string
  /**
   * Alta CORTA: cobra antes de continuar (§4.5). Se llama con la tarjeta ya guardada y ANTES de
   * `onNext`; si revienta, no se avanza. En el asistente LARGO no se pasa, así que el paso se
   * comporta exactamente como hoy: guarda `v2SetupData.plan` y el cobro ocurre al finalizar.
   */
  activateBeforeContinue?: (args: {
    tier: 'PRO' | 'PREMIUM'
    interval: 'monthly' | 'annual'
    payNow: boolean
    paymentMethodId: string
  }) => Promise<void>
  /**
   * Precios del SERVIDOR, con IVA. Presentes ⇒ las líneas promocionales se pintan con ellos en vez
   * del texto fijo de la tarjeta de planes. Ausentes ⇒ el texto de siempre.
   */
  quote?: PlanQuote | null
  /**
   * El padre tiene un cobro CONFIRMÁNDOSE (503 y reintentos agendados). El formulario ya terminó su
   * intento, así que su propio candado se soltó; éste lo sostiene hasta que haya desenlace. Sin él se
   * podía volver a Free, avanzar, y que el reintento activara Pro después (Codex ronda 8, P1).
   */
  cobroEnVuelo?: boolean
  /** Avisa al padre cuando este paso guarda la tarjeta o cobra: el padre bloquea SUS salidas con esto. */
  onTrabajandoChange?: (trabajando: boolean) => void
  /**
   * Bloquea el formulario de TARJETA (por defecto, lo mismo que `cobroEnVuelo`). Se separa porque tras
   * una recarga con un cobro sin cerrar el plan sigue congelado pero hay que poder CONFIRMAR otra vez:
   * el servidor recupera la suscripción que ya cobró y entrega el plan, sin cobrar dos veces.
   */
  pagoBloqueado?: boolean
}

/** Tiers the wizard can persist. ENTERPRISE routes to contact-sales and is never stored. */
type SelectableTier = 'FREE' | 'PRO' | 'PREMIUM'

export function PlanStep({
  onNext,
  venueId,
  data,
  activateBeforeContinue,
  quote,
  cobroEnVuelo = false,
  onTrabajandoChange,
  pagoBloqueado,
}: PlanStepProps) {
  const { t } = useTranslation('setup')
  const { t: tBilling } = useTranslation('billing')
  const [selectedTier, setSelectedTier] = useState<SelectableTier>(data.plan?.tier ?? 'PRO')
  const [interval, setInterval] = useState<'monthly' | 'annual'>(data.plan?.interval ?? 'monthly')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  // The SetupIntent can fail (backend flag off → 404) or never start (no provisional venue
  // yet). Both used to leave the step stuck on a permanent "Cargando…" with nothing to
  // click, which reads exactly like a dead button. Track the state so we can offer a retry.
  const [intentStatus, setIntentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const setupIntentEnVuelo = useRef<PedidoEnVuelo<Awaited<ReturnType<typeof setupService.planSetupIntent>>>>(null)
  // El mensaje del último cobro fallido vive AQUÍ y no en el formulario: tras un fallo el formulario se vuelve a
  // montar con un SetupIntent nuevo, y su propio estado (con el mensaje del banco) se perdería.
  const [errorDePago, setErrorDePago] = useState<string | null>(null)
  const { toast } = useToast()
  const avisarFalloDelIntent = useRef(() => {})
  avisarFalloDelIntent.current = () =>
    toast({ title: t('plan.setupIntentError', { defaultValue: 'No pudimos preparar el pago' }), variant: 'destructive' })
  // Dos fases en el MISMO paso: primero se elige el plan, luego se paga en una pantalla propia (como
  // la caja de una tienda). Antes la tarjeta quedaba debajo de la cuadrícula de planes, fuera de vista.
  const [fase, setFase] = useState<'elegir' | 'pagar'>('elegir')
  // 🔴 Mientras se guarda la tarjeta y se cobra NO se puede volver a elegir plan: hacerlo desmontaba
  // el candado del formulario y el alta avanzaba como Free y después como Pro (Codex ronda 7, P1).
  const [cobrando, setCobrando] = useState(false)
  const bloqueado = cobrando || cobroEnVuelo
  useEffect(() => {
    onTrabajandoChange?.(cobrando)
  }, [cobrando, onTrabajandoChange])
  const inicioRef = useRef<HTMLDivElement | null>(null)

  const payNowLabel = payNowLabelFactory(t as unknown as (k: string, o?: Record<string, unknown>) => string, quote)
  // Las tarjetas pintan los montos del servidor, con IVA, como el resto de esta pantalla. Sin
  // cotización quedan los del catálogo («+ IVA»), que es lo que había.
  const preciosConIva = quote?.tiers
    ? {
        PRO: { monthlyCents: quote.tiers.PRO.monthlyCents, annualCents: quote.tiers.PRO.annualCents },
        PREMIUM: { monthlyCents: quote.tiers.PREMIUM.monthlyCents, annualCents: quote.tiers.PREMIUM.annualCents },
      }
    : undefined
  const isPaidTier = selectedTier === 'PRO' || selectedTier === 'PREMIUM'
  const tierName = tBilling(`plan.tiers.${getTierDef(selectedTier).key}.name`)

  // Línea promocional: si el servidor mandó su cotización, se pinta con SUS montos (con IVA, que
  // es como se cobra en México). Sin cotización queda el texto de siempre.
  const introPro = quote?.tiers?.PRO?.intro ?? null
  const promoLine = introPro
    ? t('plan.promoLineFromQuote', {
        defaultValue: 'Paga hoy: {{count}} meses a {{intro}}, luego {{list}} al mes. IVA incluido.',
        count: introPro.months,
        intro: formatMXN(introPro.monthlyCents),
        list: formatMXN(quote?.tiers?.PRO?.monthlyCents ?? Number.NaN),
      })
    : t('plan.promoLine', { defaultValue: 'Paga hoy: 3 meses a $599 + IVA, luego $999.' })

  // Qué pasa DESPUÉS de cada botón, dicho antes de tocarlo. Con prueba gratis el cargo llega solo el
  // día que termina la prueba (Stripe cobra la tarjeta guardada), y sin descuento de introducción:
  // ese descuento sólo existe pagando hoy. Nadie debería enterarse del cargo al verlo en su banco.
  const { i18n } = useTranslation()
  const trialDays = quote?.trialDays ?? 30
  const precioTier = isPaidTier ? quote?.tiers?.[selectedTier] : undefined
  const precioRecurrente = precioTier ? (interval === 'annual' ? precioTier.annualCents : precioTier.monthlyCents) : null
  const periodo = interval === 'annual' ? t('plan.perYear', { defaultValue: 'al año' }) : t('plan.perMonth', { defaultValue: 'al mes' })
  const fechaDelCobro = new Intl.DateTimeFormat(getIntlLocale(i18n?.language), {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Mexico_City',
  }).format(new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000))
  const trialHint =
    precioRecurrente != null
      ? t('plan.trialHint', {
          defaultValue:
            'Hoy no pagas nada. El {{date}} se cobran {{price}} {{period}} a esta tarjeta. Cancela antes desde Facturación y no se te cobra.',
          date: fechaDelCobro,
          price: formatMXN(precioRecurrente),
          period: periodo,
        })
      : t('plan.trialHintNoPrice', {
          defaultValue:
            'Hoy no pagas nada. Al terminar los {{count}} días se cobra el precio del plan a esta tarjeta. Cancela antes desde Facturación y no se te cobra.',
          count: trialDays,
        })
  const conIntroHoy = selectedTier === 'PRO' && interval === 'monthly'
  const payNowHint = conIntroHoy
    ? promoLine
    : precioRecurrente != null
      ? t('plan.payNowHint', {
          defaultValue: 'Hoy se cobran {{price}} {{period}}. IVA incluido.',
          price: formatMXN(precioRecurrente),
          period: periodo,
        })
      : null

  // El precio que se ve en la barra y en el resumen: el del servidor con IVA si llegó; si no, el del
  // catálogo con «+ IVA», que es lo que había.
  const tierDef = getTierDef(selectedTier)
  const precioVisible =
    precioRecurrente != null
      ? `${formatMXN(precioRecurrente)} ${periodo}`
      : `$${(interval === 'annual' ? tierDef.priceAnnual : tierDef.priceMonthly)?.toLocaleString('es-MX')} ${periodo}`
  const notaIva =
    precioRecurrente != null ? t('plan.ivaIncluded', { defaultValue: 'IVA incluido' }) : t('plan.plusIva', { defaultValue: '+ IVA' })

  const irA = (siguiente: 'elegir' | 'pagar') => {
    // Ir A PAGAR el mismo plan nunca cambia nada; lo que se congela es volver a ELEGIR.
    if (bloqueado && siguiente === 'elegir') return
    setFase(siguiente)
    requestAnimationFrame(() => inicioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  useEffect(() => {
    if (!venueId) {
      // Nothing to fetch against yet — surface it as an error with a retry instead of an
      // endless spinner (the provisional venue is created lazily by GET progress).
      setIntentStatus('error')
      return
    }
    let active = true
    setIntentStatus('loading')
    // 🔴 Nunca a la vista un SetupIntent posiblemente gastado mientras llega el nuevo (ver abajo).
    setClientSecret(null)
    pedidoCompartido(setupIntentEnVuelo, `${venueId}:${retryToken}`, () => setupService.planSetupIntent(venueId))
      .then(res => {
        if (!active) return
        setClientSecret(res.data.data.clientSecret)
        setIntentStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setIntentStatus('error')
        avisarFalloDelIntent.current()
      })
    return () => {
      active = false
    }
    // `toast` y `t` NO van aquí: una referencia nueva de cualquiera de los dos pedía OTRO SetupIntent (26-sep).
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

  const handleSelectTier = useCallback(
    (tier: TierId) => {
      if (bloqueado) return // con un cobro sin cerrar, el plan elegido no se mueve
      if (tier === 'ENTERPRISE') {
        // Enterprise is contact-sales only — no self-serve onboarding path (matches ConversionWizard).
        window.open(salesWhatsAppLink('Hola, me interesa el plan Enterprise de Avoqado para mi negocio.'), '_blank', 'noopener,noreferrer')
        return
      }
      // La siguiente acción (Continuar) vive en la barra fija de abajo: siempre a la vista, sin saltos.
      setSelectedTier(tier)
    },
    [bloqueado],
  )

  const continuarGratis = () => {
    if (bloqueado) return
    onNext({ plan: { tier: 'FREE', acceptedAt: new Date().toISOString() } })
  }

  if (fase === 'elegir' || !isPaidTier) {
    return (
      <div ref={inicioRef} className="flex flex-col gap-8 pb-36">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{t('plan.title', { defaultValue: 'Tu plan Avoqado' })}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t('plan.subtitle', { defaultValue: 'Elige el plan que mejor se adapte a tu negocio. Puedes cambiarlo cuando quieras.' })}
          </p>
        </div>

        {/* Reuse the billing PlanPicker — same cards + monthly/annual toggle as the billing
            portal and ConversionWizard. `currentTier` is bound to the in-wizard selection so
            the chosen tier reads as "selected". Interval is controlled so a toggle flip is
            persisted even without re-clicking a tier CTA. */}
        <div data-tour="setup-plan-picker">
          <PlanPicker
            currentTier={selectedTier}
            // Wizard semantics: `currentTier` is the pick, not a plan the venue owns. Without
            // this the pre-selected PRO card rendered a disabled "Tu plan actual".
            selectionMode="choice"
            interval={interval}
            onIntervalChange={setInterval}
            promoNotes={interval === 'monthly' ? { PRO: promoLine } : undefined}
            preciosConIva={preciosConIva}
            onSelectTier={handleSelectTier}
          />
        </div>

        {/* Las tarjetas dicen TEMAS; el detalle completo, por categoría, vive aquí (cerrado por default). */}
        <PlanComparison selectedTier={selectedTier} />
        <HybridOnboardingButton initialSlug={data.hybridOfferSlug} venueId={venueId} disabled={bloqueado} onNext={onNext} />
        <FeatureCatalogBrowser />

        {/* Barra FIJA a la pantalla (no `sticky`: el contenedor del asistente la dejaba fuera de vista).
            El plan elegido y «Continuar» siempre visibles, aunque la cuadrícula o la tabla sean largas. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:pb-6">
          <div className="pointer-events-auto mx-auto flex w-full max-w-[720px] flex-col gap-3 rounded-2xl border border-input bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {t('plan.selectedPlan', { plan: tierName, defaultValue: 'Plan seleccionado: {{plan}}' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPaidTier
                  ? `${precioVisible} · ${notaIva}`
                  : t('plan.freeNote', {
                      defaultValue: 'Empieza gratis sin tarjeta. Puedes mejorar tu plan cuando quieras desde Facturación.',
                    })}
              </p>
            </div>
            {isPaidTier ? (
              <Button data-tour="setup-plan-continue" className="h-11 shrink-0 rounded-full px-8" onClick={() => irA('pagar')}>
                {t('plan.continue', { defaultValue: 'Continuar' })}
              </Button>
            ) : (
              <Button data-tour="setup-plan-free-continue" className="h-11 shrink-0 rounded-full px-8" onClick={continuarGratis}>
                {t('plan.freeContinue', { defaultValue: 'Continuar con el plan Gratis' })}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={inicioRef} className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('plan.checkoutTitle', { defaultValue: 'Confirma tu plan' })}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t('plan.checkoutSubtitle', { defaultValue: 'Elige cómo empezar y agrega tu tarjeta.' })}
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] md:items-start">
        {/* Resumen: lo que se está comprando, siempre a la vista mientras se paga. */}
        <aside className="flex flex-col gap-5 rounded-2xl bg-muted/40 p-6 md:sticky md:top-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('plan.yourPlan', { defaultValue: 'Tu plan' })}
            </p>
            <p className="mt-1 text-2xl font-semibold">{tierName}</p>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums">{precioVisible}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {notaIva} ·{' '}
              {interval === 'annual'
                ? t('plan.billedAnnually', { defaultValue: 'Se cobra una vez al año' })
                : t('plan.billedMonthly', { defaultValue: 'Se cobra cada mes' })}
            </p>
          </div>
          {(selectedTier === 'PRO' || selectedTier === 'PREMIUM') && (
            <div data-testid="plan-summary-features" className="flex flex-col gap-3 border-t border-input pt-5">
              <p className="text-sm font-medium">
                {selectedTier === 'PRO'
                  ? tBilling('plan.compare.plusFree', { defaultValue: 'Todo lo de Gratis, más:' })
                  : tBilling('plan.compare.plusPro', { defaultValue: 'Todo lo de Pro, más:' })}
              </p>
              {/* Lo que este plan agrega sobre el de abajo, una línea por categoría: completo, pero corto. */}
              <ul className="flex flex-col gap-2.5">
                {novedadesDelPlan(selectedTier).map(grupo => (
                  <li key={grupo.categoria} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                    <span>
                      <span className="font-medium">{tBilling(`plan.compare.categories.${grupo.categoria}`)}:</span>{' '}
                      <span className="text-muted-foreground">
                        {grupo.filas
                          .map(f => {
                            const valor = valorDeCelda(f, selectedTier)
                            const nombre = tBilling(`plan.compare.rows.${f.key}`)
                            return typeof valor === 'string'
                              ? `${nombre} ${tBilling(`plan.compare.values.${valor}`).toLowerCase()}`
                              : nombre
                          })
                          .join(' · ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            variant="ghost"
            data-tour="setup-plan-change"
            disabled={bloqueado}
            className="-ml-3 w-fit gap-2 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => irA('elegir')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('plan.changePlan', { defaultValue: 'Cambiar plan' })}
          </Button>
        </aside>

        <section className="flex flex-col gap-4">
          {intentStatus === 'error' || !options ? (
            intentStatus === 'error' ? (
              // Never strand the user on a spinner: say what failed and give them a way out.
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t('plan.setupIntentErrorBody', {
                      defaultValue:
                        'No pudimos preparar el pago con tarjeta. Vuelve a intentarlo o continúa con el plan Gratis y mejóralo después.',
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" className="rounded-full gap-2" onClick={() => setRetryToken(n => n + 1)}>
                    <RotateCw className="h-4 w-4" />
                    {t('plan.retry', { defaultValue: 'Reintentar' })}
                  </Button>
                  <Button variant="ghost" className="rounded-full" onClick={continuarGratis}>
                    {t('plan.freeContinue', { defaultValue: 'Continuar con el plan Gratis' })}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('plan.loading', { defaultValue: 'Cargando…' })}</p>
            )
          ) : (
            // `key`: el `clientSecret` de <Elements> es INMUTABLE; sin remontar, el SetupIntent nuevo no llega al formulario.
            <Elements key={clientSecret ?? 'sin-intent'} stripe={stripePromise} options={options}>
              <PlanCardForm
                errorMessage={errorDePago}
                payNowLabel={payNowLabel(selectedTier, interval)}
                trialLabel={t('plan.startTrial', { defaultValue: 'Empezar 30 días gratis' })}
                trialOptionTitle={t('plan.optionTrial', { defaultValue: '{{count}} días gratis', count: trialDays })}
                payNowOptionTitle={
                  conIntroHoy
                    ? t('plan.optionPayNowSave', { defaultValue: 'Pagar hoy y ahorrar' })
                    : t('plan.optionPayNow', { defaultValue: 'Pagar hoy' })
                }
                trialHint={trialHint}
                payNowHint={payNowHint}
                busy={pagoBloqueado ?? cobroEnVuelo}
                onBusyChange={setCobrando}
                // Stripe no cargó el formulario: se muestra el «Reintentar» de arriba, que pide un SetupIntent nuevo.
                onLoadError={() => setIntentStatus('error')}
                onConfirmed={async (paymentMethodId, payNow) => {
                  // 🔴 El cobro va ANTES de avanzar. Si `activateBeforeContinue` lanza, no se llama a
                  // `onNext`: avanzar tras un rechazo dejaría el alta creyendo que hay plan pagado.
                  if (activateBeforeContinue) {
                    setErrorDePago(null)
                    try {
                      await activateBeforeContinue({ tier: selectedTier, interval, payNow, paymentMethodId })
                    } catch (fallo) {
                      // 🔴 El SetupIntent ya quedó CONFIRMADO con esta tarjeta: está gastado. Sin uno nuevo, reintentar con
                      // otra tarjeta daba «Se produjo un error de procesamiento» y sólo salía recargando (full-testing, 26-sep).
                      setErrorDePago(
                        mensajeDeFalloDeCobro(fallo) ??
                          t('plan.chargeError', { defaultValue: 'No pudimos procesar el pago. Intenta de nuevo.' }),
                      )
                      setRetryToken(n => n + 1)
                      throw fallo
                    }
                  }
                  const termino = await onNext({
                    plan: { tier: selectedTier, paymentMethodId, interval, payNow, acceptedAt: new Date().toISOString() },
                  })
                  // 🔴 Codex R13 — asistente LARGO: aquí el cobro va en la finalización del padre. Si falló, el SetupIntent
                  // ya quedó confirmado con esta tarjeta: se pide uno nuevo y se DICE, en vez de quedarse mudo.
                  if (termino === false) {
                    setErrorDePago(t('plan.completeError', { defaultValue: 'No pudimos terminar tu alta. Intenta de nuevo.' }))
                    setRetryToken(n => n + 1)
                  }
                }}
              />
            </Elements>
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * La promo de introducción solo existe para PRO mensual: Premium y anual pagan precio completo hoy.
 * Con cotización, el monto del botón es el del SERVIDOR con IVA — el mismo que dice la tarjeta —;
 * sin ella queda el texto de siempre.
 */
function payNowLabelFactory(t: (k: string, o?: Record<string, unknown>) => string, quote?: PlanQuote | null) {
  const intro = quote?.tiers?.PRO?.intro ?? null
  return (tier: 'PRO' | 'PREMIUM', interval: 'monthly' | 'annual') =>
    interval === 'annual'
      ? t('plan.payNowAnnual', { defaultValue: 'Pagar hoy (anual)' })
      : tier === 'PRO'
        ? intro
          ? t('plan.payNowMonthlyFromQuote', {
              defaultValue: 'Pagar hoy y ahorrar ({{count}} meses a {{intro}})',
              count: intro.months,
              intro: formatMXN(intro.monthlyCents),
            })
          : t('plan.payNowMonthly', { defaultValue: 'Pagar hoy y ahorrar' })
        : t('plan.payNow', { defaultValue: 'Pagar hoy' })
}
