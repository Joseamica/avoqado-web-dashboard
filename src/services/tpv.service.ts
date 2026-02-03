import api from '@/api'
import { SendCommandRequest, TpvCommand, TpvCommandPayload, TpvCommandPriority, TpvCommandType } from '@/types/tpv-commands'

// ============================================
// TPV List & Details
// ============================================

export const getTpvs = async (venueId: string, pagination: { pageIndex: number; pageSize: number }) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/tpvs`, {
    params: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    },
  })
  return response.data
}

export const getTpvById = async (venueId: string, tpvId: string) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}`)
  return response.data
}

export const updateTpv = async (venueId: string, tpvId: string, data: { name?: string; status?: string }) => {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}`, data)
  return response.data
}

/**
 * Delete a terminal (only non-activated terminals can be deleted)
 * Activated terminals should be RETIRED instead
 */
export const deleteTpv = async (venueId: string, tpvId: string) => {
  const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}`)
  return response.data
}

// ============================================
// TPV Activation
// ============================================

/**
 * Generate activation code for a terminal
 * @param venueId Venue ID
 * @param terminalId Terminal ID
 * @returns Activation code data with expiration
 */
export const generateActivationCode = async (venueId: string, terminalId: string) => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/tpv/${terminalId}/activation-code`)
  return response.data
}

// ============================================
// Remote Commands
// ============================================

/**
 * Send a command to a TPV terminal
 * @param terminalId Terminal ID (CUID)
 * @param command Command type
 * @param payload Optional command payload
 * @param priority Optional priority (defaults to NORMAL)
 * @returns Command response with status
 */
export const sendTpvCommand = async (
  terminalId: string,
  command: TpvCommandType | string,
  payload?: TpvCommandPayload,
  priority?: TpvCommandPriority,
) => {
  const response = await api.post(`/api/v1/dashboard/tpv/${terminalId}/command`, {
    command,
    payload,
    priority,
  })
  return response.data
}

/**
 * Send a command with full request options
 * @param terminalId Terminal ID
 * @param request Full command request
 * @returns Command response
 */
export const sendTpvCommandFull = async (terminalId: string, request: SendCommandRequest) => {
  const response = await api.post(`/api/v1/dashboard/tpv/${terminalId}/command`, request)
  return response.data
}

/**
 * Get command history for a terminal
 * @param venueId Venue ID
 * @param terminalId Terminal ID
 * @param options Query options
 * @returns Paginated command history
 */
export const getCommandHistory = async (
  venueId: string,
  terminalId: string,
  options?: {
    page?: number
    pageSize?: number
    status?: string
    commandType?: TpvCommandType
  },
): Promise<{ commands: TpvCommand[]; total: number; page: number; pageSize: number }> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv-commands`, {
    params: {
      terminalId,
      page: options?.page || 1,
      pageSize: options?.pageSize || 10,
      status: options?.status,
      commandType: options?.commandType,
    },
  })
  // Map server response to expected format
  return {
    commands: response.data.data || [],
    total: response.data.meta?.total || 0,
    page: response.data.meta?.page || 1,
    pageSize: response.data.meta?.pageSize || 10,
  }
}

// ============================================
// Convenience Functions for Common Commands
// ============================================

/**
 * Lock a terminal with optional message
 */
export const lockTerminal = async (terminalId: string, reason?: string, message?: string) => {
  return sendTpvCommand(terminalId, TpvCommandType.LOCK, { reason, message }, TpvCommandPriority.HIGH)
}

/**
 * Unlock a terminal
 */
export const unlockTerminal = async (terminalId: string) => {
  return sendTpvCommand(terminalId, TpvCommandType.UNLOCK, undefined, TpvCommandPriority.HIGH)
}

/**
 * Enter maintenance mode
 */
export const enterMaintenanceMode = async (terminalId: string, reason?: string, duration?: number) => {
  return sendTpvCommand(terminalId, TpvCommandType.MAINTENANCE_MODE, { reason, duration })
}

/**
 * Exit maintenance mode
 */
export const exitMaintenanceMode = async (terminalId: string) => {
  return sendTpvCommand(terminalId, TpvCommandType.EXIT_MAINTENANCE)
}

/**
 * Restart terminal app
 */
export const restartTerminal = async (terminalId: string) => {
  return sendTpvCommand(terminalId, TpvCommandType.RESTART, undefined, TpvCommandPriority.HIGH)
}

/**
 * Refresh menu on terminal
 */
export const refreshMenu = async (terminalId: string) => {
  return sendTpvCommand(terminalId, TpvCommandType.REFRESH_MENU)
}

/**
 * Sync data on terminal
 */
export const syncData = async (terminalId: string) => {
  return sendTpvCommand(terminalId, TpvCommandType.SYNC_DATA)
}

/**
 * Clear cache on terminal
 */
export const clearCache = async (terminalId: string, targets?: ('menu' | 'orders' | 'config' | 'all')[]) => {
  return sendTpvCommand(terminalId, TpvCommandType.CLEAR_CACHE, { targets })
}

/**
 * Export logs from terminal
 */
export const exportLogs = async (terminalId: string) => {
  return sendTpvCommand(terminalId, TpvCommandType.EXPORT_LOGS, undefined, TpvCommandPriority.LOW)
}
