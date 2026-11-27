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
/** v2 con Pro a 10 mensualidades («2 meses gratis») y Premium a 11 (un mes gratis, ahorro bruto $1,970.84). */
export const OFERTA_V2_PREMIUM_11X: OfertaDePlanes = {
  ...OFERTA_V2_PLUS,
  PRO: plan('Pro', 79900, 799000),
  PREMIUM: plan('Premium', 169900, 1868900),
}
/** v2 con un precio que trae centavos: Pro $799.50 + IVA al mes. */
export const OFERTA_V2_CON_CENTAVOS: OfertaDePlanes = { ...OFERTA_V2_PLUS, PRO: plan('Plus', 79950, 850000) }
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
    useNombresDelPlan: (cotizacion?: Parameters<typeof actual.nombreConCotizacion>[3]) => {
      const { t } = useTranslation('billing')
      return (tier: string) => actual.nombreConCotizacion(leer(), tier, t, cotizacion)
    },
  }
}

/** La oferta que lee el hook simulado; cada prueba la cambia y `beforeEach` la deja en la v1. */
export const ofertaActual: { valor: OfertaDePlanes } = { valor: OFERTA_V1 }
