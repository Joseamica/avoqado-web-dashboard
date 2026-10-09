import api from '@/api'
import type { FloorPlanDto, PublishFloorPlanBody, PublishFloorPlanResult } from '@/pages/Settings/FloorPlan/model/types'

// Plano de mesas — GET/PUT /api/v1/dashboard/venues/:venueId/floor-plan. Responden { success, data }.
// Query key: ['floor-plan', venueId]. El PUT es idempotente por `saveId` (src/api.ts reintenta una vez
// ante error de red; el servidor reconoce el folio repetido).
const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/floor-plan`

export async function getFloorPlan(venueId: string): Promise<FloorPlanDto> {
  const res = await api.get(base(venueId))
  return res.data.data
}

/**
 * Tope del PUT: un guardado colgado no deja el editor en «Guardando…» para siempre. Al agotarse, axios lo rechaza sin
 * respuesta (código ECONNABORTED): el editor lo trata como «sin conexión» y el reintento lleva el MISMO `saveId`, así
 * que si el primero sí llegó, el servidor lo reconoce y no aplica dos veces.
 */
export const PUBLISH_TIMEOUT_MS = 45_000

export async function publishFloorPlan(venueId: string, body: PublishFloorPlanBody): Promise<PublishFloorPlanResult> {
  const res = await api.put(base(venueId), body, { timeout: PUBLISH_TIMEOUT_MS })
  return res.data.data
}
