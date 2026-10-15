import api from '@/api'

/**
 * La pantalla del cliente de un dispositivo POS_ANDROID, desde el dashboard. Contrato: avoqado-server
 * `src/routes/dashboard/customerDisplay.routes.ts` (rama `pantalla-cliente-f0a-v2`, spec §5.5). Todas las respuestas
 * vienen envueltas en `{ data }`; los errores en `{ message, code, details }` (y el mensaje se enseña TAL CUAL).
 */

export type CustomerDisplayTheme = 'LIGHT' | 'DARK'

/** El diseño guardado (`DesignValues` del server). */
export interface CustomerDisplayDesign {
  theme: CustomerDisplayTheme
  accentColor: string | null
  logoAssetId: string | null
  welcomeText: string | null
  thanksText: string | null
  slides: { assetId: string }[]
  slideSeconds: number
  showPromotions: boolean
}

/**
 * Lo que el editor de F1 manda a `/preview` y a `PUT`. 🔴 Sólo cinco campos: las imágenes, sus segundos y las promos son
 * de F3, y mandarlos podría pedir el plan PRO (`FEATURE_REQUIRES_PRO`). Un texto vacío se manda vacío: el server lo
 * limpia y lo guarda como null («Bienvenido» / «Gracias por tu compra» en la tablet).
 */
export interface CustomerDisplayDraft {
  theme: CustomerDisplayTheme
  accentColor: string | null
  logoAssetId: string | null
  welcomeText: string | null
  thanksText: string | null
}

/** La ficha efectiva que arma el server (spec §5.3). El dashboard la PINTA; no recalcula nada. */
export interface CustomerDisplayFicha {
  schemaVersion: number
  fingerprint: string
  theme: CustomerDisplayTheme
  accent: { custom: false } | { custom: true; color: string; on: string }
  logo: { source: 'asset'; url: string; sha256: string } | { source: 'venue'; url: string; version: string } | null
  welcomeText: string | null
  thanksText: string | null
  slides: { url: string; sha256: string }[]
  slideSeconds: number
  promotionCards: { enabled: boolean }
  poweredBy: true
}

export interface CustomerDisplayEntitlements {
  slides: boolean
  promotionCards: boolean
}

/** Presencia efectiva, con la regla de 7 días del server: SUPPORTED = presente, UNSUPPORTED = ausente. */
export type DisplayPresence = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'

export interface CustomerDisplayDeviceState {
  presence: DisplayPresence
  stale: boolean
  capabilitiesObservedAt: string | null
  lastHeartbeat: string | null
  designVersion: number | null
  /** El acuse de la tablet, tal como lo guardó el server (`unknown`). Se lee con `leerAcuse` (estado.ts). */
  ack: unknown
  installationWarning: boolean
}

export interface CustomerDisplayView {
  terminal: { id: string; name: string }
  editToken: string
  design: CustomerDisplayDesign
  ficha: CustomerDisplayFicha
  entitlements: CustomerDisplayEntitlements
  assetRejected: string[]
  device: CustomerDisplayDeviceState
}

export interface CustomerDisplayPreview {
  ficha: CustomerDisplayFicha
  assetRejected: string[]
  previewSeq: number
}

export interface CustomerDisplaySaved {
  editToken: string
  design: CustomerDisplayDesign
  ficha: CustomerDisplayFicha
  assetRejected: string[]
}

export interface CustomerDisplayReset {
  editToken: string
  design: CustomerDisplayDesign
  ficha: CustomerDisplayFicha
}

export interface CustomerDisplayAsset {
  assetId: string
  url: string
  sha256: string
  width: number
  height: number
}

export interface CopyEndpoint {
  terminalId: string
  editToken: string
}

export interface CustomerDisplayCopyResult {
  copied: string[]
  promosOmitted: boolean
}

export interface CustomerDisplayDeviceItem {
  id: string
  name: string
  editToken: string
  designVersion: number | null
  presence: DisplayPresence
  stale: boolean
  capabilitiesObservedAt: string | null
  lastHeartbeat: string | null
}

export interface CustomerDisplayDeviceList {
  total: number
  nextCursor: string | null
  devices: CustomerDisplayDeviceItem[]
}

const raiz = (venueId: string, terminalId: string) => `/api/v1/dashboard/venues/${venueId}/terminals/${terminalId}/customer-display`

export async function getCustomerDisplay(venueId: string, terminalId: string): Promise<CustomerDisplayView> {
  const response = await api.get(raiz(venueId, terminalId))
  return response.data.data
}

export async function previewCustomerDisplay(
  venueId: string,
  terminalId: string,
  design: CustomerDisplayDraft,
  previewSeq: number,
): Promise<CustomerDisplayPreview> {
  const response = await api.post(`${raiz(venueId, terminalId)}/preview`, { design, previewSeq })
  return response.data.data
}

export async function saveCustomerDisplay(
  venueId: string,
  terminalId: string,
  expectedEditToken: string,
  design: CustomerDisplayDraft,
): Promise<CustomerDisplaySaved> {
  const response = await api.put(raiz(venueId, terminalId), { expectedEditToken, design })
  return response.data.data
}

export async function resetCustomerDisplay(venueId: string, terminalId: string, expectedEditToken: string): Promise<CustomerDisplayReset> {
  const response = await api.post(`${raiz(venueId, terminalId)}/reset`, { expectedEditToken })
  return response.data.data
}

/** 🔴 `kind` va en la QUERY y el multipart lleva SÓLO `file`: la ruta tiene `fields: 0`, y un campo de texto es un 422. */
export async function uploadCustomerDisplayLogo(venueId: string, terminalId: string, file: File): Promise<CustomerDisplayAsset> {
  const form = new FormData()
  form.append('file', file)
  const response = await api.post(`${raiz(venueId, terminalId)}/assets?kind=logo`, form)
  return response.data.data
}

export async function copyCustomerDisplay(
  venueId: string,
  source: CopyEndpoint,
  targets: CopyEndpoint[],
): Promise<CustomerDisplayCopyResult> {
  const response = await api.post(`${raiz(venueId, source.terminalId)}/copy`, { source, targets })
  return response.data.data
}

export async function listCustomerDisplayDevices(
  venueId: string,
  opciones: { cursor?: string; take: number },
): Promise<CustomerDisplayDeviceList> {
  const params: Record<string, string | number> = { take: opciones.take }
  if (opciones.cursor) params.cursor = opciones.cursor
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/customer-display/devices`, { params })
  return response.data.data
}
