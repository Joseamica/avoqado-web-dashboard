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

const esEntero = (n: unknown, minimo: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= minimo
const precioValido = (p: any) => !!p && esEntero(p.netCents, 1) && esEntero(p.grossCents, 1)
const planValido = (p: any, exigeNombre: boolean) =>
  !!p &&
  typeof p.displayName === 'string' &&
  (!exigeNombre || p.displayName.trim().length > 0) &&
  typeof p.onSale === 'boolean' &&
  typeof p.requiresCard === 'boolean' &&
  esEntero(p.trialDays, 0) &&
  precioValido(p.monthly) &&
  precioValido(p.annual)

/** El 200 también se valida: lo que no cuadra con el contrato es «sin dato», nunca «$0» ni un nombre vacío. */
function validar(body: any): PlanesPublicos {
  const data = body?.data
  const v = data?.offerVersion
  const exigeNombre = typeof v === 'number' && v >= 2
  const ok =
    body?.success === true &&
    !!data &&
    (v === null || typeof v === 'number') &&
    typeof data.FREE?.displayName === 'string' &&
    (!exigeNombre || data.FREE.displayName.trim().length > 0) &&
    planValido(data.PRO, exigeNombre) &&
    planValido(data.PREMIUM, exigeNombre)
  if (!ok) throw new Error('plan-offer inválida')
  return data as PlanesPublicos
}

export const planOfferService = {
  /** Lanza ante cualquier respuesta que no sea 200 válido (503 = oferta dañada, 404 incluido): quien lo usa decide «sin dato». */
  async get(): Promise<PlanesPublicos> {
    const response = await publicApi.get('/api/v1/public/plan-offer')
    return validar(response.data)
  },
}
