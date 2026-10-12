import api from '@/api'
import type { Asignacion, Pagina, Puesto, ResumenDePago, WorkRelation } from '@/types/rh'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/rh`

export const rhService = {
  async positions(venueId: string, p: { includeArchived?: boolean; limit?: number; offset?: number } = {}): Promise<Pagina<Puesto>> {
    return (await api.get(`${base(venueId)}/positions`, { params: p })).data
  },
  async suggestions(venueId: string): Promise<{ data: Array<{ name: string; suggestedRole: string }> }> {
    return (await api.get(`${base(venueId)}/positions/suggestions`)).data
  },
  async createPosition(venueId: string, body: Partial<Puesto> & { name: string; suggestedRole: string }): Promise<Puesto> {
    return (await api.post(`${base(venueId)}/positions`, body)).data
  },
  async updatePosition(venueId: string, id: string, body: Partial<Puesto>): Promise<Puesto> {
    return (await api.patch(`${base(venueId)}/positions/${id}`, body)).data
  },
  async archivePosition(venueId: string, id: string): Promise<Puesto> {
    return (await api.post(`${base(venueId)}/positions/${id}/archive`)).data
  },
  async history(venueId: string, staffId: string, page = 0, limit = 20): Promise<Pagina<Asignacion>> {
    return (await api.get(`${base(venueId)}/staff/${staffId}/assignments`, { params: { limit, offset: page * limit } })).data
  },
  async assign(venueId: string, staffId: string, body: { positionId: string; relation?: WorkRelation | null; fecha?: string; tracksAttendance?: boolean }): Promise<Asignacion> {
    return (await api.post(`${base(venueId)}/staff/${staffId}/assignments`, body)).data
  },
  async change(venueId: string, assignmentId: string, body: { positionId?: string; relation?: WorkRelation | null; fecha?: string }): Promise<Asignacion> {
    return (await api.post(`${base(venueId)}/assignments/${assignmentId}/change`, body)).data
  },
  async end(venueId: string, assignmentId: string, fecha?: string): Promise<Asignacion> {
    return (await api.post(`${base(venueId)}/assignments/${assignmentId}/end`, { fecha })).data
  },
  async payOverview(venueId: string, staffId: string): Promise<ResumenDePago> {
    return (await api.get(`${base(venueId)}/staff/${staffId}/pay-overview`)).data
  },
}
