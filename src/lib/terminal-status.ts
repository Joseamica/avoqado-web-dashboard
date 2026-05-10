import type { StatusPulseProps } from '@/components/ui/status-pulse'

export type PulseStatus = StatusPulseProps['status']

export type TerminalStatusKey =
  | 'locked'
  | 'pending'
  | 'online'
  | 'offline'
  | 'inactive'
  | 'maintenance'
  | 'retired'
  | 'unknown'

export interface TerminalStatusInput {
  status?: string | null
  lastHeartbeat?: string | null
  isLocked?: boolean | null
}

export interface TerminalStatusInfo {
  statusKey: TerminalStatusKey
  pulseStatus: PulseStatus
  isOnline: boolean
}

export const TERMINAL_ONLINE_THRESHOLD_MS = 5 * 60 * 1000

export function isTerminalOnline(lastHeartbeat?: string | null, thresholdMs: number = TERMINAL_ONLINE_THRESHOLD_MS): boolean {
  if (!lastHeartbeat) return false
  const diff = Date.now() - new Date(lastHeartbeat).getTime()
  return diff >= 0 && diff < thresholdMs
}

export function getTerminalStatusInfo(input: TerminalStatusInput): TerminalStatusInfo {
  const online = isTerminalOnline(input.lastHeartbeat)

  if (input.isLocked) {
    return { statusKey: 'locked', pulseStatus: 'error', isOnline: online }
  }

  switch (input.status) {
    case 'PENDING_ACTIVATION':
      return { statusKey: 'pending', pulseStatus: 'info', isOnline: false }
    case 'ACTIVE':
      return online
        ? { statusKey: 'online', pulseStatus: 'success', isOnline: true }
        : { statusKey: 'offline', pulseStatus: 'warning', isOnline: false }
    case 'INACTIVE':
      return { statusKey: 'inactive', pulseStatus: 'neutral', isOnline: false }
    case 'MAINTENANCE':
      return { statusKey: 'maintenance', pulseStatus: 'warning', isOnline: true }
    case 'RETIRED':
      return { statusKey: 'retired', pulseStatus: 'error', isOnline: false }
    default:
      return { statusKey: 'unknown', pulseStatus: 'neutral', isOnline: false }
  }
}
