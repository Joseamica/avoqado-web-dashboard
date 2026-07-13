import api from '@/api'

// Impresoras y estaciones (print stations) — configuración FREE de ruteo de comandas
// cocina/barra. Cada endpoint responde { success, data } y aquí devolvemos res.data.data.
// Base: /api/v1/dashboard/venues/${venueId}/print-stations

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/print-stations`

// ── Tipos (espejo del backend) ────────────────────────────────────────────────

export type PrinterConnectionType = 'NETWORK' | 'BLUETOOTH' | 'USB_SPOOLER' | 'TERMINAL_INTERNAL'

export interface Printer {
  id: string
  venueId: string
  name: string
  connectionType: PrinterConnectionType
  stableKey: string | null
  address: string | null
  paperWidthMm: number // 58 | 80
  charset: string
  active: boolean
  lastStatus: string | null
  lastSeenAt: string | null
}

export interface PrintStation {
  id: string
  venueId: string
  name: string
  printerId: string | null
  copies: number
  isDefault: boolean
  active: boolean
  displayOrder: number
  printer?: { id: string; name: string; active: boolean; lastStatus: string | null } | null
}

export interface Gateway {
  id: string
  venueId: string
  terminalId: string
  address: string | null
  active: boolean
  lastHeartbeat: string | null
}

export interface RoutingCategory {
  id: string
  name: string
  printStationId: string | null
}

export interface RoutingProduct {
  id: string
  name: string
  categoryId: string | null
  printStationId: string | null
}

export interface RoutingData {
  categories: RoutingCategory[]
  products: RoutingProduct[]
  unroutedCategories: number
  hasDefault: boolean
}

export interface PreviewPlan {
  stationId: string | null
  stationName: string | null
  unrouted: boolean
  lines: { productName: string; quantity: number }[]
}

export interface PreviewResult {
  plans: PreviewPlan[]
  unrouted: boolean
}

// ── Payloads ─────────────────────────────────────────────────────────────────

export interface CreatePrinterInput {
  name: string
  connectionType?: PrinterConnectionType
  address?: string
  stableKey?: string
  paperWidthMm?: number
  charset?: string
}
export type UpdatePrinterInput = Partial<CreatePrinterInput> & { active?: boolean }

export interface CreateStationInput {
  name: string
  printerId?: string | null
  copies?: number
  isDefault?: boolean
  displayOrder?: number
}
export type UpdateStationInput = Partial<CreateStationInput> & { active?: boolean }

export interface UpdateGatewayInput {
  terminalId: string
  address?: string
  active?: boolean
}

export interface UpdateRoutingInput {
  categories?: { id: string; printStationId: string | null }[]
  products?: { id: string; printStationId: string | null }[]
}

// ── Estaciones ─────────────────────────────────────────────────────────────

export async function getPrintStations(venueId: string): Promise<PrintStation[]> {
  const res = await api.get(`${base(venueId)}/`)
  return res.data.data
}

export async function createPrintStation(venueId: string, body: CreateStationInput): Promise<PrintStation> {
  const res = await api.post(`${base(venueId)}/`, body)
  return res.data.data
}

export async function updatePrintStation(venueId: string, stationId: string, body: UpdateStationInput): Promise<PrintStation> {
  const res = await api.put(`${base(venueId)}/${stationId}`, body)
  return res.data.data
}

export async function deletePrintStation(venueId: string, stationId: string): Promise<{ id: string; deleted: boolean }> {
  const res = await api.delete(`${base(venueId)}/${stationId}`)
  return res.data.data
}

// ── Impresoras ───────────────────────────────────────────────────────────────

export async function getPrinters(venueId: string): Promise<Printer[]> {
  const res = await api.get(`${base(venueId)}/printers`)
  return res.data.data
}

export async function createPrinter(venueId: string, body: CreatePrinterInput): Promise<Printer> {
  const res = await api.post(`${base(venueId)}/printers`, body)
  return res.data.data
}

export async function updatePrinter(venueId: string, printerId: string, body: UpdatePrinterInput): Promise<Printer> {
  const res = await api.put(`${base(venueId)}/printers/${printerId}`, body)
  return res.data.data
}

export async function deletePrinter(venueId: string, printerId: string): Promise<{ id: string; deleted: boolean }> {
  const res = await api.delete(`${base(venueId)}/printers/${printerId}`)
  return res.data.data
}

// ── Gateway ─────────────────────────────────────────────────────────────────

export async function getGateway(venueId: string): Promise<Gateway | null> {
  const res = await api.get(`${base(venueId)}/gateway`)
  return res.data.data
}

export async function updateGateway(venueId: string, body: UpdateGatewayInput): Promise<Gateway> {
  const res = await api.put(`${base(venueId)}/gateway`, body)
  return res.data.data
}

// ── Ruteo ─────────────────────────────────────────────────────────────────

export async function getRouting(venueId: string): Promise<RoutingData> {
  const res = await api.get(`${base(venueId)}/routing`)
  return res.data.data
}

export async function updateRouting(venueId: string, body: UpdateRoutingInput): Promise<{ categoriesUpdated: number; productsUpdated: number }> {
  const res = await api.put(`${base(venueId)}/routing`, body)
  return res.data.data
}

export async function previewRouting(
  venueId: string,
  body: { items: { productId: string; quantity: number }[] },
): Promise<PreviewResult> {
  const res = await api.post(`${base(venueId)}/routing/preview`, body)
  return res.data.data
}
