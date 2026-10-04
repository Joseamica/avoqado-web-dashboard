import api from '@/api'
import type { AjusteClaseInput, AjusteManualDto, AjusteManualInput, AsignacionVigenteDto, CeldaDto, ClaseValoradaDto, ListaPeriodosDto, NivelDto, PagoDeClaseDto, PaginaCursor, PaginaOffset, PreviewCierreDto, ReciboDto, ReportePeriodoDto, ReservaHuerfanaDto, ResultadoCierreDto, TablaDto } from '@/types/staffPay'

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
  // ── Fase 2: cerrar y pagar ──
  async periods(venueId: string, antesDe?: string): Promise<ListaPeriodosDto> { return (await api.get(`${base(venueId)}/periods`, { params: antesDe ? { antesDe } : {} })).data },
  async setPeriodicity(venueId: string, periodicidad: 'MONTHLY' | 'SEMIMONTHLY') { return (await api.patch(`${base(venueId)}/periodicity`, { periodicidad })).data },
  async closePreview(venueId: string, fecha: string): Promise<PreviewCierreDto> { return (await api.get(`${base(venueId)}/periods/close-preview`, { params: { fecha } })).data },
  async close(venueId: string, body: { fecha: string; huellaEsperada: string; confirmarHuerfanas: boolean }): Promise<ResultadoCierreDto> { return (await api.post(`${base(venueId)}/periods/close`, body)).data },
  async markPaid(venueId: string, periodId: string, body: { staffId?: string; nota?: string }): Promise<{ marcados: number }> { return (await api.post(`${base(venueId)}/periods/${periodId}/paid`, body)).data },
  async addAdjustment(venueId: string, body: AjusteManualInput): Promise<AjusteManualDto> { return (await api.post(`${base(venueId)}/adjustments`, body)).data },
  async receipt(venueId: string, staffId: string, fecha: string, p: { cursor?: string; limit: number }): Promise<ReciboDto> { return (await api.get(`${base(venueId)}/staff/${staffId}/receipt`, { params: { fecha, ...p } })).data },
  async downloadReceipt(venueId: string, staffId: string, fecha: string, format: 'pdf' | 'xlsx', nombre: string): Promise<void> {
    try {
      const r = await api.get(`${base(venueId)}/staff/${staffId}/receipt/export`, { params: { fecha, format }, responseType: 'blob' })
      // Import dinámico: `@/utils/export` arrastra exceljs y papaparse, y este servicio lo cargan pantallas que sólo pintan una tarjeta.
      const { triggerDownload } = await import('@/utils/export')
      triggerDownload(r.data as Blob, `${nombre}.${format}`)
    } catch (err) {
      // `responseType: 'blob'` ⇒ el cuerpo de un error llega como Blob: se deja como JSON para que el aviso diga la causa real.
      const resp = (err as { response?: { data?: unknown } } | null)?.response
      if (resp?.data instanceof Blob) {
        try { resp.data = JSON.parse(await resp.data.text()) } catch { /* no era JSON: se deja el Blob */ }
      }
      throw err
    }
  },
}
