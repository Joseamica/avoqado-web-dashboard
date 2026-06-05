import api from '@/api'

/**
 * Facturación (CFDI 4.0) service.
 *
 * Wraps the venue-scoped fiscal endpoints exposed by avoqado-server:
 *   /api/v1/dashboard/venues/:venueId/fiscal/*  — emisor + CSD + merchant config
 *   /api/v1/dashboard/venues/:venueId/cfdi/*    — issued invoices list + cancel
 *
 * Money fields on a Cfdi are INTEGER CENTS — divide by 100 for display.
 */

// ─── Emisor (the fiscal issuer / "RFC emisor") ──────────────────────────────

export type CsdStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'

export type GlobalPeriodicity = 'DIARIO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'BIMESTRAL'

export interface Emisor {
  id: string
  venueId: string
  rfc: string
  legalName: string
  /** SAT régimen fiscal — 3-digit code (e.g. "601"). */
  regimenFiscal: string
  /** Lugar de expedición — 5-digit postal code. */
  lugarExpedicion: string
  provider: string
  /** PAC organization id once provisioned; null until "Conectar al PAC" runs. */
  providerOrgId: string | null
  csdStatus: CsdStatus
  csdExpiresAt: string | null
  csdLastCheckedAt: string | null
  serie: string | null
  defaultUsoCfdi: string
  globalPeriodicity: GlobalPeriodicity
  createdAt: string
  updatedAt: string
}

export interface UpsertEmisorRequest {
  rfc: string
  legalName: string
  /** 3-digit SAT régimen fiscal code. */
  regimenFiscal: string
  /** 5-digit postal code (CP). */
  lugarExpedicion: string
  serie?: string
  defaultUsoCfdi?: string
  globalPeriodicity?: GlobalPeriodicity
}

export interface UploadCsdRequest {
  cerBase64: string
  keyBase64: string
  password: string
}

// ─── Merchant config (per merchant-account / e-commerce channel toggles) ────

export interface MerchantConfig {
  id: string
  merchantAccountId: string | null
  ecommerceMerchantId: string | null
  fiscalEmisorId: string
  facturacionEnabled: boolean
  autofacturaEnabled: boolean
  includeInGlobal: boolean
  merchantAccount?: { id: string; alias: string; displayName: string } | null
  ecommerceMerchant?: { id: string; channelName: string } | null
}

export interface UpsertMerchantConfigRequest {
  /** Exactly one of merchantAccountId / ecommerceMerchantId must be set. */
  merchantAccountId?: string
  ecommerceMerchantId?: string
  fiscalEmisorId: string
  facturacionEnabled: boolean
  autofacturaEnabled: boolean
  includeInGlobal: boolean
}

export interface FiscalConfig {
  emisores: Emisor[]
  merchantConfigs: MerchantConfig[]
}

// ─── CFDI (issued invoices) ─────────────────────────────────────────────────

export type CfdiFlow = 'STAFF_B' | 'AUTOFACTURA_A' | 'GLOBAL_C'

export interface Cfdi {
  id: string
  type: string
  status: string
  flow: CfdiFlow
  isGlobal: boolean
  orderId: string | null
  receptorRfc: string
  receptorNombre: string
  serie: string
  folio: string
  uuid: string | null
  /** INTEGER CENTS. */
  subtotalCents: number
  /** INTEGER CENTS. */
  taxCents: number
  /** INTEGER CENTS. */
  totalCents: number
  stampedAt: string | null
  createdAt: string
  cancelStatus: string | null
  xmlUrl: string | null
  pdfUrl: string | null
  globalPeriod: unknown
}

export interface CfdiListFilters {
  status?: string
  flow?: CfdiFlow
  isGlobal?: boolean
  receptorRfc?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface CfdiListResponse {
  cfdis: Cfdi[]
  total: number
  page: number
  pageSize: number
}

export type CancelMotivo = '01' | '02' | '03' | '04'

export interface CancelCfdiRequest {
  motivo: CancelMotivo
  /** Required by SAT when motivo === '01' (substitutes another CFDI). */
  substituteUuid?: string
}

export interface CancelCfdiResponse {
  cancelStatus: string
  cancelledAt: string
  cfdiId: string
}

// ─── SAT catalog stub (wired in a later slice) ──────────────────────────────

export interface SatCatalogEntry {
  code: string
  description: string
}

export const cfdiService = {
  // ── Fiscal config ──────────────────────────────────────────────────────
  async getFiscalConfig(venueId: string): Promise<FiscalConfig> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal/config`)
    // Backend may wrap in { success, data } or return the shape directly.
    const data = response.data?.data ?? response.data
    return {
      emisores: data?.emisores ?? [],
      merchantConfigs: data?.merchantConfigs ?? [],
    }
  },

  async createEmisor(venueId: string, data: UpsertEmisorRequest): Promise<Emisor> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores`, data)
    return response.data?.data ?? response.data
  },

  async updateEmisor(venueId: string, emisorId: string, data: UpsertEmisorRequest): Promise<Emisor> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}`, data)
    return response.data?.data ?? response.data
  },

  /** Connect an emisor to the PAC (facturapi org). No body. */
  async provisionEmisor(venueId: string, emisorId: string): Promise<Emisor> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/provision`)
    return response.data?.data ?? response.data
  },

  /** Upload the CSD (.cer + .key as base64) and its password. */
  async uploadCsd(venueId: string, emisorId: string, data: UploadCsdRequest): Promise<Emisor> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/csd`, data)
    return response.data?.data ?? response.data
  },

  async upsertMerchantConfig(venueId: string, data: UpsertMerchantConfigRequest): Promise<MerchantConfig> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/fiscal/merchant-config`, data)
    return response.data?.data ?? response.data
  },

  // ── CFDI list + actions ────────────────────────────────────────────────
  async getCfdis(venueId: string, filters: CfdiListFilters = {}): Promise<CfdiListResponse> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/cfdi`, {
      params: {
        ...(filters.status && { status: filters.status }),
        ...(filters.flow && { flow: filters.flow }),
        ...(filters.isGlobal !== undefined && { isGlobal: filters.isGlobal }),
        ...(filters.receptorRfc && { receptorRfc: filters.receptorRfc }),
        ...(filters.from && { from: filters.from }),
        ...(filters.to && { to: filters.to }),
        ...(filters.page && { page: filters.page }),
        ...(filters.pageSize && { pageSize: filters.pageSize }),
      },
    })
    const data = response.data?.data ?? response.data
    return {
      cfdis: data?.cfdis ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? filters.page ?? 1,
      pageSize: data?.pageSize ?? filters.pageSize ?? 20,
    }
  },

  async getCfdi(venueId: string, cfdiId: string): Promise<Cfdi> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/cfdi/${cfdiId}`)
    const data = response.data?.data ?? response.data
    return data?.cfdi ?? data
  },

  async cancelCfdi(venueId: string, cfdiId: string, data: CancelCfdiRequest): Promise<CancelCfdiResponse> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/cfdi/${cfdiId}/cancel`, data)
    return response.data?.data ?? response.data
  },

  // ── Deferred to slice 2 (stubbed so callers compile) ─────────────────────

  /** Trigger generation of the periodic "factura global" for an emisor.
   *  Wired into the admin trigger page in a later slice. */
  async triggerGlobal(venueId: string, emisorId: string): Promise<{ cfdiId?: string; queued?: boolean }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/trigger-global`)
    return response.data?.data ?? response.data
  },

  /** Fetch a SAT catalog (régimen fiscal, uso CFDI, etc.). Wired into the
   *  SAT-keys product config in a later slice. */
  async satCatalog(venueId: string, catalog: string): Promise<SatCatalogEntry[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal/sat-catalog/${catalog}`)
    return response.data?.data ?? response.data ?? []
  },
}

export default cfdiService
