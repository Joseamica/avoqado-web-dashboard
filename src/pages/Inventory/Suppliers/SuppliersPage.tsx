import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supplierService, type Supplier } from '@/services/supplier.service'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SupplierDialog } from './components/SupplierDialog'
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
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { ColumnCustomizer } from '@/components/filters/ColumnCustomizer'
import { useDebounce } from '@/hooks/useDebounce'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

export default function SuppliersPage() {
  const { venueId } = useCurrentVenue()
  const { staffInfo } = useAuth()
  const isSuperAdmin = staffInfo?.role === 'SUPERADMIN'
  const { t } = useTranslation('suppliers')
  const tCommon = useTranslation().t
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Multi-select filters (Stripe-style)
  const [activeFilter, setActiveFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name',
    'contactName',
    'phone',
    'email',
    'active',
  ])

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  // Query suppliers
  const {
    data,
    isLoading,
    refetch: _refetch,
  } = useQuery({
    queryKey: ['suppliers', venueId, debouncedSearchTerm],
    queryFn: async () => {
      const response = await supplierService.getSuppliers(venueId, {
        search: debouncedSearchTerm || undefined,
      })
      return response
    },
    staleTime: 0,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (supplierId: string) => supplierService.deleteSupplier(venueId, supplierId),
    onSuccess: () => {
      toast({
        title: t('delete.success'),
      })
      queryClient.invalidateQueries({ queryKey: ['suppliers', venueId] })
      setDeleteDialogOpen(false)
      setSupplierToDelete(null)
    },
    onError: (error: Error) => {
      toast({
        title: t('delete.error'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Event handlers
  const handleEditClick = useCallback((e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation()
    setSelectedSupplier(supplier)
    setDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback((e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation()
    setSupplierToDelete(supplier)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDelete = useCallback(() => {
    if (supplierToDelete) {
      deleteMutation.mutate(supplierToDelete.id)
    }
  }, [supplierToDelete, deleteMutation])

  // Columns definition
  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: 'name',
        meta: { label: t('columns.name') },
        header: () => <span className="text-xs font-medium">{t('columns.name')}</span>,
        cell: ({ cell }) => (
          <span className="text-xs font-medium">{cell.getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'contactName',
        meta: { label: t('columns.contact') },
        header: () => <span className="text-xs font-medium">{t('columns.contact')}</span>,
        cell: ({ cell }) => (
          <span className="text-xs text-muted-foreground">
            {(cell.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'phone',
        meta: { label: t('columns.phone') },
        header: () => <span className="text-xs font-medium">{t('columns.phone')}</span>,
        cell: ({ cell }) => (
          <span className="text-xs text-muted-foreground">
            {(cell.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        meta: { label: t('columns.email') },
        header: () => <span className="text-xs font-medium">{t('columns.email')}</span>,
        cell: ({ cell }) => (
          <span className="text-xs text-muted-foreground">
            {(cell.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'active',
        meta: { label: t('columns.status') },
        header: () => <span className="text-xs font-medium">{t('columns.status')}</span>,
        cell: ({ cell }) => {
          const isActive = cell.getValue() as boolean
          const statusClasses = isActive
            ? { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400' }
            : { bg: 'bg-secondary dark:bg-secondary', text: 'text-secondary-foreground' }

          return (
            <Badge
              variant="soft"
              className={`${statusClasses.bg} ${statusClasses.text} border-transparent text-[10px] px-1.5 py-0 h-5`}
            >
              {isActive ? t('statuses.active') : t('statuses.inactive')}
            </Badge>
          )
        },
      },
      // SUPERADMIN actions column
      ...(isSuperAdmin
        ? [
            {
              id: 'actions',
              header: () => (
                <span className="text-xs font-medium bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">
                  Superadmin
                </span>
              ),
              cell: ({ row }: { row: { original: Supplier } }) => (
                <div className="flex items-center justify-end">
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
                    <Button
                      size="icon"
                      className="h-7 w-7 bg-background hover:bg-muted text-foreground border-0"
                      onClick={e => handleEditClick(e, row.original)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-7 w-7 bg-background hover:bg-destructive/10 text-destructive border-0"
                      onClick={e => handleDeleteClick(e, row.original)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ),
              size: 120,
            },
          ]
        : []),
    ],
    [t, isSuperAdmin, handleEditClick, handleDeleteClick]
  )

  // Filtered columns based on visibility
  const filteredColumns = useMemo(
    () =>
      columns.filter(col => {
        const colId = col.id || (col as any).accessorKey
        if (!colId) return true
        if (colId === 'actions') return true // Always show actions
        return visibleColumns.includes(colId)
      }),
    [columns, visibleColumns]
  )

  // Client-side filtering
  const filteredData = useMemo(() => {
    let suppliers = data?.data || []

    // Filter by active status (multi-select)
    if (activeFilter.length > 0) {
      suppliers = suppliers.filter((s: Supplier) => {
        if (activeFilter.includes('active') && s.active) return true
        if (activeFilter.includes('inactive') && !s.active) return true
        return false
      })
    }

    return suppliers
  }, [data?.data, activeFilter])

  // Active filters count
  const activeFiltersCount = [activeFilter.length > 0, searchTerm !== ''].filter(Boolean).length

  // Reset all filters
  const resetFilters = useCallback(() => {
    setActiveFilter([])
    setSearchTerm('')
  }, [])

  // Get display label for active filter
  const getActiveFilterLabel = useCallback(() => {
    if (activeFilter.length === 0) return null
    if (activeFilter.length === 1) {
      return activeFilter[0] === 'active' ? t('statuses.active') : t('statuses.inactive')
    }
    return `${activeFilter.length} ${t('filters.selected')}`
  }, [activeFilter, t])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setSelectedSupplier(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <Input
          placeholder={t('search.placeholder')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-64"
        />

        {/* Status filter */}
        <FilterPill
          label={t('filters.status')}
          isActive={activeFilter.length > 0}
          activeLabel={getActiveFilterLabel()}
          onClear={() => setActiveFilter([])}
        >
          <CheckboxFilterContent
            title={t('filters.status')}
            options={[
              { value: 'active', label: t('statuses.active') },
              { value: 'inactive', label: t('statuses.inactive') },
            ]}
            selectedValues={activeFilter}
            onApply={setActiveFilter}
          />
        </FilterPill>

        {/* Column customizer */}
        <ColumnCustomizer
          columns={columns
            .filter(col => col.id !== 'actions')
            .map(col => ({
              id: col.id || (col as any).accessorKey,
              label: (col.meta as any)?.label || col.id || (col as any).accessorKey,
              visible: visibleColumns.includes(col.id || (col as any).accessorKey),
            }))}
          onApply={setVisibleColumns}
        />

        {/* Clear all filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t('filters.clearAll')} ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={filteredColumns}
        data={filteredData}
        rowCount={filteredData.length}
        isLoading={isLoading}
        showColumnCustomizer={false}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.confirm.description', { name: supplierToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              {t('delete.confirm.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Supplier Dialog */}
      <SupplierDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        supplier={selectedSupplier}
      />
    </div>
  )
}
