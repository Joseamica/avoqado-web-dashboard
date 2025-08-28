import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Building2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Settings,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  Zap
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VenueStatus, SubscriptionPlan, type SuperadminVenue } from '@/types/superadmin'
import { Currency } from '@/utils/currency'
import { superadminAPI } from '@/services/superadmin.service'
import { useToast } from '@/hooks/use-toast'
import { useNavigate } from 'react-router-dom'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'

// Data now fetched from API via React Query

const VenueManagement: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['superadmin-venues'],
    queryFn: superadminAPI.getAllVenues,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedVenue, setSelectedVenue] = useState<SuperadminVenue | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false)
  const [reason, setReason] = useState('')

  // Filter venues
  const filteredVenues = venues.filter(venue => {
    const matchesSearch = venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         venue.owner.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         venue.organization.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || venue.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: VenueStatus) => {
    switch (status) {
      case VenueStatus.ACTIVE: return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200'
      case VenueStatus.PENDING: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200'
      case VenueStatus.SUSPENDED: return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
      case VenueStatus.CANCELLED: return 'bg-muted text-muted-foreground'
      case VenueStatus.TRIAL: return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusLabel = (status: VenueStatus) => t(`venueMgmt.statuses.${status}`)

  const getPlanColor = (plan: SubscriptionPlan) => {
    switch (plan) {
      case SubscriptionPlan.STARTER: return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
      case SubscriptionPlan.PROFESSIONAL: return 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200'
      case SubscriptionPlan.ENTERPRISE: return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PENDING': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'OVERDUE': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return <XCircle className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getPaymentStatusLabel = (status: string) => t(`venueMgmt.paymentStatuses.${status}`)

  const getPlanLabel = (plan: SubscriptionPlan) => t(`venueMgmt.planLabels.${plan}`)

  const handleApproveVenue = (venue: SuperadminVenue) => {
    setSelectedVenue(venue)
    setIsApprovalDialogOpen(true)
  }

  const handleViewDetails = (venue: SuperadminVenue) => {
    setSelectedVenue(venue)
    setIsDetailsOpen(true)
  }

  const approveMutation = useMutation({
    mutationFn: (venueId: string) => superadminAPI.approveVenue(venueId, reason || undefined),
    onSuccess: () => {
      toast({ title: t('venueMgmt.toasts.approveSuccessTitle'), description: `${selectedVenue?.name} ${t('venueMgmt.toasts.successDescSuffix')} ${t('venueMgmt.toasts.approved')}` })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsApprovalDialogOpen(false)
      setReason('')
    },
    onError: (error: any) => {
      toast({
        title: t('venueMgmt.toasts.approveFailedTitle'),
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (venueId: string) => superadminAPI.suspendVenue(venueId, reason || t('venueMgmt.dialogs.suspendReasonPlaceholder')),
    onSuccess: () => {
      toast({ title: t('venueMgmt.toasts.suspendSuccessTitle'), description: `${selectedVenue?.name} ${t('venueMgmt.toasts.successDescSuffix')} ${t('venueMgmt.toasts.suspended')}` })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsSuspendDialogOpen(false)
      setReason('')
    },
    onError: (error: any) => {
      toast({
        title: t('venueMgmt.toasts.suspendFailedTitle'),
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<SuperadminVenue>[] = [
    {
      accessorKey: 'name',
      meta: { label: t('venueMgmt.columns.venue') },
      header: t('venueMgmt.columns.venue'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-muted-foreground">{row.original.owner.email}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      meta: { label: t('venueMgmt.columns.status') },
      header: t('venueMgmt.columns.status'),
      cell: ({ row }) => (
        <Badge className={getStatusColor(row.original.status)}>
          {getStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: 'subscriptionPlan',
      meta: { label: t('venueMgmt.columns.subscriptionPlan') },
      header: t('venueMgmt.columns.subscriptionPlan'),
      cell: ({ row }) => (
        <Badge className={getPlanColor(row.original.subscriptionPlan)}>
          {getPlanLabel(row.original.subscriptionPlan)}
        </Badge>
      ),
    },
    {
      accessorKey: 'monthlyRevenue',
      meta: { label: t('venueMgmt.columns.monthlyRevenue') },
      header: t('venueMgmt.columns.monthlyRevenue'),
      cell: ({ row }) => (
        <div className="font-medium">{Currency(row.original.monthlyRevenue)}</div>
      ),
    },
    {
      accessorKey: 'billing.paymentStatus',
      meta: { label: t('venueMgmt.columns.payment') },
      header: t('venueMgmt.columns.payment'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          {getPaymentStatusIcon(row.original.billing.paymentStatus)}
          <span className="text-sm">{getPaymentStatusLabel(row.original.billing.paymentStatus)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'analytics.activeUsers',
      meta: { label: t('venueMgmt.columns.users') },
      header: t('venueMgmt.columns.users'),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.analytics.activeUsers}</span>
      ),
    },
    {
      id: 'actions',
      meta: { label: t('venueMgmt.columns.actions') },
      header: t('venueMgmt.columns.actions'),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewDetails(row.original)}>
              <Eye className="mr-2 h-4 w-4" />
              {t('venueMgmt.dropdown.viewDetails')}
            </DropdownMenuItem>
            {row.original.status === VenueStatus.PENDING && (
              <DropdownMenuItem onClick={() => handleApproveVenue(row.original)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('venueMgmt.dropdown.approve')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate(`/admin/venues/${row.original.id}`)}>
              <Settings className="mr-2 h-4 w-4" />
              {t('venueMgmt.dropdown.manageFeatures')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Zap className="mr-2 h-4 w-4" />
              {t('venueMgmt.dropdown.viewAnalytics')}
            </DropdownMenuItem>
            {row.original.status === VenueStatus.ACTIVE && (
              <DropdownMenuItem className="text-red-600" onClick={() => { setSelectedVenue(row.original); setIsSuspendDialogOpen(true) }}>
                <XCircle className="mr-2 h-4 w-4" />
                {t('venueMgmt.dropdown.suspend')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // Calculate stats
  const { totalRevenue, totalCommission, pendingApprovals, activeVenues } = useMemo(() => {
    const tr = venues.reduce((sum, venue) => sum + venue.monthlyRevenue, 0)
    const tc = venues.reduce((sum, venue) => sum + (venue.monthlyRevenue * venue.commissionRate / 100), 0)
    const pa = venues.filter(v => v.status === VenueStatus.PENDING).length
    const av = venues.filter(v => v.status === VenueStatus.ACTIVE).length
    return { totalRevenue: tr, totalCommission: tc, pendingApprovals: pa, activeVenues: av }
  }, [venues])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('venueMgmt.title')}</h1>
          <p className="text-muted-foreground">{t('venueMgmt.subtitle')}</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('venueMgmt.stats.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {t('venueMgmt.stats.commissionPrefix')} {Currency(totalCommission)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('venueMgmt.stats.activeVenues')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeVenues}</div>
            <p className="text-xs text-muted-foreground">
              {venues.length} {t('venueMgmt.stats.totalVenuesSuffix')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('venueMgmt.stats.pendingApprovals')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">{t('venueMgmt.stats.requireAction')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('venueMgmt.stats.avgRevenue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Currency(totalRevenue / (activeVenues || 1))}
            </div>
            <p className="text-xs text-muted-foreground">{t('venueMgmt.stats.perActiveVenue')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Venues Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('venueMgmt.tableTitle')}</CardTitle>
          <CardDescription>{t('venueMgmt.tableDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('venueMgmt.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('venueMgmt.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('venueMgmt.allStatuses')}</SelectItem>
                <SelectItem value={VenueStatus.ACTIVE}>{t('venueMgmt.statuses.ACTIVE')}</SelectItem>
                <SelectItem value={VenueStatus.PENDING}>{t('venueMgmt.statuses.PENDING')}</SelectItem>
                <SelectItem value={VenueStatus.SUSPENDED}>{t('venueMgmt.statuses.SUSPENDED')}</SelectItem>
                <SelectItem value={VenueStatus.TRIAL}>{t('venueMgmt.statuses.TRIAL')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">{t('venueMgmt.loadingVenues')}</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredVenues}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              setPagination={() => {}}
              tableId="superadmin:venues"
              rowCount={filteredVenues.length}
            />
          )}
        </CardContent>
      </Card>

      {/* Venue Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('venueMgmt.dialogs.detailsTitle')}</DialogTitle>
            <DialogDescription>
              {t('venueMgmt.dialogs.detailsDescPrefix')} {selectedVenue?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedVenue && <VenueDetailsView venue={selectedVenue} />}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('venueMgmt.dialogs.approveTitle')}</DialogTitle>
            <DialogDescription>
              {t('venueMgmt.dialogs.approveDescPrefix')} {selectedVenue?.name}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="approve-reason">{t('venueMgmt.dialogs.approveReasonLabel')}</Label>
            <Input id="approve-reason" placeholder={t('venueMgmt.dialogs.approveReasonPlaceholder')} value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              {t('venueMgmt.dialogs.cancel')}
            </Button>
            <Button onClick={() => selectedVenue && approveMutation.mutate(selectedVenue.id)} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? t('venueMgmt.dialogs.approving') : t('venueMgmt.dialogs.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={isSuspendDialogOpen} onOpenChange={setIsSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('venueMgmt.dialogs.suspendTitle')}</DialogTitle>
            <DialogDescription>
              {t('venueMgmt.dialogs.suspendDescPrefix')} {selectedVenue?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="suspend-reason">{t('venueMgmt.dialogs.suspendReasonLabel')}</Label>
            <Input id="suspend-reason" placeholder={t('venueMgmt.dialogs.suspendReasonPlaceholder')} value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSuspendDialogOpen(false)}>
              {t('venueMgmt.dialogs.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => selectedVenue && suspendMutation.mutate(selectedVenue.id)} disabled={suspendMutation.isPending || !reason}>
              {suspendMutation.isPending ? t('venueMgmt.dialogs.suspending') : t('venueMgmt.dialogs.suspend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Venue Details Component
const VenueDetailsView: React.FC<{ venue: SuperadminVenue }> = ({ venue }) => {
  const { t } = useTranslation()
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">{t('detailsView.tabs.overview')}</TabsTrigger>
        <TabsTrigger value="billing">{t('detailsView.tabs.billing')}</TabsTrigger>
        <TabsTrigger value="features">{t('detailsView.tabs.features')}</TabsTrigger>
        <TabsTrigger value="analytics">{t('detailsView.tabs.analytics')}</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">{t('detailsView.venueInfo.title')}</h3>
            <div className="space-y-2 text-sm">
              <div><strong>{t('detailsView.venueInfo.name')}:</strong> {venue.name}</div>
              <div><strong>{t('detailsView.venueInfo.slug')}:</strong> {venue.slug}</div>
              <div><strong>{t('detailsView.venueInfo.status')}:</strong> {venue.status}</div>
              <div><strong>{t('detailsView.venueInfo.plan')}:</strong> {venue.subscriptionPlan}</div>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">{t('detailsView.ownerInfo.title')}</h3>
            <div className="space-y-2 text-sm">
              <div><strong>{t('detailsView.ownerInfo.name')}:</strong> {venue.owner.firstName} {venue.owner.lastName}</div>
              <div><strong>{t('detailsView.ownerInfo.email')}:</strong> {venue.owner.email}</div>
              <div><strong>{t('detailsView.ownerInfo.phone')}:</strong> {venue.owner.phone || t('detailsView.ownerInfo.na')}</div>
            </div>
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="billing" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">{t('detailsView.billingInfo.title')}</h3>
            <div className="space-y-2 text-sm">
              <div><strong>{t('detailsView.billingInfo.subscriptionFee')}:</strong> {Currency(venue.billing.monthlySubscriptionFee)}</div>
              <div><strong>{t('detailsView.billingInfo.featuresCost')}:</strong> {Currency(venue.billing.additionalFeaturesCost)}</div>
              <div><strong>{t('detailsView.billingInfo.totalMonthly')}:</strong> {Currency(venue.billing.totalMonthlyBill)}</div>
              <div><strong>{t('detailsView.billingInfo.paymentStatus')}:</strong> {venue.billing.paymentStatus}</div>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">{t('detailsView.revenueInfo.title')}</h3>
            <div className="space-y-2 text-sm">
              <div><strong>{t('detailsView.revenueInfo.monthlyRevenue')}:</strong> {Currency(venue.monthlyRevenue)}</div>
              <div><strong>{t('detailsView.revenueInfo.totalRevenue')}:</strong> {Currency(venue.totalRevenue)}</div>
              <div><strong>{t('detailsView.revenueInfo.commissionRate')}:</strong> {venue.commissionRate}%</div>
              <div><strong>{t('detailsView.revenueInfo.commissionEarned')}:</strong> {Currency(venue.monthlyRevenue * venue.commissionRate / 100)}</div>
            </div>
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="features">
        <div className="text-center py-8">
          <p className="text-muted-foreground">{t('detailsView.featuresComingSoon')}</p>
        </div>
      </TabsContent>
      
      <TabsContent value="analytics">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">{t('detailsView.analytics.title')}</h3>
            <div className="space-y-2 text-sm">
              <div><strong>{t('detailsView.analytics.monthlyTransactions')}:</strong> {venue.analytics.monthlyTransactions.toLocaleString()}</div>
              <div><strong>{t('detailsView.analytics.avgOrderValue')}:</strong> {Currency(venue.analytics.averageOrderValue)}</div>
              <div><strong>{t('detailsView.analytics.activeUsers')}:</strong> {venue.analytics.activeUsers}</div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}

export default VenueManagement
