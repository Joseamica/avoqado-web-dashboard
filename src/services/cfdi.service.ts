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

// ─── Nota de crédito (CFDI de EGRESO) por un reembolso ──────────────────────

/** Por qué NO se puede emitir la nota de crédito de un reembolso. */
export type CreditNoteBlockReason =
  | 'NOT_A_REFUND'
  | 'REFUND_NOT_COMPLETED'
  | 'NO_ORIGINAL_CFDI'
  | 'ORIGINAL_CANCELLED'
  | 'TIP_ONLY'
  | 'EXCEEDS_REMAINING'

export interface RefundCreditNote {
  id: string
  status: 'DRAFT' | 'VALIDATING' | 'VALIDATION_FAILED' | 'STAMPING' | 'STAMPED' | 'STAMP_FAILED' | 'CANCEL_REQUESTED' | 'CANCELLED'
  uuid: string | null
  serie: string | null
  folio: string | null
  /** INTEGER CENTS — dividir entre 100 para mostrar. */
  totalCents: number
  subtotalCents?: number
  taxCents?: number
  stampedAt?: string | null
  xmlUrl: string | null
  pdfUrl: string | null
  lastError?: string | null
}

export interface RefundCreditNoteStatus {
  /** La nota de crédito ya emitida (cualquier estado), o `null` si aún no se emite. */
  creditNote: RefundCreditNote | null
  /** El servidor decide si procede — y cuándo no, trae el texto en español. */
  eligibility: { eligible: boolean; reason: CreditNoteBlockReason | null; message: string | null }
  preview: {
    facturaOriginal: { folio: string; uuid: string; totalCents: number } | null
    receptor: { rfc: string; nombre: string } | null
    /** INTEGER CENTS. Es la MERCANCÍA devuelta — la propina va aparte y NO se factura. */
    amountToCreditCents: number
    tipRefundCents: number
  } | null
}

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
  /** Opt-in: permitir facturar ventas en efectivo (QR + factura global). Default false. */
  invoiceCashSales: boolean
  /** Opt-in: que el efectivo cuente en los libros fiscales (IVA/ISR/pólizas). Default false. */
  includeCashInAccounting: boolean
  /** Tasa de ISN (impuesto sobre nómina, estatal), fracción 0-0.10 (0.03 = 3%). */
  isnRate: number
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
  /** Opt-in: permitir facturar ventas en efectivo (QR + factura global). */
  invoiceCashSales?: boolean
  /** Opt-in: que el efectivo cuente en los libros fiscales (IVA/ISR/pólizas). */
  includeCashInAccounting?: boolean
  /** Tasa de ISN (fracción 0-0.10). */
  isnRate?: number
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
  /** Opt-out: excluir este merchant de los libros fiscales (pólizas / IVA / ISR). Default true. */
  includeInAccounting: boolean
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
  /** Opt-out: excluir este merchant de los libros fiscales. */
  includeInAccounting?: boolean
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

// ─── Issue a CFDI for an order (Flow B — "Facturar una cuenta") ──────────────

/**
 * Receptor (recipient) fiscal data captured at issue time.
 *
 * Shared shape between staff-issued (Flow B) and the public autofactura page
 * (Flow A) so the same form/modal can drive both.
 */
export interface CfdiReceptor {
  /** Receptor RFC (12-13 chars, uppercase). */
  rfc: string
  /** Razón social / legal name exactly as registered with the SAT. */
  razonSocial: string
  /** SAT régimen fiscal — 3-digit code (e.g. "601"). */
  regimenFiscal: string
  /** Domicilio fiscal — 5-digit postal code. */
  codigoPostal: string
  /** SAT uso de CFDI (e.g. "G03"). */
  usoCfdi: string
  /** Optional email to send the stamped CFDI to. */
  email?: string
}

/** Shape returned by a successful (201) stamp. */
export interface IssuedCfdi {
  id: string
  uuid: string
  serie: string
  folio: string
  status: string
  xmlUrl: string | null
  pdfUrl: string | null
}

/** 201 success body. */
export interface IssueCfdiResponse {
  cfdi: IssuedCfdi
}

// ─── Global CFDI (Flow C — "Factura global / Público en General") ────────────

/** Period a stamped global CFDI covers (echoed back by the backend). */
export interface GlobalPeriod {
  periodicidad: GlobalPeriodicity
  /** SAT "Meses" code (e.g. "01"-"12", or bimonthly "13"-"18"). */
  meses: string
  anio: number
}

/** 201 body — the period's global CFDI was stamped. */
export interface GlobalCfdiStamped {
  cfdi: {
    id: string
    uuid: string
    serie: string
    folio: string
    globalPeriod: GlobalPeriod
    pdfUrl: string | null
  }
}

/** 200 body — nothing to invoice for the period (success-ish, NOT an error). */
export interface GlobalCfdiNothingToInvoice {
  status: 'NOTHING_TO_INVOICE'
  message: string
}

/** Union of the two NON-error responses from the trigger endpoint. */
export type GlobalCfdiResult = GlobalCfdiStamped | GlobalCfdiNothingToInvoice

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

// ─── SAT catalog search (product/category fiscal keys) ──────────────────────

/** A single SAT catalog match: a code + its human description. */
export interface SatCatalogResult {
  /** SAT code — `ClaveProdServ` (8 digits) for products, `ClaveUnidad` for units. */
  key: string
  /** Human-readable SAT description for the code. */
  description: string
}

/** Which SAT catalog to search against. */
export type SatCatalogType = 'product' | 'unit'

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

  /**
   * Flow C — manually stamp the period's global CFDI ("Público en General") for
   * an emisor. No body. Gated by `cfdi:configure` + the `CFDI` feature.
   *
   * Returns the raw response body, which is one of two NON-error shapes:
   *   - 201 `{ cfdi: { id, uuid, serie, folio, globalPeriod, pdfUrl } }` — stamped.
   *   - 200 `{ status: 'NOTHING_TO_INVOICE', message }` — nothing to invoice.
   *
   * On any 4xx/5xx (409 CSD inactivo / already running, 422 validation, 502 PAC
   * rejected, 404 not found) axios throws and the caller must read
   * `err.response.status` / `err.response.data` to branch.
   */
  async triggerGlobalCfdi(venueId: string, emisorId: string): Promise<GlobalCfdiResult> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/global`)
    // Both 201 and 200 carry the meaningful body directly (no { data } wrapper
    // for this endpoint), but stay tolerant if the backend ever wraps it.
    return (response.data?.data ?? response.data) as GlobalCfdiResult
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

  /**
   * Emit (stamp) a CFDI for a closed/paid order — Flow B "Facturar una cuenta".
   *
   * On success the PAC stamped the invoice and the backend returns 201 with the
   * `{ cfdi }` payload. On any non-2xx (422 validation, 502 PAC rejected, 409
   * business rule, 403 feature/merchant gating, 404 not found) axios throws and
   * the caller must read `err.response.status` / `err.response.data` to branch.
   */
  async issueCfdiForOrder(venueId: string, orderId: string, receptor: CfdiReceptor): Promise<IssueCfdiResponse> {
    const body = {
      rfc: receptor.rfc,
      razonSocial: receptor.razonSocial,
      regimenFiscal: receptor.regimenFiscal,
      codigoPostal: receptor.codigoPostal,
      usoCfdi: receptor.usoCfdi,
      ...(receptor.email?.trim() && { email: receptor.email.trim() }),
    }
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/orders/${orderId}/cfdi`, body)
    return response.data?.data ?? response.data
  },

  // ── Nota de crédito (CFDI de EGRESO) por un reembolso ────────────────────

  /**
   * Estado de la nota de crédito de un reembolso: si ya existe, si se puede emitir,
   * y —cuando no— el motivo EN ESPAÑOL listo para pintarse.
   *
   * 404 = el reembolso no existe en este local. 403 = el local no tiene la feature CFDI.
   */
  async getRefundCreditNote(venueId: string, refundId: string): Promise<RefundCreditNoteStatus> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/refunds/${refundId}/credit-note`)
    return (response.data?.data ?? response.data) as RefundCreditNoteStatus
  },

  /**
   * Timbra la nota de crédito (CFDI de Egreso) que ampara un reembolso.
   *
   * 🔴 Irreversible: crea un documento fiscal real. La venta original NO se modifica y su
   * CFDI de ingreso NO se cancela — el egreso va relacionado (TipoRelacion 01, uso G02).
   * Errores: 409 regla de negocio (sin factura original, cancelada, sólo propina, importe
   * excedido, ya en proceso) · 422 validación previa · 502 el PAC rechazó · 403 sin plan.
   */
  async emitRefundCreditNote(venueId: string, refundId: string): Promise<{ creditNote: RefundCreditNote }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/refunds/${refundId}/credit-note`)
    return response.data?.data ?? response.data
  },

  // ── Deferred to slice 2 (stubbed so callers compile) ─────────────────────

  /** Trigger generation of the periodic "factura global" for an emisor.
   *  Wired into the admin trigger page in a later slice. */
  async triggerGlobal(venueId: string, emisorId: string): Promise<{ cfdiId?: string; queued?: boolean }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/global`)
    return response.data?.data ?? response.data
  },

  /**
   * Search the SAT catalog for product (`ClaveProdServ`) or unit (`ClaveUnidad`)
   * keys. Backed by `GET /fiscal/sat-catalog?type=product|unit&q=<texto>`
   * (gated `cfdi:view` + the `CFDI` feature).
   *
   * Returns `{ key, description }[]`. Used by the SAT key pickers on the product
   * and category forms.
   */
  async searchSatCatalog(venueId: string, type: SatCatalogType, q: string): Promise<SatCatalogResult[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal/sat-catalog`, {
      params: { type, ...(q.trim() ? { q: q.trim() } : {}) },
    })
    const data = response.data?.data ?? response.data
    return (data?.results ?? []) as SatCatalogResult[]
  },
}

export default cfdiService
