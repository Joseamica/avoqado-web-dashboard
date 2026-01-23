import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import {
  purchaseOrderService,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderFilters,
  getStatusBadgeColor,
  formatPrice,
} from '@/services/purchaseOrder.service'
import { supplierService } from '@/services/supplier.service'
import { StaffRole } from '@/types'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { ColumnCustomizer } from '@/components/filters/ColumnCustomizer'
import { DateFilterContent, type DateFilter } from '@/components/filters/DateFilterContent'
import { RangeFilterContent } from '@/components/filters/RangeFilterContent'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Plus, Search, MoreVertical, Pencil, Trash2, Eye, X, Copy, FileText, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ColumnDef } from '@tanstack/react-table'
import { PurchaseOrderWizard } from './components/PurchaseOrderWizard'

export default function PurchaseOrdersPage() {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { venue, fullBasePath } = useCurrentVenue()
  const { staffInfo } = useAuth()
  const { toast } = useToast()
  const isSuperAdmin = staffInfo?.role === StaffRole.SUPERADMIN

  // Filters state
  const [orderNumberFilter, setOrderNumberFilter] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<PurchaseOrderStatus[]>([])
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const [deliveryDateFilter, setDeliveryDateFilter] = useState<DateFilter | null>(null)
  const [totalRange, setTotalRange] = useState<{ min: string; max: string } | null>(null)
  const [itemsRange, setItemsRange] = useState<{ min: number; max: number } | null>(null)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const debouncedOrderNumber = useDebounce(orderNumberFilter, 300)

  // Column visibility state
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null)

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [duplicateFromOrder, setDuplicateFromOrder] = useState<any>(null)

  // Check for duplicate data in sessionStorage on mount
  useEffect(() => {
    const duplicateData = sessionStorage.getItem('duplicatePOData')
    // console.log('🔍 Checking sessionStorage for duplicate data:', duplicateData)
    if (duplicateData) {
      try {
        const orderData = JSON.parse(duplicateData)
        // console.log('✅ Parsed duplicate data:', orderData)
        setDuplicateFromOrder(orderData)
        // Use setTimeout to ensure state updates before opening wizard
        setTimeout(() => {
          setWizardOpen(true)
        }, 0)
        sessionStorage.removeItem('duplicatePOData')
      } catch (error) {
        console.error('❌ Error parsing duplicate data:', error)
        sessionStorage.removeItem('duplicatePOData')
      }
    }
  }, [])

  // Build filters for backend
  const filters: PurchaseOrderFilters = useMemo(() => {
    const f: PurchaseOrderFilters = {}
    if (selectedStatuses.length > 0) f.status = selectedStatuses
    if (debouncedSearchTerm) f.search = debouncedSearchTerm
    return f
  }, [selectedStatuses, debouncedSearchTerm])

  // Fetch purchase orders
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchase-orders', venue?.id, filters],
    queryFn: () => purchaseOrderService.getPurchaseOrders(venue!.id, filters),
    enabled: !!venue,
  })

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', venue?.id],
    queryFn: () => supplierService.getSuppliers(venue!.id),
    enabled: !!venue,
  })

  // Apply filters in frontend
  const filteredPurchaseOrders = useMemo(() => {
    let orders = purchaseOrders?.data || []

    // General search filter (searches across multiple fields)
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase()
      orders = orders.filter((po) => {
        return (
          po.orderNumber.toLowerCase().includes(searchLower) ||
          po.supplier?.name?.toLowerCase().includes(searchLower) ||
          po.total.toString().includes(searchLower) ||
          po.status.toLowerCase().includes(searchLower) ||
          po.notes?.toLowerCase().includes(searchLower)
        )
      })
    }

    // Order number filter
    if (debouncedOrderNumber) {
      orders = orders.filter((po) =>
        po.orderNumber.toLowerCase().includes(debouncedOrderNumber.toLowerCase())
      )
    }

    // Supplier filter
    if (selectedSuppliers.length > 0) {
      orders = orders.filter((po) => selectedSuppliers.includes(po.supplier.id))
    }

    // Date filter
    if (dateFilter) {
      const now = new Date()
      orders = orders.filter((po) => {
        const orderDate = new Date(po.orderDate)
        switch (dateFilter.operator) {
          case 'last': {
            const value = typeof dateFilter.value === 'number' ? dateFilter.value : parseInt(dateFilter.value as string) || 0
            const cutoffDate = new Date()
            switch (dateFilter.unit) {
              case 'hours':
                cutoffDate.setHours(now.getHours() - value)
                break
              case 'days':
                cutoffDate.setDate(now.getDate() - value)
                break
              case 'weeks':
                cutoffDate.setDate(now.getDate() - value * 7)
                break
              case 'months':
                cutoffDate.setMonth(now.getMonth() - value)
                break
            }
            return orderDate >= cutoffDate
          }
          case 'before': {
            const targetDate = new Date(dateFilter.value as string)
            return orderDate < targetDate
          }
          case 'after': {
            const targetDate = new Date(dateFilter.value as string)
            return orderDate > targetDate
          }
          case 'between': {
            const startDate = new Date(dateFilter.value as string)
            const endDate = new Date(dateFilter.value2 as string)
            endDate.setHours(23, 59, 59, 999)
            return orderDate >= startDate && orderDate <= endDate
          }
          case 'on': {
            const targetDate = new Date(dateFilter.value as string)
            return (
              orderDate.getFullYear() === targetDate.getFullYear() &&
              orderDate.getMonth() === targetDate.getMonth() &&
              orderDate.getDate() === targetDate.getDate()
            )
          }
          default:
            return true
        }
      })
    }

    // Delivery date filter
    if (deliveryDateFilter) {
      const now = new Date()
      orders = orders.filter((po) => {
        if (!po.expectedDeliveryDate) return false
        const deliveryDate = new Date(po.expectedDeliveryDate)
        switch (deliveryDateFilter.operator) {
          case 'last': {
            const value = typeof deliveryDateFilter.value === 'number' ? deliveryDateFilter.value : parseInt(deliveryDateFilter.value as string) || 0
            const cutoffDate = new Date()
            switch (deliveryDateFilter.unit) {
              case 'hours':
                cutoffDate.setHours(now.getHours() - value)
                break
              case 'days':
                cutoffDate.setDate(now.getDate() - value)
                break
              case 'weeks':
                cutoffDate.setDate(now.getDate() - value * 7)
                break
              case 'months':
                cutoffDate.setMonth(now.getMonth() - value)
                break
            }
            return deliveryDate >= cutoffDate
          }
          case 'before': {
            const targetDate = new Date(deliveryDateFilter.value as string)
            return deliveryDate < targetDate
          }
          case 'after': {
            const targetDate = new Date(deliveryDateFilter.value as string)
            return deliveryDate > targetDate
          }
          case 'between': {
            const startDate = new Date(deliveryDateFilter.value as string)
            const endDate = new Date(deliveryDateFilter.value2 as string)
            endDate.setHours(23, 59, 59, 999)
            return deliveryDate >= startDate && deliveryDate <= endDate
          }
          case 'on': {
            const targetDate = new Date(deliveryDateFilter.value as string)
            return (
              deliveryDate.getFullYear() === targetDate.getFullYear() &&
              deliveryDate.getMonth() === targetDate.getMonth() &&
              deliveryDate.getDate() === targetDate.getDate()
            )
          }
          default:
            return true
        }
      })
    }

    // Total range filter
    if (totalRange) {
      orders = orders.filter((po) => {
        const total = parseFloat(po.total)
        const min = totalRange.min ? parseFloat(totalRange.min) : -Infinity
        const max = totalRange.max ? parseFloat(totalRange.max) : Infinity
        return total >= min && total <= max
      })
    }

    // Items count range filter
    if (itemsRange) {
      orders = orders.filter((po) => {
        const itemCount = po.items.length
        const min = itemsRange.min ?? -Infinity
        const max = itemsRange.max ?? Infinity
        return itemCount >= min && itemCount <= max
      })
    }

    return orders
  }, [purchaseOrders?.data, debouncedSearchTerm, debouncedOrderNumber, selectedSuppliers, dateFilter, deliveryDateFilter, totalRange, itemsRange])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (poId: string) => purchaseOrderService.cancelPurchaseOrder(venue!.id, poId, 'Deleted by admin'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast({ description: t('delete.success') })
      setDeleteDialogOpen(false)
      setPoToDelete(null)
    },
    onError: () => {
      toast({ description: t('delete.error'), variant: 'destructive' })
    },
  })

  // Status filter options
  const statusOptions = useMemo(() => [
    { value: PurchaseOrderStatus.DRAFT, label: t('statuses.DRAFT') },
    { value: PurchaseOrderStatus.PENDING_APPROVAL, label: t('statuses.PENDING_APPROVAL') },
    { value: PurchaseOrderStatus.APPROVED, label: t('statuses.APPROVED') },
    { value: PurchaseOrderStatus.SENT, label: t('statuses.SENT') },
    { value: PurchaseOrderStatus.CONFIRMED, label: t('statuses.CONFIRMED') },
    { value: PurchaseOrderStatus.SHIPPED, label: t('statuses.SHIPPED') },
    { value: PurchaseOrderStatus.PARTIAL, label: t('statuses.PARTIAL') },
    { value: PurchaseOrderStatus.RECEIVED, label: t('statuses.RECEIVED') },
    { value: PurchaseOrderStatus.CANCELLED, label: t('statuses.CANCELLED') },
  ], [t])

  // Supplier filter options
  const supplierOptions = useMemo(() =>
    (suppliers?.data || []).map(s => ({ value: s.id, label: s.name })),
    [suppliers]
  )

  // Helper to get display label for date filters
  const getDateFilterLabel = useCallback((filter: DateFilter | null) => {
    if (!filter) return null
    switch (filter.operator) {
      case 'last': {
        const unitLabels: Record<string, string> = {
          hours: t('filters.dateUnits.hours', { defaultValue: 'horas' }),
          days: t('filters.dateUnits.days', { defaultValue: 'días' }),
          weeks: t('filters.dateUnits.weeks', { defaultValue: 'semanas' }),
          months: t('filters.dateUnits.months', { defaultValue: 'meses' }),
        }
        return `${t('filters.dateLabels.last', { defaultValue: 'Últimos' })} ${filter.value} ${unitLabels[filter.unit || 'days']}`
      }
      case 'before':
        return `${t('filters.dateLabels.before', { defaultValue: 'Antes de' })} ${filter.value}`
      case 'after':
        return `${t('filters.dateLabels.after', { defaultValue: 'Después de' })} ${filter.value}`
      case 'between':
        return `${filter.value} - ${filter.value2}`
      case 'on':
        return `${t('filters.dateLabels.on', { defaultValue: 'En' })} ${filter.value}`
      default:
        return null
    }
  }, [t])

  // Helper to get display label for multi-select filters
  const getFilterDisplayLabel = useCallback((selectedValues: string[], options: { value: string; label: string }[]) => {
    if (selectedValues.length === 0) return null
    if (selectedValues.length === 1) {
      return options.find(o => o.value === selectedValues[0])?.label || null
    }
    return `${selectedValues.length} ${t('filters.selected', { defaultValue: 'seleccionados' })}`
  }, [t])

  // Handlers
  const handleDeleteClick = useCallback((po: PurchaseOrder) => {
    setPoToDelete(po)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (poToDelete) {
      deleteMutation.mutate(poToDelete.id)
    }
  }, [poToDelete, deleteMutation])

  const handleRowClick = useCallback(
    (po: PurchaseOrder) => {
      navigate(`${fullBasePath}/inventory/purchase-orders/${po.id}`)
    },
    [navigate, fullBasePath]
  )

  const handleCreateClick = useCallback(() => {
    setWizardOpen(true)
  }, [])

  const handleDuplicate = useCallback((po: PurchaseOrder) => {
    // console.log('🔄 Duplicating order from list:', po)
    const duplicateData = {
      supplierId: po.supplierId,
      supplier: po.supplier,
      items: po.items.map(item => ({
        rawMaterialId: item.rawMaterial.id,
        rawMaterial: item.rawMaterial,
        quantityOrdered: item.quantityOrdered,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })),
      taxRate: po.taxRate,
      commissionRate: po.commissionRate,
      notes: po.notes,
    }
    // console.log('📦 Duplicate data prepared:', duplicateData)

    setDuplicateFromOrder(duplicateData)
    // Use setTimeout to ensure state updates before opening wizard
    setTimeout(() => {
      setWizardOpen(true)
    }, 0)
  }, [])

  const handleSaveAsPDF = useCallback(async (po: PurchaseOrder) => {
    try {
      const blob = await purchaseOrderService.generatePDF(venue!.id, po.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `orden-compra-${po.orderNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast({ description: t('actions.pdfDownloaded', { defaultValue: 'PDF descargado' }) })
    } catch (_error) {
      toast({
        description: t('actions.pdfError', { defaultValue: 'Error al generar PDF' }),
        variant: 'destructive',
      })
    }
  }, [t, toast, venue])

  const handleSaveAsCSV = useCallback((po: PurchaseOrder) => {
    const headers = ['Item', 'SKU', 'Quantity', 'Unit Price', 'Total']
    const rows = po.items.map(item => [
      item.rawMaterial.name,
      item.rawMaterial.sku || 'N/A',
      item.quantityOrdered,
      item.unitPrice,
      (Number(item.quantityOrdered) * Number(item.unitPrice)).toFixed(2),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Subtotal,,,${po.subtotal}`,
      `Tax,,,${po.taxAmount}`,
      `Total,,,${po.total}`,
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `PO-${po.orderNumber}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast({ description: t('actions.csvDownloaded', { defaultValue: 'CSV descargado' }) })
  }, [t, toast])

  // Columns definition
  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        id: 'orderNumber',
        accessorKey: 'orderNumber',
        header: t('columns.orderNumber'),
        cell: ({ row }) => (
          <div className="font-medium">{row.original.orderNumber}</div>
        ),
      },
      {
        id: 'supplier',
        accessorKey: 'supplier.name',
        header: t('columns.supplier'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.supplier.name}</div>
            {row.original.supplier.contactName && (
              <div className="text-sm text-muted-foreground">{row.original.supplier.contactName}</div>
            )}
          </div>
        ),
      },
      {
        id: 'items',
        accessorKey: 'items',
        header: t('columns.items'),
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.items.length} {row.original.items.length === 1 ? t('common:item') : t('common:items')}
          </div>
        ),
      },
      {
        id: 'total',
        accessorKey: 'total',
        header: t('columns.total'),
        cell: ({ row }) => (
          <div className="font-medium">{formatPrice(row.original.total)}</div>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('columns.status'),
        cell: ({ row }) => {
          const { variant, className } = getStatusBadgeColor(row.original.status)
          return (
            <Badge variant={variant} className={className}>
              {t(`statuses.${row.original.status}`)}
            </Badge>
          )
        },
      },
      {
        id: 'orderDate',
        accessorKey: 'orderDate',
        header: t('columns.orderDate'),
        cell: ({ row }) => (
          <div className="text-sm">
            {new Date(row.original.orderDate).toLocaleDateString()}
          </div>
        ),
      },
      {
        id: 'expectedDeliveryDate',
        accessorKey: 'expectedDeliveryDate',
        header: t('columns.expectedDeliveryDate'),
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.expectedDeliveryDate
              ? new Date(row.original.expectedDeliveryDate).toLocaleDateString()
              : '—'}
          </div>
        ),
      },
      {
        id: 'actions',
        header: t('common:actions'),
        cell: ({ row }) => {
          const po = row.original
          const canEdit = po.status === PurchaseOrderStatus.DRAFT ||
                         po.status === PurchaseOrderStatus.CONFIRMED ||
                         po.status === PurchaseOrderStatus.RECEIVED
          const canDelete = canEdit // Same conditions for delete

          return (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRowClick(po)
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {t('actions.details', { defaultValue: 'Detalles' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDuplicate(po)
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {t('actions.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleSaveAsPDF(po)
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t('actions.saveAsPDF')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSaveAsCSV(po)
                    }}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {t('actions.saveAsCSV')}
                  </DropdownMenuItem>

                  {isSuperAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      {canEdit && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`${fullBasePath}/inventory/purchase-orders/${po.id}/edit`)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('common:edit')}
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(po)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('common:delete')}
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [t, isSuperAdmin, venue, navigate, handleDeleteClick, handleRowClick, handleDuplicate, handleSaveAsPDF, handleSaveAsCSV, fullBasePath]
  )

  // Filter visible columns
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => !hiddenColumns.includes(col.id || ''))
  }, [columns, hiddenColumns])

  // Available columns for customizer
  const availableColumns = useMemo(() => {
    return columns.map((col) => ({
      id: col.id || '',
      label: typeof col.header === 'string' ? col.header : col.id || '',
      visible: !hiddenColumns.includes(col.id || ''),
    }))
  }, [columns, hiddenColumns])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {/* Filters - All in one row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Expandable Search */}
        <div className="relative flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('search.placeholder')}
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
              {searchTerm && <span className="sr-only">{t('filters.searchActive')}</span>}
            </Button>
          )}
          {/* Active search indicator dot */}
          {searchTerm && !isSearchOpen && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        {/* Order Number Filter */}
        <FilterPill
          label={t('columns.orderNumber')}
          activeValue={orderNumberFilter}
          isActive={!!orderNumberFilter}
          onClear={() => setOrderNumberFilter('')}
        >
          <div className="w-[280px] p-4">
            <h4 className="font-medium text-sm mb-3">{t('columns.orderNumber')}</h4>
            <Input
              value={orderNumberFilter}
              onChange={(e) => setOrderNumberFilter(e.target.value)}
              placeholder={t('search.placeholder', { defaultValue: 'Buscar...' })}
              autoFocus
            />
          </div>
        </FilterPill>

        {/* Supplier filter */}
        <FilterPill
          label={t('filters.supplier')}
          activeValue={getFilterDisplayLabel(selectedSuppliers, supplierOptions)}
          isActive={selectedSuppliers.length > 0}
          onClear={() => setSelectedSuppliers([])}
        >
          <CheckboxFilterContent
            title={t('filters.supplier')}
            options={supplierOptions}
            selectedValues={selectedSuppliers}
            onApply={setSelectedSuppliers}
          />
        </FilterPill>

        {/* Items Count Range Filter */}
        <FilterPill
          label={t('columns.items')}
          activeValue={
            itemsRange
              ? `${itemsRange.min || '0'} - ${itemsRange.max || '∞'}`
              : undefined
          }
          isActive={itemsRange !== null}
          onClear={() => setItemsRange(null)}
        >
          <RangeFilterContent
            title={`${t('filters.filterBy', { defaultValue: 'Filtrar por' })}: ${t('columns.items').toLowerCase()}`}
            currentRange={
              itemsRange
                ? { min: itemsRange.min?.toString() || '', max: itemsRange.max?.toString() || '' }
                : null
            }
            onApply={(range) => {
              if (!range) {
                setItemsRange(null)
              } else {
                setItemsRange({
                  min: range.min ? parseInt(range.min) : 0,
                  max: range.max ? parseInt(range.max) : Infinity,
                })
              }
            }}
            placeholder="0"
          />
        </FilterPill>

        {/* Total Range Filter */}
        <FilterPill
          label={t('columns.total')}
          activeValue={
            totalRange
              ? `$${totalRange.min || '0'} - $${totalRange.max || '∞'}`
              : undefined
          }
          isActive={totalRange !== null}
          onClear={() => setTotalRange(null)}
        >
          <RangeFilterContent
            title={`${t('filters.filterBy', { defaultValue: 'Filtrar por' })}: ${t('columns.total').toLowerCase()}`}
            currentRange={totalRange}
            onApply={setTotalRange}
            prefix="$"
            placeholder="0.00"
          />
        </FilterPill>

        {/* Status filter */}
        <FilterPill
          label={t('filters.status')}
          activeValue={getFilterDisplayLabel(selectedStatuses as string[], statusOptions)}
          isActive={selectedStatuses.length > 0}
          onClear={() => setSelectedStatuses([])}
        >
          <CheckboxFilterContent
            title={t('filters.status')}
            options={statusOptions}
            selectedValues={selectedStatuses as string[]}
            onApply={(values) => setSelectedStatuses(values as PurchaseOrderStatus[])}
          />
        </FilterPill>

        {/* Date Filter Pill */}
        <FilterPill
          label={t('columns.orderDate')}
          activeValue={getDateFilterLabel(dateFilter)}
          isActive={dateFilter !== null}
          onClear={() => setDateFilter(null)}
        >
          <DateFilterContent
            title={`${t('filters.filterBy', { defaultValue: 'Filtrar por' })}: ${t('columns.orderDate').toLowerCase()}`}
            currentFilter={dateFilter}
            onApply={setDateFilter}
          />
        </FilterPill>

        {/* Expected Delivery Date Filter */}
        <FilterPill
          label={t('columns.expectedDeliveryDate')}
          activeValue={getDateFilterLabel(deliveryDateFilter)}
          isActive={deliveryDateFilter !== null}
          onClear={() => setDeliveryDateFilter(null)}
        >
          <DateFilterContent
            title={`${t('filters.filterBy', { defaultValue: 'Filtrar por' })}: ${t('columns.expectedDeliveryDate').toLowerCase()}`}
            currentFilter={deliveryDateFilter}
            onApply={setDeliveryDateFilter}
          />
        </FilterPill>

        {/* Clear all filters */}
        {(orderNumberFilter ||
          selectedStatuses.length > 0 ||
          selectedSuppliers.length > 0 ||
          searchTerm ||
          dateFilter ||
          deliveryDateFilter ||
          totalRange ||
          itemsRange) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOrderNumberFilter('')
              setSelectedStatuses([])
              setSelectedSuppliers([])
              setSearchTerm('')
              setIsSearchOpen(false)
              setDateFilter(null)
              setDeliveryDateFilter(null)
              setTotalRange(null)
              setItemsRange(null)
            }}
          >
            {t('filters.clearAll')}
          </Button>
        )}

        <div className="flex-1" />

        {/* Column customizer */}
        <ColumnCustomizer
          columns={availableColumns}
          onApply={(visibleColumnIds) => {
            const allColumnIds = columns.map((col) => col.id || '')
            const hidden = allColumnIds.filter((id) => !visibleColumnIds.includes(id))
            setHiddenColumns(hidden)
          }}
        />
      </div>

      {/* Table */}
      <DataTable<PurchaseOrder>
        columns={visibleColumns}
        data={filteredPurchaseOrders}
        rowCount={filteredPurchaseOrders.length}
        isLoading={isLoading}
        onRowClick={handleRowClick}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.confirm.description', { orderNumber: poToDelete?.orderNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              {t('delete.confirm.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Order Wizard */}
      <PurchaseOrderWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setDuplicateFromOrder(null)
        }}
        onSuccess={() => {
          setWizardOpen(false)
          setDuplicateFromOrder(null)
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
        }}
        duplicateFrom={duplicateFromOrder}
        mode="create"
      />
    </div>
  )
}
