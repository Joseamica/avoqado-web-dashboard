// Lectura PÚBLICA de la oferta vigente de planes: `GET /api/v1/public/plan-offer`.
// 🔴 `publicApi` (sin credenciales), igual que launchOffer.service: el router público responde `Access-Control-Allow-Origin: *`.
import { publicApi } from '@/api'

/** Copia del tipo del SERVIDOR (`planesPublicos.ts`). Dinero en CENTAVOS. */
export interface PrecioPublico {
  netCents: number
  grossCents: number
}
export interface PlanDeLaOferta {
  displayName: string
  onSale: boolean
  requiresCard: boolean
  trialDays: number
  monthly: PrecioPublico
  annual: PrecioPublico
}
export interface PlanesPublicos {
  /** Número de la vigente SÓLO si la publicó el editor (≥ 2); `null` con la v1, el respaldo o sin versiones. */
  offerVersion: number | null
  FREE: { displayName: string }
  PRO: PlanDeLaOferta
  PREMIUM: PlanDeLaOferta
}

export const planOfferService = {
  /** Lanza ante cualquier respuesta que no sea 200 (503 = oferta dañada, 404 incluido): quien lo usa decide «sin dato». */
  async get(): Promise<PlanesPublicos> {
    const response = await publicApi.get('/api/v1/public/plan-offer')
    const data = response.data?.data as PlanesPublicos | undefined
    if (!data) throw new Error('plan-offer sin datos')
    return data
  },
}
