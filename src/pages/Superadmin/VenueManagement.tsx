import React, { useState } from 'react'
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
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Users,
  Settings,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  Crown,
  Zap
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VenueStatus, SubscriptionPlan, type SuperadminVenue } from '@/types/superadmin'
import Currency from '@/utils/currency'

// Mock data for venues
const mockVenues: SuperadminVenue[] = [
  {
    id: '1',
    name: 'Restaurante El Patrón',
    slug: 'el-patron',
    status: VenueStatus.ACTIVE,
    subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
    monthlyRevenue: 45000,
    commissionRate: 15,
    totalTransactions: 2847,
    totalRevenue: 540000,
    organizationId: 'org1',
    organization: {
      id: 'org1',
      name: 'Grupo Restaurantero SA',
      email: 'admin@gruporestaurantero.com',
      phone: '+1234567890'
    },
    owner: {
      id: 'user1',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      email: 'carlos@elpatron.com',
      phone: '+1234567891'
    },
    features: [],
    analytics: {
      monthlyTransactions: 2847,
      monthlyRevenue: 45000,
      averageOrderValue: 15.82,
      activeUsers: 124,
      lastActivityAt: '2024-08-15T14:30:00Z'
    },
    billing: {
      nextBillingDate: '2024-09-01T00:00:00Z',
      monthlySubscriptionFee: 299,
      additionalFeaturesCost: 149,
      totalMonthlyBill: 448,
      paymentStatus: 'PAID'
    },
    approvedAt: '2024-01-15T10:00:00Z',
    approvedBy: 'superadmin1',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-08-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Sushi Zen',
    slug: 'sushi-zen',
    status: VenueStatus.PENDING,
    subscriptionPlan: SubscriptionPlan.STARTER,
    monthlyRevenue: 0,
    commissionRate: 12,
    totalTransactions: 0,
    totalRevenue: 0,
    organizationId: 'org2',
    organization: {
      id: 'org2',
      name: 'Zen Foods LLC',
      email: 'info@zenfoods.com'
    },
    owner: {
      id: 'user2',
      firstName: 'Akira',
      lastName: 'Tanaka',
      email: 'akira@sushizen.com'
    },
    features: [],
    analytics: {
      monthlyTransactions: 0,
      monthlyRevenue: 0,
      averageOrderValue: 0,
      activeUsers: 1,
      lastActivityAt: '2024-08-14T09:15:00Z'
    },
    billing: {
      nextBillingDate: '2024-09-01T00:00:00Z',
      monthlySubscriptionFee: 99,
      additionalFeaturesCost: 0,
      totalMonthlyBill: 99,
      paymentStatus: 'PENDING'
    },
    createdAt: '2024-08-10T10:00:00Z',
    updatedAt: '2024-08-14T10:00:00Z'
  },
  {
    id: '3',
    name: 'Pizza Corner',
    slug: 'pizza-corner',
    status: VenueStatus.SUSPENDED,
    subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
    monthlyRevenue: 32000,
    commissionRate: 15,
    totalTransactions: 1956,
    totalRevenue: 384000,
    organizationId: 'org3',
    organization: {
      id: 'org3',
      name: 'Corner Foods Inc',
      email: 'billing@cornerfoods.com'
    },
    owner: {
      id: 'user3',
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@pizzacorner.com'
    },
    features: [],
    analytics: {
      monthlyTransactions: 1956,
      monthlyRevenue: 32000,
      averageOrderValue: 16.37,
      activeUsers: 89,
      lastActivityAt: '2024-08-10T18:45:00Z'
    },
    billing: {
      nextBillingDate: '2024-09-01T00:00:00Z',
      monthlySubscriptionFee: 299,
      additionalFeaturesCost: 49,
      totalMonthlyBill: 348,
      paymentStatus: 'OVERDUE'
    },
    approvedAt: '2024-02-01T10:00:00Z',
    approvedBy: 'superadmin1',
    createdAt: '2024-01-25T10:00:00Z',
    updatedAt: '2024-08-10T10:00:00Z'
  }
]

const VenueManagement: React.FC = () => {
  const [venues] = useState<SuperadminVenue[]>(mockVenues)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedVenue, setSelectedVenue] = useState<SuperadminVenue | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)

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
      case VenueStatus.CANCELLED: return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200'
      case VenueStatus.TRIAL: return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200'
    }
  }

  const getPlanColor = (plan: SubscriptionPlan) => {
    switch (plan) {
      case SubscriptionPlan.STARTER: return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
      case SubscriptionPlan.PROFESSIONAL: return 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200'
      case SubscriptionPlan.ENTERPRISE: return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200'
    }
  }

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PENDING': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'OVERDUE': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return <XCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const handleApproveVenue = (venue: SuperadminVenue) => {
    setSelectedVenue(venue)
    setIsApprovalDialogOpen(true)
  }

  const handleViewDetails = (venue: SuperadminVenue) => {
    setSelectedVenue(venue)
    setIsDetailsOpen(true)
  }

  const columns: ColumnDef<SuperadminVenue>[] = [
    {
      accessorKey: 'name',
      header: 'Venue',
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-gray-500">{row.original.owner.email}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={getStatusColor(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'subscriptionPlan',
      header: 'Plan',
      cell: ({ row }) => (
        <Badge className={getPlanColor(row.original.subscriptionPlan)}>
          {row.original.subscriptionPlan}
        </Badge>
      ),
    },
    {
      accessorKey: 'monthlyRevenue',
      header: 'Monthly Revenue',
      cell: ({ row }) => (
        <div className="font-medium">{Currency(row.original.monthlyRevenue)}</div>
      ),
    },
    {
      accessorKey: 'billing.paymentStatus',
      header: 'Payment',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          {getPaymentStatusIcon(row.original.billing.paymentStatus)}
          <span className="text-sm">{row.original.billing.paymentStatus}</span>
        </div>
      ),
    },
    {
      accessorKey: 'analytics.activeUsers',
      header: 'Users',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.analytics.activeUsers}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
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
              View Details
            </DropdownMenuItem>
            {row.original.status === VenueStatus.PENDING && (
              <DropdownMenuItem onClick={() => handleApproveVenue(row.original)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Venue
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Manage Features
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Zap className="mr-2 h-4 w-4" />
              View Analytics
            </DropdownMenuItem>
            {row.original.status === VenueStatus.ACTIVE && (
              <DropdownMenuItem className="text-red-600">
                <XCircle className="mr-2 h-4 w-4" />
                Suspend Venue
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // Calculate stats
  const totalRevenue = venues.reduce((sum, venue) => sum + venue.monthlyRevenue, 0)
  const totalCommission = venues.reduce((sum, venue) => sum + (venue.monthlyRevenue * venue.commissionRate / 100), 0)
  const pendingApprovals = venues.filter(v => v.status === VenueStatus.PENDING).length
  const activeVenues = venues.filter(v => v.status === VenueStatus.ACTIVE).length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Venue Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and manage all venues on the platform
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Commission: {Currency(totalCommission)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Venues</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeVenues}</div>
            <p className="text-xs text-muted-foreground">
              {venues.length} total venues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">
              Require action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue per Venue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Currency(totalRevenue / (activeVenues || 1))}
            </div>
            <p className="text-xs text-muted-foreground">
              Per active venue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Venues Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Venues</CardTitle>
          <CardDescription>
            Manage venue registrations, subscriptions, and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search venues, owners, or organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={VenueStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={VenueStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={VenueStatus.SUSPENDED}>Suspended</SelectItem>
                <SelectItem value={VenueStatus.TRIAL}>Trial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={filteredVenues}
            pagination={{ pageIndex: 0, pageSize: 10 }}
            setPagination={() => {}}
            rowCount={filteredVenues.length}
          />
        </CardContent>
      </Card>

      {/* Venue Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Venue Details</DialogTitle>
            <DialogDescription>
              Complete information about {selectedVenue?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedVenue && <VenueDetailsView venue={selectedVenue} />}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Venue</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve {selectedVenue?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsApprovalDialogOpen(false)}>
              Approve Venue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Venue Details Component
const VenueDetailsView: React.FC<{ venue: SuperadminVenue }> = ({ venue }) => {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Venue Information</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Name:</strong> {venue.name}</div>
              <div><strong>Slug:</strong> {venue.slug}</div>
              <div><strong>Status:</strong> {venue.status}</div>
              <div><strong>Plan:</strong> {venue.subscriptionPlan}</div>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Owner Information</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Name:</strong> {venue.owner.firstName} {venue.owner.lastName}</div>
              <div><strong>Email:</strong> {venue.owner.email}</div>
              <div><strong>Phone:</strong> {venue.owner.phone || 'N/A'}</div>
            </div>
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="billing" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Billing Information</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Subscription Fee:</strong> {Currency(venue.billing.monthlySubscriptionFee)}</div>
              <div><strong>Features Cost:</strong> {Currency(venue.billing.additionalFeaturesCost)}</div>
              <div><strong>Total Monthly:</strong> {Currency(venue.billing.totalMonthlyBill)}</div>
              <div><strong>Payment Status:</strong> {venue.billing.paymentStatus}</div>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Revenue Information</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Monthly Revenue:</strong> {Currency(venue.monthlyRevenue)}</div>
              <div><strong>Total Revenue:</strong> {Currency(venue.totalRevenue)}</div>
              <div><strong>Commission Rate:</strong> {venue.commissionRate}%</div>
              <div><strong>Commission Earned:</strong> {Currency(venue.monthlyRevenue * venue.commissionRate / 100)}</div>
            </div>
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="features">
        <div className="text-center py-8">
          <p className="text-gray-500">Feature management coming soon...</p>
        </div>
      </TabsContent>
      
      <TabsContent value="analytics">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Performance Metrics</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Monthly Transactions:</strong> {venue.analytics.monthlyTransactions.toLocaleString()}</div>
              <div><strong>Average Order Value:</strong> {Currency(venue.analytics.averageOrderValue)}</div>
              <div><strong>Active Users:</strong> {venue.analytics.activeUsers}</div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}

export default VenueManagement