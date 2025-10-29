import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { superadminAPI } from '@/services/superadmin.service'
import { FeatureCategory, FeatureStatus, PricingModel, type PlatformFeature } from '@/types/superadmin'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  BarChart3,
  Cpu,
  CreditCard,
  DollarSign,
  Eye,
  Globe,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Data now fetched from API via React Query

const FeatureManagement: React.FC = () => {
  const { t, i18n } = useTranslation('superadmin')
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
      case FeatureCategory.OPERATIONS:
        return <Cpu className="w-4 h-4" />
      case FeatureCategory.PAYMENTS:
        return <CreditCard className="w-4 h-4" />
      case FeatureCategory.MARKETING:
        return <Megaphone className="w-4 h-4" />
      case FeatureCategory.ANALYTICS:
        return <BarChart3 className="w-4 h-4" />
      case FeatureCategory.INTEGRATIONS:
        return <Globe className="w-4 h-4" />
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
        return t('featureMgmt.pricing.free')
      case PricingModel.FIXED:
        return Currency(feature.basePrice || 0)
      case PricingModel.USAGE_BASED:
        return `${Currency(feature.usagePrice || 0)}/${feature.usageUnit}`
      case PricingModel.TIERED:
        return `${t('featureMgmt.pricing.from')} ${Currency(feature.basePrice || 0)}`
      default:
        return t('featureMgmt.pricing.contactSales')
    }
  }

  const getCategoryLabel = (category: FeatureCategory) => t(`categories.${category}`)

  const getStatusLabel = (status: FeatureStatus) => t(`featureStatuses.${status}`)

  const columns: ColumnDef<PlatformFeature>[] = [
    {
      accessorKey: 'name',
      header: t('featureMgmt.columns.feature'),
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
      header: t('featureMgmt.columns.category'),
      cell: ({ row }) => <Badge variant="secondary">{getCategoryLabel(row.original.category)}</Badge>,
    },
    {
      accessorKey: 'status',
      header: t('featureMgmt.columns.status'),
      cell: ({ row }) => <Badge className={getStatusColor(row.original.status)}>{getStatusLabel(row.original.status)}</Badge>,
    },
    {
      accessorKey: 'pricing',
      header: t('featureMgmt.columns.pricing'),
      cell: ({ row }) => <span className="font-medium">{getPricingDisplay(row.original)}</span>,
    },
    {
      accessorKey: 'isCore',
      header: t('featureMgmt.columns.type'),
      cell: ({ row }) => (
        <Badge variant={row.original.isCore ? 'default' : 'secondary'}>
          {row.original.isCore ? t('featureMgmt.core') : t('featureMgmt.addOn')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('featureMgmt.columns.actions'),
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
              {t('featureMgmt.dropdown.viewDetails')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil className="mr-2 h-4 w-4" />
              {t('featureMgmt.dropdown.editFeature')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              {t('featureMgmt.dropdown.manageVenues')}
            </DropdownMenuItem>
            {!row.original.isCore && (
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                {t('featureMgmt.dropdown.deleteFeature')}
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
          <h1 className="text-3xl font-bold text-foreground">{t('featureMgmt.title')}</h1>
          <p className="text-muted-foreground">{t('featureMgmt.subtitle')}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t('featureMgmt.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t('featureMgmt.createTitle')}</DialogTitle>
              <DialogDescription>{t('featureMgmt.createDesc')}</DialogDescription>
            </DialogHeader>
            <CreateFeatureForm onClose={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Feature Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('featureMgmt.stats.total')}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{features.length}</div>
            <p className="text-xs text-muted-foreground">
              {features.filter(f => f.isCore).length} {t('featureMgmt.stats.coreCountSuffix')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('featureMgmt.stats.active')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{features.filter(f => f.status === FeatureStatus.ACTIVE).length}</div>
            <p className="text-xs text-muted-foreground">
              {features.filter(f => f.status === FeatureStatus.BETA).length} {t('featureMgmt.stats.betaCountSuffix')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('featureMgmt.stats.avgRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                8450,
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('featureMgmt.stats.avgRevenueChange')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('featureMgmt.stats.adoption')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'percent', maximumFractionDigits: 0 }).format(0.67)}
            </div>
            <p className="text-xs text-muted-foreground">{t('featureMgmt.stats.adoptionAvg')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('featureMgmt.tableTitle')}</CardTitle>
          <CardDescription>{t('featureMgmt.tableDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input placeholder={t('featureMgmt.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('featureMgmt.filterByCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('featureMgmt.allCategories')}</SelectItem>
                <SelectItem value={FeatureCategory.OPERATIONS}>{t('categories.OPERATIONS')}</SelectItem>
                <SelectItem value={FeatureCategory.PAYMENTS}>{t('categories.PAYMENTS')}</SelectItem>
                <SelectItem value={FeatureCategory.MARKETING}>{t('categories.MARKETING')}</SelectItem>
                <SelectItem value={FeatureCategory.ANALYTICS}>{t('categories.ANALYTICS')}</SelectItem>
                <SelectItem value={FeatureCategory.INTEGRATIONS}>{t('categories.INTEGRATIONS')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
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
  const { t } = useTranslation('superadmin')

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
      toast({ title: t('featureMgmt.toast.createdTitle'), description: `${data.name} ${t('featureMgmt.toast.createdDescPrefix')}` })
      queryClient.invalidateQueries({ queryKey: ['superadmin-features'] })
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: t('featureMgmt.toast.createFailed'),
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
          <Label htmlFor="name">{t('featureMgmt.form.nameLabel')}</Label>
          <Input id="name" placeholder={t('featureMgmt.form.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="code">{t('featureMgmt.form.codeLabel')}</Label>
          <Input id="code" placeholder={t('featureMgmt.form.codePlaceholder')} value={code} onChange={e => setCode(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="description">{t('featureMgmt.form.descLabel')}</Label>
        <Textarea
          id="description"
          placeholder={t('featureMgmt.form.descPlaceholder')}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">{t('featureMgmt.form.categoryLabel')}</Label>
          <Select value={category} onValueChange={value => setCategory(value as FeatureCategory)}>
            <SelectTrigger>
              <SelectValue placeholder={t('featureMgmt.form.categoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FeatureCategory.OPERATIONS}>{t('categories.OPERATIONS')}</SelectItem>
              <SelectItem value={FeatureCategory.PAYMENTS}>{t('categories.PAYMENTS')}</SelectItem>
              <SelectItem value={FeatureCategory.MARKETING}>{t('categories.MARKETING')}</SelectItem>
              <SelectItem value={FeatureCategory.ANALYTICS}>{t('categories.ANALYTICS')}</SelectItem>
              <SelectItem value={FeatureCategory.INTEGRATIONS}>{t('categories.INTEGRATIONS')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="pricing">{t('featureMgmt.form.pricingLabel')}</Label>
          <Select value={pricingModel} onValueChange={value => setPricingModel(value as PricingModel)}>
            <SelectTrigger>
              <SelectValue placeholder={t('featureMgmt.form.pricingPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PricingModel.FREE}>{t('featureMgmt.pricing.free')}</SelectItem>
              <SelectItem value={PricingModel.FIXED}>{t('featureMgmt.pricing.fixed')}</SelectItem>
              <SelectItem value={PricingModel.USAGE_BASED}>{t('featureMgmt.pricing.usageBased')}</SelectItem>
              <SelectItem value={PricingModel.TIERED}>{t('featureMgmt.pricing.tiered')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">{t('featureMgmt.form.basePriceLabel')}</Label>
          <Input
            id="price"
            type="number"
            placeholder={t('featureMgmt.form.basePricePlaceholder')}
            value={basePrice}
            onChange={e => setBasePrice(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <Switch id="core" checked={isCore} onCheckedChange={setIsCore} />
          <Label htmlFor="core">{t('featureMgmt.form.coreLabel')}</Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('featureMgmt.form.cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={createFeature.isPending}>
          {createFeature.isPending ? t('featureMgmt.form.creating') : t('featureMgmt.form.submit')}
        </Button>
      </DialogFooter>
    </div>
  )
}

export default FeatureManagement
