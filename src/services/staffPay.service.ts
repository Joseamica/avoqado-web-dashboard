import api from '@/api'
import type { AccesoDto, AjusteClaseInput, AjusteManualDto, AjusteManualInput, AsignacionVigenteDto, CeldaDto, ClaseValoradaDto, EstadoSedesDto, LiquidarInput, ListaPeriodosDto, NivelDto, PagoDeClaseDto, PaginaCursor, PaginaDiferenciasDto, PaginaOffset, PreviewCierreDto, PreviewLiquidacionDto, PreviewPagadoDto, ReciboDto, ReportePeriodoDto, ReservaHuerfanaDto, ResultadoCierreDto, ResultadoLiquidacionDto, ResultadoVentanaDto, SimulacionVigenciaDto, TablaDto, VistaPreviaParticipacionDto } from '@/types/staffPay'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/staff-pay`

export const staffPayService = {
  async access(venueId: string): Promise<AccesoDto> { return (await api.get(`${base(venueId)}/access`)).data },
  async levels(venueId: string): Promise<NivelDto[]> { return (await api.get(`${base(venueId)}/levels`)).data },
  async createLevel(venueId: string, name: string): Promise<{ id: string }> { return (await api.post(`${base(venueId)}/levels`, { name })).data },
  async updateLevel(venueId: string, levelId: string, data: { name?: string; archived?: boolean; sortOrder?: number }) { return (await api.patch(`${base(venueId)}/levels/${levelId}`, data)).data },
  async assignments(venueId: string, fecha?: string): Promise<AsignacionVigenteDto[]> { return (await api.get(`${base(venueId)}/assignments`, { params: { fecha } })).data },
  async assign(venueId: string, data: { staffId: string; payLevelId: string; effectiveFrom: string; simular?: boolean }): Promise<SimulacionVigenciaDto> { return (await api.post(`${base(venueId)}/assignments`, data)).data },
  async tables(venueId: string, fecha?: string): Promise<TablaDto[]> { return (await api.get(`${base(venueId)}/tables`, { params: { fecha } })).data },
  async createTable(venueId: string, data: { name: string; productIds: string[] }): Promise<{ id: string }> { return (await api.post(`${base(venueId)}/tables`, data)).data },
  async publish(venueId: string, tableId: string, data: { effectiveFrom: string; countMode: 'BOOKED'; maxCount: number; cells: CeldaDto[]; simular?: boolean }): Promise<SimulacionVigenciaDto & { revision?: number }> {
    return (await api.post(`${base(venueId)}/tables/${tableId}/versions`, data)).data
  },
  async report(venueId: string, p: { fecha?: string; sede?: string; offset: number; limit: number }): Promise<ReportePeriodoDto> { return (await api.get(`${base(venueId)}/report`, { params: p })).data },
  async staffDetail(venueId: string, staffId: string, p: { fecha?: string; sede?: string; cursor?: string; limit: number }): Promise<PaginaCursor<ClaseValoradaDto>> { return (await api.get(`${base(venueId)}/report/staff/${staffId}`, { params: p })).data },
  async exceptions(venueId: string, p: { fecha?: string; sede?: string; cursor?: string; limit: number }): Promise<PaginaCursor<ClaseValoradaDto>> { return (await api.get(`${base(venueId)}/report/exceptions`, { params: p })).data },
  async orphans(venueId: string, p: { fecha?: string; sede?: string; offset: number; limit: number }): Promise<PaginaOffset<ReservaHuerfanaDto>> { return (await api.get(`${base(venueId)}/report/orphans`, { params: p })).data },
  async classPay(venueId: string, sessionId: string): Promise<PagoDeClaseDto> { return (await api.get(`${base(venueId)}/class-sessions/${sessionId}/pay`)).data },
  async adjustClass(venueId: string, sessionId: string, data: AjusteClaseInput): Promise<PagoDeClaseDto> { return (await api.put(`${base(venueId)}/class-sessions/${sessionId}/pay-adjustments`, data)).data },
  // ── Fase 3: activar pago al personal, propinas en el recibo (staffpay:close) y estado por sede ──
  async activate(venueId: string, body: { periodicidad: 'MONTHLY' | 'SEMIMONTHLY'; inicioEsperado: string; sedes?: string[] }): Promise<{ startDate: string; yaActivado: boolean }> {
    return (await api.post(`${base(venueId)}/activate`, body)).data
  },
  async setTips(venueId: string, encender: boolean): Promise<{ encendidas: boolean }> {
    return (await api.put(`${base(venueId)}/tips`, { encender })).data
  },
  async sedes(venueId: string): Promise<EstadoSedesDto> { return (await api.get(`${base(venueId)}/sedes`)).data },
  /** Qué entra y qué queda fuera al activar o desactivar UNA sede desde `fecha`; sin ella, el servidor usa «hoy» de la sede. */
  async participationPreview(venueId: string, sedeId: string, accion: 'activar' | 'desactivar', fecha?: string): Promise<VistaPreviaParticipacionDto> {
    return (await api.get(`${base(venueId)}/sedes/${sedeId}/participation-preview`, { params: fecha ? { accion, fecha } : { accion } })).data
  },
  /** `fechaEsperada` = el `maximo` (hoy de la sede) que se vio en la vista previa: si ya es otro día, 409 FECHA_CAMBIO. */
  async activateSede(venueId: string, sedeId: string, body: { desde: string; fechaEsperada: string }): Promise<ResultadoVentanaDto> {
    return (await api.post(`${base(venueId)}/sedes/${sedeId}/activate`, body)).data
  },
  async deactivateSede(venueId: string, sedeId: string, body: { hasta: string; fechaEsperada: string }): Promise<ResultadoVentanaDto> {
    return (await api.post(`${base(venueId)}/sedes/${sedeId}/deactivate`, body)).data
  },
  // ── Fase 2: cerrar y pagar ──
  async periods(venueId: string, antesDe?: string): Promise<ListaPeriodosDto> { return (await api.get(`${base(venueId)}/periods`, { params: antesDe ? { antesDe } : {} })).data },
  async setPeriodicity(venueId: string, periodicidad: 'MONTHLY' | 'SEMIMONTHLY') { return (await api.patch(`${base(venueId)}/periodicity`, { periodicidad })).data },
  async closePreview(venueId: string, fecha: string): Promise<PreviewCierreDto> { return (await api.get(`${base(venueId)}/periods/close-preview`, { params: { fecha } })).data },
  async close(venueId: string, body: { fecha: string; huellaEsperada: string; confirmarHuerfanas: boolean }): Promise<ResultadoCierreDto> { return (await api.post(`${base(venueId)}/periods/close`, body)).data },
  async paidPreview(venueId: string, periodId: string, staffId?: string): Promise<PreviewPagadoDto> { return (await api.get(`${base(venueId)}/periods/${periodId}/paid-preview`, { params: staffId ? { staffId } : {} })).data },
  async markPaid(venueId: string, periodId: string, body: { staffId?: string; nota?: string; huellaEsperada?: string }): Promise<{ marcados: number }> { return (await api.post(`${base(venueId)}/periods/${periodId}/paid`, body)).data },
  async addAdjustment(venueId: string, body: AjusteManualInput): Promise<AjusteManualDto> { return (await api.post(`${base(venueId)}/adjustments`, body)).data },
  /** Con `sede`, renglones, total y cantidad son SÓLO de esa sede (Codex bloque A #5); la exportación no la acepta. */
  async receipt(venueId: string, staffId: string, fecha: string, p: { cursor?: string; limit: number; sede?: string }): Promise<ReciboDto> {
    const { sede, ...resto } = p
    return (await api.get(`${base(venueId)}/staff/${staffId}/receipt`, { params: { fecha, ...resto, ...(sede ? { sede } : {}) } })).data
  },
  // ── Fase 2, Bloque B: diferencias ──
  /** Lo pendiente de un periodo CERRADO, por cursor (el server lo devuelve `null` en la última página). */
  async differences(venueId: string, periodId: string, p: { cursor?: string; limit: number }): Promise<PaginaDiferenciasDto> {
    return (await api.get(`${base(venueId)}/periods/${periodId}/differences`, { params: p.cursor ? p : { limit: p.limit } })).data
  },
  /** 🔴 Bajo la sede de la CLASE, no la del URL (Codex R1-18): desde otra sede, la clase da 404. */
  async classDifference(classVenueId: string, sessionId: string, destinoFecha?: string): Promise<PreviewLiquidacionDto> {
    return (await api.get(`${base(classVenueId)}/class-sessions/${sessionId}/difference`, { params: destinoFecha ? { destinoFecha } : {} })).data
  },
  async settleDifference(classVenueId: string, sessionId: string, body: LiquidarInput): Promise<ResultadoLiquidacionDto> {
    return (await api.post(`${base(classVenueId)}/class-sessions/${sessionId}/difference/settle`, body)).data
  },
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
