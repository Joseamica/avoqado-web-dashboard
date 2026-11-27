import { vi } from 'vitest'
import type { OfertaDePlanes } from '@/hooks/usePlanOffer'

const precio = (net: number) => ({ netCents: net, grossCents: Math.round(net * 1.16) })
const plan = (displayName: string, monthlyNet: number, annualNet: number, onSale = true) => ({
  displayName,
  onSale,
  requiresCard: false,
  trialDays: 0,
  monthly: precio(monthlyNet),
  annual: precio(annualNet),
})

/** v1: lo de hoy (Pro $999 y Premium $1,699 + IVA; anual = 10 mensualidades). */
export const OFERTA_V1: OfertaDePlanes = {
  estado: 'servidor',
  offerVersion: null,
  FREE: { displayName: 'Gratis' },
  PRO: plan('Pro', 99900, 999000),
  PREMIUM: plan('Premium', 169900, 1699000),
}
/** v2 del editor: Pro se llama «Plus», $799/mes + IVA y $8,500/año + IVA (ahorro bruto $1,262.08). */
export const OFERTA_V2_PLUS: OfertaDePlanes = {
  estado: 'servidor',
  offerVersion: 2,
  FREE: { displayName: 'Gratis' },
  PRO: plan('Plus', 79900, 850000),
  PREMIUM: plan('Premium', 169900, 1699000),
}
/** v3: Premium ya no se vende. */
export const OFERTA_V3_PREMIUM_FUERA: OfertaDePlanes = {
  ...OFERTA_V2_PLUS,
  offerVersion: 3,
  PREMIUM: plan('Premium', 169900, 1699000, false),
}
export const OFERTA_CARGANDO: OfertaDePlanes = { estado: 'cargando' }
export const OFERTA_SIN_DATO: OfertaDePlanes = { estado: 'sinDato' }

/**
 * Para `vi.mock('@/hooks/usePlanOffer', () => moduloDelHookConOferta(() => estado.oferta))`: cambia SÓLO la lectura de la oferta,
 * y los nombres (`useNombreDelPlan`, `useNombresDelPlan`) salen de ella con la misma regla real.
 */
export async function moduloDelHookConOferta(leer: () => OfertaDePlanes) {
  const actual = await vi.importActual<typeof import('@/hooks/usePlanOffer')>('@/hooks/usePlanOffer')
  const { useTranslation } = await import('react-i18next')
  return {
    ...actual,
    usePlanOffer: leer,
    useNombreDelPlan: (tier: Parameters<typeof actual.nombreDelPlanDe>[1]) => {
      const { t } = useTranslation('billing')
      return actual.nombreDelPlanDe(leer(), tier, t)
    },
    useNombresDelPlan: () => {
      const { t } = useTranslation('billing')
      return (tier: string) => actual.nombreDelPlanDe(leer(), tier.toUpperCase() as Parameters<typeof actual.nombreDelPlanDe>[1], t)
    },
  }
}

/** La oferta que lee el hook simulado; cada prueba la cambia y `beforeEach` la deja en la v1. */
export const ofertaActual: { valor: OfertaDePlanes } = { valor: OFERTA_V1 }
