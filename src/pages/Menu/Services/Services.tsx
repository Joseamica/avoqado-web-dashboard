import { getProducts, updateProduct, deleteProduct } from '@/services/menu.service'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowUpDown,
  UploadCloud,
  ImageIcon,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  X,
  Calendar,
  Users,
  Plus,
} from 'lucide-react'
import { useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from '@/hooks/useDebounce'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Product } from '@/types'
import { Currency } from '@/utils/currency'
import { PermissionGate } from '@/components/PermissionGate'
import { useMenuSocketEvents } from '@/hooks/use-menu-socket-events'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { type ProductType } from '@/services/inventory.service'
import { ServiceTypeSelectorDialog } from './ServiceTypeSelectorDialog'
import { ServiceFormDialog } from './ServiceFormDialog'

const SERVICE_TYPES: ProductType[] = ['APPOINTMENTS_SERVICE', 'CLASS']

export default function Services() {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  // Create flow state
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(false)
  const [selectedServiceType, setSelectedServiceType] = useState<ProductType | null>(null)
  const [createWizardOpen, setCreateWizardOpen] = useState(false)

  // Edit flow state
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const [editWizardOpen, setEditWizardOpen] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])

  // Fetch products (shared cache with Products page)
  const { data: allProducts, isLoading } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId!, { orderBy: 'name' }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  })

  useMenuSocketEvents(venueId, {
    onAvailabilityChanged: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
    onMenuItemUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
  })

  // Filter to services only
  const services = useMemo(() => {
    if (!allProducts) return []
    return allProducts.filter(p => SERVICE_TYPES.includes(p.type as ProductType))
  }, [allProducts])

  // Type filter options
  const typeOptions = useMemo(
    () => [
      { value: 'APPOINTMENTS_SERVICE', label: t('services.types.service') },
      { value: 'CLASS', label: t('services.types.class') },
    ],
    [t],
  )

  // Status filter options
  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('services.filters.active') },
      { value: 'inactive', label: t('services.filters.inactive') },
    ],
    [t],
  )

  const getFilterDisplayLabel = useCallback(
    (values: string[], options: { value: string; label: string }[]) => {
      if (values.length === 0) return null
      if (values.length === 1) {
        const option = options.find(o => o.value === values[0])
        return option?.label || values[0]
      }
      return `${values.length} ${tCommon('selected', { defaultValue: 'seleccionados' })}`
    },
    [tCommon],
  )

  const activeFiltersCount = useMemo(
    () =>
      [typeFilter.length > 0, statusFilter.length > 0, debouncedSearchTerm !== ''].filter(Boolean)
        .length,
    [typeFilter, statusFilter, debouncedSearchTerm],
  )

  const resetFilters = useCallback(() => {
    setTypeFilter([])
    setStatusFilter([])
    setSearchTerm('')
  }, [])

  // Filtered services
  const filteredServices = useMemo(() => {
    let result = services

    if (debouncedSearchTerm) {
      const lowerSearch = debouncedSearchTerm.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(lowerSearch))
    }

    if (typeFilter.length > 0) {
      result = result.filter(s => typeFilter.includes(s.type))
    }

    if (statusFilter.length > 0) {
      result = result.filter(s => {
        const isActive = s.active
        return (
          (statusFilter.includes('active') && isActive) ||
          (statusFilter.includes('inactive') && !isActive)
        )
      })
    }

    return result
  }, [services, debouncedSearchTerm, typeFilter, statusFilter])

  // Mutations
  const toggleActive = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: boolean }) => {
      await updateProduct(venueId!, productId, { active: status })
      return { productId, status }
    },
    onMutate: async ({ productId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['products', venueId] })
      const previousProducts = queryClient.getQueryData<Product[]>(['products', venueId])
      queryClient.setQueryData<Product[]>(['products', venueId], old => {
        if (!old) return old
        return old.map(p => (p.id === productId ? { ...p, active: status } : p))
      })
      return { previousProducts }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: tCommon('error'),
        description: t('services.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
    onSuccess: (data) => {
      toast({
        title: data.status ? t('services.toasts.activated') : t('services.toasts.deactivated'),
        description: t('services.toasts.saved'),
      })
    },
  })

  const deleteServiceMutation = useMutation({
    mutationFn: async (productId: string) => {
      await deleteProduct(venueId!, productId)
      return productId
    },
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: t('services.toasts.deleted'),
        description: t('services.toasts.deletedDesc'),
      })
    },
    onError: () => {
      setDeleteDialogOpen(false)
      toast({
        title: tCommon('error'),
        description: t('services.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Columns
  const columns: ColumnDef<Product, unknown>[] = useMemo(
    () => [
      {
        id: 'imageUrl',
        accessorKey: 'imageUrl',
        header: () => <div className="flex-row-center">{t('services.columns.photo')}</div>,
        cell: ({ cell, row }) => {
          const imgUrl = cell.getValue() as string
          const productId = row.original.id
          const hasError = imageErrors[productId]
          return (
            <div className="w-12 h-12 overflow-hidden bg-muted rounded">
              {imgUrl && !hasError ? (
                <img
                  src={imgUrl}
                  alt=""
                  className="object-cover h-12 w-12"
                  onError={() => setImageErrors(prev => ({ ...prev, [productId]: true }))}
                />
              ) : imgUrl && hasError ? (
                <div className="flex items-center justify-center w-full h-full bg-muted">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <UploadCloud className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          )
        },
        enableSorting: false,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => (
          <div
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="cursor-pointer flex-row-center"
          >
            {t('services.columns.name')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </div>
        ),
        cell: ({ cell }) => cell.getValue() as string,
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: t('services.columns.type'),
        cell: ({ cell }) => {
          const type = cell.getValue() as string
          const isClass = type === 'CLASS'
          return (
            <Badge variant="secondary" className="gap-1">
              {isClass ? <Users className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              {isClass ? t('services.types.class') : t('services.types.service')}
            </Badge>
          )
        },
        enableSorting: false,
      },
      {
        id: 'price',
        accessorKey: 'price',
        header: ({ column }) => (
          <div
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="cursor-pointer flex-row-center"
          >
            {t('services.columns.price')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </div>
        ),
        cell: ({ cell }) => <span>{Currency(cell.getValue() as number)}</span>,
      },
      {
        id: 'details',
        header: t('services.columns.details'),
        enableSorting: false,
        cell: ({ row }) => {
          const product = row.original
          if (product.type === 'APPOINTMENTS_SERVICE' && product.duration) {
            return (
              <span className="text-muted-foreground text-sm">
                {t('services.detail.duration', { minutes: product.duration })}
              </span>
            )
          }
          if (product.type === 'CLASS' && product.maxParticipants) {
            return (
              <span className="text-muted-foreground text-sm">
                {t('services.detail.participants', { count: product.maxParticipants })}
              </span>
            )
          }
          return <span className="text-muted-foreground">-</span>
        },
      },
      {
        id: 'available',
        accessorKey: 'active',
        header: t('services.columns.available'),
        enableColumnFilter: false,
        cell: ({ row }) => {
          const product = row.original
          const isActive = product.active
          return (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <Switch
                checked={isActive}
                onCheckedChange={checked => {
                  toggleActive.mutate({ productId: product.id, status: checked })
                }}
                className={
                  isActive
                    ? 'data-[state=checked]:bg-green-500'
                    : 'data-[state=unchecked]:bg-red-500'
                }
              />
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        enableColumnFilter: false,
        cell: ({ row }) => {
          const product = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="sr-only">{tCommon('actions')}</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" sideOffset={5}>
                <DropdownMenuLabel>{tCommon('actions')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <PermissionGate permission="menu:update">
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      setEditProductId(product.id)
                      setEditWizardOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {tCommon('edit')}
                  </DropdownMenuItem>
                </PermissionGate>
                <PermissionGate permission="menu:delete">
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      setProductToDelete(product)
                      setDeleteDialogOpen(true)
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {tCommon('delete')}
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [t, tCommon, imageErrors, toggleActive],
  )

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between mb-6">
        <PageTitleWithInfo
          title={t('services.title')}
          className="text-xl font-semibold"
          tooltip={t('services.emptyState')}
        />
        <PermissionGate permission="menu:create">
          <Button onClick={() => setTypeSelectorOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>{t('services.new')}</span>
          </Button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Expandable search bar */}
        <div className="relative flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={tCommon('search')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      if (!searchTerm) setIsSearchOpen(false)
                    }
                  }}
                  className="h-8 w-[200px] pl-8 pr-8 text-sm rounded-full"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => {
                  setSearchTerm('')
                  setIsSearchOpen(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant={searchTerm ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          {searchTerm && !isSearchOpen && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        {/* Type Filter */}
        <FilterPill
          label={t('services.filters.typeLabel')}
          activeValue={getFilterDisplayLabel(typeFilter, typeOptions)}
          isActive={typeFilter.length > 0}
          onClear={() => setTypeFilter([])}
        >
          <CheckboxFilterContent
            title={t('services.filters.typeLabel')}
            options={typeOptions}
            selectedValues={typeFilter}
            onApply={setTypeFilter}
          />
        </FilterPill>

        {/* Status Filter */}
        <FilterPill
          label={t('services.filters.statusLabel')}
          activeValue={getFilterDisplayLabel(statusFilter, statusOptions)}
          isActive={statusFilter.length > 0}
          onClear={() => setStatusFilter([])}
        >
          <CheckboxFilterContent
            title={t('services.filters.statusLabel')}
            options={statusOptions}
            selectedValues={statusFilter}
            onApply={setStatusFilter}
          />
        </FilterPill>

        {/* Reset filters */}
        {activeFiltersCount > 0 && (
          <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 gap-1.5 rounded-full">
            <X className="h-3.5 w-3.5" />
            {tCommon('clearFilters', { defaultValue: 'Borrar filtros' })}
          </Button>
        )}
      </div>

      <DataTable
        data={filteredServices}
        rowCount={filteredServices.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={false}
        tableId="menu:services"
        pagination={pagination}
        setPagination={setPagination}
        onRowClick={row => {
          setEditProductId(row.id)
          setEditWizardOpen(true)
        }}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('services.detail.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('services.detail.deleteMessage')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (productToDelete) {
                  deleteServiceMutation.mutate(productToDelete.id)
                }
              }}
              disabled={deleteServiceMutation.isPending}
            >
              {deleteServiceMutation.isPending
                ? t('services.toasts.deleted')
                : t('services.detail.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Service Type Selector (shown first) */}
      <ServiceTypeSelectorDialog
        open={typeSelectorOpen}
        onOpenChange={setTypeSelectorOpen}
        onSelect={type => {
          setSelectedServiceType(type)
          setCreateWizardOpen(true)
        }}
      />

      {/* Service Form for Create Mode */}
      <ServiceFormDialog
        open={createWizardOpen}
        onOpenChange={open => {
          setCreateWizardOpen(open)
          if (!open) setSelectedServiceType(null)
        }}
        mode="create"
        serviceType={selectedServiceType}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products', venueId] })
        }}
      />

      {/* Service Form for Edit Mode */}
      <ServiceFormDialog
        open={editWizardOpen}
        onOpenChange={open => {
          setEditWizardOpen(open)
          if (!open) setEditProductId(null)
        }}
        mode="edit"
        productId={editProductId ?? undefined}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products', venueId] })
        }}
      />
    </div>
  )
}
