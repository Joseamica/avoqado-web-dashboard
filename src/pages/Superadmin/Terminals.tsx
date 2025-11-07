import React, { useState } from 'react'
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
import { formatDistanceToNow } from 'date-fns'

const Terminals: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
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
          title: '✅ Terminal Created',
          description: (
            <div className="space-y-2">
              <p><strong>Name:</strong> {data.terminal.name}</p>
              <p><strong>Serial:</strong> {data.terminal.serialNumber}</p>
              <p className="font-mono text-lg"><strong>Activation Code:</strong> {data.activationCode.activationCode}</p>
              <p className="text-xs text-muted-foreground">Code expires in 7 days</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(data.activationCode!.activationCode)
                  toast({ title: 'Copied!', description: 'Activation code copied to clipboard' })
                }}
              >
                <Copy className="w-3 h-3 mr-1" /> Copy Code
              </Button>
            </div>
          ),
          duration: 15000,
        })
      } else {
        toast({ title: 'Success', description: 'Terminal created successfully' })
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to create terminal'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => terminalAPI.updateTerminal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({ title: 'Success', description: 'Terminal updated successfully' })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to update terminal'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminalAPI.deleteTerminal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({ title: 'Success', description: 'Terminal deleted successfully' })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to delete terminal'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    },
  })

  const generateCodeMutation = useMutation({
    mutationFn: terminalAPI.generateActivationCode,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({
        title: '🔑 Activation Code Generated',
        description: (
          <div className="space-y-2">
            <p className="font-mono text-lg">{data.activationCode}</p>
            <p className="text-xs">Expires: {new Date(data.expiresAt).toLocaleDateString()}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(data.activationCode)
                toast({ title: 'Copied!', description: 'Code copied to clipboard' })
              }}
            >
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
          </div>
        ),
        duration: 10000,
      })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to generate code'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    },
  })

  const handleSave = async (data: any) => {
    if (selectedTerminal) {
      await updateMutation.mutateAsync({ id: selectedTerminal.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (terminal: Terminal) => {
    setSelectedTerminal(terminal)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedTerminal(null)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this terminal?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleGenerateCode = async (terminal: Terminal) => {
    await generateCodeMutation.mutateAsync(terminal.id)
  }

  const filteredTerminals = terminals.filter(t =>
    (t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (t.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (t.venue?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  )

  const columns: ColumnDef<Terminal>[] = [
    {
      accessorKey: 'name',
      header: 'Terminal',
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
      header: 'Venue',
      cell: ({ row }) => row.original.venue?.name || 'N/A',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const terminal = row.original
        const online = isTerminalOnline(terminal.lastHeartbeat)
        const isActive = terminal.status === 'ACTIVE'
        return (
          <div className="flex items-center gap-2">
            <Badge variant={isActive && online ? 'default' : 'secondary'}
                   className={isActive && online ? 'bg-green-500 hover:bg-green-600' : ''}>
              {isActive && online ? 'Online' : 'Offline'}
            </Badge>
            {terminal.status === 'RETIRED' && <Badge variant="destructive">Retired</Badge>}
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      accessorKey: 'assignedMerchantIds',
      header: 'Merchants',
      cell: ({ row }) => <span className="text-sm">{row.original.assignedMerchantIds?.length || 0} assigned</span>,
    },
    {
      accessorKey: 'lastHeartbeat',
      header: 'Last Seen',
      cell: ({ row }) => row.original.lastHeartbeat
        ? <span className="text-sm">{formatDistanceToNow(new Date(row.original.lastHeartbeat))} ago</span>
        : <span className="text-sm text-muted-foreground">Never</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
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
  ]

  const onlineCount = terminals.filter(t => isTerminalOnline(t.lastHeartbeat)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Terminals</h1>
          <p className="text-muted-foreground">Manage POS terminals, printers, and KDS devices</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Create Terminal
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
            <CardTitle className="text-sm font-medium">Total Terminals</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{terminals.length}</div>
            <p className="text-xs text-muted-foreground">{onlineCount} online</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Terminals</CardTitle>
          <CardDescription>Manage terminals across all venues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by name, serial, or venue..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-64">
              <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues.map(venue => (
                    <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
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
