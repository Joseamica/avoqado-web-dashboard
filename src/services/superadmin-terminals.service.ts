import api from '@/api'

/**
 * Terminal Types & Interfaces
 */
export enum TerminalType {
  TPV_ANDROID = 'TPV_ANDROID',
  TPV_IOS = 'TPV_IOS',
  PRINTER_RECEIPT = 'PRINTER_RECEIPT',
  PRINTER_KITCHEN = 'PRINTER_KITCHEN',
  KDS = 'KDS',
}

export enum TerminalStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
}

export interface Terminal {
  id: string
  venueId: string
  venue: {
    id: string
    name: string
    slug: string
  }
  serialNumber: string
  name: string
  type: TerminalType
  brand?: string
  model?: string
  status: TerminalStatus
  lastHeartbeat?: string
  version?: string
  systemInfo?: any
  ipAddress?: string
  config?: any
  assignedMerchantIds: string[]
  preferredProcessor?: string
  mentaTerminalId?: string
  mentaLastSync?: string
  activationCode?: string
  activationCodeExpiry?: string
  activatedAt?: string
  activatedBy?: string
  activationAttempts?: number
  lastActivationAttempt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateTerminalRequest {
  venueId: string
  serialNumber: string
  name: string
  type: TerminalType
  brand?: string
  model?: string
  assignedMerchantIds?: string[]
  generateActivationCode?: boolean
}

export interface UpdateTerminalRequest {
  name?: string
  status?: TerminalStatus
  assignedMerchantIds?: string[]
  brand?: string
  model?: string
}

export interface ActivationCodeResponse {
  activationCode: string
  expiresAt: string
  expiresIn: number
  terminalId: string
  serialNumber: string
  venueName: string
}

/**
 * Get all terminals (cross-venue)
 *
 * @param filters Optional filters: venueId, status, type
 * @returns List of terminals
 */
export async function getAllTerminals(filters?: { venueId?: string; status?: string; type?: string }): Promise<Terminal[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/terminals', {
    params: filters,
  })
  return response.data.data
}

/**
 * Get terminal by ID
 *
 * @param terminalId Terminal ID
 * @returns Terminal data
 */
export async function getTerminalById(terminalId: string): Promise<Terminal> {
  const response = await api.get(`/api/v1/dashboard/superadmin/terminals/${terminalId}`)
  return response.data.data
}

/**
 * Create new terminal
 *
 * @param data Terminal creation data
 * @returns Created terminal, optional activation code, and auto-attached merchants
 */
export async function createTerminal(data: CreateTerminalRequest): Promise<{
  terminal: Terminal
  activationCode?: ActivationCodeResponse
  autoAttachedMerchants?: Array<{ id: string; displayName: string | null }>
}> {
  const response = await api.post('/api/v1/dashboard/superadmin/terminals', data)
  return {
    terminal: response.data.data,
    activationCode: response.data.activationCode,
    autoAttachedMerchants: response.data.autoAttachedMerchants,
  }
}

/**
 * Update terminal
 *
 * @param terminalId Terminal ID
 * @param data Update data
 * @returns Updated terminal
 */
export async function updateTerminal(terminalId: string, data: UpdateTerminalRequest): Promise<Terminal> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/terminals/${terminalId}`, data)
  return response.data.data
}

/**
 * Generate activation code for terminal
 *
 * @param terminalId Terminal ID
 * @returns Activation code data
 */
export async function generateActivationCode(terminalId: string): Promise<ActivationCodeResponse> {
  const response = await api.post(`/api/v1/dashboard/superadmin/terminals/${terminalId}/generate-activation-code`)
  return response.data.data
}

/**
 * Delete terminal
 *
 * @param terminalId Terminal ID
 */
export async function deleteTerminal(terminalId: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/terminals/${terminalId}`)
}

/**
 * Send remote activation command to a pre-registered terminal
 *
 * The terminal must:
 * - Not be already activated (no activatedAt)
 * - Have a serialNumber
 * - Have sent at least one heartbeat (proof of physical device)
 *
 * @param terminalId Terminal ID
 * @returns Command queue result with terminal info
 */
export async function sendRemoteActivation(terminalId: string): Promise<{
  commandId: string
  correlationId: string
  status: string
  terminal: {
    id: string
    name: string
    serialNumber: string
    venue: { id: string; name: string; slug: string }
  }
}> {
  const response = await api.post(`/api/v1/dashboard/superadmin/terminals/${terminalId}/remote-activate`)
  return response.data.data
}

/**
 * Check if terminal is online based on last heartbeat
 *
 * @param lastHeartbeat Last heartbeat timestamp
 * @param thresholdMinutes Threshold in minutes (default: 5)
 * @returns Boolean indicating if terminal is online
 */
export function isTerminalOnline(lastHeartbeat?: string, thresholdMinutes = 5): boolean {
  if (!lastHeartbeat) return false

  const lastHeartbeatDate = new Date(lastHeartbeat)
  const now = new Date()
  const diffMs = now.getTime() - lastHeartbeatDate.getTime()
  const diffMinutes = diffMs / (1000 * 60)

  return diffMinutes < thresholdMinutes
}

/**
 * App Update Types (for INSTALL_VERSION command)
 */
export interface AppUpdate {
  id: string
  versionName: string
  versionCode: number
  environment: 'SANDBOX' | 'PRODUCTION'
  downloadUrl: string
  fileSize: string
  checksum: string
  releaseNotes?: string
  isRequired: boolean
  isActive: boolean
  minAndroidSdk: number
  createdAt: string
}

/**
 * Get all app updates (for INSTALL_VERSION version selector)
 *
 * @param environment Optional filter by environment
 * @returns List of app updates
 */
export async function getAppUpdates(environment?: 'SANDBOX' | 'PRODUCTION'): Promise<AppUpdate[]> {
  const response = await api.get('/api/v1/superadmin/app-updates', {
    params: environment ? { environment } : undefined,
  })
  return response.data.data
}

/**
 * Convenience export
 */
export const terminalAPI = {
  getAllTerminals,
  getTerminalById,
  createTerminal,
  updateTerminal,
  generateActivationCode,
  deleteTerminal,
  sendRemoteActivation,
  isTerminalOnline,
  getAppUpdates,
}
