import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { superadminAPI } from '@/services/superadmin.service'
import { getOrganizationsList, type OrganizationSimple } from '@/services/superadmin-organizations.service'
import { SubscriptionPlan, VenueStatus, type SuperadminVenue } from '@/types/superadmin'
import { Currency } from '@/utils/currency'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpDown,
  Ban,
  BadgeCheck,
  Building2,
  CheckCircle,
  Clock,
  Crown,
  DollarSign,
  FileText,
  Package,
  Search,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VenueModuleManagementDialog from './components/VenueModuleManagementDialog'
import { cn } from '@/lib/utils'

// ============================================================================
// MODERN UI COMPONENTS (2025/2026 Design System)
// ============================================================================

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
)

interface StatusPulseProps {
  status: 'success' | 'warning' | 'error' | 'neutral' | 'info'
}

const StatusPulse: React.FC<StatusPulseProps> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted',
    info: 'bg-blue-500',
  }
  return (
    <span className="relative flex h-3 w-3">
      <span
        className={cn(
          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
          colors[status]
        )}
      />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subtitle?: string
  gradient: string
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, subtitle, gradient }) => (
  <GlassCard className="p-5">
    <div className="flex items-start justify-between">
      <div className={cn('p-2.5 rounded-xl bg-gradient-to-br', gradient)}>{icon}</div>
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
    </div>
  </GlassCard>
)

// ============================================================================
// VENUE STATUS HELPERS
// ============================================================================

const STATUS_CONFIG: Record<
  VenueStatus,
  { label: string; pulseStatus: StatusPulseProps['status']; badgeClass: string }
> = {
  [VenueStatus.LIVE_DEMO]: {
    label: 'Demo en Vivo',
    pulseStatus: 'info',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
  [VenueStatus.ACTIVE]: {
    label: 'Activo',
    pulseStatus: 'success',
    badgeClass: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  [VenueStatus.ONBOARDING]: {
    label: 'Onboarding',
    pulseStatus: 'info',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  [VenueStatus.TRIAL]: {
    label: 'Prueba',
    pulseStatus: 'info',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  [VenueStatus.PENDING_ACTIVATION]: {
    label: 'Pendiente',
    pulseStatus: 'warning',
    badgeClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  [VenueStatus.SUSPENDED]: {
    label: 'Suspendido',
    pulseStatus: 'error',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  [VenueStatus.ADMIN_SUSPENDED]: {
    label: 'Suspendido (Admin)',
    pulseStatus: 'error',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  [VenueStatus.CLOSED]: {
    label: 'Cerrado',
    pulseStatus: 'neutral',
    badgeClass: 'bg-muted/10 text-muted-foreground border-muted/20',
  },
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  [VenueStatus.ONBOARDING]: [VenueStatus.PENDING_ACTIVATION, VenueStatus.ACTIVE, VenueStatus.TRIAL],
  [VenueStatus.TRIAL]: [VenueStatus.ACTIVE, VenueStatus.SUSPENDED, VenueStatus.CLOSED],
  [VenueStatus.PENDING_ACTIVATION]: [VenueStatus.ACTIVE],
  [VenueStatus.ACTIVE]: [VenueStatus.SUSPENDED, VenueStatus.ADMIN_SUSPENDED, VenueStatus.CLOSED],
  [VenueStatus.SUSPENDED]: [VenueStatus.ACTIVE],
  [VenueStatus.ADMIN_SUSPENDED]: [VenueStatus.ACTIVE],
  [VenueStatus.CLOSED]: [VenueStatus.ACTIVE],
}

const PLAN_CONFIG: Record<SubscriptionPlan, { label: string; icon: React.ReactNode; gradient: string }> = {
  [SubscriptionPlan.STARTER]: {
    label: 'Starter',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    gradient: 'from-green-500/20 to-green-500/5',
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    label: 'Professional',
    icon: <Zap className="w-3.5 h-3.5" />,
    gradient: 'from-blue-500/20 to-blue-500/5',
  },
  [SubscriptionPlan.ENTERPRISE]: {
    label: 'Enterprise',
    icon: <Crown className="w-3.5 h-3.5" />,
    gradient: 'from-amber-500/20 to-amber-500/5',
  },
  [SubscriptionPlan.CUSTOM]: {
    label: 'Personalizado',
    icon: <BadgeCheck className="w-3.5 h-3.5" />,
    gradient: 'from-purple-500/20 to-purple-500/5',
  },
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PAID: {
    label: 'Pagado',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-600 dark:text-green-400',
  },
  PENDING: {
    label: 'Pendiente',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  OVERDUE: {
    label: 'Vencido',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-red-600 dark:text-red-400',
  },
}

// ============================================================================
// VENUE LIST ITEM COMPONENT (compact for sidebar)
// ============================================================================

interface VenueListItemProps {
  venue: SuperadminVenue
  isSelected: boolean
  onClick: () => void
}

const VenueListItem: React.FC<VenueListItemProps> = ({ venue, isSelected, onClick }) => {
  const statusConfig = STATUS_CONFIG[venue.status]
  const hasKYCPending = venue.kycStatus === 'PENDING_REVIEW' || venue.kycStatus === 'IN_REVIEW'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 rounded-xl transition-all duration-200 border',
        'hover:bg-muted/50',
        isSelected
          ? 'border-emerald-500/50 bg-emerald-500/5 shadow-sm'
          : 'border-transparent'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 shrink-0 mt-0.5">
          <Building2 className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">{venue.name}</span>
            {hasKYCPending && (
              <AlertCircle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
            )}
            <div className="ml-auto shrink-0">
              <StatusPulse status={statusConfig.pulseStatus} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{venue.owner.email}</p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-muted-foreground/70 truncate">{venue.organization.name}</span>
            <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2">
              {Currency(venue.monthlyRevenue)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VenueManagement: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['superadmin-venues'],
    queryFn: superadminAPI.getAllVenues,
  })

  const { data: organizations = [] } = useQuery<OrganizationSimple[]>({
    queryKey: ['superadmin-organizations-list'],
    queryFn: getOrganizationsList,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false)
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [targetOrgId, setTargetOrgId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<string>('')

  // Filter venues
  const filteredVenues = useMemo(() => {
    return venues.filter(venue => {
      const matchesSearch =
        venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        venue.owner.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        venue.organization.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || venue.status === statusFilter
      const matchesOrg = orgFilter === 'all' || venue.organizationId === orgFilter
      return matchesSearch && matchesStatus && matchesOrg
    })
  }, [venues, searchTerm, statusFilter, orgFilter])

  // Resolve selected venue from filteredVenues
  const selectedVenue = useMemo(() => {
    if (!selectedVenueId) return null
    return filteredVenues.find(v => v.id === selectedVenueId) ?? null
  }, [filteredVenues, selectedVenueId])

  // Auto-select first venue when list changes and current selection is not visible
  useEffect(() => {
    if (filteredVenues.length > 0 && !selectedVenue) {
      setSelectedVenueId(filteredVenues[0].id)
    }
  }, [filteredVenues, selectedVenue])

  // Calculate stats
  const stats = useMemo(() => {
    const totalRevenue = venues.reduce((sum, venue) => sum + venue.monthlyRevenue, 0)
    const totalCommission = venues.reduce(
      (sum, venue) => sum + (venue.monthlyRevenue * venue.commissionRate) / 100,
      0
    )
    const pendingApprovals = venues.filter(
      v => v.status === VenueStatus.PENDING_ACTIVATION
    ).length
    const activeVenues = venues.filter(v => v.status === VenueStatus.ACTIVE).length
    const avgRevenue = activeVenues > 0 ? totalRevenue / activeVenues : 0
    return { totalRevenue, totalCommission, pendingApprovals, activeVenues, avgRevenue }
  }, [venues])

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (venueId: string) => superadminAPI.approveVenue(venueId, reason || undefined),
    onSuccess: () => {
      toast({
        title: 'Venue aprobado',
        description: `${selectedVenue?.name} ha sido aprobado exitosamente.`,
      })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsApprovalDialogOpen(false)
      setReason('')
    },
    onError: (error: any) => {
      toast({
        title: 'Error al aprobar',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (venueId: string) =>
      superadminAPI.suspendVenue(venueId, reason || 'Suspendido por administrador'),
    onSuccess: () => {
      toast({
        title: 'Venue suspendido',
        description: `${selectedVenue?.name} ha sido suspendido.`,
      })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsSuspendDialogOpen(false)
      setReason('')
    },
    onError: (error: any) => {
      toast({
        title: 'Error al suspender',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const transferMutation = useMutation({
    mutationFn: ({ venueId, targetOrganizationId }: { venueId: string; targetOrganizationId: string }) =>
      superadminAPI.transferVenue(venueId, targetOrganizationId),
    onSuccess: (data) => {
      toast({
        title: 'Venue transferido',
        description: data.message,
      })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsTransferDialogOpen(false)
      setTargetOrgId('')
    },
    onError: (error: any) => {
      toast({
        title: 'Error al transferir',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  const changeStatusMutation = useMutation({
    mutationFn: ({ venueId, status, reason }: { venueId: string; status: string; reason?: string }) =>
      superadminAPI.changeVenueStatus(venueId, status, reason),
    onSuccess: () => {
      toast({
        title: 'Estado actualizado',
        description: `${selectedVenue?.name} ahora tiene estado ${STATUS_CONFIG[newStatus as VenueStatus]?.label || newStatus}.`,
      })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsStatusDialogOpen(false)
      setNewStatus('')
      setReason('')
    },
    onError: (error: any) => {
      toast({
        title: 'Error al cambiar estado',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  // Derived state for action visibility
  const hasKYCPending = selectedVenue
    ? selectedVenue.kycStatus === 'PENDING_REVIEW' || selectedVenue.kycStatus === 'IN_REVIEW'
    : false
  const canApprove = selectedVenue?.status === VenueStatus.PENDING_ACTIVATION
  const canSuspend = selectedVenue?.status === VenueStatus.ACTIVE

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Venues</h1>
          <p className="text-muted-foreground mt-1">
            Administra y supervisa todos los venues de la plataforma
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />}
          label="Ingresos Totales"
          value={Currency(stats.totalRevenue)}
          subtitle={`Comisión: ${Currency(stats.totalCommission)}`}
          gradient="from-green-500/20 to-green-500/5"
        />
        <MetricCard
          icon={<Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          label="Venues Activos"
          value={stats.activeVenues}
          subtitle={`${venues.length} venues totales`}
          gradient="from-blue-500/20 to-blue-500/5"
        />
        <MetricCard
          icon={<Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />}
          label="Pendientes de Aprobación"
          value={stats.pendingApprovals}
          subtitle="Requieren acción"
          gradient="from-yellow-500/20 to-yellow-500/5"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
          label="Ingreso Promedio"
          value={Currency(stats.avgRevenue)}
          subtitle="Por venue activo"
          gradient="from-purple-500/20 to-purple-500/5"
        />
      </div>

      {/* Master-Detail Layout */}
      <GlassCard className="overflow-hidden">
        <div className="flex" style={{ height: 'calc(100vh - 340px)', minHeight: '500px' }}>
          {/* Left Panel — Venue List */}
          <div className="w-80 shrink-0 border-r border-border/50 flex flex-col">
            {/* Search & Filters */}
            <div className="p-4 space-y-3 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar venue..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background cursor-text h-9 text-sm"
                />
              </div>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="bg-background cursor-pointer h-9 text-sm">
                  <SelectValue placeholder="Organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">
                    Todas las organizaciones
                  </SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id} className="cursor-pointer">
                      {org.name} ({org.venueCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background cursor-pointer h-9 text-sm">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">
                    Todos los estados
                  </SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <SelectItem key={status} value={status} className="cursor-pointer">
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {filteredVenues.length} de {venues.length} venues
              </p>
            </div>

            {/* Venue List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2">Cargando...</p>
                  </div>
                </div>
              ) : filteredVenues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="p-2.5 rounded-full bg-muted/50 mb-2">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Sin resultados</p>
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 cursor-pointer text-xs h-7"
                      onClick={() => setSearchTerm('')}
                    >
                      Limpiar búsqueda
                    </Button>
                  )}
                </div>
              ) : (
                filteredVenues.map(venue => (
                  <VenueListItem
                    key={venue.id}
                    venue={venue}
                    isSelected={selectedVenueId === venue.id}
                    onClick={() => setSelectedVenueId(venue.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Panel — Detail View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedVenue ? (
              <>
                {/* Detail Header */}
                <div className="px-6 py-4 border-b border-border/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold truncate">{selectedVenue.name}</h2>
                          {(() => {
                            const sc = STATUS_CONFIG[selectedVenue.status]
                            return (
                              <div
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                                  sc.badgeClass
                                )}
                              >
                                <StatusPulse status={sc.pulseStatus} />
                                {sc.label}
                              </div>
                            )
                          })()}
                          {(() => {
                            const pc = PLAN_CONFIG[selectedVenue.subscriptionPlan] || {
                              label: selectedVenue.subscriptionPlan || 'Desconocido',
                              icon: <Store className="w-3.5 h-3.5" />,
                              gradient: 'from-gray-500/20 to-gray-500/5',
                            }
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground">
                                <div className={cn('p-0.5 rounded', pc.gradient)}>{pc.icon}</div>
                                {pc.label}
                              </div>
                            )
                          })()}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {selectedVenue.organization.name} &middot; {selectedVenue.owner.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {hasKYCPending && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="cursor-pointer h-8 text-xs gap-1.5"
                              onClick={() => navigate(`/superadmin/kyc/${selectedVenue.id}`)}
                            >
                              <FileText className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                              Revisar KYC
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>KYC pendiente de revisión</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer h-8 text-xs gap-1.5"
                      onClick={() => {
                        setIsModuleDialogOpen(true)
                      }}
                    >
                      <Package className="w-3.5 h-3.5" />
                      Módulos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer h-8 text-xs gap-1.5"
                      onClick={() => {
                        setNewStatus('')
                        setReason('')
                        setIsStatusDialogOpen(true)
                      }}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Cambiar Estado
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer h-8 text-xs gap-1.5"
                      onClick={() => {
                        setTargetOrgId('')
                        setIsTransferDialogOpen(true)
                      }}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Transferir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer h-8 text-xs gap-1.5"
                      onClick={() => navigate(`/admin/venues/${selectedVenue.id}`)}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Features
                    </Button>
                    {canApprove && (
                      <Button
                        size="sm"
                        className="cursor-pointer h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-green-50"
                        onClick={() => {
                          setReason('')
                          setIsApprovalDialogOpen(true)
                        }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Aprobar
                      </Button>
                    )}
                    {canSuspend && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="cursor-pointer h-8 text-xs gap-1.5"
                        onClick={() => {
                          setReason('')
                          setIsSuspendDialogOpen(true)
                        }}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Suspender
                      </Button>
                    )}
                  </div>
                </div>

                {/* Detail Content (scrollable) */}
                <div className="flex-1 overflow-y-auto p-6">
                  <VenueDetailsView venue={selectedVenue} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Selecciona un venue</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Elige un venue de la lista para ver sus detalles
                </p>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle>Aprobar Venue</DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas aprobar {selectedVenue?.name}?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="approve-reason">Notas de aprobación (opcional)</Label>
            <Input
              id="approve-reason"
              placeholder="Ej: Documentación verificada..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="bg-background"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApprovalDialogOpen(false)}
              disabled={approveMutation.isPending}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => selectedVenue && approveMutation.mutate(selectedVenue.id)}
              disabled={approveMutation.isPending}
              className="cursor-pointer"
            >
              {approveMutation.isPending ? 'Aprobando...' : 'Aprobar Venue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <AlertDialog open={isSuspendDialogOpen} onOpenChange={setIsSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/5">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <AlertDialogTitle>Suspender Venue</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription>
              Estás a punto de suspender <strong>{selectedVenue?.name}</strong>. El venue no podrá
              operar mientras esté suspendido. Esta acción puede ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="suspend-reason">
              Razón de suspensión <span className="text-destructive">*</span>
            </Label>
            <Input
              id="suspend-reason"
              placeholder="Ej: Falta de pago, violación de términos..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="bg-background"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={suspendMutation.isPending}
              className="cursor-pointer"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedVenue && suspendMutation.mutate(selectedVenue.id)}
              disabled={suspendMutation.isPending || !reason}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {suspendMutation.isPending ? 'Suspendiendo...' : 'Suspender Venue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Venue Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle>Transferir Venue</DialogTitle>
                <DialogDescription>
                  Mover <strong>{selectedVenue?.name}</strong> de{' '}
                  <strong>{selectedVenue?.organization.name}</strong> a otra organizacion.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Organizacion actual</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedVenue?.organization.name}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Organizacion destino</Label>
              <Select value={targetOrgId} onValueChange={setTargetOrgId}>
                <SelectTrigger className="bg-background cursor-pointer">
                  <SelectValue placeholder="Selecciona una organizacion..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations
                    .filter(org => org.id !== selectedVenue?.organizationId)
                    .map(org => (
                      <SelectItem key={org.id} value={org.id} className="cursor-pointer">
                        {org.name} ({org.venueCount} venues)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTransferDialogOpen(false)}
              disabled={transferMutation.isPending}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                selectedVenue &&
                targetOrgId &&
                transferMutation.mutate({
                  venueId: selectedVenue.id,
                  targetOrganizationId: targetOrgId,
                })
              }
              disabled={transferMutation.isPending || !targetOrgId}
              className="cursor-pointer"
            >
              {transferMutation.isPending ? 'Transfiriendo...' : 'Transferir Venue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5">
                <ArrowUpDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <DialogTitle>Cambiar Estado</DialogTitle>
                <DialogDescription>
                  Cambiar estado de <strong>{selectedVenue?.name}</strong>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Estado actual</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30">
                {selectedVenue && (
                  <>
                    <StatusPulse status={STATUS_CONFIG[selectedVenue.status]?.pulseStatus || 'neutral'} />
                    <span className="text-sm font-medium">
                      {STATUS_CONFIG[selectedVenue.status]?.label || selectedVenue.status}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nuevo estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-background cursor-pointer">
                  <SelectValue placeholder="Selecciona un estado..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedVenue &&
                    VALID_TRANSITIONS[selectedVenue.status]?.map((status: string) => (
                      <SelectItem key={status} value={status} className="cursor-pointer">
                        {STATUS_CONFIG[status as VenueStatus]?.label || status}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="status-reason">Razón (opcional)</Label>
              <Input
                id="status-reason"
                placeholder="Ej: Activación tras revisión KYC..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStatusDialogOpen(false)}
              disabled={changeStatusMutation.isPending}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                selectedVenue &&
                newStatus &&
                changeStatusMutation.mutate({
                  venueId: selectedVenue.id,
                  status: newStatus,
                  reason: reason || undefined,
                })
              }
              disabled={changeStatusMutation.isPending || !newStatus}
              className="cursor-pointer"
            >
              {changeStatusMutation.isPending ? 'Cambiando...' : 'Cambiar Estado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Venue Module Management Dialog */}
      <VenueModuleManagementDialog
        open={isModuleDialogOpen}
        onOpenChange={setIsModuleDialogOpen}
        venue={
          selectedVenue
            ? {
                id: selectedVenue.id,
                name: selectedVenue.name,
                organization: selectedVenue.organization,
              }
            : null
        }
      />
    </div>
  )
}

// ============================================================================
// VENUE DETAILS VIEW COMPONENT
// ============================================================================

const VenueDetailsView: React.FC<{ venue: SuperadminVenue }> = ({ venue }) => {
  const numberFormat = new Intl.NumberFormat('es-MX')
  const statusConfig = STATUS_CONFIG[venue.status]
  const planConfig = PLAN_CONFIG[venue.subscriptionPlan] || {
    label: venue.subscriptionPlan || 'Desconocido',
    icon: <Store className="w-3.5 h-3.5" />,
    gradient: 'from-gray-500/20 to-gray-500/5',
  }
  const paymentConfig = PAYMENT_STATUS_CONFIG[venue.billing.paymentStatus] || {
    label: venue.billing.paymentStatus,
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-muted-foreground',
  }

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border mb-4">
        <TabsTrigger
          value="overview"
          className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
        >
          Resumen
        </TabsTrigger>
        <TabsTrigger
          value="billing"
          className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
        >
          Facturación
        </TabsTrigger>
        <TabsTrigger
          value="features"
          className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
        >
          Features
        </TabsTrigger>
        <TabsTrigger
          value="analytics"
          className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
        >
          Analíticas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Venue Info */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Información del Venue</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre:</span>
                <span className="font-medium">{venue.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug:</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{venue.slug}</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estado:</span>
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
                    statusConfig.badgeClass
                  )}
                >
                  <StatusPulse status={statusConfig.pulseStatus} />
                  {statusConfig.label}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plan:</span>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted/50">
                  <div className={cn('p-0.5 rounded', planConfig.gradient)}>
                    {planConfig.icon}
                  </div>
                  {planConfig.label}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Owner Info */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-sm">Propietario</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre:</span>
                <span className="font-medium">
                  {venue.owner.firstName} {venue.owner.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium truncate max-w-[180px]">{venue.owner.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Teléfono:</span>
                <span className="font-medium">{venue.owner.phone || 'N/A'}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </TabsContent>

      <TabsContent value="billing" className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Billing Info */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-sm">Facturación</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suscripción mensual:</span>
                <span className="font-medium">
                  {Currency(venue.billing.monthlySubscriptionFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Features adicionales:</span>
                <span className="font-medium">
                  {Currency(venue.billing.additionalFeaturesCost)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2 mt-2">
                <span className="text-muted-foreground font-medium">Total mensual:</span>
                <span className="font-bold">{Currency(venue.billing.totalMonthlyBill)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estado de pago:</span>
                <div className={cn('flex items-center gap-1', paymentConfig.color)}>
                  {paymentConfig.icon}
                  <span className="text-xs font-medium">{paymentConfig.label}</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Revenue Info */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm">Ingresos</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingresos mensuales:</span>
                <span className="font-medium">{Currency(venue.monthlyRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingresos totales:</span>
                <span className="font-medium">{Currency(venue.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tasa de comisión:</span>
                <span className="font-medium">{venue.commissionRate}%</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2 mt-2">
                <span className="text-muted-foreground font-medium">Comisión ganada:</span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {Currency((venue.monthlyRevenue * venue.commissionRate) / 100)}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </TabsContent>

      <TabsContent value="features">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="p-3 rounded-full bg-muted/50 mb-3">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Próximamente</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            La gestión de features estará disponible pronto
          </p>
        </div>
      </TabsContent>

      <TabsContent value="analytics">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-sm">Métricas de Uso</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-bold">
                {numberFormat.format(venue.analytics.monthlyTransactions)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Transacciones mensuales</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-bold">
                {Currency(venue.analytics.averageOrderValue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ticket promedio</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-bold">
                {numberFormat.format(venue.analytics.activeUsers)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Usuarios activos</p>
            </div>
          </div>
        </GlassCard>
      </TabsContent>
    </Tabs>
  )
}

export default VenueManagement
