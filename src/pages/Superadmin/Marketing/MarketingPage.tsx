/**
 * Marketing Page
 *
 * Campaign list with filters, bulk actions, and quick stats.
 * Per CLAUDE.md: Superadmin pages use hardcoded Spanish, no i18n.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import * as marketingService from '@/services/superadmin-marketing.service'
import type { CampaignStatus, MarketingCampaign } from '@/services/superadmin-marketing.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Mail,
  MailOpen,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

// Status configuration
const STATUS_CONFIG: Record<CampaignStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> =
  {
    DRAFT: { label: 'Borrador', variant: 'secondary', icon: FileText },
    SCHEDULED: { label: 'Programada', variant: 'outline', icon: Clock },
    SENDING: { label: 'Enviando', variant: 'default', icon: Send },
    COMPLETED: { label: 'Completada', variant: 'default', icon: CheckCircle2 },
    FAILED: { label: 'Fallida', variant: 'destructive', icon: XCircle },
    CANCELLED: { label: 'Cancelada', variant: 'outline', icon: X },
  }

function MarketingPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Filter states
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null)

  // Fetch campaigns
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['marketing-campaigns', statusFilter, searchQuery],
    queryFn: () =>
      marketingService.listCampaigns({
        status: statusFilter === 'all' ? undefined : [statusFilter],
        search: searchQuery || undefined,
      }),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingService.deleteCampaign(id),
    onSuccess: () => {
      toast({ title: 'Campaña eliminada', description: 'La campaña ha sido eliminada correctamente.' })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      setCampaignToDelete(null)
      setDeleteDialogOpen(false)
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar la campaña', variant: 'destructive' })
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => marketingService.bulkDeleteCampaigns({ ids }),
    onSuccess: count => {
      toast({ title: 'Campañas eliminadas', description: `${count} campaña(s) eliminada(s) correctamente.` })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      setSelectedIds(new Set())
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudieron eliminar las campañas', variant: 'destructive' })
    },
  })

  // Computed stats
  const stats = useMemo(() => {
    if (!data?.campaigns) return { total: 0, sending: 0, completed: 0, draft: 0 }
    return {
      total: data.total,
      sending: data.campaigns.filter(c => c.status === 'SENDING').length,
      completed: data.campaigns.filter(c => c.status === 'COMPLETED').length,
      draft: data.campaigns.filter(c => c.status === 'DRAFT').length,
    }
  }, [data])

  // Selection helpers
  const isAllSelected = data?.campaigns && data.campaigns.length > 0 && selectedIds.size === data.campaigns.length
  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data?.campaigns.map(c => c.id) || []))
    }
  }
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // Handle delete confirmation
  const handleDelete = (id: string) => {
    setCampaignToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete)
    }
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    bulkDeleteMutation.mutate(Array.from(selectedIds))
  }

  const getStatusBadge = (status: CampaignStatus) => {
    const config = STATUS_CONFIG[status]
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit rounded-full">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketing</h1>
          <p className="text-muted-foreground mt-2">Campañas de email masivo para venues y staff</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full cursor-pointer" onClick={() => navigate('/superadmin/marketing/templates')}>
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button className="rounded-full cursor-pointer" onClick={() => navigate('/superadmin/marketing/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Campaña
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campañas</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviando</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Borradores</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campañas</CardTitle>
              <CardDescription>Lista de todas las campañas de marketing</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="rounded-full cursor-pointer" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refrescar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o asunto..."
                  className="pl-10 rounded-full"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Tabs value={statusFilter} onValueChange={v => setStatusFilter(v as CampaignStatus | 'all')}>
              <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
                <TabsTrigger
                  value="all"
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
                >
                  Todas
                </TabsTrigger>
                <TabsTrigger
                  value="DRAFT"
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
                >
                  Borradores
                </TabsTrigger>
                <TabsTrigger
                  value="SENDING"
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
                >
                  Enviando
                </TabsTrigger>
                <TabsTrigger
                  value="COMPLETED"
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
                >
                  Completadas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center gap-4 p-3 bg-muted/50 rounded-2xl border border-border/50">
              <span className="text-sm font-medium">{selectedIds.size} seleccionada(s)</span>
              <Button variant="destructive" size="sm" className="rounded-full cursor-pointer" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
                {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Eliminar
              </Button>
              <Button variant="outline" size="sm" className="rounded-full cursor-pointer" onClick={() => setSelectedIds(new Set())}>
                Cancelar
              </Button>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.campaigns.length ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay campañas</p>
              <Button className="mt-4 rounded-full cursor-pointer" onClick={() => navigate('/superadmin/marketing/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera campaña
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Destinatarios</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MailOpen className="h-4 w-4" />
                      <span>Abiertos</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MousePointerClick className="h-4 w-4" />
                      <span>Clicks</span>
                    </div>
                  </TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.campaigns.map(campaign => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    isSelected={selectedIds.has(campaign.id)}
                    onToggleSelect={() => toggleSelection(campaign.id)}
                    onView={() => navigate(`/superadmin/marketing/${campaign.id}`)}
                    onEdit={() => navigate(`/superadmin/marketing/${campaign.id}/edit`)}
                    onDelete={() => handleDelete(campaign.id)}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La campaña y todos sus registros de envío serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full cursor-pointer">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Campaign Row Component
function CampaignRow({
  campaign,
  isSelected,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  getStatusBadge,
}: {
  campaign: MarketingCampaign
  isSelected: boolean
  onToggleSelect: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  getStatusBadge: (status: CampaignStatus) => React.ReactNode
}) {
  const openRate = campaign.totalRecipients > 0 ? ((campaign.openedCount / campaign.totalRecipients) * 100).toFixed(1) : '0'
  const clickRate = campaign.totalRecipients > 0 ? ((campaign.clickedCount / campaign.totalRecipients) * 100).toFixed(1) : '0'

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onView}>
      <TableCell onClick={e => e.stopPropagation()}>
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{campaign.name}</p>
          <p className="text-sm text-muted-foreground truncate max-w-[300px]">{campaign.subject}</p>
        </div>
      </TableCell>
      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
      <TableCell className="text-center">
        <div>
          <span className="font-medium">{campaign.sentCount}</span>
          <span className="text-muted-foreground">/{campaign.totalRecipients}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div>
          <span className="font-medium">{campaign.openedCount}</span>
          <span className="text-muted-foreground text-sm ml-1">({openRate}%)</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div>
          <span className="font-medium">{campaign.clickedCount}</span>
          <span className="text-muted-foreground text-sm ml-1">({clickRate}%)</span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {DateTime.fromISO(campaign.createdAt).toRelative({ locale: 'es' })}
      </TableCell>
      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-4 w-4 mr-2" />
              Ver detalles
            </DropdownMenuItem>
            {campaign.status === 'DRAFT' && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export default MarketingPage
