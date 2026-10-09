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

export async function publishFloorPlan(venueId: string, body: PublishFloorPlanBody): Promise<PublishFloorPlanResult> {
  const res = await api.put(base(venueId), body)
  return res.data.data
}
