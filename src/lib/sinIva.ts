import type { FeatureGridOffer } from '@/services/hybridBilling.service'

/** Pesos con IVA → pesos sin IVA. Misma fórmula que `splitIvaInclusive` del SERVIDOR (redondeo en centavos). */
export const sinIva = (conIva: number): number => Math.round(Math.round(conIva * 100) / 1.16) / 100

/** Solo un precio de lista se anuncia «+ IVA»; una oferta o promoción sigue con IVA incluido. Sin `listPrice` no se afirma nada. */
export const esPrecioDeLista = (offer: FeatureGridOffer): boolean =>
  offer.renewal === 'SAME_PRICE' && offer.listPrice != null && offer.listPrice === offer.price
