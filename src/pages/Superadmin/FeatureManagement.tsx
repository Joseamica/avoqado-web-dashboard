import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Zap,
  Plus,
  Settings,
  Eye,
  TrendingUp,
  Users,
  DollarSign,
  Cpu,
  Bot,
  BarChart3,
  Globe,
  Crown,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FeatureCategory, FeatureStatus, PricingModel, type PlatformFeature } from '@/types/superadmin'
import { Currency } from '@/utils/currency'
import { superadminAPI } from '@/services/superadmin'
import { useToast } from '@/hooks/use-toast'

// Data now fetched from API via React Query

const FeatureManagement: React.FC = () => {
  const { data: features = [], isLoading } = useQuery({
    queryKey: ['superadmin-features'],
    queryFn: superadminAPI.getAllFeatures,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Filter features based on search and category
  const filteredFeatures = features.filter(feature => {
    const matchesSearch =
      feature.name.toLowerCase().includes(searchTerm.toLowerCase()) || feature.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getCategoryIcon = (category: FeatureCategory) => {
    switch (category) {
      case FeatureCategory.AI:
        return <Bot className="w-4 h-4" />
      case FeatureCategory.ANALYTICS:
        return <BarChart3 className="w-4 h-4" />
      case FeatureCategory.INTEGRATIONS:
        return <Globe className="w-4 h-4" />
      case FeatureCategory.PREMIUM:
        return <Crown className="w-4 h-4" />
      default:
        return <Cpu className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: FeatureStatus) => {
    switch (status) {
      case FeatureStatus.ACTIVE:
        return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200'
      case FeatureStatus.BETA:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
      case FeatureStatus.INACTIVE:
        return 'bg-muted text-muted-foreground'
      case FeatureStatus.DEPRECATED:
        return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getPricingDisplay = (feature: PlatformFeature) => {
    switch (feature.pricingModel) {
      case PricingModel.FREE:
        return 'Free'
      case PricingModel.FIXED:
        return Currency(feature.basePrice || 0)
      case PricingModel.USAGE_BASED:
        return `${Currency(feature.usagePrice || 0)}/${feature.usageUnit}`
      case PricingModel.TIERED:
        return `From ${Currency(feature.basePrice || 0)}`
      default:
        return 'Contact Sales'
    }
  }

  const columns: ColumnDef<PlatformFeature>[] = [
    {
      accessorKey: 'name',
      header: 'Feature',
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-muted">{getCategoryIcon(row.original.category)}</div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-muted-foreground">{row.original.code}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge className={getStatusColor(row.original.status)}>{row.original.status}</Badge>,
    },
    {
      accessorKey: 'pricing',
      header: 'Pricing',
      cell: ({ row }) => <span className="font-medium">{getPricingDisplay(row.original)}</span>,
    },
    {
      accessorKey: 'isCore',
      header: 'Type',
      cell: ({ row }) => <Badge variant={row.original.isCore ? 'default' : 'secondary'}>{row.original.isCore ? 'Core' : 'Add-on'}</Badge>,
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
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Feature
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Manage Venues
            </DropdownMenuItem>
            {!row.original.isCore && (
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Feature
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Feature Management</h1>
          <p className="text-muted-foreground">Manage platform features and venue access controls</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Feature
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Feature</DialogTitle>
              <DialogDescription>Add a new feature to the platform that venues can subscribe to.</DialogDescription>
            </DialogHeader>
            <CreateFeatureForm onClose={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Feature Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Features</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{features.length}</div>
            <p className="text-xs text-muted-foreground">{features.filter(f => f.isCore).length} core features</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Features</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{features.filter(f => f.status === FeatureStatus.ACTIVE).length}</div>
            <p className="text-xs text-muted-foreground">{features.filter(f => f.status === FeatureStatus.BETA).length} in beta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Revenue per Feature</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$8,450</div>
            <p className="text-xs text-muted-foreground">+12.5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feature Adoption</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">67%</div>
            <p className="text-xs text-muted-foreground">Average adoption rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Features</CardTitle>
          <CardDescription>Manage and monitor all platform features available to venues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input placeholder="Search features..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value={FeatureCategory.CORE}>Core</SelectItem>
                <SelectItem value={FeatureCategory.AI}>AI</SelectItem>
                <SelectItem value={FeatureCategory.ANALYTICS}>Analytics</SelectItem>
                <SelectItem value={FeatureCategory.INTEGRATIONS}>Integrations</SelectItem>
                <SelectItem value={FeatureCategory.PREMIUM}>Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading features...</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredFeatures}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              setPagination={() => {}}
              rowCount={filteredFeatures.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Create Feature Form Component
const CreateFeatureForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<FeatureCategory | ''>('')
  const [pricingModel, setPricingModel] = useState<PricingModel | ''>('')
  const [basePrice, setBasePrice] = useState('')
  const [isCore, setIsCore] = useState(false)

  const createFeature = useMutation({
    mutationFn: superadminAPI.createFeature,
    onSuccess: data => {
      toast({ title: 'Feature created', description: `${data.name} has been created.` })
      queryClient.invalidateQueries({ queryKey: ['superadmin-features'] })
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create feature',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive' as any,
      })
    },
  })

  const onSubmit = () => {
    createFeature.mutate({
      name,
      code,
      description,
      category: category || undefined,
      pricingModel: pricingModel || undefined,
      basePrice: basePrice ? Number(basePrice) : undefined,
      isCore,
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Feature Name</Label>
          <Input id="name" placeholder="AI Chatbot" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="code">Feature Code</Label>
          <Input id="code" placeholder="ai_chatbot" value={code} onChange={e => setCode(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" placeholder="Describe what this feature does..." value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={value => setCategory(value as FeatureCategory)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FeatureCategory.AI}>AI</SelectItem>
              <SelectItem value={FeatureCategory.ANALYTICS}>Analytics</SelectItem>
              <SelectItem value={FeatureCategory.INTEGRATIONS}>Integrations</SelectItem>
              <SelectItem value={FeatureCategory.PREMIUM}>Premium</SelectItem>
              <SelectItem value={FeatureCategory.CORE}>Core</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="pricing">Pricing Model</Label>
          <Select value={pricingModel} onValueChange={value => setPricingModel(value as PricingModel)}>
            <SelectTrigger>
              <SelectValue placeholder="Select pricing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PricingModel.FREE}>Free</SelectItem>
              <SelectItem value={PricingModel.FIXED}>Fixed Price</SelectItem>
              <SelectItem value={PricingModel.USAGE_BASED}>Usage Based</SelectItem>
              <SelectItem value={PricingModel.TIERED}>Tiered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Base Price ($)</Label>
          <Input id="price" type="number" placeholder="49.99" value={basePrice} onChange={e => setBasePrice(e.target.value)} />
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <Switch id="core" checked={isCore} onCheckedChange={setIsCore} />
          <Label htmlFor="core">Core Feature</Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={createFeature.isPending}>
          {createFeature.isPending ? 'Creating...' : 'Create Feature'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export default FeatureManagement
