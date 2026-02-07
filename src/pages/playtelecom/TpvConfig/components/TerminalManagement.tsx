/**
 * TerminalManagement - List terminals with lock/maintenance quick actions
 * Used within TpvConfiguration page for venue-level terminal control
 *
 * Uses optimistic local state for lock/maintenance since these are async commands
 * sent to the TPV. The DB doesn't update until the TPV processes the command and
 * sends a heartbeat. Pattern adapted from RemoteCommandPanel.
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Monitor, Lock, Unlock, Wrench, WrenchIcon, Loader2, RotateCcw, Trash2, FileText, MoreVertical } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { useToast } from '@/hooks/use-toast'
import { getTpvs, lockTerminal, unlockTerminal, enterMaintenanceMode, exitMaintenanceMode, restartTerminal, clearCache, exportLogs } from '@/services/tpv.service'
import { TerminalStatus, type Terminal } from '@/types'

type ConfirmAction = {
  type: 'lock' | 'unlock' | 'maintenance_on' | 'maintenance_off' | 'restart' | 'clear_cache' | 'export_logs'
  terminal: Terminal
}

// Optimistic state override per terminal
type OptimisticOverride = {
  locked?: boolean
  maintenance?: boolean
}

// Timeout for awaiting heartbeat fallback (ms)
const HEARTBEAT_TIMEOUT = 60_000

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Activo', variant: 'default' },
  INACTIVE: { label: 'Inactivo', variant: 'secondary' },
  MAINTENANCE: { label: 'Mantenimiento', variant: 'outline' },
  RETIRED: { label: 'Retirado', variant: 'destructive' },
  PENDING_ACTIVATION: { label: 'Pendiente', variant: 'secondary' },
  LOCKED: { label: 'Bloqueado', variant: 'destructive' },
}

function getStatusBadge(status: string) {
  return STATUS_BADGE[status] || { label: status, variant: 'secondary' as const }
}

function isLocked(terminal: Terminal): boolean {
  return terminal.isLocked === true
}

function isInMaintenance(terminal: Terminal): boolean {
  return terminal.status === TerminalStatus.MAINTENANCE
}

export function TerminalManagement() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueId = activeVenue?.id
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { socket } = useSocket()

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  // Optimistic overrides: terminalId -> { locked?, maintenance? }
  const [optimisticState, setOptimisticState] = useState<Map<string, OptimisticOverride>>(new Map())

  // Track which terminals have pending commands (for spinner)
  const [pendingTerminals, setPendingTerminals] = useState<Set<string>>(new Set())

  // Heartbeat timeout refs per terminal
  const heartbeatTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Fetch all terminals for this venue
  const { data: terminalsData, isLoading } = useQuery({
    queryKey: ['venue', venueId, 'terminals'],
    queryFn: () => getTpvs(venueId!, { pageIndex: 0, pageSize: 100 }),
    enabled: !!venueId,
    staleTime: 30000,
  })

  const terminals: Terminal[] = useMemo(() => terminalsData?.data || [], [terminalsData])

  // Socket.IO listener: clear optimistic state when TPV heartbeat arrives
  useEffect(() => {
    if (!socket) return

    const handleStatusUpdate = (data: { terminalId: string }) => {
      // Clear optimistic override for this terminal
      setOptimisticState(prev => {
        const next = new Map(prev)
        next.delete(data.terminalId)
        return next
      })
      setPendingTerminals(prev => {
        const next = new Set(prev)
        next.delete(data.terminalId)
        return next
      })

      // Clear timeout for this terminal
      const timeout = heartbeatTimeoutsRef.current.get(data.terminalId)
      if (timeout) {
        clearTimeout(timeout)
        heartbeatTimeoutsRef.current.delete(data.terminalId)
      }

      // Refetch terminals to get real status from DB
      queryClient.invalidateQueries({ queryKey: ['venue', venueId, 'terminals'] })
    }

    socket.on('tpv_status_update', handleStatusUpdate)
    return () => {
      socket.off('tpv_status_update', handleStatusUpdate)
    }
  }, [socket, venueId, queryClient])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      heartbeatTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      heartbeatTimeoutsRef.current.clear()
    }
  }, [])

  // Helper: set optimistic state + pending + start timeout
  const applyOptimistic = useCallback((terminalId: string, override: OptimisticOverride) => {
    setOptimisticState(prev => {
      const next = new Map(prev)
      const existing = next.get(terminalId) || {}
      next.set(terminalId, { ...existing, ...override })
      return next
    })
    setPendingTerminals(prev => new Set(prev).add(terminalId))

    // Fallback timeout: clear optimistic state if heartbeat never arrives
    const existingTimeout = heartbeatTimeoutsRef.current.get(terminalId)
    if (existingTimeout) clearTimeout(existingTimeout)

    const timeoutId = setTimeout(() => {
      setOptimisticState(prev => {
        const next = new Map(prev)
        next.delete(terminalId)
        return next
      })
      setPendingTerminals(prev => {
        const next = new Set(prev)
        next.delete(terminalId)
        return next
      })
      heartbeatTimeoutsRef.current.delete(terminalId)
      // Refetch to get whatever the real state is
      queryClient.invalidateQueries({ queryKey: ['venue', venueId, 'terminals'] })
    }, HEARTBEAT_TIMEOUT)

    heartbeatTimeoutsRef.current.set(terminalId, timeoutId)
  }, [venueId, queryClient])

  // Lock mutation
  const lockMutation = useMutation({
    mutationFn: (terminalId: string) => lockTerminal(terminalId, 'Bloqueado desde dashboard'),
    onSuccess: (_, terminalId) => {
      applyOptimistic(terminalId, { locked: true })
      toast({
        title: t('playtelecom:tpvConfig.terminals.lockSuccess', { defaultValue: 'Comando enviado: bloquear terminal' }),
      })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:tpvConfig.terminals.lockError', { defaultValue: 'Error al bloquear terminal' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Unlock mutation
  const unlockMutation = useMutation({
    mutationFn: (terminalId: string) => unlockTerminal(terminalId),
    onSuccess: (_, terminalId) => {
      applyOptimistic(terminalId, { locked: false })
      toast({
        title: t('playtelecom:tpvConfig.terminals.unlockSuccess', { defaultValue: 'Comando enviado: desbloquear terminal' }),
      })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:tpvConfig.terminals.unlockError', { defaultValue: 'Error al desbloquear terminal' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Maintenance on mutation
  const maintenanceOnMutation = useMutation({
    mutationFn: (terminalId: string) => enterMaintenanceMode(terminalId, 'Modo mantenimiento desde dashboard'),
    onSuccess: (_, terminalId) => {
      applyOptimistic(terminalId, { maintenance: true })
      toast({
        title: t('playtelecom:tpvConfig.terminals.maintenanceOnSuccess', { defaultValue: 'Comando enviado: modo mantenimiento' }),
      })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:tpvConfig.terminals.maintenanceError', { defaultValue: 'Error al cambiar modo mantenimiento' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Maintenance off mutation
  const maintenanceOffMutation = useMutation({
    mutationFn: (terminalId: string) => exitMaintenanceMode(terminalId),
    onSuccess: (_, terminalId) => {
      applyOptimistic(terminalId, { maintenance: false })
      toast({
        title: t('playtelecom:tpvConfig.terminals.maintenanceOffSuccess', { defaultValue: 'Comando enviado: salir de mantenimiento' }),
      })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:tpvConfig.terminals.maintenanceError', { defaultValue: 'Error al cambiar modo mantenimiento' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Restart mutation
  const restartMutation = useMutation({
    mutationFn: (terminalId: string) => restartTerminal(terminalId),
    onSuccess: (_, terminalId) => {
      setPendingTerminals(prev => new Set(prev).add(terminalId))
      toast({
        title: t('playtelecom:tpvConfig.terminals.restartSuccess', { defaultValue: 'Comando enviado: reiniciar terminal' }),
      })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:tpvConfig.terminals.restartError', { defaultValue: 'Error al reiniciar terminal' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: (terminalId: string) => clearCache(terminalId, ['all']),
    onSuccess: (_, terminalId) => {
      setPendingTerminals(prev => new Set(prev).add(terminalId))
      toast({
        title: t('playtelecom:tpvConfig.terminals.clearCacheSuccess', { defaultValue: 'Comando enviado: limpiar cache' }),
      })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:tpvConfig.terminals.clearCacheError', { defaultValue: 'Error al limpiar cache' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Export logs mutation
  const exportLogsMutation = useMutation({
    mutationFn: (terminalId: string) => exportLogs(terminalId),
    onSuccess: () => {
      toast({
        title: t('playtelecom:tpvConfig.terminals.exportLogsSuccess', { defaultValue: 'Comando enviado: exportar datos' }),
      })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:tpvConfig.terminals.exportLogsError', { defaultValue: 'Error al exportar datos' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const isPending = lockMutation.isPending || unlockMutation.isPending || maintenanceOnMutation.isPending || maintenanceOffMutation.isPending || restartMutation.isPending || clearCacheMutation.isPending || exportLogsMutation.isPending

  const handleConfirm = useCallback(() => {
    if (!confirmAction) return
    const { type, terminal } = confirmAction
    switch (type) {
      case 'lock':
        lockMutation.mutate(terminal.id)
        break
      case 'unlock':
        unlockMutation.mutate(terminal.id)
        break
      case 'maintenance_on':
        maintenanceOnMutation.mutate(terminal.id)
        break
      case 'maintenance_off':
        maintenanceOffMutation.mutate(terminal.id)
        break
      case 'restart':
        restartMutation.mutate(terminal.id)
        break
      case 'clear_cache':
        clearCacheMutation.mutate(terminal.id)
        break
      case 'export_logs':
        exportLogsMutation.mutate(terminal.id)
        break
    }
    setConfirmAction(null)
  }, [confirmAction, lockMutation, unlockMutation, maintenanceOnMutation, maintenanceOffMutation, restartMutation, clearCacheMutation, exportLogsMutation])

  const confirmTitle = useMemo(() => {
    if (!confirmAction) return ''
    const name = confirmAction.terminal.name
    switch (confirmAction.type) {
      case 'lock': return t('playtelecom:tpvConfig.terminals.confirmLock', { name, defaultValue: `Bloquear "${name}"?` })
      case 'unlock': return t('playtelecom:tpvConfig.terminals.confirmUnlock', { name, defaultValue: `Desbloquear "${name}"?` })
      case 'maintenance_on': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOn', { name, defaultValue: `Activar mantenimiento en "${name}"?` })
      case 'maintenance_off': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOff', { name, defaultValue: `Desactivar mantenimiento en "${name}"?` })
      case 'restart': return t('playtelecom:tpvConfig.terminals.confirmRestart', { name, defaultValue: `Reiniciar "${name}"?` })
      case 'clear_cache': return t('playtelecom:tpvConfig.terminals.confirmClearCache', { name, defaultValue: `Limpiar cache de "${name}"?` })
      case 'export_logs': return t('playtelecom:tpvConfig.terminals.confirmExportLogs', { name, defaultValue: `Exportar datos de "${name}"?` })
    }
  }, [confirmAction, t])

  const confirmDescription = useMemo(() => {
    if (!confirmAction) return ''
    switch (confirmAction.type) {
      case 'lock': return t('playtelecom:tpvConfig.terminals.confirmLockDesc', { defaultValue: 'La terminal quedara bloqueada hasta que se desbloquee manualmente.' })
      case 'unlock': return t('playtelecom:tpvConfig.terminals.confirmUnlockDesc', { defaultValue: 'La terminal volvera a estar operativa.' })
      case 'maintenance_on': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOnDesc', { defaultValue: 'La terminal entrara en modo mantenimiento y no podra procesar operaciones.' })
      case 'maintenance_off': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOffDesc', { defaultValue: 'La terminal saldra del modo mantenimiento y volvera a operar.' })
      case 'restart': return t('playtelecom:tpvConfig.terminals.confirmRestartDesc', { defaultValue: 'La terminal se reiniciara. Esto puede tomar unos segundos.' })
      case 'clear_cache': return t('playtelecom:tpvConfig.terminals.confirmClearCacheDesc', { defaultValue: 'Se limpiara toda la cache de la terminal. Los datos se volveran a sincronizar automaticamente.' })
      case 'export_logs': return t('playtelecom:tpvConfig.terminals.confirmExportLogsDesc', { defaultValue: 'Se exportaran los logs y datos de la terminal para diagnostico.' })
    }
  }, [confirmAction, t])

  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </GlassCard>
    )
  }

  if (terminals.length === 0) {
    return null
  }

  return (
    <>
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <Monitor className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {t('playtelecom:tpvConfig.terminals.title', { defaultValue: 'Terminales' })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('playtelecom:tpvConfig.terminals.subtitle', {
                count: terminals.length,
                defaultValue: '{{count}} terminales registradas',
              })}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {terminals.map(terminal => {
            const override = optimisticState.get(terminal.id)
            const locked = override?.locked ?? isLocked(terminal)
            const maintenance = override?.maintenance ?? isInMaintenance(terminal)
            const isProcessing = pendingTerminals.has(terminal.id)

            // Compute effective status badge
            const effectiveStatus = locked
              ? 'LOCKED'
              : maintenance
                ? 'MAINTENANCE'
                : terminal.status
            const badge = getStatusBadge(effectiveStatus)

            return (
              <div
                key={terminal.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50"
              >
                {/* Terminal Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{terminal.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {terminal.serialNumber || t('playtelecom:tpvConfig.terminals.noSerial', { defaultValue: 'Sin numero de serie' })}
                    </p>
                  </div>
                  <Badge variant={badge.variant} className="flex-shrink-0 text-xs">
                    {isProcessing ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('playtelecom:tpvConfig.terminals.syncing', { defaultValue: 'Sincronizando...' })}
                      </span>
                    ) : (
                      badge.label
                    )}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  {/* Lock / Unlock */}
                  {locked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isPending || isProcessing}
                      onClick={() => setConfirmAction({ type: 'unlock', terminal })}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 mr-1" />
                      )}
                      {t('playtelecom:tpvConfig.terminals.unlock', { defaultValue: 'Desbloquear' })}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isPending || isProcessing}
                      onClick={() => setConfirmAction({ type: 'lock', terminal })}
                    >
                      <Lock className="w-3.5 h-3.5 mr-1" />
                      {t('playtelecom:tpvConfig.terminals.lock', { defaultValue: 'Bloquear' })}
                    </Button>
                  )}

                  {/* Maintenance On / Off */}
                  {maintenance ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isPending || isProcessing}
                      onClick={() => setConfirmAction({ type: 'maintenance_off', terminal })}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <WrenchIcon className="w-3.5 h-3.5 mr-1" />
                      )}
                      {t('playtelecom:tpvConfig.terminals.exitMaintenance', { defaultValue: 'Salir Mant.' })}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isPending || isProcessing}
                      onClick={() => setConfirmAction({ type: 'maintenance_on', terminal })}
                    >
                      <Wrench className="w-3.5 h-3.5 mr-1" />
                      {t('playtelecom:tpvConfig.terminals.enterMaintenance', { defaultValue: 'Mantenimiento' })}
                    </Button>
                  )}

                  {/* More Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={isPending || isProcessing}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setConfirmAction({ type: 'restart', terminal })}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('playtelecom:tpvConfig.terminals.restart', { defaultValue: 'Reiniciar' })}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setConfirmAction({ type: 'clear_cache', terminal })}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('playtelecom:tpvConfig.terminals.clearCache', { defaultValue: 'Limpiar Cache' })}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmAction({ type: 'export_logs', terminal })}>
                        <FileText className="w-4 h-4 mr-2" />
                        {t('playtelecom:tpvConfig.terminals.exportLogs', { defaultValue: 'Exportar Datos' })}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('common:cancel', { defaultValue: 'Cancelar' })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {t('common:confirm', { defaultValue: 'Confirmar' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
