/**
 * TPV Remote Command Types
 *
 * These types match the server-side TpvCommandType enum in Prisma schema.
 * Used for sending remote commands from Dashboard to TPV terminals.
 */

// ============================================
// Command Type Enum
// ============================================

export enum TpvCommandType {
  // Device State Commands
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  EXIT_MAINTENANCE = 'EXIT_MAINTENANCE',
  REACTIVATE = 'REACTIVATE',
  REMOTE_ACTIVATE = 'REMOTE_ACTIVATE', // SUPERADMIN: Remote activation for pre-registered terminals

  // App Lifecycle Commands
  RESTART = 'RESTART',
  SHUTDOWN = 'SHUTDOWN',
  CLEAR_CACHE = 'CLEAR_CACHE',
  FORCE_UPDATE = 'FORCE_UPDATE',
  REQUEST_UPDATE = 'REQUEST_UPDATE', // Shows dialog on TPV, user can accept/dismiss
  INSTALL_VERSION = 'INSTALL_VERSION', // Install specific version (SUPERADMIN rollback/upgrade)

  // Data Management Commands
  SYNC_DATA = 'SYNC_DATA',
  FACTORY_RESET = 'FACTORY_RESET',
  EXPORT_LOGS = 'EXPORT_LOGS',

  // Configuration Commands
  UPDATE_CONFIG = 'UPDATE_CONFIG',
  REFRESH_MENU = 'REFRESH_MENU',
  UPDATE_MERCHANT = 'UPDATE_MERCHANT',

  // Automation Commands (Server-side only)
  SCHEDULE = 'SCHEDULE',
  TIME_RULE = 'TIME_RULE',
  GEOFENCE_TRIGGER = 'GEOFENCE_TRIGGER',
}

// ============================================
// Command Priority Enum
// ============================================

export enum TpvCommandPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ============================================
// Command Status Enum
// ============================================

export enum TpvCommandStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

// ============================================
// Command Result Status Enum
// ============================================

export enum TpvCommandResultStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
  TIMEOUT = 'TIMEOUT',
}

// ============================================
// Payload Types for Each Command
// ============================================

export interface LockPayload {
  reason?: string
  message?: string
  lockedBy?: string
}

export interface MaintenanceModePayload {
  reason?: string
  initiatedBy?: string
  duration?: number // minutes, 0 = indefinite
}

export interface ClearCachePayload {
  targets?: ('menu' | 'orders' | 'config' | 'all')[]
}

export interface ForceUpdatePayload {
  version?: string
  force?: boolean
}

export interface InstallVersionPayload {
  versionCode: number // Target version code to install
}

export interface UpdateConfigPayload {
  config: Record<string, unknown>
}

export interface UpdateMerchantPayload {
  merchantAccountId: string
}

export interface SchedulePayload {
  scheduledFor: string // ISO date
  command: TpvCommandType
  commandPayload?: Record<string, unknown>
}

// Union type for all payloads
export type TpvCommandPayload =
  | LockPayload
  | MaintenanceModePayload
  | ClearCachePayload
  | ForceUpdatePayload
  | InstallVersionPayload
  | UpdateConfigPayload
  | UpdateMerchantPayload
  | SchedulePayload
  | Record<string, unknown>
  | undefined

// ============================================
// Command Request/Response Types
// ============================================

export interface SendCommandRequest {
  command: TpvCommandType
  payload?: TpvCommandPayload
  priority?: TpvCommandPriority
  expiresAt?: string // ISO date
  requiresPin?: boolean
}

export interface TpvCommand {
  id: string
  terminalId: string
  venueId: string
  commandType: TpvCommandType
  payload?: TpvCommandPayload
  priority: TpvCommandPriority
  status: TpvCommandStatus
  resultStatus?: TpvCommandResultStatus
  resultMessage?: string
  resultData?: Record<string, unknown>
  requestedBy?: string
  requestedByName?: string
  requestedByEmail?: string
  createdAt: string
  sentAt?: string
  receivedAt?: string
  executedAt?: string
  completedAt?: string
  expiresAt?: string
  correlationId?: string
}

// ============================================
// Command Category for UI Grouping
// ============================================

export type CommandCategory =
  | 'device_state'
  | 'app_lifecycle'
  | 'data_management'
  | 'configuration'

export interface CommandDefinition {
  type: TpvCommandType
  category: CommandCategory
  icon: string
  requiresOnline: boolean
  requiresConfirmation: boolean
  isDangerous: boolean
  defaultPriority: TpvCommandPriority
  hasPayload: boolean
}

// Command definitions for UI
export const COMMAND_DEFINITIONS: Record<TpvCommandType, CommandDefinition> = {
  // Device State Commands
  [TpvCommandType.LOCK]: {
    type: TpvCommandType.LOCK,
    category: 'device_state',
    icon: 'Lock',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: true,
  },
  [TpvCommandType.UNLOCK]: {
    type: TpvCommandType.UNLOCK,
    category: 'device_state',
    icon: 'Unlock',
    requiresOnline: true,
    requiresConfirmation: false,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: false,
  },
  [TpvCommandType.MAINTENANCE_MODE]: {
    type: TpvCommandType.MAINTENANCE_MODE,
    category: 'device_state',
    icon: 'Wrench',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: true,
  },
  [TpvCommandType.EXIT_MAINTENANCE]: {
    type: TpvCommandType.EXIT_MAINTENANCE,
    category: 'device_state',
    icon: 'Play',
    requiresOnline: true,
    requiresConfirmation: false,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: false,
  },
  [TpvCommandType.REACTIVATE]: {
    type: TpvCommandType.REACTIVATE,
    category: 'device_state',
    icon: 'Power',
    requiresOnline: false,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: false,
  },
  [TpvCommandType.REMOTE_ACTIVATE]: {
    type: TpvCommandType.REMOTE_ACTIVATE,
    category: 'device_state',
    icon: 'Zap',
    requiresOnline: true, // Terminal must have sent at least one heartbeat
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: true, // Contains venue info for activation
  },

  // App Lifecycle Commands
  [TpvCommandType.RESTART]: {
    type: TpvCommandType.RESTART,
    category: 'app_lifecycle',
    icon: 'RotateCcw',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: false,
  },
  [TpvCommandType.SHUTDOWN]: {
    type: TpvCommandType.SHUTDOWN,
    category: 'app_lifecycle',
    icon: 'PowerOff',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: true,
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: false,
  },
  [TpvCommandType.CLEAR_CACHE]: {
    type: TpvCommandType.CLEAR_CACHE,
    category: 'app_lifecycle',
    icon: 'Trash2',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: true,
  },
  [TpvCommandType.FORCE_UPDATE]: {
    type: TpvCommandType.FORCE_UPDATE,
    category: 'app_lifecycle',
    icon: 'Download',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: true,
  },
  [TpvCommandType.REQUEST_UPDATE]: {
    type: TpvCommandType.REQUEST_UPDATE,
    category: 'app_lifecycle',
    icon: 'Download',
    requiresOnline: true,
    requiresConfirmation: false, // Just sends request, user decides on TPV
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: false,
  },
  [TpvCommandType.INSTALL_VERSION]: {
    type: TpvCommandType.INSTALL_VERSION,
    category: 'app_lifecycle',
    icon: 'Archive',
    requiresOnline: false, // Queued for delivery when terminal connects (backend supports offline commands)
    requiresConfirmation: true, // SUPERADMIN must confirm version selection
    isDangerous: true, // Can rollback to older version
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: true, // Contains versionCode
  },

  // Data Management Commands
  [TpvCommandType.SYNC_DATA]: {
    type: TpvCommandType.SYNC_DATA,
    category: 'data_management',
    icon: 'RefreshCw',
    requiresOnline: true,
    requiresConfirmation: false,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: false,
  },
  [TpvCommandType.FACTORY_RESET]: {
    type: TpvCommandType.FACTORY_RESET,
    category: 'data_management',
    icon: 'AlertTriangle',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: true,
    defaultPriority: TpvCommandPriority.CRITICAL,
    hasPayload: false,
  },
  [TpvCommandType.EXPORT_LOGS]: {
    type: TpvCommandType.EXPORT_LOGS,
    category: 'data_management',
    icon: 'FileText',
    requiresOnline: true,
    requiresConfirmation: false,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.LOW,
    hasPayload: false,
  },

  // Configuration Commands
  [TpvCommandType.UPDATE_CONFIG]: {
    type: TpvCommandType.UPDATE_CONFIG,
    category: 'configuration',
    icon: 'Settings',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: true,
  },
  [TpvCommandType.REFRESH_MENU]: {
    type: TpvCommandType.REFRESH_MENU,
    category: 'configuration',
    icon: 'Menu',
    requiresOnline: true,
    requiresConfirmation: false,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: false,
  },
  [TpvCommandType.UPDATE_MERCHANT]: {
    type: TpvCommandType.UPDATE_MERCHANT,
    category: 'configuration',
    icon: 'CreditCard',
    requiresOnline: true,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.HIGH,
    hasPayload: true,
  },

  // Automation Commands (Server-side only, not shown in UI)
  [TpvCommandType.SCHEDULE]: {
    type: TpvCommandType.SCHEDULE,
    category: 'configuration',
    icon: 'Calendar',
    requiresOnline: false,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: true,
  },
  [TpvCommandType.TIME_RULE]: {
    type: TpvCommandType.TIME_RULE,
    category: 'configuration',
    icon: 'Clock',
    requiresOnline: false,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: true,
  },
  [TpvCommandType.GEOFENCE_TRIGGER]: {
    type: TpvCommandType.GEOFENCE_TRIGGER,
    category: 'configuration',
    icon: 'MapPin',
    requiresOnline: false,
    requiresConfirmation: true,
    isDangerous: false,
    defaultPriority: TpvCommandPriority.NORMAL,
    hasPayload: true,
  },
}

// Commands available in the UI (excludes server-side only commands)
export const UI_AVAILABLE_COMMANDS = Object.values(TpvCommandType).filter(
  (cmd) => ![TpvCommandType.SCHEDULE, TpvCommandType.TIME_RULE, TpvCommandType.GEOFENCE_TRIGGER].includes(cmd)
)
