/**
 * La tabla «Ver todo lo que incluye cada plan». Las tarjetas de planes muestran TEMAS (5-6 líneas);
 * aquí va el detalle, por categoría, como la página de precios de Square.
 *
 * 🔴 Las palomitas NO se escriben a mano: salen de `includes` del catálogo (el mismo mapa que usa el
 * paywall, espejo del servidor). Así la tabla no puede prometer lo que el plan no da. Sólo las filas
 * SIN código (lo que es de todos, o un número como los usuarios) llevan valores explícitos.
 * `planComparison.test.ts` falla si una función de pago de un plan no aparece en ninguna fila.
 */
import { TIER_ORDER, getTierForFeature, type PlanTierDef, type TierId } from './plan-catalog'

/** Columnas de la tabla (Enterprise se vende por contacto: tiene su propia tarjeta). */
export const TIERS_COMPARADOS = ['FREE', 'PRO', 'PREMIUM'] as const
export type TierComparado = (typeof TIERS_COMPARADOS)[number]

export type ValorDeCelda = boolean | string

export interface FilaDeComparacion {
  /** Sufijo i18n bajo billing `plan.compare.rows.<key>`. */
  key: string
  /** Códigos de función; el plan la tiene si incluye CUALQUIERA. */
  codes?: string[]
  /** Para filas sin código: valor por plan (true/false o un sufijo i18n bajo `plan.compare.values`). */
  values?: Record<TierComparado, ValorDeCelda>
}

export interface CategoriaDeComparacion {
  key: string
  rows: FilaDeComparacion[]
}

const TODOS: Record<TierComparado, ValorDeCelda> = { FREE: true, PRO: true, PREMIUM: true }

export const PLAN_COMPARISON: CategoriaDeComparacion[] = [
  {
    key: 'sell',
    rows: [
      { key: 'pos', values: TODOS },
      { key: 'menuOrders', values: TODOS },
      { key: 'tables', codes: ['TABLE_SERVICE'] },
      { key: 'reservations', codes: ['RESERVATIONS'] },
      { key: 'onlineOrdering', codes: ['ONLINE_ORDERING'] },
      { key: 'upsell', codes: ['UPSELL'] },
      { key: 'upsellAi', codes: ['UPSELL_AI'] },
      { key: 'delivery', codes: ['DELIVERY_CHANNELS'] },
      { key: 'merchantRules', codes: ['MERCHANT_ROUTING_RULES'] },
    ],
  },
  {
    key: 'customers',
    rows: [
      { key: 'loyalty', codes: ['LOYALTY_PROGRAM'] },
      { key: 'referrals', codes: ['REFERRAL_PROGRAM'] },
      { key: 'promotions', codes: ['PROMOTIONS'] },
      { key: 'campaigns', codes: ['CUSTOMER_CAMPAIGNS'] },
      { key: 'googleReviews', codes: ['GOOGLE_REVIEW_REDIRECT'] },
    ],
  },
  {
    key: 'inventory',
    rows: [
      { key: 'inventoryBasic', values: TODOS },
      { key: 'inventoryFifo', codes: ['INVENTORY_TRACKING'] },
      { key: 'autoReorder', codes: ['AUTO_REORDER'] },
      { key: 'serialized', codes: ['SERIALIZED_INVENTORY'] },
      { key: 'scale', codes: ['SCALE_INTEGRATION'] },
    ],
  },
  {
    key: 'money',
    rows: [
      { key: 'dailyReports', values: TODOS },
      { key: 'reportsHistory', codes: ['ADVANCED_REPORTS'] },
      { key: 'cashCount', codes: ['CASH_RECONCILIATION'] },
      { key: 'bankReconciliation', codes: ['BANK_RECONCILIATION'] },
      { key: 'balance', codes: ['AVAILABLE_BALANCE', 'BANKING_HUB'] },
      { key: 'exportTransactions', codes: ['TRANSACTION_EXPORT'] },
      { key: 'cfdi', codes: ['CFDI'] },
    ],
  },
  {
    key: 'team',
    rows: [
      { key: 'seats', values: { FREE: 'upTo2', PRO: 'unlimited', PREMIUM: 'unlimited' } },
      { key: 'auditLog', codes: ['VENUE_AUDIT_LOG'] },
      { key: 'commissions', codes: ['COMMISSIONS'] },
      { key: 'attendance', codes: ['ATTENDANCE_TRACKING'] },
    ],
  },
  {
    key: 'ai',
    rows: [
      { key: 'chatbot', codes: ['CHATBOT'] },
      { key: 'aiAssistant', codes: ['AI_ASSISTANT_BUBBLE'] },
      { key: 'offline', codes: ['OFFLINE_LAN_HUB'] },
    ],
  },
]

const rango = (id: TierId) => TIER_ORDER.indexOf(id)

/** ¿Qué dice la celda de `fila` para `tier`? Con código: del catálogo; sin código: su valor. */
export function valorDeCelda(fila: FilaDeComparacion, tier: TierComparado): ValorDeCelda {
  if (fila.values) return fila.values[tier]
  return (fila.codes ?? []).some(code => {
    const desde = getTierForFeature(code)
    return desde != null && rango(tier) >= rango(desde)
  })
}

/** ¿Los tres planes dicen lo mismo en esta fila? Esas filas no ayudan a elegir: van en una sola línea. */
export function esComun(fila: FilaDeComparacion): boolean {
  const [a, ...resto] = TIERS_COMPARADOS.map(t => valorDeCelda(fila, t))
  return resto.every(v => v === a)
}

/** Lo que `tier` agrega sobre el plan de abajo (Pro sobre Free, Premium sobre Pro), por categoría. */
export function novedadesDelPlan(tier: 'PRO' | 'PREMIUM'): { categoria: string; filas: FilaDeComparacion[] }[] {
  const abajo: TierComparado = tier === 'PRO' ? 'FREE' : 'PRO'
  return PLAN_COMPARISON.map(c => ({
    categoria: c.key,
    filas: c.rows.filter(f => {
      const aqui = valorDeCelda(f, tier)
      return aqui !== false && aqui !== valorDeCelda(f, abajo)
    }),
  })).filter(c => c.filas.length > 0)
}

export interface BeneficioDelPlan {
  fila: FilaDeComparacion
  /** `true` o un sufijo de `plan.compare.values` («Ilimitados»). Nunca `false`: lo que no incluye no se lista. */
  valor: true | string
}

/**
 * TODO lo que incluye `tier`, por categoría: la lista del botón «Ver todos» de cada tarjeta. Sale del
 * mismo catálogo que la tabla, así que no puede prometer lo que el plan no da. Enterprise incluye todo
 * lo de Premium (sus extras propios —marca propia, API, SLA— viven en el catálogo de la tarjeta).
 */
export function beneficiosDelPlan(tier: TierId): { categoria: string; beneficios: BeneficioDelPlan[] }[] {
  const columna: TierComparado = tier === 'ENTERPRISE' ? 'PREMIUM' : tier
  return PLAN_COMPARISON.map(c => ({
    categoria: c.key,
    beneficios: c.rows.flatMap(fila => {
      const valor = valorDeCelda(fila, columna)
      return valor === false ? [] : [{ fila, valor }]
    }),
  })).filter(c => c.beneficios.length > 0)
}

/** Extras que no son funciones del catálogo (marca propia, API, SLA): sólo Enterprise los tiene. */
export const extrasDelPlan = (tier: PlanTierDef) => (tier.id === 'ENTERPRISE' ? tier.featureKeys.filter(k => !k.startsWith('all')) : [])

/** Cuántos beneficios lista la ventana: el número del botón «Ver todos (N)». */
export const totalDeBeneficios = (tier: PlanTierDef) =>
  extrasDelPlan(tier).length + beneficiosDelPlan(tier.id).reduce((n, c) => n + c.beneficios.length, 0)
