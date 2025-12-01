import { getTpvs, sendTpvCommand as sendTpvCommandApi, deleteTpv } from '@/services/tpv.service'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Wrench, Archive, CheckCircle2, AlertTriangle, XCircle, Package, KeyRound, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Terminal } from '@/types'
import { useTranslation } from 'react-i18next'
import { PermissionGate } from '@/components/PermissionGate'
import { TerminalPurchaseWizard } from './components/purchase-wizard/TerminalPurchaseWizard'
import { ActivateTerminalModal } from './components/ActivateTerminalModal'
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

export default function Tpvs() {
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [wizardOpen, setWizardOpen] = useState(false)
  const [activationModalOpen, setActivationModalOpen] = useState(false)
  const [selectedTerminalForActivation, setSelectedTerminalForActivation] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [terminalToDelete, setTerminalToDelete] = useState<{ id: string; name: string } | null>(null)

  // Helper function to get terminal status styling
  const getTerminalStatusStyle = (status: string, lastHeartbeat?: string | null) => {
    const now = new Date()
    const heartbeatTime = lastHeartbeat ? new Date(lastHeartbeat) : null
    const isOnline = heartbeatTime && (now.getTime() - heartbeatTime.getTime()) < 5 * 60 * 1000 // 5 minutes

    switch (status) {
      case 'PENDING_ACTIVATION':
        return {
          dotColor: 'bg-blue-500',
          label: t('tpv.status.pendingActivation', { defaultValue: 'Pendiente' }),
          isOnline: false
        }
      case 'ACTIVE':
        return {
          dotColor: isOnline ? 'bg-emerald-500' : 'bg-amber-500',
          label: isOnline
            ? t('tpv.status.online', { defaultValue: 'En línea' })
            : t('tpv.status.offline', { defaultValue: 'Sin conexión' }),
          isOnline
        }
      case 'INACTIVE':
        return {
          dotColor: 'bg-gray-400',
          label: t('tpv.status.inactive', { defaultValue: 'Inactivo' }),
          isOnline: false
        }
      case 'MAINTENANCE':
        return {
          dotColor: 'bg-orange-500',
          label: t('tpv.status.maintenance', { defaultValue: 'Mantenimiento' }),
          isOnline: true // Maintenance mode means connected
        }
      case 'RETIRED':
        return {
          dotColor: 'bg-red-500',
          label: t('tpv.status.retired', { defaultValue: 'Retirado' }),
          isOnline: false
        }
      default:
        return {
          dotColor: 'bg-gray-400',
          label: t('tpv.status.unknown', { defaultValue: 'Desconocido' }),
          isOnline: false
        }
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['tpvs', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: () => getTpvs(venueId, pagination),
  })

  const commandMutation = useMutation({
    mutationFn: ({ terminalId, command, payload }: { terminalId: string; command: string; payload?: any }) =>
      sendTpvCommandApi(terminalId, command, payload),
    onSuccess: (data, variables) => {
      const commandLabel = t(`tpv.commandLabels.${variables.command}`, { defaultValue: variables.command })
      toast({
        title: t('tpv.commands.sent', { defaultValue: 'Comando enviado' }),
        description: t('tpv.commands.sentSuccess', { command: commandLabel, defaultValue: `Comando ${commandLabel} enviado exitosamente` }),
        variant: "default",
      })
      // Refresh the TPV list to show updated status
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('tpv.commands.error', { defaultValue: 'Error' }),
        description: t('tpv.commands.sendError', { error: error.response?.data?.message || error.message, defaultValue: `Error enviando comando: ${error.response?.data?.message || error.message}` }),
        variant: "destructive",
      })
    }
  })

  const sendTpvCommand = useCallback((terminalId: string, command: string) => {
    const payload = command === 'MAINTENANCE_MODE'
      ? { message: t('tpv.commands.maintenancePayload', { defaultValue: 'Activado desde dashboard' }), duration: 0 }
      : undefined

    commandMutation.mutate({ terminalId, command, payload })
  }, [commandMutation, t])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (terminalId: string) => deleteTpv(venueId, terminalId),
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setTerminalToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      toast({
        title: t('tpv.messages.deleted', { defaultValue: 'Terminal eliminada' }),
        description: t('tpv.messages.deletedSuccess', { defaultValue: 'La terminal ha sido eliminada correctamente.' }),
      })
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message
      toast({
        title: t('common.error', { defaultValue: 'Error' }),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const totalTpvs = data?.meta?.total || 0

  const columns: ColumnDef<Terminal, unknown>[] = [
    {
      id: 'terminal',
      accessorKey: 'name',
      meta: { label: t('tpv.table.columns.name', { defaultValue: 'Terminal' }) },
      header: t('tpv.table.columns.name', { defaultValue: 'Terminal' }),
      cell: ({ row }) => {
        const terminal = row.original as any
        const statusStyle = getTerminalStatusStyle(terminal.status, terminal.lastHeartbeat)
        const isActivated = terminal.activatedAt != null

        return (
          <div className="flex items-center gap-3">
            {/* Status dot */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusStyle.dotColor}`} />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">{statusStyle.label}</p>
                {terminal.lastHeartbeat && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(terminal.lastHeartbeat).toLocaleString()}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Terminal info */}
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{terminal.name}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {terminal.serialNumber && (
                  <span className="font-mono truncate max-w-[140px]">
                    {terminal.serialNumber.startsWith('AVQD-')
                      ? terminal.serialNumber
                      : terminal.serialNumber.slice(0, 8)}
                  </span>
                )}
                {terminal.version && (
                  <span className="text-muted-foreground/60">v{terminal.version}</span>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'activation',
      accessorKey: 'activatedAt',
      meta: { label: t('tpv.table.columns.activation', { defaultValue: 'Activación' }) },
      header: t('tpv.table.columns.status', { defaultValue: 'Estado' }),
      cell: ({ row }) => {
        const terminal = row.original as any
        const isActivated = terminal.activatedAt != null

        if (isActivated) {
          return (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">{t('tpv.status.activated', { defaultValue: 'Activado' })}</span>
            </div>
          )
        }

        return (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Package className="w-4 h-4" />
            <span className="text-sm">{t('tpv.status.notActivated', { defaultValue: 'Sin activar' })}</span>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const terminal = row.original as any
        const statusStyle = getTerminalStatusStyle(terminal.status, terminal.lastHeartbeat)
        const isInMaintenance = terminal.status === 'MAINTENANCE'
        const isOnline = statusStyle.isOnline

        return (
          <div className="flex items-center justify-end gap-1">
            {/* Show Activate button if terminal is pending activation */}
            {terminal.status === 'PENDING_ACTIVATION' && (
              <PermissionGate permission="tpv:update">
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedTerminalForActivation(terminal.id)
                    setActivationModalOpen(true)
                  }}
                  className="h-7 px-2.5 text-xs"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1" />
                  {t('tpv.actions.activate', { defaultValue: 'Activar' })}
                </Button>
              </PermissionGate>
            )}

            {/* Only show command buttons if user has permission */}
            <PermissionGate permission="tpv:command">
              {isInMaintenance ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        sendTpvCommand(terminal.id, 'EXIT_MAINTENANCE')
                      }}
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tpv.actions.exit_maintenance', { defaultValue: 'Salir mantenimiento' })}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!isOnline}
                      onClick={(e) => {
                        e.stopPropagation()
                        sendTpvCommand(terminal.id, 'MAINTENANCE_MODE')
                      }}
                      className="h-7 w-7"
                    >
                      <Wrench className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isOnline
                      ? t('tpv.actions.maintenance', { defaultValue: 'Mantenimiento' })
                      : t('tpv.actions.offline', { defaultValue: 'Desconectado' })
                    }
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isOnline}
                    onClick={(e) => {
                      e.stopPropagation()
                      sendTpvCommand(terminal.id, 'UPDATE_STATUS')
                    }}
                    className="h-7 w-7"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isOnline
                    ? t('tpv.actions.update_status', { defaultValue: 'Actualizar' })
                    : t('tpv.actions.offline', { defaultValue: 'Desconectado' })
                  }
                </TooltipContent>
              </Tooltip>
            </PermissionGate>

            {/* Delete button - only for non-activated terminals */}
            {!terminal.activatedAt && (
              <PermissionGate permission="tpv:delete">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTerminalToDelete({ id: terminal.id, name: terminal.name })
                        setDeleteDialogOpen(true)
                      }}
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tpv.actions.delete', { defaultValue: 'Eliminar terminal' })}
                  </TooltipContent>
                </Tooltip>
              </PermissionGate>
            )}
          </div>
        )
      },
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, tpvs: any[]) => {
    if (!searchTerm) return tpvs

    const lowerSearchTerm = searchTerm.toLowerCase()

    return tpvs.filter(tpv => {
      const tpvIdMatch = tpv.id.toString().includes(lowerSearchTerm)
      const tpvNameMatch = tpv.name.toLowerCase().includes(lowerSearchTerm)
      const serialNumberMatch = tpv.serialNumber?.toLowerCase().includes(lowerSearchTerm)
      const versionMatch = tpv.version?.toLowerCase().includes(lowerSearchTerm)

      return tpvIdMatch || tpvNameMatch || serialNumberMatch || versionMatch
    })
  }, [])

  return (
    <TooltipProvider>
      <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">
            {t('tpv.title', { defaultValue: 'Terminales punto de venta' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('tpv.subtitle', { defaultValue: 'Gestiona los dispositivos TPV de tu restaurante' })}
          </p>
        </div>
        {/* Only show "Create" button if user has permission */}
        <PermissionGate permission="tpv:create">
          <Button onClick={() => setWizardOpen(true)}>
            <span>{t('tpv.actions.createNew', { defaultValue: 'Nuevo dispositivo' })}</span>
          </Button>
        </PermissionGate>
      </div>

      <DataTable
        data={data?.data || []}
        rowCount={totalTpvs}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('tpv.search.placeholder', { defaultValue: 'Buscar terminales...' })}
        onSearch={handleSearch}
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
        tableId="tpv:list"
        pagination={pagination}
        setPagination={setPagination}
      />

      <TerminalPurchaseWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          // Refresh the list
          queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
        }}
      />

      <ActivateTerminalModal
        open={activationModalOpen}
        onOpenChange={setActivationModalOpen}
        terminalId={selectedTerminalForActivation}
        onSuccess={() => {
          // Refresh the list
          queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
        }}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('tpv.delete.title', { defaultValue: '¿Eliminar terminal?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('tpv.delete.description', {
                name: terminalToDelete?.name,
                defaultValue: `Esta acción eliminará permanentemente la terminal "${terminalToDelete?.name}". Esta acción no se puede deshacer.`
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('common.cancel', { defaultValue: 'Cancelar' })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => terminalToDelete && deleteMutation.mutate(terminalToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t('common.deleting', { defaultValue: 'Eliminando...' })
                : t('common.delete', { defaultValue: 'Eliminar' })
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
