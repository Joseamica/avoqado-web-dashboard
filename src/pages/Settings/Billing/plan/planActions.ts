// src/pages/Settings/Billing/plan/planActions.ts
import { esPrecioDeLista } from '@/lib/sinIva'
import type { OfertaDePlanes } from '@/hooks/usePlanOffer'
import type { CotizacionDeTuPlan, OpcionCotizada, PlanOrigin, PlanState } from '@/services/features.service'
import type {
  FeatureGrid,
  FeatureGridEntry,
  FeatureGridOffer,
  HybridLineInput,
  HybridReplacementOptions,
} from '@/services/hybridBilling.service'

/** A plan choice on the page. Enterprise is sold by talking to sales, never here. */
export type PlanTarget = 'FREE' | 'PRO' | 'PREMIUM'
/** A hybrid quote takes at most eight offers (the server's `hybridQuoteBody`). */
export const MAX_OFFERS = 8
export const TIER_RANK = { FREE: 0, PRO: 1, PREMIUM: 2, ENTERPRISE: 3 } as const

export const NO_ORIGIN: PlanOrigin = {
  kind: 'NONE',
  tier: null,
  price: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAt: null,
  contractId: null,
  contractRevision: null,
  subscriptionId: null,
  paymentIssue: null,
}

/** The one obligation behind "Tu plan". A server that predates `origin` still sends the classic fields. */
export function originOf(plan: PlanState | undefined): PlanOrigin {
  if (plan?.origin) return plan.origin
  if (plan?.hasPlan && plan.stripeSubscriptionId && plan.state !== 'canceled')
    return {
      ...NO_ORIGIN,
      kind: 'CLASSIC',
      tier: plan.planTier === 'PREMIUM' ? 'PREMIUM' : 'PRO',
      price: plan.price,
      interval: plan.interval,
      currentPeriodEnd: plan.currentPeriodEnd,
      cancelAt: plan.cancelAtPeriodEnd ? plan.currentPeriodEnd : null,
      subscriptionId: plan.stripeSubscriptionId,
    }
  return NO_ORIGIN
}

export const currentTarget = (origin: PlanOrigin): PlanTarget => (origin.kind === 'NONE' ? 'FREE' : (origin.tier ?? 'FREE'))

/**
 * The classic checkout's first charge, IVA included, from the SERVIDOR's current offer (B4: never a stored number).
 * `null` = no amount to show: the offer is loading / unavailable, or the plan is not on sale.
 */
export function classicPrice(tier: 'PRO' | 'PREMIUM', interval: 'monthly' | 'annual', oferta: OfertaDePlanes | undefined): number | null {
  if (oferta?.estado !== 'servidor' || !oferta[tier].onSale) return null
  return oferta[tier][interval].grossCents / 100
}

/** The offer says this plan is not sold today (only a 200 can say so). */
const fueraDeVentaEnOferta = (tier: 'PRO' | 'PREMIUM', oferta: OfertaDePlanes | undefined) =>
  oferta?.estado === 'servidor' && !oferta[tier].onSale

/** How many functions a plan brings, counted from the catalog (functions sold by quote don't count). */
export function tierFeatureCount(entries: FeatureGridEntry[], tier: PlanTarget): number {
  return entries.filter(entry => entry.offering !== 'CONTACT' && entry.minimumTier && TIER_RANK[entry.minimumTier] <= TIER_RANK[tier])
    .length
}

/** Functions of the replaced subscriptions that nothing else keeps: the quote must list them as dropped. */
export function leavingFeatureCodes(
  replacements: HybridReplacementOptions | undefined,
  replaceIds: string[],
  keptCodes: string[],
): string[] {
  if (!replacements) return []
  const stays = new Set([
    ...replacements.standaloneFeatureCodes,
    ...replacements.items.filter(item => !replaceIds.includes(item.subscriptionId)).flatMap(item => item.featureCodes),
    ...keptCodes,
  ])
  const replaced = replacements.items.filter(item => replaceIds.includes(item.subscriptionId)).flatMap(item => item.featureCodes)
  return [...new Set(replaced)].filter(code => !stays.has(code))
}

export interface SelectionInput {
  origin: PlanOrigin
  grandfathered: boolean
  target: PlanTarget
  marked: string[]
  grid: FeatureGrid | undefined
  replacements: HybridReplacementOptions | undefined
  /** The classic checkout answered PLAN_ABSORBE_SUELTA: the plan absorbs a function bought alone. */
  classicRejected: boolean
  /** Function codes (and `'PLAN'` for the plan) quoted at their list offer instead of the best one (spec §5). */
  preferList?: string[]
  /**
   * Planes editables (B2, Task 12): lo que «Tu plan» cotizó con una versión del editor (`PlanState.cotizacion`). Sin ella, todo es
   * lo de hoy, literal.
   */
  cotizacion?: CotizacionDeTuPlan
  /** Mensual o anual de la compra clásica: con `cotizacion`, decide qué comprobante viaja. Sin cotización no cambia nada. */
  interval?: 'monthly' | 'annual'
  /** La oferta vigente del SERVIDOR (`usePlanOffer()`). Sin ella (o cargando / sin dato) no hay monto de lista que enseñar. */
  oferta?: OfertaDePlanes
}

/** La opción cotizada de un plan en esa periodicidad: sólo si el plan es vendible hoy (nunca un checkout sin su comprobante). */
export function opcionCotizada(
  cotizacion: CotizacionDeTuPlan | undefined,
  tier: 'PRO' | 'PREMIUM',
  interval: 'monthly' | 'annual',
): OpcionCotizada | null {
  const plan = cotizacion?.planes?.[tier]
  return plan?.vendible ? (plan[interval] ?? null) : null
}

/**
 * Con una prueba que Stripe ya terminó (`TERMINADA`) la fila puede seguir diciendo `CLASSIC` porque la baja todavía no llega
 * (b2-r6 #4): «Tu plan» compra como Gratis, igual que el SERVIDOR cotiza. Sin cotización (o sin esa prueba), el origen de siempre.
 */
const origenQueCompra = (input: Pick<SelectionInput, 'origin' | 'cotizacion'>): PlanOrigin =>
  input.cotizacion?.estadoDeLaPrueba?.estado === 'TERMINADA' ? NO_ORIGIN : input.origin

/**
 * B2 (revisión 3): una prueba que Stripe todavía corre (`SIN_TARJETA` o `CON_TARJETA`). Durante ella otro plan sí puede estar a la
 * venta, pero no se compra encima de la prueba (la regla común lo niega): no se enseña su precio ni se sugiere.
 */
const pruebaViva = (cotizacion: CotizacionDeTuPlan | undefined) => {
  const estado = cotizacion?.estadoDeLaPrueba?.estado
  return estado === 'SIN_TARJETA' || estado === 'CON_TARJETA'
}

/** La compra clásica con el comprobante de su opción; con una prueba regalada que difiere el cobro, también su fecha (D3). */
const compraConComprobante = (tier: 'PRO' | 'PREMIUM', opcion: OpcionCotizada): PlanOperation => ({
  kind: 'CLASSIC_CHECKOUT',
  tier,
  ...(opcion.trialEndsAt ? { firstChargeAt: opcion.trialEndsAt } : {}),
  quoteToken: opcion.quoteToken,
})

/** The offer a function is quoted with: its list when the owner asked for it and it has one, else the best offer. */
export const chosenOffer = (entry: FeatureGridEntry, preferList?: string[]) =>
  (entry.featureCode && preferList?.includes(entry.featureCode) && entry.listOffer) || entry.offer

/** The same for a plan: `'PLAN'` in preferList picks the plan's list. */
export const chosenPlanOffer = (grid: FeatureGrid | undefined, tier: 'PRO' | 'PREMIUM', preferList?: string[]) =>
  (preferList?.includes('PLAN') && grid?.planListOffers?.[tier]) || grid?.plans[tier] || null

/** A function the plan grants as part of it (the catalog tier), as opposed to one sold only alone or by quote. */
const inPlan = (grid: FeatureGrid, tier: 'PRO' | 'PREMIUM', code: string) => {
  const e = grid.entries.find(x => x.featureCode === code)
  return (
    !!e &&
    e.offering === 'CONFIGURABLE' &&
    e.minimumTier !== null &&
    e.minimumTier !== 'ENTERPRISE' &&
    TIER_RANK[e.minimumTier] <= TIER_RANK[tier]
  )
}
const sellable = (grid: FeatureGrid, code: string) => grid.entries.some(e => e.featureCode === code && e.offering === 'CONFIGURABLE')

/** Replaceable subscriptions a plan offer covers whole: its replacement takes them along (spec §4.1). */
const absorbedBy = (offer: FeatureGridOffer, replacements: HybridReplacementOptions | undefined) =>
  (replacements?.items ?? [])
    .filter(
      item =>
        item.replaceable && item.featureCodes.length > 0 && item.featureCodes.every(code => offer.includedFeatureCodes.includes(code)),
    )
    .map(item => item.subscriptionId)

export type PlanOperation =
  | { kind: 'NONE' }
  | { kind: 'FOUNDER' }
  | { kind: 'COMP' }
  | { kind: 'ASSISTED'; tier: PlanTarget }
  | { kind: 'FEATURES'; lines: HybridLineInput[] }
  /**
   * `firstChargeAt` (D3): quedarse con el plan de una prueba regalada; hoy no se cobra y el primer cobro es esa fecha.
   * `quoteToken` (B2): el comprobante de la opción cotizada; sólo con una versión del editor.
   */
  | { kind: 'CLASSIC_CHECKOUT'; tier: 'PRO' | 'PREMIUM'; firstChargeAt?: string; quoteToken?: string }
  /** B2 (§17): la prueba SIN tarjeta se completa en el portal de Stripe; el monto es la vista previa de Stripe (`null` = no se sabe). */
  | {
      kind: 'PORTAL_TARJETA'
      tier: 'PRO' | 'PREMIUM'
      interval: 'monthly' | 'annual'
      trialEndsAt: string
      montoAlTerminarCents: number | null
    }
  /** B2 (§18): la prueba ya tiene la tarjeta que Stripe cobrará al terminar; sólo informa. */
  | {
      kind: 'PRUEBA_CON_TARJETA'
      trialEndsAt: string
      tarjeta: { brand: string | null; last4: string | null }
      montoAlTerminarCents: number | null
    }
  /** B2 (b2-r8 #7): la compra que se aceptó al convertir la demo y cuya respuesta se perdió; su checkout cita la aceptación. */
  | { kind: 'TERMINAR_ACEPTACION'; acceptanceId: string; tier: 'PRO' | 'PREMIUM'; interval: 'monthly' | 'annual' }
  | {
      kind: 'HYBRID_REPLACE'
      tier: 'PRO' | 'PREMIUM'
      lines: HybridLineInput[]
      replaceSubscriptionIds: string[]
      dropFeatureCodes: string[]
    }
  | { kind: 'HYBRID_DROP'; lines: HybridLineInput[]; replaceSubscriptionIds: string[]; dropFeatureCodes: string[] }
  | { kind: 'DOWNGRADE_CLASSIC' }
  | { kind: 'CANCEL_CONTRACT'; contractId: string; revision: number }

/** The replaceable subscription behind the current plan, when there is one. */
function ownSource(origin: PlanOrigin, replacements: HybridReplacementOptions | undefined): string[] {
  return (replacements?.items ?? [])
    .filter(item => item.replaceable && item.subscriptionId === origin.subscriptionId)
    .map(item => item.subscriptionId)
}

/** Whether dropping to Gratis can keep functions: the current plan must be replaceable today. */
export const canDropWithFeatures = (origin: PlanOrigin, replacements: HybridReplacementOptions | undefined) =>
  origin.kind !== 'NONE' && ownSource(origin, replacements).length > 0

/**
 * A change self-service would get wrong in phase 1, so it is "Cambio asistido" (spec §4.2, §4.5):
 * (a) the current plan's subscription also carries a function bought alone — replacing it takes that function along;
 * (b) a subscription the new plan does not absorb whole holds a function the plan includes — the server refuses the overlap;
 * (c) a classic plan to another paid plan — the classic subscription may be annual or carry the intro coupon (phase 2).
 */
export function mixedChange(input: SelectionInput): boolean {
  const { origin, target, grid } = input
  const current = currentTarget(origin)
  if (origin.kind === 'CLASSIC' && target !== 'FREE' && target !== current) return true
  if (!grid) return false
  const items = input.replacements?.items ?? []
  const own = ownSource(origin, input.replacements)
  // Only functions sold alone count: a plan's subscription also lists the free functions (and, on servers before
  // 2026-09-29, quote-only ones), which no plan grants as CONFIGURABLE.
  if (
    current !== 'FREE' &&
    items.some(
      item => own.includes(item.subscriptionId) && item.featureCodes.some(code => sellable(grid, code) && !inPlan(grid, current, code)),
    )
  )
    return true
  if (target === 'FREE') return false
  const offer = chosenPlanOffer(grid, target, input.preferList)
  const absorbed = offer ? absorbedBy(offer, input.replacements) : []
  return items.some(
    item =>
      !own.includes(item.subscriptionId) &&
      !absorbed.includes(item.subscriptionId) &&
      item.featureCodes.some(code => inPlan(grid, target, code)),
  )
}

/** Which server operation a choice maps to (spec §4.1). Without one, it is "Cambio asistido", never an invented path. */
export function planOperation(entrada: SelectionInput): PlanOperation {
  if (entrada.grandfathered) return { kind: 'FOUNDER' }
  const { cotizacion } = entrada
  // B2 (b2-r8 #7): la compra aceptada al convertir la demo va primero, aunque la vigente ya no venda ningún plan.
  const aceptada = cotizacion?.aceptacionPendiente
  if (aceptada)
    return { kind: 'TERMINAR_ACEPTACION', acceptanceId: aceptada.acceptanceId, tier: aceptada.tier, interval: aceptada.interval }
  const input = cotizacion ? { ...entrada, origin: origenQueCompra(entrada) } : entrada
  const current = currentTarget(input.origin)
  const prueba = cotizacion?.estadoDeLaPrueba
  // B2 (b2-r6 #4): la prueba sin tarjeta se decide por lo que dice Stripe, antes que por la fila: nunca una compra clásica encima.
  if (prueba && input.target === current && !input.marked.length) {
    if (prueba.estado === 'SIN_TARJETA')
      return {
        kind: 'PORTAL_TARJETA',
        tier: prueba.tier,
        interval: prueba.interval,
        trialEndsAt: prueba.trialEndsAt,
        montoAlTerminarCents: prueba.montoAlTerminarCents,
      }
    if (prueba.estado === 'CON_TARJETA')
      return {
        kind: 'PRUEBA_CON_TARJETA',
        trialEndsAt: prueba.trialEndsAt,
        tarjeta: prueba.tarjeta ?? { brand: null, last4: null },
        montoAlTerminarCents: prueba.montoAlTerminarCents,
      }
  }
  const interval = input.interval ?? 'monthly'
  const offers = input.marked.flatMap(code => {
    const found = input.grid?.entries.find(entry => entry.featureCode === code)
    const offer = found && chosenOffer(found, input.preferList)
    return offer ? [offer] : []
  })
  const lines = offers.map(offer => ({ publicationId: offer.publicationId, selectedFeatureCodes: [] as string[] }))
  // D3: en una prueba regalada que el SERVIDOR todavía puede diferir, quedarse con SU plan es la compra clásica sin cobro hoy.
  // Otro plan sigue en «escríbenos»: Premium→Pro le quitaría Premium ese mismo día.
  const { firstChargeAt, tier: tierDeLaPrueba } = input.origin
  const quedarse = input.origin.kind === 'COMP' && tierDeLaPrueba && input.target === current && !lines.length && !input.classicRejected
  if (quedarse && cotizacion) {
    // Con la versión del editor, lo que el SERVIDOR firmó: la opción que difiere el cobro (su `trialEndsAt`) es la fecha del primero.
    const opcion = opcionCotizada(cotizacion, tierDeLaPrueba, interval)
    if (opcion?.trialEndsAt) return compraConComprobante(tierDeLaPrueba, opcion)
  } else if (quedarse && firstChargeAt) return { kind: 'CLASSIC_CHECKOUT', tier: tierDeLaPrueba, firstChargeAt }
  if (input.target === current) return lines.length ? { kind: 'FEATURES', lines } : { kind: 'NONE' }
  if (input.origin.kind === 'COMP') return { kind: 'COMP' }
  const own = ownSource(input.origin, input.replacements)
  if (input.target === 'FREE') {
    if (lines.length) {
      if (!own.length || mixedChange(input)) return { kind: 'ASSISTED', tier: 'FREE' }
      const kept = offers.flatMap(offer => offer.includedFeatureCodes)
      return {
        kind: 'HYBRID_DROP',
        lines,
        replaceSubscriptionIds: own,
        dropFeatureCodes: leavingFeatureCodes(input.replacements, own, kept),
      }
    }
    if (input.origin.kind === 'CLASSIC') return { kind: 'DOWNGRADE_CLASSIC' }
    if (input.origin.kind === 'CONTRACT' && input.origin.contractId && input.origin.contractRevision != null)
      return { kind: 'CANCEL_CONTRACT', contractId: input.origin.contractId, revision: input.origin.contractRevision }
    return { kind: 'ASSISTED', tier: 'FREE' }
  }
  if (input.origin.kind === 'NONE' && !input.classicRejected) {
    if (!cotizacion) return { kind: 'CLASSIC_CHECKOUT', tier: input.target }
    // Con la versión del editor: el comprobante de la opción elegida, o «Cambio asistido» si el plan no es vendible hoy.
    const opcion = opcionCotizada(cotizacion, input.target, interval)
    return opcion ? compraConComprobante(input.target, opcion) : { kind: 'ASSISTED', tier: input.target }
  }
  // B2 (revisión #1): la rejilla híbrida no lee la versión del editor. Con ella, un plan de destino que hoy no se vende (sin opción en
  // esa periodicidad) es «Cambio asistido», nunca un reemplazo con precio y «Revisar y pagar».
  if (cotizacion && !opcionCotizada(cotizacion, input.target, interval)) return { kind: 'ASSISTED', tier: input.target }
  const offer = input.grid?.purchasesEnabled ? chosenPlanOffer(input.grid, input.target, input.preferList) : null
  if (!offer) return { kind: 'ASSISTED', tier: input.target }
  // The plan's own subscription must be replaceable; standalone functions the new plan absorbs go with it (spec §4.1).
  if ((input.origin.kind !== 'NONE' && !own.length) || mixedChange(input)) return { kind: 'ASSISTED', tier: input.target }
  const sources = [...new Set([...own, ...absorbedBy(offer, input.replacements)])]
  // The server takes at most eight subscriptions to replace in one quote.
  if (!sources.length || sources.length > MAX_OFFERS) return { kind: 'ASSISTED', tier: input.target }
  return {
    kind: 'HYBRID_REPLACE',
    tier: input.target,
    lines: [{ publicationId: offer.publicationId, selectedFeatureCodes: [] }],
    replaceSubscriptionIds: sources,
    dropFeatureCodes: leavingFeatureCodes(input.replacements, sources, offer.includedFeatureCodes),
  }
}

/** ADD: no plan change (buy functions) · DROP: going to Gratis keeping functions · VIEW: a plan change (no marks). */
export type GridMode = 'ADD' | 'DROP' | 'VIEW'

export function gridMode(target: PlanTarget, current: PlanTarget, dropReady: boolean): GridMode {
  if (target === current) return 'ADD'
  if (target === 'FREE') return dropReady ? 'DROP' : 'VIEW'
  return 'VIEW'
}

/** ADD: what the venue lacks and has an offer · DROP: only what the plan gives today, to keep it. */
export function isMarkable(entry: FeatureGridEntry, mode: GridMode): boolean {
  if (!entry.offer) return false
  if (mode === 'ADD') return entry.access.source === 'NONE'
  if (mode === 'DROP') return entry.access.source === 'PLAN'
  return false
}

/**
 * The price a plan pill shows: the one its operation would charge (classic, replacement offer, or the list as reference).
 * `amount` is always IVA included; `ivaAparte` says the amount is a LIST price, announced as "+ IVA" (spec: when in doubt, IVA included).
 */
export function planPillPrice(
  tier: PlanTarget,
  input: Omit<SelectionInput, 'target' | 'marked'> & { interval: 'monthly' | 'annual' },
): { amount: number; per: 'month' | 'year'; ivaAparte: boolean; fueraDeVenta?: true; duranteLaPrueba?: true; sinMonto?: true } {
  if (tier === 'FREE') return { amount: 0, per: 'month', ivaAparte: false }
  const origin = input.cotizacion ? origenQueCompra(input) : input.origin
  if (tier === currentTarget(origin) && origin.price)
    // D5: con un cupón vigente, lo que de verdad paga hoy (la línea de «Tu plan» dice hasta cuándo y el precio después).
    return {
      amount: origin.discount?.gross ?? origin.price.gross,
      per: origin.interval === 'year' ? 'year' : 'month',
      ivaAparte: false,
    }
  // B2 (revisiones 2 y 3): con la versión del editor no se enseña precio (`fueraDeVenta`, y `amount` no se lee) de otro plan durante
  // una prueba viva (`duranteLaPrueba`: puede estar a la venta, pero no se compra encima de la prueba) ni de un plan que hoy no se
  // vende (sin opción en esa periodicidad). Sin cotización, los precios de hoy.
  const per = input.interval === 'annual' ? 'year' : 'month'
  if (pruebaViva(input.cotizacion) && tier !== currentTarget(origin))
    return { amount: 0, per, ivaAparte: false, fueraDeVenta: true, duranteLaPrueba: true }
  if (input.cotizacion && !pruebaViva(input.cotizacion) && !opcionCotizada(input.cotizacion, tier, input.interval))
    return { amount: 0, per, ivaAparte: false, fueraDeVenta: true }
  // B4: la oferta vigente dice que el plan no se vende hoy (sólo un 200 lo dice).
  if (!input.cotizacion && fueraDeVentaEnOferta(tier, input.oferta)) return { amount: 0, per, ivaAparte: false, fueraDeVenta: true }
  const op = planOperation({ ...input, target: tier, marked: [] })
  if (op.kind === 'CLASSIC_CHECKOUT') {
    // B2: con la cotización, el precio de la versión que firmó el SERVIDOR (con IVA), nunca el del catálogo.
    const opcion = op.quoteToken ? opcionCotizada(input.cotizacion, tier, input.interval) : null
    if (opcion) return { amount: opcion.precioCents / 100, per: input.interval === 'annual' ? 'year' : 'month', ivaAparte: false }
    const lista = classicPrice(tier, input.interval, input.oferta)
    // Sin oferta del SERVIDOR no hay monto: nunca $0.00 ni el número de hoy.
    if (lista === null) return { amount: 0, per, ivaAparte: true, sinMonto: true }
    return { amount: lista, per, ivaAparte: true }
  }
  const offer = op.kind === 'HYBRID_REPLACE' ? chosenPlanOffer(input.grid, tier, input.preferList) : null
  if (offer) return { amount: offer.price, per: 'month', ivaAparte: esPrecioDeLista(offer) }
  // B2: de referencia, el precio mensual de la versión si el plan se vende hoy; si no, el del catálogo, como hoy.
  const referencia = opcionCotizada(input.cotizacion, tier, 'monthly')
  if (referencia) return { amount: referencia.precioCents / 100, per: 'month', ivaAparte: false }
  const lista = classicPrice(tier, 'monthly', input.oferta)
  if (lista === null) return { amount: 0, per: 'month', ivaAparte: true, sinMonto: true }
  return { amount: lista, per: 'month', ivaAparte: true }
}

export interface SummaryLine {
  key: string
  plan?: PlanTarget
  entry?: FeatureGridEntry
  offer?: FeatureGridOffer
  price: number | null
  /** B2: el plan no se puede comprar hoy (ver `planPillPrice`); la línea lo dice en vez de un precio. */
  fueraDeVenta?: true
  /** B2 (revisión 3): la razón es una prueba viva: el plan no se compra encima de ella. */
  duranteLaPrueba?: true
}

export interface SelectionSummaryModel {
  operation: PlanOperation
  current: PlanTarget
  target: PlanTarget
  lines: SummaryLine[]
  /** Sum of first charges, IVA included; null when there is nothing to buy. */
  monthlyTotal: number | null
  /** Only the classic checkout's first charge; a hybrid purchase shows `quote.dueNow` at review. */
  payToday: number | null
  /** D3: quedarse con el plan de una prueba regalada — hoy $0 y el primer cobro ese día. */
  firstChargeAt: string | null
  lose: FeatureGridEntry[]
  hint: { tier: 'PRO' | 'PREMIUM'; covered: number; more: number; price: number } | null
  seatNotice: boolean
  tooMany: boolean
}

/** "Pro includes these N and M more": a comparison, never a price guarantee (spec §4.2). */
function includedHint(
  entries: FeatureGridEntry[],
  marked: string[],
  current: PlanTarget,
  cotizacion?: CotizacionDeTuPlan,
  oferta?: OfertaDePlanes,
): SelectionSummaryModel['hint'] {
  if (!marked.length) return null
  for (const tier of ['PRO', 'PREMIUM'] as const) {
    if (TIER_RANK[tier] <= TIER_RANK[current]) continue
    const covered = marked.filter(code => {
      const found = entries.find(item => item.featureCode === code)
      return !!found?.minimumTier && TIER_RANK[found.minimumTier] <= TIER_RANK[tier]
    }).length
    // B2: con la cotización, el precio mensual de la versión (con IVA) si el plan se vende hoy; si no, el del catálogo, como hoy.
    // Un plan que la versión no vende no se sugiere (revisión 2), ni otro plan durante una prueba viva (revisión 3).
    const referencia = opcionCotizada(cotizacion, tier, 'monthly')
    if (cotizacion && (!referencia || pruebaViva(cotizacion))) continue
    const price = referencia ? referencia.precioCents / 100 : classicPrice(tier, 'monthly', oferta)
    // Sin monto (oferta cargando, sin dato o plan fuera de venta) la sugerencia no sale: nunca un plan con precio $0 (r3 #2).
    if (price === null) continue
    if (covered === marked.length) return { tier, covered, more: Math.max(0, tierFeatureCount(entries, tier) - covered), price }
  }
  return null
}

/** Lo que no compra nada en «Tu selección»: sin líneas ni total (el resumen dice su propio texto). */
const SIN_PRECIO: PlanOperation['kind'][] = ['NONE', 'FOUNDER', 'COMP', 'PORTAL_TARJETA', 'PRUEBA_CON_TARJETA', 'TERMINAR_ACEPTACION']
const SIN_LINEAS: PlanOperation['kind'][] = ['PORTAL_TARJETA', 'PRUEBA_CON_TARJETA', 'TERMINAR_ACEPTACION']

export function summarizeSelection(input: SelectionInput & { interval: 'monthly' | 'annual' }): SelectionSummaryModel {
  const operation = planOperation(input)
  const current = currentTarget(input.cotizacion ? origenQueCompra(input) : input.origin)
  const entries = input.grid?.entries ?? []
  const features: SummaryLine[] = input.marked.flatMap(code => {
    const found = entries.find(item => item.featureCode === code)
    const offer = found && chosenOffer(found, input.preferList)
    return found && offer ? [{ key: found.id, entry: found, offer, price: offer.price }] : []
  })
  const pildora = planPillPrice(input.target, input)
  const planLine: SummaryLine = {
    key: `plan-${input.target}`,
    plan: input.target,
    offer: operation.kind === 'HYBRID_REPLACE' ? (chosenPlanOffer(input.grid, operation.tier, input.preferList) ?? undefined) : undefined,
    price: pildora.fueraDeVenta || pildora.sinMonto ? null : pildora.amount,
    ...(pildora.fueraDeVenta ? { fueraDeVenta: true as const } : {}),
    ...(pildora.duranteLaPrueba ? { duranteLaPrueba: true as const } : {}),
  }
  const quedarse = operation.kind === 'CLASSIC_CHECKOUT' && !!operation.firstChargeAt
  // Quedarse con el plan de la prueba SÍ compra el plan: su línea va aunque el destino sea el plan actual.
  const lines = SIN_LINEAS.includes(operation.kind)
    ? []
    : input.target === current && current !== 'FREE' && !quedarse
      ? features
      : [planLine, ...features]
  const priced = !SIN_PRECIO.includes(operation.kind)
  // A replacement drops exactly what its quote lists; ending the plan stops what the plan gives. Only held functions
  // show: a server older than 2026-09-29 listed a classic plan's quote-only functions (white label, master catalog) too.
  const lose =
    operation.kind === 'HYBRID_REPLACE' || operation.kind === 'HYBRID_DROP'
      ? entries.filter(item => item.featureCode && item.access.source !== 'NONE' && operation.dropFeatureCodes.includes(item.featureCode))
      : operation.kind === 'DOWNGRADE_CLASSIC' || operation.kind === 'CANCEL_CONTRACT'
        ? entries.filter(item => item.access.source === 'PLAN')
        : []
  return {
    operation,
    current,
    target: input.target,
    lines,
    // Un plan fuera de venta no tiene total: «$0.00» sería un precio inventado (revisión 2).
    // Una línea pagada sin monto (`price === null` sin estar fuera de venta) deja el total en null: nunca $0.00 (r2 #4).
    monthlyTotal:
      priced && !lines.some(line => line.fueraDeVenta || line.price === null)
        ? lines.reduce((sum, line) => sum + (line.price ?? 0), 0)
        : null,
    payToday: operation.kind === 'CLASSIC_CHECKOUT' ? (quedarse ? 0 : planLine.price) : null,
    firstChargeAt: quedarse && operation.kind === 'CLASSIC_CHECKOUT' ? (operation.firstChargeAt ?? null) : null,
    lose,
    hint: operation.kind === 'FEATURES' ? includedHint(entries, input.marked, current, input.cotizacion, input.oferta) : null,
    seatNotice: input.target === 'FREE' && current !== 'FREE',
    tooMany: input.marked.length > MAX_OFFERS,
  }
}

/** One detail of the server's HYBRID_DEPENDENCY_TERM refusal (`DependencyTermIssue`, dates as ISO). */
export interface DependencyIssue {
  featureCode: string
  requiredFeatureCode: string
  requiredUntil?: string | null
  /** What brings the dependency: a cart line (by publication), something the venue keeps, or nothing. */
  unit: { kind: 'LINE'; publicationId: string } | { kind: 'RETAINED'; source?: string } | null
}

export type DependencyFix =
  | { kind: 'LIST'; prefer: string; plan?: 'PRO' | 'PREMIUM'; entry?: FeatureGridEntry; price: number }
  | { kind: 'RETAINED' | 'MISSING' | 'REMOVE'; code: string; entry?: FeatureGridEntry }

/**
 * Spec §5: a cart line that brings the dependency for too short is redone at ITS list (the plan's, for a plan line — never
 * a loose function on top of it); with no list, the function that cannot outlast it leaves the purchase (removing the
 * dependency would only turn the refusal into «add it»). A kept contract that ends first is an assisted change; nothing
 * bringing it asks to add it. Already on the list, or a dependent function the venue keeps instead of buying: only the
 * server's message.
 */
export function dependencyFix(issue: DependencyIssue, input: SelectionInput): DependencyFix | null {
  const entries = input.grid?.entries ?? []
  const entryOf = (code: string) => entries.find(entry => entry.featureCode === code)
  const code = issue.requiredFeatureCode
  if (!issue.unit) return { kind: 'MISSING', code, entry: entryOf(code) }
  if (issue.unit.kind === 'RETAINED') return { kind: 'RETAINED', code, entry: entryOf(code) }
  const { publicationId } = issue.unit
  const tier = input.target === 'FREE' ? null : input.target
  let list: FeatureGridOffer | null | undefined
  if (tier && chosenPlanOffer(input.grid, tier, input.preferList)?.publicationId === publicationId) {
    list = input.grid?.planListOffers?.[tier]
    if (list && list.publicationId !== publicationId) return { kind: 'LIST', prefer: 'PLAN', plan: tier, price: list.price }
  } else {
    const line = entries.find(
      entry =>
        !!entry.featureCode &&
        input.marked.includes(entry.featureCode) &&
        chosenOffer(entry, input.preferList)?.publicationId === publicationId,
    )
    list = line?.listOffer
    if (line?.featureCode && list && list.publicationId !== publicationId)
      return { kind: 'LIST', prefer: line.featureCode, entry: line, price: list.price }
  }
  if (list) return null
  return input.marked.includes(issue.featureCode) ? { kind: 'REMOVE', code: issue.featureCode, entry: entryOf(issue.featureCode) } : null
}

/**
 * Plan Básico en «Tu plan» (Task 9). Qué dice la fila y qué botón da, según el plan de hoy:
 * - CURRENT: un contrato del Básico → «Básico · $499 + IVA» y «Subir a Pro».
 * - BUY: Gratis con el Básico publicado → «Contratar Básico» (compra híbrida).
 * - TRIAL_ENDS_FREE: la prueba termina sin cobrar → «Tu prueba termina el…» y «Quedarme en Pro» (= «Reanudar»).
 * - AFTER_PRO: Pro que ya termina, o de cortesía → «Ese día podrás contratar el Básico», sin botón.
 * - CAN_END_PRO: Pro mensual en su último periodo con descuento → «Terminar mi Pro al acabar el periodo».
 * - DISCOUNT_CONTINUES: le quedan meses con descuento → la fecha, sin botón (el SERVIDOR también lo rechaza).
 */
export type BasicNotice =
  | { kind: 'CURRENT'; name: string; price: number | null; active: boolean }
  | { kind: 'BUY'; price: number }
  | { kind: 'TRIAL_ENDS_FREE'; date: string | null }
  | { kind: 'AFTER_PRO'; price: number }
  | { kind: 'CAN_END_PRO'; price: number }
  | { kind: 'DISCOUNT_CONTINUES'; date: string | null }

/** Precios sin IVA (se muestran «+ IVA», nunca el total). */
export function basicNotice(plan: PlanState | undefined, origin: PlanOrigin): BasicNotice | null {
  if (!plan || plan.grandfathered) return null
  if (plan.basicPlan)
    return { kind: 'CURRENT', name: plan.basicPlan.name, price: plan.basicPlan.price?.base ?? null, active: plan.basicPlan.active }
  // «Ese día podrás contratar el Básico» sólo si hay un Básico publicado; si no, la fila dice lo de siempre.
  if (plan.trialModality === 'ENDS_FREE')
    return plan.basicOffer ? { kind: 'TRIAL_ENDS_FREE', date: plan.trialEndsAt ?? origin.cancelAt ?? origin.currentPeriodEnd } : null
  // B2 (§11.2): con una versión del editor el Básico no se vende a nadie nuevo; sólo se dice el que ya existe.
  if (plan.cotizacion) return null
  const offer = plan.basicOffer
  if (!offer) return null
  const price = offer.price.base
  if (origin.kind === 'NONE') return offer.availableAt ? null : { kind: 'BUY', price }
  if (origin.kind === 'COMP' || (origin.kind === 'CLASSIC' && origin.cancelAt)) return { kind: 'AFTER_PRO', price }
  if (origin.kind !== 'CLASSIC') return null
  return offer.canEndProNow ? { kind: 'CAN_END_PRO', price } : { kind: 'DISCOUNT_CONTINUES', date: offer.discountEndsAt }
}
