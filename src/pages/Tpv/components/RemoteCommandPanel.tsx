import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Lock,
  Menu,
  Play,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Settings,
  Trash2,
  Unlock,
  Wrench,
  Zap,
} from 'lucide-react'

import { useSocket } from '@/context/SocketContext'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { PermissionGate } from '@/components/PermissionGate'
import { sendTpvCommand } from '@/services/tpv.service'
import { terminalAPI } from '@/services/superadmin-terminals.service'
import {
  COMMAND_DEFINITIONS,
  TpvCommandPayload,
  TpvCommandPriority,
  TpvCommandType,
} from '@/types/tpv-commands'

// Icon mapping
const ICON_MAP = {
  Lock,
  Unlock,
  Wrench,
  Play,
  Power,
  RotateCcw,
  PowerOff,
  Trash2,
  Download,
  RefreshCw,
  AlertTriangle,
  FileText,
  Settings,
  Menu,
  CreditCard,
  Loader2,
  Zap,
}

// Commands that require waiting for heartbeat after execution (terminal state changes)
// These commands stay in "loading" state until TPV confirms via heartbeat/status update
const COMMANDS_AWAITING_HEARTBEAT: TpvCommandType[] = [
  TpvCommandType.RESTART,
  TpvCommandType.SYNC_DATA,
  TpvCommandType.MAINTENANCE_MODE,
  TpvCommandType.EXIT_MAINTENANCE,
  TpvCommandType.LOCK,
  TpvCommandType.UNLOCK,
]

// Debounce delay for toggle switches (ms)
const TOGGLE_DEBOUNCE_DELAY = 500

// Timeout for awaiting heartbeat fallback (ms) - if TPV doesn't respond within this time,
// clear the loading state. This handles cases where backend ACK fails or TPV is offline.
const HEARTBEAT_TIMEOUT = 60_000 // 60 seconds

interface RemoteCommandPanelProps {
  terminalId: string
  terminalName?: string
  isOnline: boolean
  isLocked?: boolean
  isInMaintenance?: boolean
  isActivated?: boolean // true if terminal has activatedAt set
  isSuperadmin?: boolean // true if current user is SUPERADMIN
  venueId: string
}

interface CommandGroup {
  title: string
  description: string
  commands: TpvCommandType[]
}

export function RemoteCommandPanel({
  terminalId,
  terminalName,
  isOnline,
  isLocked = false,
  isInMaintenance = false,
  isActivated = true,
  isSuperadmin = false,
  venueId,
}: RemoteCommandPanelProps) {
  const { t } = useTranslation(['tpv', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { socket } = useSocket()

  // Track pending commands by type (prevents double-clicks)
  const [pendingCommands, setPendingCommands] = useState<Set<TpvCommandType>>(new Set())

  // Track commands awaiting heartbeat (button stays disabled until TPV reconnects)
  const [awaitingHeartbeat, setAwaitingHeartbeat] = useState<Set<TpvCommandType>>(new Set())

  // Refs to track heartbeat timeout per command (fallback if heartbeat never arrives)
  const heartbeatTimeoutsRef = useRef<Map<TpvCommandType, NodeJS.Timeout>>(new Map())

  // Refs for debouncing toggle switches
  const lockToggleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maintenanceToggleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Refs to track if dialog submit was clicked (to prevent clearing pendingCommands on onOpenChange)
  const lockSubmittedRef = useRef(false)
  const maintenanceSubmittedRef = useRef(false)

  // Socket.IO listener to clear awaiting heartbeat state when TPV reconnects
  useEffect(() => {
    if (!socket || !terminalId) return

    const handleStatusUpdate = (data: { terminalId: string }) => {
      if (data.terminalId === terminalId) {
        // TPV sent heartbeat, clear all awaiting states
        setAwaitingHeartbeat(new Set())

        // Clear all pending heartbeat timeouts since heartbeat arrived
        heartbeatTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
        heartbeatTimeoutsRef.current.clear()
      }
    }

    socket.on('tpv_status_update', handleStatusUpdate)
    return () => {
      socket.off('tpv_status_update', handleStatusUpdate)
    }
  }, [socket, terminalId])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (lockToggleTimeoutRef.current) clearTimeout(lockToggleTimeoutRef.current)
      if (maintenanceToggleTimeoutRef.current) clearTimeout(maintenanceToggleTimeoutRef.current)
      // Clear all heartbeat fallback timeouts
      heartbeatTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      heartbeatTimeoutsRef.current.clear()
    }
  }, [])

  // State for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    command: TpvCommandType | null
    payload?: TpvCommandPayload
  }>({ open: false, command: null })

  // State for lock dialog with payload
  const [lockDialog, setLockDialog] = useState<{
    open: boolean
    reason: string
    message: string
  }>({ open: false, reason: '', message: '' })

  // State for maintenance dialog
  const [maintenanceDialog, setMaintenanceDialog] = useState<{
    open: boolean
    reason: string
  }>({ open: false, reason: '' })

  // State for remote activate dialog (SUPERADMIN only)
  const [remoteActivateDialog, setRemoteActivateDialog] = useState<{ open: boolean }>({ open: false })

  // Remote Activate mutation (SUPERADMIN only - uses dedicated endpoint)
  const remoteActivateMutation = useMutation({
    mutationFn: () => terminalAPI.sendRemoteActivation(terminalId),
    onSuccess: () => {
      toast({
        title: t('commands.remoteActivateSent'),
        description: t('commands.remoteActivateSentDesc'),
      })
      // Invalidate TPV data to refresh activation status
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, terminalId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminal', terminalId] })
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: t('commands.error'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  // Command mutation with pending state tracking
  const commandMutation = useMutation({
    mutationFn: async ({
      command,
      payload,
      priority,
    }: {
      command: TpvCommandType
      payload?: TpvCommandPayload
      priority?: TpvCommandPriority
    }) => {
      // Mark command as pending
      setPendingCommands((prev) => new Set(prev).add(command))
      return sendTpvCommand(terminalId, command, payload, priority)
    },
    onSuccess: (_, variables) => {
      toast({
        title: t('commands.sent'),
        description: t('commands.sentSuccess', { command: t(`commands.types.${variables.command}`) }),
      })

      // For RESTART/SYNC commands, set awaiting heartbeat (button stays disabled until TPV reconnects)
      if (COMMANDS_AWAITING_HEARTBEAT.includes(variables.command)) {
        setAwaitingHeartbeat((prev) => new Set(prev).add(variables.command))

        // Set up timeout fallback in case heartbeat never arrives (backend bug, TPV offline, etc.)
        // This prevents the toggle from being stuck in loading state forever
        const timeoutId = setTimeout(() => {
          setAwaitingHeartbeat((prev) => {
            const next = new Set(prev)
            next.delete(variables.command)
            return next
          })
          heartbeatTimeoutsRef.current.delete(variables.command)
        }, HEARTBEAT_TIMEOUT)

        // Store timeout so it can be cleared if heartbeat arrives
        heartbeatTimeoutsRef.current.set(variables.command, timeoutId)
      }

      // Invalidate TPV data to refresh status
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, terminalId] })
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }, variables) => {
      toast({
        title: t('commands.error'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
      // Clear pending state on error
      setPendingCommands((prev) => {
        const next = new Set(prev)
        next.delete(variables.command)
        return next
      })
    },
    onSettled: (_, __, variables) => {
      // Clear pending state after mutation completes (success or error)
      setPendingCommands((prev) => {
        const next = new Set(prev)
        next.delete(variables.command)
        return next
      })
    },
  })

  // Command groups for organized display (excluding toggle commands)
  const commandGroups: CommandGroup[] = [
    {
      title: t('commands.groups.appLifecycle'),
      description: t('commands.groups.appLifecycleDesc'),
      commands: [
        TpvCommandType.RESTART,
        TpvCommandType.CLEAR_CACHE,
        TpvCommandType.FORCE_UPDATE,
      ],
    },
    {
      title: t('commands.groups.dataManagement'),
      description: t('commands.groups.dataManagementDesc'),
      commands: [
        TpvCommandType.SYNC_DATA,
        TpvCommandType.REFRESH_MENU,
        TpvCommandType.EXPORT_LOGS,
      ],
    },
  ]

  // Handle toggle for maintenance mode (debounced to prevent rapid clicking issues)
  const handleMaintenanceToggle = useCallback(
    (checked: boolean) => {
      // Clear any pending debounce
      if (maintenanceToggleTimeoutRef.current) {
        clearTimeout(maintenanceToggleTimeoutRef.current)
      }

      // Set pending state IMMEDIATELY for visual feedback (spinner + disabled)
      const commandToTrack = checked ? TpvCommandType.MAINTENANCE_MODE : TpvCommandType.EXIT_MAINTENANCE
      setPendingCommands((prev) => new Set(prev).add(commandToTrack))

      // Debounce the toggle action
      maintenanceToggleTimeoutRef.current = setTimeout(() => {
        if (checked) {
          // Show dialog for entering maintenance with reason
          // Clear pending state since dialog will handle the rest
          setPendingCommands((prev) => {
            const next = new Set(prev)
            next.delete(TpvCommandType.MAINTENANCE_MODE)
            return next
          })
          setMaintenanceDialog({ open: true, reason: '' })
        } else {
          // Exit maintenance - mutation will handle clearing pendingCommands in onSettled
          commandMutation.mutate({
            command: TpvCommandType.EXIT_MAINTENANCE,
            priority: TpvCommandPriority.NORMAL,
          })
        }
      }, TOGGLE_DEBOUNCE_DELAY)
    },
    [commandMutation],
  )

  // Handle toggle for lock (debounced to prevent rapid clicking issues)
  const handleLockToggle = useCallback(
    (checked: boolean) => {
      // Clear any pending debounce
      if (lockToggleTimeoutRef.current) {
        clearTimeout(lockToggleTimeoutRef.current)
      }

      // Set pending state IMMEDIATELY for visual feedback (spinner + disabled)
      const commandToTrack = checked ? TpvCommandType.LOCK : TpvCommandType.UNLOCK
      setPendingCommands((prev) => new Set(prev).add(commandToTrack))

      // Debounce the toggle action
      lockToggleTimeoutRef.current = setTimeout(() => {
        if (checked) {
          // Show dialog for locking with reason
          // Clear pending state since dialog will handle the rest
          setPendingCommands((prev) => {
            const next = new Set(prev)
            next.delete(TpvCommandType.LOCK)
            return next
          })
          setLockDialog({ open: true, reason: '', message: '' })
        } else {
          // Unlock - mutation will handle clearing pendingCommands in onSettled
          commandMutation.mutate({
            command: TpvCommandType.UNLOCK,
            priority: TpvCommandPriority.HIGH,
          })
        }
      }, TOGGLE_DEBOUNCE_DELAY)
    },
    [commandMutation],
  )

  // Handle command execution
  const executeCommand = (command: TpvCommandType, payload?: TpvCommandPayload) => {
    const def = COMMAND_DEFINITIONS[command]

    // Check if terminal is online for commands that require it
    if (def.requiresOnline && !isOnline) {
      toast({
        title: t('commands.offlineError'),
        description: t('commands.offlineErrorDesc'),
        variant: 'destructive',
      })
      return
    }

    // Show confirmation dialog for dangerous or confirmation-required commands
    if (def.requiresConfirmation || def.isDangerous) {
      setConfirmDialog({ open: true, command, payload })
      return
    }

    // Execute immediately
    commandMutation.mutate({ command, payload, priority: def.defaultPriority })
  }

  // Confirm and execute command
  const confirmCommand = () => {
    if (confirmDialog.command) {
      const def = COMMAND_DEFINITIONS[confirmDialog.command]
      commandMutation.mutate({
        command: confirmDialog.command,
        payload: confirmDialog.payload,
        priority: def.defaultPriority,
      })
    }
    setConfirmDialog({ open: false, command: null })
  }

  // Handle lock with payload
  const handleLock = () => {
    // Mark as submitted to prevent onOpenChange from clearing pendingCommands
    lockSubmittedRef.current = true
    commandMutation.mutate({
      command: TpvCommandType.LOCK,
      payload: {
        reason: lockDialog.reason || undefined,
        message: lockDialog.message || undefined,
      },
      priority: TpvCommandPriority.HIGH,
    })
    setLockDialog({ open: false, reason: '', message: '' })
  }

  // Handle maintenance with payload
  const handleMaintenance = () => {
    // Mark as submitted to prevent onOpenChange from clearing pendingCommands
    maintenanceSubmittedRef.current = true
    commandMutation.mutate({
      command: TpvCommandType.MAINTENANCE_MODE,
      payload: {
        reason: maintenanceDialog.reason || undefined,
      },
      priority: TpvCommandPriority.NORMAL,
    })
    setMaintenanceDialog({ open: false, reason: '' })
  }

  // Get icon component
  const getIcon = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName as keyof typeof ICON_MAP]
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null
  }

  // Check if command should be disabled
  const isCommandDisabled = (command: TpvCommandType): boolean => {
    const def = COMMAND_DEFINITIONS[command]

    // Pending command check (prevents double-clicks)
    if (pendingCommands.has(command)) return true

    // Awaiting heartbeat check (RESTART/SYNC stay disabled until TPV reconnects)
    if (awaitingHeartbeat.has(command)) return true

    // Offline check
    if (def.requiresOnline && !isOnline) return true

    // State-based disabling
    switch (command) {
      case TpvCommandType.LOCK:
        return isLocked
      case TpvCommandType.UNLOCK:
        return !isLocked
      case TpvCommandType.MAINTENANCE_MODE:
        return isInMaintenance
      case TpvCommandType.EXIT_MAINTENANCE:
        return !isInMaintenance
      default:
        return false
    }
  }

  // Get command button variant
  const getButtonVariant = (command: TpvCommandType): 'default' | 'secondary' | 'outline' | 'destructive' => {
    const def = COMMAND_DEFINITIONS[command]
    if (def.isDangerous) return 'destructive'
    if (command === TpvCommandType.UNLOCK || command === TpvCommandType.EXIT_MAINTENANCE) return 'default'
    return 'outline'
  }

  // Render a single command button
  const renderCommandButton = (command: TpvCommandType) => {
    const def = COMMAND_DEFINITIONS[command]
    const disabled = isCommandDisabled(command) || commandMutation.isPending

    // Special handling for LOCK - show dialog for payload
    if (command === TpvCommandType.LOCK) {
      return (
        <TooltipProvider key={command}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={getButtonVariant(command)}
                size="sm"
                disabled={disabled}
                onClick={() => setLockDialog({ open: true, reason: '', message: '' })}
                className="flex items-center gap-2"
              >
                {getIcon(def.icon)}
                <span>{t(`commands.types.${command}`)}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t(`commands.descriptions.${command}`)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    // Special handling for MAINTENANCE_MODE - show dialog for payload
    if (command === TpvCommandType.MAINTENANCE_MODE) {
      return (
        <TooltipProvider key={command}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={getButtonVariant(command)}
                size="sm"
                disabled={disabled}
                onClick={() => setMaintenanceDialog({ open: true, reason: '' })}
                className="flex items-center gap-2"
              >
                {getIcon(def.icon)}
                <span>{t(`commands.types.${command}`)}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t(`commands.descriptions.${command}`)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    // Check if awaiting heartbeat for visual feedback
    const isAwaiting = awaitingHeartbeat.has(command)
    const isPending = pendingCommands.has(command)

    return (
      <TooltipProvider key={command}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={getButtonVariant(command)}
              size="sm"
              disabled={disabled}
              onClick={() => executeCommand(command)}
              className="flex items-center gap-2"
            >
              {isAwaiting || isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                getIcon(def.icon)
              )}
              <span>
                {isAwaiting
                  ? command === TpvCommandType.RESTART
                    ? t('commands.restarting')
                    : command === TpvCommandType.SYNC_DATA
                      ? t('commands.syncing')
                      : t(`commands.types.${command}`)
                  : t(`commands.types.${command}`)}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isAwaiting
                ? t('commands.awaitingHeartbeat')
                : t(`commands.descriptions.${command}`)}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <PermissionGate permission="tpv:command">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                {t('commands.remoteCommands')}
              </CardTitle>
              <CardDescription>{t('commands.remoteCommandsDesc')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {t('status.offline')}
                </Badge>
              )}
              {isLocked && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <Lock className="h-3 w-3 mr-1" />
                  {t('status.locked')}
                </Badge>
              )}
              {isInMaintenance && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  <Wrench className="h-3 w-3 mr-1" />
                  {t('status.maintenance')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle Controls Section */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-foreground">{t('commands.groups.deviceState')}</h4>
              <p className="text-xs text-muted-foreground">{t('commands.groups.deviceStateDesc')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Lock Toggle */}
              {(() => {
                const isLockProcessing = pendingCommands.has(TpvCommandType.LOCK) || pendingCommands.has(TpvCommandType.UNLOCK) ||
                  awaitingHeartbeat.has(TpvCommandType.LOCK) || awaitingHeartbeat.has(TpvCommandType.UNLOCK)
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isLocked
                            ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                            : 'bg-muted/50 border-border hover:bg-muted'
                        }`}>
                          <div className="flex items-center space-x-3">
                            {isLockProcessing ? (
                              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                            ) : isLocked ? (
                              <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
                            ) : (
                              <Unlock className="w-5 h-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className={`text-sm font-medium ${isLocked ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
                                {isLockProcessing
                                  ? t('commands.awaitingHeartbeat')
                                  : isLocked ? t('actions.locked') : t('actions.unlocked')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t(`commands.descriptions.${isLocked ? 'UNLOCK' : 'LOCK'}`)}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={isLocked}
                            onCheckedChange={handleLockToggle}
                            disabled={!isOnline || commandMutation.isPending || isLockProcessing}
                            className="data-[state=checked]:bg-red-500"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{!isOnline ? t('commands.requiresOnline') : (isLocked ? t('detail.tooltips.unlock') : t('detail.tooltips.lock'))}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })()}

              {/* Maintenance Toggle */}
              {(() => {
                const isMaintenanceProcessing = pendingCommands.has(TpvCommandType.MAINTENANCE_MODE) || pendingCommands.has(TpvCommandType.EXIT_MAINTENANCE) ||
                  awaitingHeartbeat.has(TpvCommandType.MAINTENANCE_MODE) || awaitingHeartbeat.has(TpvCommandType.EXIT_MAINTENANCE)
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isInMaintenance
                            ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
                            : 'bg-muted/50 border-border hover:bg-muted'
                        }`}>
                          <div className="flex items-center space-x-3">
                            {isMaintenanceProcessing ? (
                              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                            ) : (
                              <Wrench className={`w-5 h-5 ${isInMaintenance ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`} />
                            )}
                            <div>
                              <p className={`text-sm font-medium ${isInMaintenance ? 'text-orange-700 dark:text-orange-400' : 'text-foreground'}`}>
                                {isMaintenanceProcessing
                                  ? t('commands.awaitingHeartbeat')
                                  : t('actions.maintenance')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t(`commands.descriptions.${isInMaintenance ? 'EXIT_MAINTENANCE' : 'MAINTENANCE_MODE'}`)}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={isInMaintenance}
                            onCheckedChange={handleMaintenanceToggle}
                            disabled={(!isOnline && !isInMaintenance) || commandMutation.isPending || isMaintenanceProcessing}
                            className="data-[state=checked]:bg-orange-500"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{(!isOnline && !isInMaintenance) ? t('commands.requiresOnline') : (isInMaintenance ? t('detail.tooltips.reactivate') : t('detail.tooltips.maintenanceMode'))}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })()}

              {/* Remote Activate Button - SUPERADMIN only, for pre-registered terminals */}
              {isSuperadmin && !isActivated && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start p-3 h-auto ${
                          isOnline
                            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 dark:text-amber-400'
                            : 'border-border bg-muted/50 text-muted-foreground'
                        }`}
                        onClick={() => setRemoteActivateDialog({ open: true })}
                        disabled={!isOnline || remoteActivateMutation.isPending}
                      >
                        <div className="flex items-center space-x-3 w-full">
                          {remoteActivateMutation.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Zap className="w-5 h-5" />
                          )}
                          <div className="text-left">
                            <p className="text-sm font-medium">
                              {remoteActivateMutation.isPending ? t('commands.sending') : t('commands.remoteActivate')}
                            </p>
                            <p className="text-xs opacity-80">
                              {isOnline ? t('commands.remoteActivateDesc') : t('commands.remoteActivateRequiresOnline')}
                            </p>
                          </div>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isOnline ? t('commands.remoteActivateTooltip') : t('commands.remoteActivateRequiresOnline')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Other Command Groups */}
          {commandGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-foreground">{group.title}</h4>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.commands.map(renderCommandButton)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.command && COMMAND_DEFINITIONS[confirmDialog.command].isDangerous && (
                <span className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t('commands.dangerousAction')}
                </span>
              )}
              {confirmDialog.command && !COMMAND_DEFINITIONS[confirmDialog.command].isDangerous && (
                t('commands.confirmTitle')
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.command && (
                t('commands.confirmDesc', {
                  command: t(`commands.types.${confirmDialog.command}`),
                  terminal: terminalName || terminalId,
                })
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCommand}
              className={
                confirmDialog.command && COMMAND_DEFINITIONS[confirmDialog.command].isDangerous
                  ? 'bg-destructive hover:bg-destructive/90'
                  : ''
              }
            >
              {t('commands.execute')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lock Dialog with Payload */}
      <AlertDialog open={lockDialog.open} onOpenChange={(open) => {
        setLockDialog({ ...lockDialog, open })
        // Clear pending state only if dialog was cancelled (not submitted)
        if (!open && !lockSubmittedRef.current) {
          setPendingCommands((prev) => {
            const next = new Set(prev)
            next.delete(TpvCommandType.LOCK)
            return next
          })
        }
        // Reset ref for next time
        lockSubmittedRef.current = false
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-600" />
              {t('commands.lockTerminal')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('commands.lockTerminalDesc', { terminal: terminalName || terminalId })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lockReason">{t('commands.lockReason')}</Label>
              <Input
                id="lockReason"
                placeholder={t('commands.lockReasonPlaceholder')}
                value={lockDialog.reason}
                onChange={(e) => setLockDialog({ ...lockDialog, reason: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockMessage">{t('commands.lockMessage')}</Label>
              <Textarea
                id="lockMessage"
                placeholder={t('commands.lockMessagePlaceholder')}
                value={lockDialog.message}
                onChange={(e) => setLockDialog({ ...lockDialog, message: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t('commands.lockMessageHint')}</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLock}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Lock className="h-4 w-4 mr-2" />
              {t('commands.lockNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Maintenance Dialog with Payload */}
      <AlertDialog open={maintenanceDialog.open} onOpenChange={(open) => {
        setMaintenanceDialog({ ...maintenanceDialog, open })
        // Clear pending state only if dialog was cancelled (not submitted)
        if (!open && !maintenanceSubmittedRef.current) {
          setPendingCommands((prev) => {
            const next = new Set(prev)
            next.delete(TpvCommandType.MAINTENANCE_MODE)
            return next
          })
        }
        // Reset ref for next time
        maintenanceSubmittedRef.current = false
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-yellow-600" />
              {t('commands.enterMaintenance')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('commands.enterMaintenanceDesc', { terminal: terminalName || terminalId })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="maintenanceReason">{t('commands.maintenanceReason')}</Label>
              <Input
                id="maintenanceReason"
                placeholder={t('commands.maintenanceReasonPlaceholder')}
                value={maintenanceDialog.reason}
                onChange={(e) => setMaintenanceDialog({ ...maintenanceDialog, reason: e.target.value })}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMaintenance}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Wrench className="h-4 w-4 mr-2" />
              {t('commands.enterMaintenanceNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remote Activate Confirmation Dialog - SUPERADMIN only */}
      <AlertDialog open={remoteActivateDialog.open} onOpenChange={(open) => setRemoteActivateDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              {t('commands.remoteActivateConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('commands.remoteActivateConfirmDesc', { terminal: terminalName || terminalId })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                remoteActivateMutation.mutate()
                setRemoteActivateDialog({ open: false })
              }}
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
            >
              <Zap className="h-4 w-4 mr-2" />
              {t('commands.remoteActivateNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  )
}
