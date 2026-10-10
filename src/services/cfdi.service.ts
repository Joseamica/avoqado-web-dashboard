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

/**
 * Por qué NO se puede emitir la nota de crédito de un reembolso. C2 · T10 (N4 de la T3): la unión COMPLETA del servidor
 * (`cfdiCreditNote.service.ts`, `CreditNoteBlockReason`), cada una con su texto en `creditNote.reason.*` (es/en). La pantalla pinta el
 * `message` del servidor (en español, con folios y montos); el texto por motivo es el respaldo cuando no viene.
 */
export type CreditNoteBlockReason =
  | 'NOT_A_REFUND'
  | 'REFUND_NOT_COMPLETED'
  | 'NO_ORIGINAL_CFDI'
  | 'ORIGINAL_CANCELLED'
  | 'ORIGINAL_CANCEL_PENDING'
  | 'ORIGINAL_EN_SUSTITUCION'
  | 'TIP_ONLY'
  | 'EXCEEDS_REMAINING'
  | 'ORIGINAL_IVA_MIXTO' // ya no se emite (C2): se conserva en el tipo
  | 'ORIGINAL_ENTRADA_INVALIDA'
  | 'ESPERA_XML'
  | 'XML_IRRECUPERABLE'
  | 'ARTICULO_SIN_EVIDENCIA'
  | 'ARTICULOS_NO_CUADRAN'
  | 'ARTICULO_EXCEDE_LO_FACTURADO'
  | 'CENTAVOS_DE_REDONDEO'
  // C2 (Tarea 9): la devolución por artículos no tiene evidencia de lo facturado (se puede «acreditar por importe»), o se eligió por importe
  // cuando sí la había.
  | 'SIN_MONTO_POR_ARTICULO'
  | 'REPARTO_DE_ENTREGA_INVALIDO'
  | 'IMPORTE_DEVUELTO_INVALIDO'
  | 'OCHO_SIN_REGLA'
  | 'NO_CUADRA_CON_EL_PAC'
  | 'MODALIDAD_NO_PERMITIDA'
  | 'SIN_FORMA_DE_PAGO'

/** C2 · T10: todos los motivos (la prueba exige un texto es/en para cada uno). */
export const MOTIVOS_DE_BLOQUEO_DE_NOTA: readonly CreditNoteBlockReason[] = [
  'NOT_A_REFUND',
  'REFUND_NOT_COMPLETED',
  'NO_ORIGINAL_CFDI',
  'ORIGINAL_CANCELLED',
  'ORIGINAL_CANCEL_PENDING',
  'ORIGINAL_EN_SUSTITUCION',
  'TIP_ONLY',
  'EXCEEDS_REMAINING',
  'ORIGINAL_IVA_MIXTO',
  'ORIGINAL_ENTRADA_INVALIDA',
  'ESPERA_XML',
  'XML_IRRECUPERABLE',
  'ARTICULO_SIN_EVIDENCIA',
  'ARTICULOS_NO_CUADRAN',
  'ARTICULO_EXCEDE_LO_FACTURADO',
  'CENTAVOS_DE_REDONDEO',
  'SIN_MONTO_POR_ARTICULO',
  'REPARTO_DE_ENTREGA_INVALIDO',
  'IMPORTE_DEVUELTO_INVALIDO',
  'OCHO_SIN_REGLA',
  'NO_CUADRA_CON_EL_PAC',
  'MODALIDAD_NO_PERMITIDA',
  'SIN_FORMA_DE_PAGO',
]

/** C2: el tratamiento de IVA de un concepto de la nota. */
export type TratamientoDeNota = 'IVA_16' | 'IVA_8' | 'IVA_0' | 'EXENTO' | 'NO_OBJETO'
/** C2: lo que se acreditaría de un tratamiento (INTEGER CENTS). */
export interface DesgloseDeNota {
  tratamiento: TratamientoDeNota
  cents: number
  baseCents: number
  ivaCents: number
}
/** C2 (P8): lo que la nota lleva de más, declarado por componente y ámbito (centavos de redondeo). */
export interface RedondeoDeNota {
  tratamiento: TratamientoDeNota
  componente: 'BASE' | 'IVA' | 'ARTICULO'
  cents: number
  ambito: 'FACTURA' | 'TICKET' | 'DOCUMENTO_GLOBAL'
  orderItemId?: string
}
/**
 * C2 (Tarea 9, P10): la devolución por artículos se detuvo por falta de evidencia y el servidor ofrece «acreditar por importe»: lo
 * devuelto repartido por tasa en proporción a lo que queda, con su redondeo y la HUELLA del reparto que se confirma.
 */
export interface AlternativaPorImporte {
  modalidad: 'POR_IMPORTE'
  desglose: DesgloseDeNota[]
  redondeo: RedondeoDeNota[]
  huella: string
  /** Cuando se acreditaría dinero de un artículo que no aparece en la factura (p. ej. una cortesía). */
  aviso?: string
}
/** C2 (Tarea 9): la elección «acreditar por importe» confirmada por una persona, con la huella del reparto que vio. */
export interface EleccionPorImporte {
  modalidad: 'POR_IMPORTE'
  huella: string
}

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
  /** C2 · ronda QA (D2): la nota se envió al PAC y quedó EN DUDA; sólo se confirma (nunca se vuelve a emitir). Opcional en servidores viejos. */
  recoveryOnly?: boolean
  /** El servidor decide si procede — y cuándo no, trae el texto en español. */
  eligibility: { eligible: boolean; reason: CreditNoteBlockReason | null; message: string | null }
  preview: {
    /**
     * `esGlobal` (C2 · T8, opcional): la original es la factura global en la que entró el ticket. `etiqueta` (C2 · ronda QA D7, opcional):
     * el folio con el formato de la lista («A-7»); sin ella, `folio`.
     */
    facturaOriginal: { folio: string; etiqueta?: string; uuid: string; totalCents: number; esGlobal?: boolean } | null
    receptor: { rfc: string; nombre: string } | null
    /** INTEGER CENTS. Es la MERCANCÍA devuelta — la propina va aparte y NO se factura. */
    amountToCreditCents: number
    tipRefundCents: number
    /** C2 (opcional): lo que se acreditaría por tratamiento (total, base e IVA), cuando es elegible. */
    desglose?: DesgloseDeNota[]
    /** C2 (opcional; P8): el redondeo que llevaría la nota, por componente y ámbito. */
    redondeo?: RedondeoDeNota[]
    /** C2 (opcional): el uso del CFDI de la nota (G02). */
    usoCfdi?: string
    /** C2 (opcional; G6): la facturación del comercio está apagada; la nota NO se bloquea (corrige una factura ya emitida). */
    avisoFacturacionApagada?: string
    /** C2 · T10 ronda 1 (M9, opcional): la huella de lo que se timbraría; la emisión normal la manda para atar lo que se vio. */
    huella?: string
    /** C2 (Tarea 9, opcional): la alternativa «acreditar por importe», cuando por artículos falta evidencia. */
    alternativa?: AlternativaPorImporte
  } | null
}

// ─── Emisor (the fiscal issuer / "RFC emisor") ──────────────────────────────

export type CsdStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'

export type GlobalPeriodicity = 'DIARIO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'BIMESTRAL'

/**
 * Estado de onboarding del emisor en el PAC. `pendingSteps` trae los códigos
 * que el PAC reporta como faltantes para timbrar en Live — el que el dashboard
 * acciona es 'manifiesto' (la Carta Manifiesto se firma con la e.firma).
 */
export interface EmisorProviderStatus {
  provisioned: boolean
  isProductionReady: boolean
  pendingSteps: string[]
}

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
  /**
   * C1 (T10, ajuste del founder): incluir en la factura global las ventas cobradas FUERA de la terminal (efectivo, transferencia, vales y
   * tipos de pago propios). Default false. Opcional: un servidor anterior no lo manda (se lee como apagado).
   */
  includeOffTerminalSalesInGlobal?: boolean
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
  /** C1 (T10): incluir en la global las ventas cobradas fuera de la terminal. */
  includeOffTerminalSalesInGlobal?: boolean
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
  /** Último intento: la fecha de una factura sin timbre (borrador o fallida). Opcional: servidores viejos no lo mandan. */
  updatedAt?: string
  cancelStatus: string | null
  /**
   * C2 · T10 (Codex C2-31): en qué va la cancelación, derivado por el servidor en CADA consulta (ENVIANDO pasa a CANCELACION_EN_DUDA sin
   * que nadie escriba nada). Opcional: un servidor anterior no lo manda.
   */
  estadoCancelacion?: EstadoDeCancelacion
  /** C2 · T10 (M9): por qué NO quedó la cancelación (sólo con `estadoCancelacion: 'RECHAZADA'`). */
  motivoRechazoCancelacion?: string
  /**
   * C2 · ronda QA (D6, opcional): un `STAMP_FAILED` que el PAC NO rechazó: se envió y no hubo respuesta clara; la conciliación lo confirma.
   * Sólo viene en `true`.
   */
  timbreEnDuda?: boolean
  xmlUrl: string | null
  pdfUrl: string | null
  globalPeriod: unknown
  /** Si ESTA factura corrige a otra, el id de la corregida. */
  replacesCfdiId?: string | null
  /**
   * Las facturas que corrigen a ÉSTA. 🔴 Una factura sustituida sigue `STAMPED` hasta que el SAT
   * confirme su cancelación: sin este campo la lista enseñaría dos facturas vivas por la misma venta
   * sin decir que una sustituye a la otra.
   */
  replacedBy?: Array<{ id: string; uuid: string | null; serie: string | null; folio: string | null; status: string; totalCents?: number }>
  /**
   * C1 (Tarea 11/13, contrato supuesto): el emisor de la factura. «Emitir complementaria» lo necesita (la ruta es por emisor).
   * Opcional: sin él, la fila no ofrece la acción.
   */
  fiscalEmisorId?: string | null
  /**
   * C1 (contrato supuesto): en una global, el id de su principal si ESTA es una complementaria; `null` si es principal. Ausente
   * (servidor anterior) ⇒ no se sabe y la fila no ofrece «Emitir complementaria».
   */
  complementariaDe?: string | null
}

export interface CfdiListFilters {
  /** Uno o varios estatus del servidor (viajan separados por coma). */
  status?: string | string[]
  flow?: CfdiFlow | CfdiFlow[]
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

/**
 * Vista previa del «contrato de precio» de una venta (IVA por producto, §4.6 del spec).
 *
 * El 422 de «Facturar» la trae en `priceContract` SÓLO cuando lo que bloquea es una venta vieja de IVA
 * mixto cuyo contrato se desconoce. Con `confirmable: true`, quien tenga `cfdi:configure` puede confirmar
 * que el precio ya incluía IVA (con `version` + `huella` como candado de lo que vio). Con `confirmable:
 * false`, el servidor ya puso su `motivo` en `reasons` en lugar del «confírmalo».
 */
export interface PriceContractPreview {
  orderId: string
  orderNumber: string
  /** ISO 8601 (UTC). Se muestra en el timezone del venue. */
  createdAt: string
  totalMxn: number
  taxAmountMxn: number
  source: string
  contratoActual: string
  version: number
  status: string
  paymentStatus: string
  paidAmountMxn: number
  confirmable: boolean
  motivo?: string
  huella: string
}

/** Cuerpo del 422 de «Facturar»: no se timbró nada; `reasons` dice por qué. */
export interface IssueCfdiValidationError {
  error: string
  reasons: string[]
  cfdiId?: string
  priceContract?: PriceContractPreview
}

// ─── Global CFDI (Flow C — "Factura global / Público en General") ────────────

/** Period a stamped global CFDI covers (echoed back by the backend). */
export interface GlobalPeriod {
  periodicidad: GlobalPeriodicity
  /** SAT "Meses" code (e.g. "01"-"12", or bimonthly "13"-"18"). */
  meses: string
  anio: number
}

/**
 * Cuántas ventas quedaron fuera, por motivo (lista cerrada del servidor: `EFECTIVO`, `PRODUCTO_POR_REVISAR`, …).
 * Opcional: un servidor anterior a C1 sólo manda `excluidasPorIvaMixto`.
 */
export type ExcluidasPorMotivo = Record<string, number>

/** Campos de conteo que el servidor agrega a cada respuesta del disparo (C1, Tareas 10 y 11). Todos opcionales. */
interface GlobalCfdiCounts {
  /** Campo viejo: la suma de los motivos de IVA. Se conserva. */
  excluidasPorIvaMixto?: number
  /** C1 (Tarea 10): las excluidas por motivo, incluidas las de configuración (efectivo, comercio, RFC). */
  excluidas?: ExcluidasPorMotivo
  /** C1 (Tarea 11): el id de la global principal cuando ESTA es una complementaria. */
  complementariaDe?: string
}

/** 201 body — the period's global CFDI was stamped. */
export interface GlobalCfdiStamped extends GlobalCfdiCounts {
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
export interface GlobalCfdiNothingToInvoice extends GlobalCfdiCounts {
  status: 'NOTHING_TO_INVOICE'
  message: string
}

/**
 * C1 (T11 ronda 1, m4): 200 — la llave YA estaba timbrada (otro clic o el job llegaron antes): no se emitió otra. Trae `cfdi` como el 201,
 * así que hay que mirar `yaTimbrada` (o `status`) ANTES de avisar «timbrada».
 */
export interface GlobalCfdiAlreadyStamped extends GlobalCfdiCounts {
  status: 'YA_TIMBRADA'
  yaTimbrada: true
  message: string
  cfdi: GlobalCfdiStamped['cfdi']
}

/** Union of the NON-error responses from the trigger endpoint (and from the complementary one). */
export type GlobalCfdiResult = GlobalCfdiStamped | GlobalCfdiNothingToInvoice | GlobalCfdiAlreadyStamped

/** Estado de la global PRINCIPAL de un periodo (C1, Tarea 8). Una cancelación en trámite sigue `TIMBRADA`. */
export type EstadoDelPeriodo = 'TIMBRADA' | 'SIN_TIMBRAR' | 'SIN_GLOBAL' | 'CANCELADA'

/**
 * Cuántas ventas del periodo entrarían HOY a una complementaria, entre las revisadas (C1-27). `completo: false` = el servidor dejó
 * de revisar antes de terminar: `n` es «al menos n», y con `n: 0` no se sabe cuántas (nunca «200 o más»).
 */
export interface CorregidasPendientes {
  n: number
  completo: boolean
}

/** Un periodo cerrado RECIENTE de la factura global (los que revisa el job; uno más viejo se pide a soporte: C1-P16 = B). */
export interface PeriodoDeLaGlobal {
  /** Inicio del periodo, ISO con zona. Es lo que se manda tal cual como `desde` para emitirlo a mano. */
  desde: string
  /** Fin (exclusivo) del periodo, ISO. */
  hasta: string
  meses: string
  anio: number
  estado: EstadoDelPeriodo
  /** La global principal del periodo, si existe. */
  cfdiId: string | null
  folio: string | null
  /** Por qué no se timbró (sólo `SIN_TIMBRAR`), tal como lo manda el servidor. */
  motivo: string | null
  /** Sólo con la principal timbrada o cancelada (Tarea 11); si no, `null`. */
  corregidasPendientes: CorregidasPendientes | null
  /** Las complementarias de la principal (Tarea 11). `motivo`: sólo en una `SIN_TIMBRAR` (p. ej. el rechazo del PAC; T11 ronda 1, m2). */
  complementarias: Array<{
    cfdiId: string
    folio: string | null
    estado: 'TIMBRADA' | 'CANCELADA' | 'SIN_TIMBRAR'
    motivo?: string | null
    /** Ronda QA (hermanos, opcional): quedó EN DUDA (el PAC no contestó claro); no es un rechazo. */
    timbreEnDuda?: true
  }>
  /** Ronda QA (hermanos, opcional): la principal SIN_TIMBRAR quedó EN DUDA (el PAC no contestó claro); no es un rechazo. */
  timbreEnDuda?: true
}

/**
 * C1 (T10 ronda 1, I1): una global sin timbrar de OTRA periodicidad (de antes de que el RFC la cambiara). SÓLO para mostrar: nunca se emite
 * desde el panel (su `desde` es de otra periodicidad). `estado`: `APARTADA` (tiene ventas apartadas), `RECHAZADA` (el PAC la rechazó; sus
 * ventas quedaron libres), `DETENIDA` (captura que no se emitió). `complementariaDe` ≠ null ⇒ es una complementaria (se emite desde la lista).
 */
export interface GlobalDeOtraPeriodicidad {
  cfdiId: string
  periodicidad: GlobalPeriodicity
  desde: string
  hasta: string
  meses: string
  anio: number
  estado: 'APARTADA' | 'RECHAZADA' | 'DETENIDA'
  folio: string | null
  motivo: string | null
  /** Ronda QA (hermanos, opcional): quedó EN DUDA (el PAC no contestó claro); no es un rechazo. */
  timbreEnDuda?: true
  complementariaDe: string | null
}

/** C1 (T8 + T10): la respuesta de `GET …/global/periodos`. `otrasPeriodicidades.completo: false` ⇒ hay más (a lo más 10 por llamada). */
export interface GlobalPeriodosResponse {
  periodos: PeriodoDeLaGlobal[]
  otrasPeriodicidades: { globales: GlobalDeOtraPeriodicidad[]; completo: boolean }
  /**
   * Ola final de C1 («apagado se VE y se EXPLICA»): `true` = Avoqado no emite la global de este RFC (ningún comercio suyo con «Facturación
   * activa» e «Incluir en global», y el interruptor de ventas fuera de la terminal apagado). Opcional: un servidor anterior no lo manda, y
   * entonces la pantalla se comporta como siempre.
   */
  globalApagada?: boolean
}

/** Una venta que no entró a la factura global, con su motivo (C1, Tarea 12). */
export interface GlobalExcluida {
  orderId: string
  folio: string
  /** INTEGER CENTS: todos los cobros elegibles de la venta. */
  cobradoCents: number
  motivo: string
  /** El texto genérico del motivo (qué pasó y qué hacer). */
  texto: string
  /** El detalle de ESTA venta (nombra productos o montos). Se muestra tal cual. */
  detalle: string
}

/** Una página del listado de ventas que no entraron (C1, Tarea 12). `totales` y `corregidasPendientes` sólo en la primera página. */
export interface GlobalExcluidasPage {
  periodo: { meses: string; anio: number; desde: string; hasta: string }
  estadoDelPeriodo: EstadoDelPeriodo
  totales: { porMotivo: ExcluidasPorMotivo; total: number; completo: boolean; revisadas: number } | null
  corregidasPendientes: CorregidasPendientes | null
  /** La estadística HISTÓRICA de la captura de la principal: nunca se suma a `totales`. */
  ultimaCaptura: { al: string; excluidas: ExcluidasPorMotivo } | null
  excluidas: GlobalExcluida[]
  /** Cursor de la siguiente página; `null` = no hay más. */
  siguiente: string | null
  revisadas: number
}

/** Qué periodo listar: el de una global que ya existe (por su id, C1-32) o uno reciente (`desde`); sin nada, el último cerrado. */
export interface GlobalExcluidasQuery {
  principalId?: string
  desde?: string
  cursor?: string
}

/** Vista previa de la complementaria de una principal (C1, Tarea 11). `motivo` ≠ null ⇒ no se puede emitir (p. ej. año fuera: C1-33). */
export interface GlobalComplementariaPreview {
  periodo: { desde: string; hasta: string; meses: string; anio: number }
  estadoPrincipal: 'TIMBRADA' | 'CANCELADA'
  corregidasPendientes: CorregidasPendientes
  siguienteLlave: string | null
  motivo: string | null
}

export type CancelMotivo = '01' | '02' | '03' | '04'

export type CancelCfdiRequest =
  | {
      motivo: CancelMotivo
      /** Required by SAT when motivo === '01' (substitutes another CFDI). */
      substituteUuid?: string
    }
  /** C2 · T10 ronda 1 (I-1): «Consultar estado». El servidor SÓLO consulta: nunca anota ni envía un intento de cancelación. */
  | { soloConsultar: true }

export interface SendCfdiEmailResponse {
  folio: string
  /** El correo al que se mandó; `null` = el que el cliente registró en el proveedor (facturas anteriores al protocolo). */
  destination: string | null
}

/** C2: el estado derivado de la cancelación que manda el servidor (EN DUDA = enviada sin respuesta clara; sólo se consulta). */
export type EstadoDeCancelacion = 'ANOTADA' | 'ENVIANDO' | 'EN_TRAMITE' | 'CANCELACION_EN_DUDA' | 'RECHAZADA' | 'CANCELADA' | null

export interface CancelCfdiResponse {
  /** `null` sólo al consultar (`soloConsultar`) una factura sin cancelación pedida. */
  cancelStatus: string | null
  cancelledAt: string
  cfdiId: string
  /** C2: opcional (servidores anteriores no lo mandan). */
  estado?: EstadoDeCancelacion
  /** C2 ronda 1 (I1): el envío terminó sin respuesta clara; opcional. */
  enDuda?: boolean
  /** C2 · T10 (M9): por qué NO quedó (sólo con el rechazo); opcional. */
  motivoRechazoCancelacion?: string
}

/**
 * Respuesta de sustituir una factura equivocada.
 *
 * 🔴 `cancelPendiente` es el campo que la pantalla DEBE mostrar: el SAT puede dejar la cancelación
 * de la original en trámite (espera la aceptación del receptor) o rechazarla, y en ambos casos la
 * original SIGUE VIGENTE. Decir «listo, cancelada» sin mirar esto sería mentirle al negocio.
 */
export interface ReplaceCfdiResponse {
  status: 'REPLACED' | 'VALIDATION_FAILED' | 'STAMP_FAILED'
  sustituta: {
    id: string
    uuid: string | null
    serie: string | null
    folio: string | null
    totalCents: number | null
    xmlUrl: string | null
    pdfUrl: string | null
  } | null
  original: { id: string; uuid: string | null }
  cancelStatus: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | null
  cancelPendiente: boolean
  reasons?: string[]
  /** C2 (M6 de la T2; opcional): por qué no se pudo PEDIR la cancelación de la original (p. ej. tiene una nota de crédito viva). */
  cancelConflicto?: string
  /** C2 (N3 de la T2; opcional): por qué no SALIÓ la cancelación de la original (p. ej. no se pudo consultar al SAT); no se envió nada. */
  cancelAviso?: string
  /** C2 · ola final (opcional): la cancelación de la original quedó EN DUDA (llega con `cancelStatus: 'REQUESTED'`); igual que en `/cancel`. */
  enDuda?: boolean
  /**
   * C2 · ola final (opcional: servidores anteriores no lo mandan): ESTA petición anotó un intento nuevo de cancelar la original. `false` ⇒ el
   * `cancelStatus` que llega (p. ej. un REJECTED) es de un intento anterior, no de esta petición.
   */
  cancelIntentoNuevo?: boolean
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

  /** Sube el logo del negocio a la org del PAC: es lo que imprime en el PDF de cada factura. Idempotente. */
  async syncEmisorLogo(
    venueId: string,
    emisorId: string,
  ): Promise<{ synced: true } | { synced: false; reason: 'NO_LOGO' | 'NOT_PROVISIONED' }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/logo`)
    return response.data
  },

  /**
   * PDF/XML como ADJUNTO vía el API (con sesión): el servidor manda `Content-Disposition: attachment`
   * y el nombre `serie-folio.pdf`, así el navegador lo guarda en Descargas en vez de abrirlo.
   */
  async downloadCfdiFile(venueId: string, cfdiId: string, type: 'pdf' | 'xml'): Promise<{ blob: Blob; filename: string }> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/cfdi/${cfdiId}/file`, { params: { type }, responseType: 'blob' })
    const disposition: string = response.headers?.['content-disposition'] ?? ''
    const match = /filename="([^"]+)"/.exec(disposition)
    return { blob: response.data as Blob, filename: match?.[1] ?? `${cfdiId}.${type}` }
  },

  /** Onboarding status at the PAC (Carta Manifiesto pendiente, etc.). Read-only. */
  async getEmisorProviderStatus(venueId: string, emisorId: string): Promise<EmisorProviderStatus> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/provider-status`)
    return response.data?.status ?? response.data
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
  async triggerGlobalCfdi(venueId: string, emisorId: string, desde?: string): Promise<GlobalCfdiResult> {
    // C1 (Tarea 8): `desde` = el inicio EXACTO de uno de los periodos recientes (tal cual lo manda `getGlobalPeriodos`). Sin él, sin
    // cuerpo, como siempre: el último periodo cerrado. Fuera de los recientes ⇒ 400 «pídelo a soporte».
    const url = `/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/global`
    const response = desde ? await api.post(url, { desde }) : await api.post(url)
    // Both 201 and 200 carry the meaningful body directly (no { data } wrapper
    // for this endpoint), but stay tolerant if the backend ever wraps it.
    return (response.data?.data ?? response.data) as GlobalCfdiResult
  },

  /**
   * C1 (Tarea 8): los periodos cerrados RECIENTES del emisor con el estado de su global (sin paginación hacia atrás) y, aparte (T10), las
   * globales sin timbrar de una periodicidad anterior. Un servidor sin `otrasPeriodicidades` da la sección vacía. Ola final: `globalApagada`
   * pasa tal cual si viene.
   */
  async getGlobalPeriodos(venueId: string, emisorId: string): Promise<GlobalPeriodosResponse> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/global/periodos`)
    const data = response.data?.data ?? response.data
    return {
      periodos: (data?.periodos ?? []) as PeriodoDeLaGlobal[],
      otrasPeriodicidades: {
        globales: (data?.otrasPeriodicidades?.globales ?? []) as GlobalDeOtraPeriodicidad[],
        completo: data?.otrasPeriodicidades?.completo !== false,
      },
      // Ola final: sólo si el servidor lo manda como booleano; sin él (servidor anterior), la pantalla se comporta como siempre.
      ...(typeof data?.globalApagada === 'boolean' && { globalApagada: data.globalApagada }),
    }
  },

  /**
   * C1 (Tarea 12): las ventas de un periodo que no entraron a la global de este emisor, por páginas (cursor). Sólo viajan los
   * parámetros que se dan. 400 = periodo fuera de los recientes («pídelo a soporte»).
   */
  async getGlobalExcluidas(venueId: string, emisorId: string, query: GlobalExcluidasQuery = {}): Promise<GlobalExcluidasPage> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/global/excluidas`, {
      params: {
        ...(query.principalId && { principalId: query.principalId }),
        ...(query.desde && { desde: query.desde }),
        ...(query.cursor && { cursor: query.cursor }),
      },
    })
    return (response.data?.data ?? response.data) as GlobalExcluidasPage
  },

  /** C1 (Tarea 11): cuántas ventas entrarían a la complementaria de una principal (por su id), y si se puede emitir. */
  async getGlobalComplementariaPreview(venueId: string, emisorId: string, principalId: string): Promise<GlobalComplementariaPreview> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/global/${principalId}/complementaria`)
    return (response.data?.data ?? response.data) as GlobalComplementariaPreview
  },

  /**
   * C1 (Tarea 11): emite (o retoma) la global complementaria de una principal. Sólo una persona; el job nunca la emite. Mismas
   * respuestas que el disparo (201 timbrada · 200 nada que facturar · 409 se está emitiendo · 422 · 502) más 400 con el texto.
   */
  async emitGlobalComplementaria(venueId: string, emisorId: string, principalId: string): Promise<GlobalCfdiResult> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal/emisores/${emisorId}/global/${principalId}/complementaria`)
    return (response.data?.data ?? response.data) as GlobalCfdiResult
  },

  // ── CFDI list + actions ────────────────────────────────────────────────
  async getCfdis(venueId: string, filters: CfdiListFilters = {}): Promise<CfdiListResponse> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/cfdi`, {
      params: {
        // Varios valores van separados por coma: el servidor los acepta así, y no depende de cómo cada
        // cliente HTTP serialice un arreglo en la URL.
        ...(filters.status && filters.status.length > 0 && { status: [filters.status].flat().join(',') }),
        ...(filters.flow && filters.flow.length > 0 && { flow: [filters.flow].flat().join(',') }),
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

  /** Reenvía por correo una factura timbrada (PDF + XML). Sin correo, al del receptor que se registró al facturar. */
  async sendCfdiEmail(venueId: string, cfdiId: string, email?: string): Promise<SendCfdiEmailResponse> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/cfdi/${cfdiId}/email`, email ? { email } : {})
    return response.data
  },

  /**
   * Sustituye una factura cuyo importe salió mal: el servidor reconstruye el documento CORRECTO
   * desde la cuenta, lo timbra relacionado a la original (TipoRelacion 04) y pide cancelar la
   * original con motivo 01. No lleva body — el importe lo pone el servidor, nunca la pantalla.
   *
   * 422 = no se timbró nada (el documento corregido no cuadra o la cuenta no se puede reconstruir);
   * el cuerpo trae `reasons` para enseñárselas a quien factura.
   */
  async replaceCfdi(venueId: string, cfdiId: string): Promise<ReplaceCfdiResponse> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/cfdi/${cfdiId}/replace`)
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

  /**
   * Confirma que una venta VIEJA (contrato de precio desconocido) se cobró con el IVA YA incluido, para
   * que «Facturar» pueda emitirla con el IVA de cada producto. No emite ni cancela ninguna factura.
   *
   * `version` + `huella` son los de la vista previa que la persona vio: si la venta cambió desde entonces,
   * el servidor responde 409 `CAMBIO_DESDE_LA_VISTA` sin tocar nada. Otros errores: 409 `NO_CONFIRMABLE`,
   * 404 `NO_ENCONTRADA`, 403 sin `cfdi:configure`. El texto para mostrar viene en `error`.
   */
  async confirmPriceContract(venueId: string, orderId: string, version: number, huella: string): Promise<{ ok: true }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/orders/${orderId}/price-contract/confirm`, { version, huella })
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
  async emitRefundCreditNote(
    venueId: string,
    refundId: string,
    eleccion?: EleccionPorImporte,
    huella?: string,
  ): Promise<{ creditNote: RefundCreditNote }> {
    // C2 (Tarea 9): sin elección, el POST de siempre (sin body); con «por importe», la modalidad y la huella del reparto que se vio
    // (409 «El reparto cambió…» si cambió desde la vista previa). T10 ronda 1 (M9): la emisión normal manda `{ huella }` de su vista previa
    // (409 «La factura cambió…» si ya no es lo que se vio).
    const url = `/api/v1/dashboard/venues/${venueId}/refunds/${refundId}/credit-note`
    const response = eleccion
      ? await api.post(url, { modalidad: eleccion.modalidad, huella: eleccion.huella })
      : huella
        ? await api.post(url, { huella })
        : await api.post(url)
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
