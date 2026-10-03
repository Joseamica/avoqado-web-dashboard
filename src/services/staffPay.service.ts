import api from '@/api'
import type { AjusteClaseInput, AsignacionVigenteDto, CeldaDto, ClaseValoradaDto, NivelDto, PagoDeClaseDto, PaginaCursor, PaginaOffset, ReportePeriodoDto, ReservaHuerfanaDto, TablaDto } from '@/types/staffPay'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/staff-pay`

export const staffPayService = {
  async access(venueId: string): Promise<{ enabled: boolean }> { return (await api.get(`${base(venueId)}/access`)).data },
  async levels(venueId: string): Promise<NivelDto[]> { return (await api.get(`${base(venueId)}/levels`)).data },
  async createLevel(venueId: string, name: string): Promise<{ id: string }> { return (await api.post(`${base(venueId)}/levels`, { name })).data },
  async updateLevel(venueId: string, levelId: string, data: { name?: string; archived?: boolean; sortOrder?: number }) { return (await api.patch(`${base(venueId)}/levels/${levelId}`, data)).data },
  async assignments(venueId: string, fecha?: string): Promise<AsignacionVigenteDto[]> { return (await api.get(`${base(venueId)}/assignments`, { params: { fecha } })).data },
  async assign(venueId: string, data: { staffId: string; payLevelId: string; effectiveFrom: string; simular?: boolean }): Promise<{ clasesQueCambian: number }> { return (await api.post(`${base(venueId)}/assignments`, data)).data },
  async tables(venueId: string, fecha?: string): Promise<TablaDto[]> { return (await api.get(`${base(venueId)}/tables`, { params: { fecha } })).data },
  async createTable(venueId: string, data: { name: string; productIds: string[] }): Promise<{ id: string }> { return (await api.post(`${base(venueId)}/tables`, data)).data },
  async publish(venueId: string, tableId: string, data: { effectiveFrom: string; countMode: 'BOOKED'; maxCount: number; cells: CeldaDto[]; simular?: boolean }): Promise<{ clasesQueCambian: number; revision?: number }> {
    return (await api.post(`${base(venueId)}/tables/${tableId}/versions`, data)).data
  },
  async report(venueId: string, p: { fecha?: string; sede?: string; offset: number; limit: number }): Promise<ReportePeriodoDto> { return (await api.get(`${base(venueId)}/report`, { params: p })).data },
  async staffDetail(venueId: string, staffId: string, p: { fecha?: string; sede?: string; cursor?: string; limit: number }): Promise<PaginaCursor<ClaseValoradaDto>> { return (await api.get(`${base(venueId)}/report/staff/${staffId}`, { params: p })).data },
  async exceptions(venueId: string, p: { fecha?: string; sede?: string; cursor?: string; limit: number }): Promise<PaginaCursor<ClaseValoradaDto>> { return (await api.get(`${base(venueId)}/report/exceptions`, { params: p })).data },
  async orphans(venueId: string, p: { fecha?: string; sede?: string; offset: number; limit: number }): Promise<PaginaOffset<ReservaHuerfanaDto>> { return (await api.get(`${base(venueId)}/report/orphans`, { params: p })).data },
  async classPay(venueId: string, sessionId: string): Promise<PagoDeClaseDto> { return (await api.get(`${base(venueId)}/class-sessions/${sessionId}/pay`)).data },
  async adjustClass(venueId: string, sessionId: string, data: AjusteClaseInput): Promise<PagoDeClaseDto> { return (await api.put(`${base(venueId)}/class-sessions/${sessionId}/pay-adjustments`, data)).data },
}
