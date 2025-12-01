import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CreditCard,
  Download,
  FileText,
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
} from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { PermissionGate } from '@/components/PermissionGate'
import { sendTpvCommand } from '@/services/tpv.service'
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
}

interface RemoteCommandPanelProps {
  terminalId: string
  terminalName?: string
  isOnline: boolean
  isLocked?: boolean
  isInMaintenance?: boolean
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
  venueId,
}: RemoteCommandPanelProps) {
  const { t } = useTranslation(['tpv', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

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

  // Command mutation
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
      return sendTpvCommand(terminalId, command, payload, priority)
    },
    onSuccess: (_, variables) => {
      toast({
        title: t('commands.sent'),
        description: t('commands.sentSuccess', { command: t(`commands.types.${variables.command}`) }),
      })
      // Invalidate TPV data to refresh status
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, terminalId] })
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: t('commands.error'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  // Command groups for organized display
  const commandGroups: CommandGroup[] = [
    {
      title: t('commands.groups.deviceState'),
      description: t('commands.groups.deviceStateDesc'),
      commands: [
        TpvCommandType.LOCK,
        TpvCommandType.UNLOCK,
        TpvCommandType.MAINTENANCE_MODE,
        TpvCommandType.EXIT_MAINTENANCE,
      ],
    },
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
      <AlertDialog open={lockDialog.open} onOpenChange={(open) => setLockDialog({ ...lockDialog, open })}>
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
      <AlertDialog open={maintenanceDialog.open} onOpenChange={(open) => setMaintenanceDialog({ ...maintenanceDialog, open })}>
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
    </PermissionGate>
  )
}
