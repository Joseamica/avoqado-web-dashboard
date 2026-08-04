import api from '@/api'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/area-tickets`

export type FulfillmentMode = 'IMMEDIATE' | 'HOLD_UNTIL_PAID' | 'PREPARE_ON_PAID'
export type DeliveryVerificationMode = 'PAPER_CONFIRMATION' | 'RECEIPT_SCAN' | 'PAPER_OR_SCAN'
export type TicketExpiryPolicy = 'BUSINESS_DAY_CLOSE' | 'FIXED_DURATION'
export type InventoryReservationMode = 'NONE' | 'HOLD_AVAILABLE_STOCK'
export type TerminalWorkspace = 'STANDARD_POS' | 'AREA_OPERATIONS'
export type ScaleTransport = 'ANDROID_USB_SERIAL' | 'DESKTOP_BRIDGE' | 'MANUAL'
export type ScaleContext = 'AREA_TICKET_LINE' | 'INVENTORY_RECEIPT' | 'INVENTORY_TRANSFER_DISPATCH' | 'STOCK_COUNT' | 'STOCK_ADJUSTMENT'

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
  entitlements: { areaTickets: boolean; scaleIntegration: boolean }
  effective: { areaTickets: boolean; scales: boolean }
  settings: AreaTicketSettings
  scaleSettings: { enabled: boolean }
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

export async function updateScaleSettings(venueId: string, enabled: boolean): Promise<{ enabled: boolean }> {
  const response = await api.put(`${base(venueId)}/scale-settings`, { enabled })
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
