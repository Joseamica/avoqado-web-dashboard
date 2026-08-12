import api from '@/api'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/area-tickets`

export type FulfillmentMode = 'IMMEDIATE' | 'HOLD_UNTIL_PAID' | 'PREPARE_ON_PAID'
export type DeliveryVerificationMode = 'PAPER_CONFIRMATION' | 'RECEIPT_SCAN' | 'PAPER_OR_SCAN'
export type TicketExpiryPolicy = 'BUSINESS_DAY_CLOSE' | 'FIXED_DURATION'
export type InventoryReservationMode = 'NONE' | 'HOLD_AVAILABLE_STOCK'
export type TerminalWorkspace = 'STANDARD_POS' | 'AREA_OPERATIONS'
export type ScaleTransport = 'ANDROID_USB_SERIAL' | 'DESKTOP_BRIDGE' | 'MANUAL'
export type ScaleContext = 'AREA_TICKET_LINE' | 'INVENTORY_RECEIPT' | 'INVENTORY_TRANSFER_DISPATCH' | 'STOCK_COUNT' | 'STOCK_ADJUSTMENT'
// Ruta de cobro externa (§caja externa fase 1) — otro POS cobra los vales de esta área
// en su propia caja. Default AVOQADO: Avoqado cobra y registra, como hoy.
export type AreaSettlementRoute = 'AVOQADO' | 'EXTERNAL'
export type ExternalConfirmationMode = 'MANUAL' | 'ASSUME_ON_PRINT'
export type ExternalOfflinePolicy = 'ALLOW' | 'BLOCK'
export type ExternalDeliveryTracking = 'TRACKED' | 'UNTRACKED'

export interface AreaTicketSettings {
  enabled: boolean
  allowMixedCart: boolean
  claimTtlSeconds: number
  checkoutSessionMaxAgeMinutes: number
  ticketExpiryPolicy: TicketExpiryPolicy
  ticketExpiryMinutes: number | null
  deliveryVerificationMode: DeliveryVerificationMode
  codeSymbology: 'CODE128'
  requireManagerForCancel: boolean
  recordWasteOnCancel: boolean
  inventoryReservationMode: InventoryReservationMode
}

export type UpdateAreaTicketSettingsInput = Omit<AreaTicketSettings, 'codeSymbology'>

export function toUpdateAreaTicketSettingsInput(settings: AreaTicketSettings): UpdateAreaTicketSettingsInput {
  return {
    enabled: settings.enabled,
    allowMixedCart: settings.allowMixedCart,
    claimTtlSeconds: settings.claimTtlSeconds,
    checkoutSessionMaxAgeMinutes: settings.checkoutSessionMaxAgeMinutes,
    ticketExpiryPolicy: settings.ticketExpiryPolicy,
    ticketExpiryMinutes: settings.ticketExpiryMinutes,
    deliveryVerificationMode: settings.deliveryVerificationMode,
    requireManagerForCancel: settings.requireManagerForCancel,
    recordWasteOnCancel: settings.recordWasteOnCancel,
    inventoryReservationMode: settings.inventoryReservationMode,
  }
}

export interface FulfillmentArea {
  id: string
  name: string
  fulfillmentMode: FulfillmentMode
  printStationId: string | null
  active: boolean
  displayOrder: number
  settlementRoute: AreaSettlementRoute
  externalConfirmationMode: ExternalConfirmationMode
  externalOfflinePolicy: ExternalOfflinePolicy
  externalDeliveryTracking: ExternalDeliveryTracking
  printStation?: { id: string; name: string; active: boolean } | null
  _count?: { terminals: number; areaTickets: number }
}

export interface AreaTicketTerminal {
  id: string
  name: string
  type: string
  status: string
  brand: string | null
  model: string | null
  deviceUid: string | null
  fulfillmentAreaId: string | null
  canIssueAreaTickets: boolean
  canCheckoutAreaTickets: boolean
  canDeliverAreaTickets: boolean
  defaultWorkspace: TerminalWorkspace
  scaleProfileId: string | null
}

export interface ScaleProfile {
  id: string
  name: string
  location: string
  model: string
  allowedContexts: ScaleContext[]
  transport: ScaleTransport
  vendorId: number | null
  productId: number | null
  baudRate: number | null
  dataBits: number | null
  parity: string | null
  stopBits: number | null
  frameParser: Record<string, unknown> | null
  stableIndicator: string | null
  unit: 'GRAM' | 'KILOGRAM' | 'POUND' | 'OUNCE'
  active: boolean
}

export interface AreaTicketOverview {
  entitlements: { areaTickets: boolean; scaleIntegration: boolean; variableWeightBarcode: boolean }
  effective: { areaTickets: boolean; scales: boolean; variableWeightBarcode: boolean }
  settings: AreaTicketSettings
  scaleSettings: ScaleSettings
  areas: FulfillmentArea[]
  terminals: AreaTicketTerminal[]
  scaleProfiles: ScaleProfile[]
  operations: {
    tickets: Record<string, number>
    checkouts: Record<string, number>
    paymentReconciliationCount: number
  }
}

export interface AreaTicketOperations {
  pendingDelivery: Array<{
    id: string
    code: string
    paidAt: string | null
    total: string
    fulfillmentArea: { id: string; name: string }
    order: { id: string; orderNumber: string; areaDeliveryCode: string | null } | null
  }>
  reconciliation: Array<{
    id: string
    updatedAt: string
    order: { id: string; orderNumber: string; paymentStatus: string; total: string } | null
  }>
  recentlyIssued: Array<{
    id: string
    code: string
    status: string
    total: string
    issuedAt: string
    fulfillmentArea: { id: string; name: string }
    sourceTerminal: { id: string; name: string }
  }>
}

export async function getAreaTicketOverview(venueId: string): Promise<AreaTicketOverview> {
  const response = await api.get(base(venueId))
  return response.data.data
}

export async function updateAreaTicketSettings(
  venueId: string,
  input: UpdateAreaTicketSettingsInput,
): Promise<AreaTicketSettings> {
  const response = await api.put(`${base(venueId)}/settings`, input)
  return response.data.data
}

export async function createFulfillmentArea(
  venueId: string,
  input: Pick<FulfillmentArea, 'name' | 'fulfillmentMode'> & Partial<Pick<FulfillmentArea, 'printStationId' | 'displayOrder'>>,
): Promise<FulfillmentArea> {
  const response = await api.post(`${base(venueId)}/areas`, input)
  return response.data.data
}

export async function updateFulfillmentArea(
  venueId: string,
  areaId: string,
  input: Partial<Pick<FulfillmentArea, 'name' | 'fulfillmentMode' | 'printStationId' | 'active' | 'displayOrder'>>,
): Promise<FulfillmentArea> {
  const response = await api.put(`${base(venueId)}/areas/${areaId}`, input)
  return response.data.data
}

export interface UpdateAreaSettlementRouteInput {
  settlementRoute: AreaSettlementRoute
  externalConfirmationMode: ExternalConfirmationMode
  externalOfflinePolicy: ExternalOfflinePolicy
  externalDeliveryTracking: ExternalDeliveryTracking
}

/**
 * Ruta de cobro externa de UN área (§caja externa fase 1) — el switch canónico: las
 * apps lo LEEN, no lo escriben. Las cuatro políticas viajan siempre juntas porque son
 * una sola decisión de negocio (dónde entra el dinero de esta área), no cuatro campos
 * sueltos — nunca mandes un PATCH parcial aquí.
 *
 * Vive fuera de `base()` a propósito: no es un endpoint de `/area-tickets`, es un
 * ajuste de la entidad FulfillmentArea.
 */
export async function updateAreaSettlementRoute(
  venueId: string,
  areaId: string,
  input: UpdateAreaSettlementRouteInput,
): Promise<FulfillmentArea> {
  const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/fulfillment-areas/${areaId}/settlement-route`, input)
  return response.data.data
}

export async function updateAreaTicketTerminal(
  venueId: string,
  terminalId: string,
  input: Partial<
    Pick<
      AreaTicketTerminal,
      | 'fulfillmentAreaId'
      | 'canIssueAreaTickets'
      | 'canCheckoutAreaTickets'
      | 'canDeliverAreaTickets'
      | 'defaultWorkspace'
      | 'scaleProfileId'
    >
  >,
): Promise<AreaTicketTerminal> {
  const response = await api.put(`${base(venueId)}/terminals/${terminalId}`, input)
  return response.data.data
}

export interface ScaleSettings {
  enabled: boolean
  variableBarcodeEnabled: boolean
  variableBarcodePrefix: string
}

export type UpdateScaleSettingsInput = Partial<ScaleSettings>

export function toUpdateScaleSettingsInput(settings: ScaleSettings): ScaleSettings {
  return {
    enabled: settings.enabled,
    variableBarcodeEnabled: settings.variableBarcodeEnabled,
    variableBarcodePrefix: settings.variableBarcodePrefix,
  }
}

export async function updateScaleSettings(venueId: string, input: UpdateScaleSettingsInput): Promise<ScaleSettings> {
  const response = await api.put(`${base(venueId)}/scale-settings`, input)
  return response.data.data
}

export type ScaleProfileInput = Pick<ScaleProfile, 'name' | 'location' | 'model' | 'allowedContexts'> &
  Partial<Omit<ScaleProfile, 'id' | 'name' | 'location' | 'model' | 'allowedContexts'>>

export async function createScaleProfile(venueId: string, input: ScaleProfileInput): Promise<ScaleProfile> {
  const response = await api.post(`${base(venueId)}/scale-profiles`, input)
  return response.data.data
}

export async function updateScaleProfile(venueId: string, profileId: string, input: Partial<ScaleProfileInput>): Promise<ScaleProfile> {
  const response = await api.put(`${base(venueId)}/scale-profiles/${profileId}`, input)
  return response.data.data
}

export async function getAreaTicketOperations(venueId: string): Promise<AreaTicketOperations> {
  const response = await api.get(`${base(venueId)}/operations`)
  return response.data.data
}

// ----------------------------------------------------------------------------
// Colas de sólo lectura de la ruta externa (§caja externa fase 1, Task 15) — qué
// cobros nadie confirmó y qué incidencias quedaron abiertas. Ningún tipo ni función
// de aquí abajo confirma, resuelve ni reabre nada: eso no existe todavía en esta
// fase. Los importes son SIEMPRE de referencia — lo que Avoqado calculó para el
// vale — nunca una venta: ese dinero entró en la caja de otro punto de venta.
// ----------------------------------------------------------------------------

export type ExternalSettlementStatus = 'PENDING' | 'ASSUMED' | 'CONFIRMED' | 'DISCREPANCY' | 'NOT_CHARGED'
export type ExternalHandoffState = 'PENDING' | 'HANDED_OFF' | 'RETURNED'
export type ExternalIncidentKind = 'UNCONFIRMED_CHARGE' | 'AMOUNT_VARIANCE' | 'NEGATIVE_STOCK' | 'CODE_MISMATCH' | 'REPRINT_RISK'
export type ExternalIncidentStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'

export interface ExternalSettlementItem {
  id: string
  status: ExternalSettlementStatus
  handoffState: ExternalHandoffState
  confirmationMode: ExternalConfirmationMode
  /** Importe que Avoqado calculó para el vale — de REFERENCIA, nunca una venta. */
  referenceAmount: string
  /** Lo que alguien reportó que la otra caja cobró. `null` mientras nadie lo capture. */
  externalAmount: string | null
  /** externalAmount − referenceAmount, YA con signo. Se deriva en el server; nunca viene de una columna. */
  variance: string | null
  externalReference: string | null
  notes: string | null
  createdAt: string
  confirmedAt: string | null
  confirmedBy: string | null
  terminal: { id: string; name: string } | null
  areaTicket: { id: string; code: string; issuedAt: string }
  area: { id: string; name: string } | null
}

export interface ExternalIncidentItem {
  id: string
  kind: ExternalIncidentKind
  status: ExternalIncidentStatus
  /** Forma libre según `kind` — ya viene en pesos y formateada por quien la abrió. */
  detail: Record<string, unknown>
  openedAt: string
  occurrenceCount: number
  reopenedAt: string | null
  resolvedAt: string | null
  resolution: string | null
  resolvedBy: string | null
  areaTicket: { id: string; code: string } | null
  area: { id: string; name: string } | null
}

export interface ExternalSettlementsPage {
  items: ExternalSettlementItem[]
  nextCursor: string | null
}

export interface ExternalIncidentsPage {
  items: ExternalIncidentItem[]
  nextCursor: string | null
}

export interface ListExternalSettlementsFilters {
  areaId?: string | null
  status?: ExternalSettlementStatus | null
  dateFrom?: string | null
  dateTo?: string | null
  cursor?: string
  pageSize?: number
}

export interface ListExternalIncidentsFilters {
  areaId?: string | null
  kind?: ExternalIncidentKind | null
  status?: ExternalIncidentStatus | null
  dateFrom?: string | null
  dateTo?: string | null
  cursor?: string
  pageSize?: number
}

/** Cola "Cobros por confirmar". Sin `status`, el server devuelve TODOS los estados. */
export async function getExternalSettlements(
  venueId: string,
  filters: ListExternalSettlementsFilters = {},
): Promise<ExternalSettlementsPage> {
  const response = await api.get(`${base(venueId)}/external-settlements`, {
    params: {
      areaId: filters.areaId || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      cursor: filters.cursor,
      pageSize: filters.pageSize,
    },
  })
  return response.data.data
}

/** Cola "Incidencias". Sin `status`, el server devuelve abiertas y cerradas. */
export async function getExternalIncidents(venueId: string, filters: ListExternalIncidentsFilters = {}): Promise<ExternalIncidentsPage> {
  const response = await api.get(`${base(venueId)}/external-incidents`, {
    params: {
      areaId: filters.areaId || undefined,
      kind: filters.kind || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      cursor: filters.cursor,
      pageSize: filters.pageSize,
    },
  })
  return response.data.data
}
