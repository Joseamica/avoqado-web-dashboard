/**
 * Candado de posiciones (tarifa al comercio, paso 1 — 12-nov-2026). Lógica pura, sin React.
 *
 * El SERVIDOR (`avoqado-server/src/services/shared/candadoDePosiciones.ts`) rechaza un guardado que cambia la cuenta de
 * una posición (PRIMARY / SECONDARY / TERTIARY) si no trae confirmados: la cuenta que vio la pantalla, la tarifa que
 * quedaría (huella) y las terminales que heredan. Contesta 400 `CONFIRMAR_POSICION` con el detalle para preguntar, o 409
 * `POSICION_DESACTUALIZADA` si algo cambió mientras tanto. El candado NUNCA escribe tarifas.
 */
import axios from 'axios'

export type PositionSlot = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
export const POSITION_SLOTS: PositionSlot[] = ['PRIMARY', 'SECONDARY', 'TERTIARY']
export const CONFIRMAR_POSICION = 'CONFIRMAR_POSICION'
export const POSICION_DESACTUALIZADA = 'POSICION_DESACTUALIZADA'

export interface PositionConfirmation {
  previousAccountId?: string | null
  nextAccountId?: string | null
  rate?: { mode: 'KEEP'; fingerprint: string }
  inheritingTerminals?: number
}
export type PositionConfirmations = Partial<Record<PositionSlot, PositionConfirmation>>

export interface PositionAccount {
  id: string | null
  name: string
  providerCode: string | null
}

export interface PositionPricing {
  id: string
  source: 'venue' | 'organization'
  effectiveFrom: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  includesTax: boolean | null
  taxRate: number
  fixedFeePerTransaction: number | null
  monthlyServiceFee: number | null
}

export interface PositionDetail {
  slot: PositionSlot
  label: string
  accountChanges: boolean
  currentAccount: PositionAccount | null
  nextAccount: PositionAccount | null
  pricing: PositionPricing | null
  pricingFingerprint: string
  venuesWithOwnRate?: { total: number; sample: Array<{ venueId: string; venueName: string; pricing: PositionPricing }> }
  inheritingTerminals: { total: number; byBrand: Record<string, number>; losingAccount: number }
  needs: { previousAccountId: boolean; nextAccountId: boolean; rate: boolean; inheritingTerminals: boolean }
  problems: string[]
}

/** Las cuentas que la pantalla tiene a la vista, por posición (lo que se manda como `previousAccountId`). */
export type SeenAccounts = Partial<Record<PositionSlot, string | null | undefined>>

/** Primer envío: sólo la cuenta que vio la pantalla en cada posición que conoce. */
export function firstConfirmations(seen?: SeenAccounts): PositionConfirmations | undefined {
  if (!seen) return undefined
  const out: PositionConfirmations = {}
  for (const slot of POSITION_SLOTS) {
    if (seen[slot] !== undefined) out[slot] = { previousAccountId: seen[slot] ?? null }
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Lo que se reenvía después de que la persona confirmó el diálogo. La cuenta anterior es la que vio la pantalla; si la
 * pantalla no la conocía (p. ej. cuentas heredadas de la organización), la que el diálogo le acaba de mostrar.
 */
export function confirmationsFrom(positions: PositionDetail[], first?: PositionConfirmations): PositionConfirmations {
  const out: PositionConfirmations = { ...(first ?? {}) }
  for (const p of positions) {
    const prev = first?.[p.slot]?.previousAccountId
    out[p.slot] = {
      previousAccountId: prev !== undefined ? prev : (p.currentAccount?.id ?? null),
      ...(p.needs.nextAccountId && { nextAccountId: p.nextAccount?.id ?? null }),
      ...(p.needs.rate && { rate: { mode: 'KEEP' as const, fingerprint: p.pricingFingerprint } }),
      ...(p.needs.inheritingTerminals && { inheritingTerminals: p.inheritingTerminals.total }),
    }
  }
  return out
}

/** Si el error es el 400 del candado, sus posiciones; si no, `null`. */
export function positionsToConfirm(error: unknown): PositionDetail[] | null {
  if (!axios.isAxiosError(error)) return null
  const data = error.response?.data as { code?: string; details?: { positions?: PositionDetail[] } } | undefined
  if (error.response?.status !== 400 || data?.code !== CONFIRMAR_POSICION) return null
  return data.details?.positions ?? []
}

export function isStalePosition(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.data as { code?: string } | undefined)?.code === POSICION_DESACTUALIZADA
}

/** La persona cerró el diálogo sin confirmar: no es un error que mostrar. */
export class PositionConfirmCancelled extends Error {
  constructor() {
    super('Cambio cancelado: no se guardó nada.')
    this.name = 'PositionConfirmCancelled'
  }
}
export const isPositionConfirmCancel = (e: unknown) => e instanceof PositionConfirmCancelled

/** «2.50 %» */
export const percent = (rate: number) => `${(rate * 100).toFixed(2)} %`

/**
 * Las cuentas que la pantalla tiene a la vista, sacadas de la configuración que leyó (la del negocio o la de la
 * organización). `undefined` (todavía sin leer) ⇒ no se afirma ninguna; `null` (leída: no hay) ⇒ las tres vacías.
 */
export function seenFromConfig(
  cfg: { primaryAccountId?: string | null; secondaryAccountId?: string | null; tertiaryAccountId?: string | null } | null | undefined,
): SeenAccounts | undefined {
  if (cfg === undefined) return undefined
  return { PRIMARY: cfg?.primaryAccountId ?? null, SECONDARY: cfg?.secondaryAccountId ?? null, TERTIARY: cfg?.tertiaryAccountId ?? null }
}

/** Donde se cambia la tarifa de un negocio (la pantalla de siempre: Pagos del negocio → «Configurar/Editar tarifa»). */
export const venueRatesLink = (slug: string | null | undefined) =>
  slug ? { href: `/venues/${slug}/payment-config`, label: 'Tarifas del negocio' } : undefined

/** El mensaje que mandó el SERVIDOR (`message` o `error`); un error propio de la pantalla, el suyo; si no, el de respaldo. */
export function serverMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined
    return data?.message || data?.error || fallback
  }
  return (error instanceof Error && error.message) || fallback
}
