import { getTpvs, sendTpvCommand as sendTpvCommandApi } from '@/services/tpv.service'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Wrench, Archive, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Terminal } from '@/types'
import { useTranslation } from 'react-i18next'

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

  // Helper function to get terminal status styling
  const getTerminalStatusStyle = (status: string, lastHeartbeat?: string | null) => {
    const now = new Date()
    const heartbeatTime = lastHeartbeat ? new Date(lastHeartbeat) : null
    const isOnline = heartbeatTime && (now.getTime() - heartbeatTime.getTime()) < 5 * 60 * 1000 // 5 minutes

    switch (status) {
      case 'ACTIVE':
        return {
          badge: isOnline 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
          icon: isOnline ? CheckCircle2 : AlertTriangle,
          label: isOnline 
            ? t('tpv.status.online', { defaultValue: 'En línea' })
            : t('tpv.status.offline', { defaultValue: 'Sin conexión' }),
          color: isOnline ? 'text-emerald-600' : 'text-amber-600'
        }
      case 'INACTIVE':
        return {
          badge: 'bg-muted text-muted-foreground border border-border hover:bg-muted/80',
          icon: XCircle,
          label: t('tpv.status.inactive', { defaultValue: 'Inactivo' }),
          color: 'text-muted-foreground'
        }
      case 'MAINTENANCE':
        return {
          badge: 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100',
          icon: Wrench,
          label: t('tpv.status.maintenance', { defaultValue: 'Mantenimiento' }),
          color: 'text-orange-600'
        }
      case 'RETIRED':
        return {
          badge: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
          icon: Archive,
          label: t('tpv.status.retired', { defaultValue: 'Retirado' }),
          color: 'text-red-600'
        }
      default:
        return {
          badge: 'bg-muted text-muted-foreground border border-border',
          icon: XCircle,
          label: t('tpv.status.unknown', { defaultValue: 'Desconocido' }),
          color: 'text-muted-foreground'
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

  const totalTpvs = data?.meta?.total || 0

  const columns: ColumnDef<Terminal, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: t('tpv.table.columns.name', { defaultValue: 'Nombre' }) },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('tpv.table.columns.name', { defaultValue: 'Nombre' })}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ cell }) => <span className="font-medium">{cell.getValue() as string}</span>,
    },
    {
      id: 'status',
      accessorKey: 'status',
      sortDescFirst: true,
      meta: { label: t('tpv.table.columns.status', { defaultValue: 'Estado' }) },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('tpv.table.columns.status', { defaultValue: 'Estado' })}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => {
        const terminal = row.original as any
        const statusStyle = getTerminalStatusStyle(terminal.status, terminal.lastHeartbeat)
        const StatusIcon = statusStyle.icon
        
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <Badge variant="outline" className={statusStyle.badge}>
                  <StatusIcon className={`w-3 h-3 mr-1 ${statusStyle.color}`} />
                  {statusStyle.label}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-medium">{statusStyle.label}</p>
                {terminal.lastHeartbeat && (
                  <p className="text-muted-foreground">
                    {t('tpv.status.lastSeen', { defaultValue: 'Visto por última vez' })}: {new Date(terminal.lastHeartbeat).toLocaleString()}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      id: 'serialNumber',
      accessorKey: 'serialNumber',
      sortDescFirst: true,
      meta: { label: t('tpv.table.columns.serial', { defaultValue: 'Número de serie' }) },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('tpv.table.columns.serial', { defaultValue: 'Número de serie' })}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ cell }) => <span className="font-mono text-sm">{cell.getValue() as string}</span>,
    },
    {
      id: 'version',
      accessorKey: 'version',
      sortDescFirst: true,
      meta: { label: t('tpv.table.columns.version', { defaultValue: 'Versión' }) },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('tpv.table.columns.version', { defaultValue: 'Versión' })}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ cell }) => {
        const version = cell.getValue() as string
        return version ? (
          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
            v{version}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            {t('tpv.table.noVersion', { defaultValue: 'No especificada' })}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: () => (
        <span className="text-sm font-medium">
          {t('tpv.table.columns.actions', { defaultValue: 'Acciones' })}
        </span>
      ),
      cell: ({ row }) => {
        const terminal = row.original as any
        const statusStyle = getTerminalStatusStyle(terminal.status, terminal.lastHeartbeat)
        const isOnline = statusStyle.label === t('tpv.status.online', { defaultValue: 'En línea' })
        const isInMaintenance = terminal.status === 'MAINTENANCE'
        
        return (
          <div className="flex items-center space-x-2">
            {isInMaintenance ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      sendTpvCommand(terminal.id, 'EXIT_MAINTENANCE')
                    }}
                    className="h-8 px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    {t('tpv.actions.exitMaintenance', { defaultValue: 'Salir Mantenimiento' })}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {t('tpv.actions.exit_maintenance', { defaultValue: 'Salir del modo mantenimiento' })}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isOnline}
                    onClick={(e) => {
                      e.stopPropagation()
                      sendTpvCommand(terminal.id, 'MAINTENANCE_MODE')
                    }}
                    className="h-8 px-3"
                  >
                    <Wrench className="w-4 h-4 mr-1" />
                    {t('tpv.actions.maintenanceMode', { defaultValue: 'Mantenimiento' })}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isOnline 
                      ? t('tpv.actions.maintenance', { defaultValue: 'Poner en modo mantenimiento' })
                      : t('tpv.actions.offline', { defaultValue: 'Terminal desconectado' })
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isOnline}
                  onClick={(e) => {
                    e.stopPropagation()
                    sendTpvCommand(terminal.id, 'UPDATE_STATUS')
                  }}
                  className="h-8 px-3"
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {t('tpv.actions.update', { defaultValue: 'Actualizar' })}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isOnline 
                    ? t('tpv.actions.update_status', { defaultValue: 'Forzar actualización de estado' })
                    : t('tpv.actions.offline', { defaultValue: 'Terminal desconectado' })
                  }
                </p>
              </TooltipContent>
            </Tooltip>
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
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>{t('tpv.actions.createNew', { defaultValue: 'Nuevo dispositivo' })}</span>
          </Link>
        </Button>
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
      </div>
    </TooltipProvider>
  )
}
