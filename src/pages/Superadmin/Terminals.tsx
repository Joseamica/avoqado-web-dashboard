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
import { Smartphone, Plus, Pencil, Trash2, Key, Copy } from 'lucide-react'
import { terminalAPI, Terminal, isTerminalOnline } from '@/services/superadmin-terminals.service'
import { getAllVenues } from '@/services/superadmin.service'
import { useToast } from '@/hooks/use-toast'
import { TerminalDialog } from './components/TerminalDialog'
import { DateTime } from 'luxon'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'

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

  const { data: venues = [] } = useQuery({ queryKey: ['venues'], queryFn: getAllVenues })

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

  const handleSave = async (data: any) => {
    if (selectedTerminal) {
      await updateMutation.mutateAsync({ id: selectedTerminal.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = useCallback((terminal: Terminal) => {
    setSelectedTerminal(terminal)
    setDialogOpen(true)
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

  const filteredTerminals = useMemo(() => terminals.filter(terminal =>
    (terminal.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (terminal.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (terminal.venue?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
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
        return (
          <div className="flex items-center gap-2">
            <Badge variant={isActive && online ? 'default' : 'secondary'}
                   className={isActive && online ? 'bg-green-500 hover:bg-green-600' : ''}>
              {isActive && online ? t('status.online') : t('status.offline')}
            </Badge>
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
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(row.original)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleGenerateCode(row.original)}>
            <Key className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ], [t, venueTimezone, localeCode, handleEdit, handleDelete, handleGenerateCode])

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
              pagination={{ pageIndex: 0, pageSize: 10 }}
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
