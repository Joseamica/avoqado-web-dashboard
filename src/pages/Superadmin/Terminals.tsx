import React, { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { Smartphone, Plus, Pencil, Trash2, Key, Copy, Zap, ArrowRightLeft } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { terminalAPI, Terminal, isTerminalOnline } from '@/services/superadmin-terminals.service'
import { getAllVenues } from '@/services/superadmin.service'
import { useToast } from '@/hooks/use-toast'
import { TerminalDialog } from './components/TerminalDialog'
import MigrateTerminalWizard from './components/MigrateTerminalWizard'
import { DateTime } from 'luxon'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { includesNormalized } from '@/lib/utils'

const Terminals: React.FC = () => {
  const { t, i18n } = useTranslation('terminals')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { venueTimezone, formatDate } = useVenueDateTime()
  const localeCode = getIntlLocale(i18n.language)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null)
  const [migrateOpen, setMigrateOpen] = useState(false)
  const [migrateTerminal, setMigrateTerminal] = useState<Terminal | null>(null)

  /**
   * Task 15 — brand-change warning dialog state.
   *
   * Triggered when the backend rejects a Terminal.brand mutation that would
   * orphan currently-assigned merchants (HTTP 409,
   * code=TERMINAL_BRAND_CHANGE_BLOCKED). We stash the pending payload here
   * so "Continuar y desasignar" can re-issue the PATCH with
   * `forceUnassign: true`, atomically pruning the incompatible merchants
   * alongside the brand change.
   */
  const [brandChangeBlocked, setBrandChangeBlocked] = useState<{
    terminalId: string
    pendingData: any
    incompatibleMerchants: Array<{ id: string; name: string; code: string }>
  } | null>(null)

  const { data: venues = [] } = useQuery({ queryKey: ['venues'], queryFn: () => getAllVenues() })

  const { data: terminals = [], isLoading } = useQuery({
    queryKey: ['terminals', selectedVenueId],
    queryFn: async () => {
      if (selectedVenueId === 'all') {
        return terminalAPI.getAllTerminals()
      } else {
        return terminalAPI.getAllTerminals({ venueId: selectedVenueId })
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: terminalAPI.createTerminal,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })

      if (data.activationCode) {
        toast({
          title: `✅ ${t('toast.created')}`,
          description: (
            <div className="space-y-2">
              <p><strong>{t('dialog.name')}:</strong> {data.terminal.name}</p>
              <p><strong>{t('dialog.serialNumber')}:</strong> {data.terminal.serialNumber}</p>
              <p className="font-mono text-lg"><strong>{t('activationCode.title')}:</strong> {data.activationCode.activationCode}</p>
              <p className="text-xs text-muted-foreground">{t('activationCode.expiresIn7Days')}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(data.activationCode!.activationCode)
                  toast({ title: t('toast.copied'), description: t('toast.copiedDesc') })
                }}
              >
                <Copy className="w-3 h-3 mr-1" /> {t('activationCode.copyCode')}
              </Button>
            </div>
          ),
          duration: 15000,
        })
      } else {
        toast({ title: t('toast.updated'), description: t('toast.createdDesc') })
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || t('toast.createFailed')
      toast({ title: t('toast.error'), description: message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => terminalAPI.updateTerminal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({ title: t('toast.updated'), description: t('toast.updatedDesc') })
    },
    onError: (error: any) => {
      // Task 15 — TERMINAL_BRAND_CHANGE_BLOCKED is handled by handleSave
      // (opens the warning dialog instead of a generic error toast).
      if (error.response?.data?.code === 'TERMINAL_BRAND_CHANGE_BLOCKED') return
      const message = error.response?.data?.message || error.message || t('toast.updateFailed')
      toast({ title: t('toast.error'), description: message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminalAPI.deleteTerminal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({ title: t('toast.deleted'), description: t('toast.deletedDesc') })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || t('toast.deleteFailed')
      toast({ title: t('toast.error'), description: message, variant: 'destructive' })
    },
  })

  const generateCodeMutation = useMutation({
    mutationFn: terminalAPI.generateActivationCode,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({
        title: `🔑 ${t('toast.codeGenerated')}`,
        description: (
          <div className="space-y-2">
            <p className="font-mono text-lg">{data.activationCode}</p>
            <p className="text-xs">{t('activationCode.expires')}: {formatDate(data.expiresAt)}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(data.activationCode)
                toast({ title: t('toast.copied'), description: t('toast.copiedDesc') })
              }}
            >
              <Copy className="w-3 h-3 mr-1" /> {t('activationCode.copy')}
            </Button>
          </div>
        ),
        duration: 10000,
      })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || t('toast.codeFailed')
      toast({ title: t('toast.error'), description: message, variant: 'destructive' })
    },
  })

  const remoteActivateMutation = useMutation({
    mutationFn: terminalAPI.sendRemoteActivation,
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({
        title: `⚡ ${t('toast.remoteActivateSent')}`,
        description: t('toast.remoteActivateSentDesc'),
        duration: 5000,
      })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || t('toast.remoteActivateFailed')
      toast({ title: t('toast.error'), description: message, variant: 'destructive' })
    },
  })

  const handleSave = async (data: any) => {
    if (selectedTerminal) {
      try {
        await updateMutation.mutateAsync({ id: selectedTerminal.id, data })
      } catch (err: any) {
        // Task 15 — backend Task 12 returns HTTP 409 + code
        // `TERMINAL_BRAND_CHANGE_BLOCKED` when changing brand would orphan
        // currently-assigned merchants. We stash the pending payload + the
        // incompatible-merchants list, then open the warning dialog. On
        // confirm, we re-issue the PATCH with `forceUnassign: true`.
        if (err?.response?.data?.code === 'TERMINAL_BRAND_CHANGE_BLOCKED') {
          const incompatible = err.response.data.details?.incompatibleMerchants ?? []
          setBrandChangeBlocked({
            terminalId: selectedTerminal.id,
            pendingData: data,
            incompatibleMerchants: incompatible,
          })
          // Swallow — the dialog drives the next step. Do NOT re-throw or
          // TerminalDialog's catch will toast a duplicate error.
          return
        }
        // Other errors: let TerminalDialog show its toast as before.
        throw err
      }
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  /**
   * Operator confirmed they want to unassign the incompatible merchants
   * and proceed with the brand change. Re-issue the PATCH with
   * `forceUnassign: true` — the backend prunes the incompatible merchants
   * atomically with the brand change.
   */
  const confirmBrandChange = async () => {
    if (!brandChangeBlocked) return
    const { terminalId, pendingData } = brandChangeBlocked
    setBrandChangeBlocked(null)
    try {
      await updateMutation.mutateAsync({
        id: terminalId,
        data: { ...pendingData, forceUnassign: true },
      })
      setDialogOpen(false)
    } catch {
      // updateMutation.onError already toasts.
    }
  }

  const handleEdit = useCallback((terminal: Terminal) => {
    setSelectedTerminal(terminal)
    setDialogOpen(true)
  }, [])

  const handleMigrate = useCallback((terminal: Terminal) => {
    setMigrateTerminal(terminal)
    setMigrateOpen(true)
  }, [])

  const handleAdd = useCallback(() => {
    setSelectedTerminal(null)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (confirm(t('confirm.delete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }, [t, deleteMutation])

  const handleGenerateCode = useCallback(async (terminal: Terminal) => {
    await generateCodeMutation.mutateAsync(terminal.id)
  }, [generateCodeMutation])

  const handleRemoteActivate = useCallback(async (terminal: Terminal) => {
    if (confirm(t('confirm.remoteActivate'))) {
      await remoteActivateMutation.mutateAsync(terminal.id)
    }
  }, [remoteActivateMutation, t])

  // Helper to check if terminal can be remotely activated
  const canRemoteActivate = useCallback((terminal: Terminal) => {
    return !terminal.activatedAt && terminal.serialNumber && terminal.lastHeartbeat
  }, [])

  const filteredTerminals = useMemo(() => terminals.filter(terminal =>
    includesNormalized(terminal.name ?? '', searchTerm) ||
    includesNormalized(terminal.serialNumber ?? '', searchTerm) ||
    includesNormalized(terminal.venue?.name ?? '', searchTerm)
  ), [terminals, searchTerm])

  const columns: ColumnDef<Terminal>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: t('columns.terminal'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-muted">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-muted-foreground font-mono">{row.original.serialNumber}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'venue.name',
      header: t('columns.venue'),
      cell: ({ row }) => row.original.venue?.name || 'N/A',
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => {
        const terminal = row.original
        const online = isTerminalOnline(terminal.lastHeartbeat)
        const isActive = terminal.status === 'ACTIVE'
        const isPreregistered = !terminal.activatedAt && terminal.serialNumber && terminal.lastHeartbeat
        const isPending = !terminal.activatedAt && !terminal.lastHeartbeat
        return (
          <div className="flex items-center gap-2">
            {isPreregistered ? (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/20">
                {t('status.preregistered')}
              </Badge>
            ) : isPending ? (
              <Badge variant="secondary">
                {t('status.pendingActivation')}
              </Badge>
            ) : (
              <Badge variant={isActive && online ? 'default' : 'secondary'}
                     className={isActive && online ? 'bg-green-500 hover:bg-green-600' : ''}>
                {isActive && online ? t('status.online') : t('status.offline')}
              </Badge>
            )}
            {terminal.status === 'RETIRED' && <Badge variant="destructive">{t('status.retired')}</Badge>}
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: t('columns.type'),
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      accessorKey: 'assignedMerchantIds',
      header: t('columns.merchants'),
      cell: ({ row }) => <span className="text-sm">{row.original.assignedMerchantIds?.length || 0} {t('assigned')}</span>,
    },
    {
      accessorKey: 'lastHeartbeat',
      header: t('columns.lastSeen'),
      cell: ({ row }) => row.original.lastHeartbeat
        ? <span className="text-sm">{DateTime.fromISO(row.original.lastHeartbeat, { zone: 'utc' }).setZone(venueTimezone).setLocale(localeCode).toRelative()}</span>
        : <span className="text-sm text-muted-foreground">{t('never')}</span>,
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      cell: ({ row }) => {
        const terminal = row.original
        const canActivate = canRemoteActivate(terminal)
        return (
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => handleEdit(terminal)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => handleMigrate(terminal)}>
                    <ArrowRightLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Migrar a otro venue</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => handleGenerateCode(terminal)}>
                    <Key className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('activationCode.title')}</TooltipContent>
              </Tooltip>
              {/* Remote Activate - Only show for pre-registered terminals */}
              {!terminal.activatedAt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={canActivate ? 'cursor-pointer text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'cursor-not-allowed opacity-50'}
                      onClick={() => canActivate && handleRemoteActivate(terminal)}
                      disabled={!canActivate}
                    >
                      <Zap className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canActivate ? t('remoteActivate.tooltip') : t('remoteActivate.tooltipDisabled')}
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => handleDelete(terminal.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Eliminar</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )
      },
    },
  ], [t, venueTimezone, localeCode, handleEdit, handleMigrate, handleDelete, handleGenerateCode, handleRemoteActivate, canRemoteActivate])

  const onlineCount = terminals.filter(t => isTerminalOnline(t.lastHeartbeat)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t('createTerminal')}
        </Button>
      </div>

      <TerminalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        terminal={selectedTerminal}
        onSave={handleSave}
      />

      <MigrateTerminalWizard open={migrateOpen} onOpenChange={setMigrateOpen} terminal={migrateTerminal} />

      {/* Task 15 — brand-change warning. Fired by handleSave's 409 catch. */}
      <AlertDialog
        open={brandChangeBlocked !== null}
        onOpenChange={(open) => {
          if (!open) setBrandChangeBlocked(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estos merchants quedarán sin asignar</AlertDialogTitle>
            <AlertDialogDescription>
              Cambiar la marca del terminal desasignará a los siguientes comercios porque su procesador no es compatible con la nueva marca:
            </AlertDialogDescription>
          </AlertDialogHeader>
          {brandChangeBlocked && brandChangeBlocked.incompatibleMerchants.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              {brandChangeBlocked.incompatibleMerchants.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">({m.code})</span>
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBrandChangeBlocked(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBrandChange}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continuar y desasignar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalTerminals')}</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{terminals.length}</div>
            <p className="text-xs text-muted-foreground">{onlineCount} {t('online')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('allTerminals')}</CardTitle>
          <CardDescription>{t('allTerminalsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-64">
              <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('filterByVenue')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allVenues')}</SelectItem>
                  {venues.map(venue => (
                    <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredTerminals}
              pagination={{ pageIndex: 0, pageSize: 20 }}
              setPagination={() => {}}
              rowCount={filteredTerminals.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Terminals
