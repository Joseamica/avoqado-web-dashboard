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
import { Monitor, Lock, Unlock, Wrench, WrenchIcon, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { useToast } from '@/hooks/use-toast'
import { getTpvs, lockTerminal, unlockTerminal, enterMaintenanceMode, exitMaintenanceMode } from '@/services/tpv.service'
import { TerminalStatus, type Terminal } from '@/types'

type ConfirmAction = {
  type: 'lock' | 'unlock' | 'maintenance_on' | 'maintenance_off'
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
  return (terminal.config as any)?.locked === true || terminal.status === ('LOCKED' as TerminalStatus)
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

  const isPending = lockMutation.isPending || unlockMutation.isPending || maintenanceOnMutation.isPending || maintenanceOffMutation.isPending

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
    }
    setConfirmAction(null)
  }, [confirmAction, lockMutation, unlockMutation, maintenanceOnMutation, maintenanceOffMutation])

  const confirmTitle = useMemo(() => {
    if (!confirmAction) return ''
    const name = confirmAction.terminal.name
    switch (confirmAction.type) {
      case 'lock': return t('playtelecom:tpvConfig.terminals.confirmLock', { name, defaultValue: `Bloquear "${name}"?` })
      case 'unlock': return t('playtelecom:tpvConfig.terminals.confirmUnlock', { name, defaultValue: `Desbloquear "${name}"?` })
      case 'maintenance_on': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOn', { name, defaultValue: `Activar mantenimiento en "${name}"?` })
      case 'maintenance_off': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOff', { name, defaultValue: `Desactivar mantenimiento en "${name}"?` })
    }
  }, [confirmAction, t])

  const confirmDescription = useMemo(() => {
    if (!confirmAction) return ''
    switch (confirmAction.type) {
      case 'lock': return t('playtelecom:tpvConfig.terminals.confirmLockDesc', { defaultValue: 'La terminal quedara bloqueada hasta que se desbloquee manualmente.' })
      case 'unlock': return t('playtelecom:tpvConfig.terminals.confirmUnlockDesc', { defaultValue: 'La terminal volvera a estar operativa.' })
      case 'maintenance_on': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOnDesc', { defaultValue: 'La terminal entrara en modo mantenimiento y no podra procesar operaciones.' })
      case 'maintenance_off': return t('playtelecom:tpvConfig.terminals.confirmMaintenanceOffDesc', { defaultValue: 'La terminal saldra del modo mantenimiento y volvera a operar.' })
    }
  }, [confirmAction, t])

  if (isLoading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </GlassCard>
    )
  }

  if (terminals.length === 0) {
    return null
  }

  return (
    <>
      <GlassCard>
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
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

                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
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
