import { getProducts, updateProduct, deleteProduct } from '@/services/menu.service'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, UploadCloud, ImageIcon, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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

export default function Products() {
  const { t, i18n } = useTranslation('menu')
  const { venueId } = useCurrentVenue()

  const location = useLocation()
  const navigate = useNavigate()

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', venueId],
    queryFn: () => getProducts(venueId!),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: boolean }) => {
      await updateProduct(venueId!, productId, { active: status })
      return { productId, status }
    },
    onMutate: async ({ productId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products', venueId] })

      // Snapshot the previous value
      const previousProducts = queryClient.getQueryData<Product[]>(['products', venueId])

      // Optimistically update the cache
      queryClient.setQueryData<Product[]>(['products', venueId], old => {
        if (!old) return old
        return old.map(product => (product.id === productId ? { ...product, active: status } : product))
      })

      // Return a context object with the snapshotted value
      return { previousProducts }
    },
    onError: (_, __, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProducts) {
        queryClient.setQueryData(['products', venueId], context.previousProducts)
      }
    },
    onSuccess: data => {
      toast({
        title: data.status ? t('products.toasts.activated') : t('products.toasts.deactivated'),
        description: t('products.toasts.saved'),
      })
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      await deleteProduct(venueId!, productId)
      return productId
    },
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: t('products.detail.toasts.deleted'),
        description: t('products.detail.toasts.deletedDesc'),
      })
    },
    onError: () => {
      setDeleteDialogOpen(false)
      toast({
        title: t('common.error'),
        description: t('products.detail.toasts.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<Product, unknown>[] = [
    {
      id: 'imageUrl',
      accessorKey: 'imageUrl',
      sortDescFirst: true,
      meta: { label: t('products.columns.photo') },
      header: () => <div className=" flex-row-center">{t('products.columns.photo')}</div>,

      cell: ({ cell, row }) => {
        const imageUrl = cell.getValue() as string
        const productId = row.original.id
        const hasError = imageErrors[productId]

        return (
          <div className="w-12 h-12 overflow-hidden bg-muted rounded">
            {imageUrl && !hasError ? (
              <img
                src={imageUrl}
                alt={t('products.imageAlt')}
                className="object-cover h-12 w-12"
                onError={() => setImageErrors(prev => ({ ...prev, [productId]: true }))}
              />
            ) : imageUrl && hasError ? (
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
    },
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: t('products.columns.name') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('products.columns.name')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => {
        return cell.getValue() as string
      },
    },
    {
      id: 'price',
      accessorKey: 'price',
      sortDescFirst: true,
      meta: { label: t('products.columns.price') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('products.columns.price')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => {
        const price = cell.getValue() as number
        return <ul>{Currency(price, false)}</ul>
      },
    },

    {
      id: 'categories',
      accessorKey: 'categories',
      meta: { label: t('products.columns.categories') },
      header: t('products.columns.categories'),
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'modifierGroups',
      accessorKey: 'modifierGroups',
      meta: { label: t('products.columns.modifierGroups') },
      header: t('products.columns.modifierGroups'),
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'updatedAt',
      accessorKey: 'updatedAt',
      meta: { label: t('products.columns.updatedAt') },
      header: t('products.columns.updatedAt'),
      enableColumnFilter: false,
      cell: ({ cell }) => {
        const updatedAt = cell.getValue() as string
        return (
          <span>
            {new Date(updatedAt).toLocaleDateString(getIntlLocale(i18n.language), {
              day: 'numeric',
              month: 'numeric',
            })}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: t('common.actions'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                <span className="sr-only">{t('modifiers.actions.openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <PermissionGate permission="menu:update">
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    navigate(product.id, { state: { from: location.pathname } })
                  }}
                  className="cursor-pointer"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t('common.edit')}
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
                  {t('common.delete')}
                </DropdownMenuItem>
              </PermissionGate>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
    {
      id: 'id',
      accessorKey: 'active',
      header: '',
      enableColumnFilter: false,
      cell: ({ row, cell }) => {
        const productId = row.original.id as string
        const active = cell.getValue() as boolean

        return (
          <Switch
            id={`active-switch-${productId}`}
            checked={active}
            onCheckedChange={() => toggleActive.mutate({ productId, status: !active })}
            onClick={e => e.stopPropagation()} // Prevent row click when switch is clicked
            disabled={toggleActive.isPending}
          />
        )
      },
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, products: any[]) => {
    if (!searchTerm) return products

    const lowerSearchTerm = searchTerm.toLowerCase()

    return products.filter(product => {
      const nameMatches = product.name.toLowerCase().includes(lowerSearchTerm)
      const modifierGroupMatches =
        product.modifierGroups?.some(modifierGroup => modifierGroup.group?.name.toLowerCase().includes(lowerSearchTerm)) || false
      const categoryMatches = product.category?.name.toLowerCase().includes(lowerSearchTerm) || false
      return nameMatches || modifierGroupMatches || categoryMatches
    })
  }, [])

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('products.title')}</h1>
        <PermissionGate permission="menu:create">
          <Button asChild>
            <Link
              to={`create`}
              state={{
                from: location.pathname,
              }}
              className="flex items-center space-x-2"
            >
              <span>{t('products.new')}</span>
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <DataTable
        data={products || []}
        rowCount={products?.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('common.search')}
        onSearch={handleSearch}
        tableId="menu:products"
        pagination={pagination}
        setPagination={setPagination}
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.detail.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('products.detail.deleteMessage')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('forms.buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (productToDelete) {
                  deleteProductMutation.mutate(productToDelete.id)
                }
              }}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? t('products.detail.toasts.deleted') : t('products.detail.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
