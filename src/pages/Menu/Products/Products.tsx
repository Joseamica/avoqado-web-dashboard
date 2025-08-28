import { getProducts, updateProduct } from '@/services/menu.service'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, UploadCloud, ImageIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Link, useLocation } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Product } from '@/types'
import { Currency } from '@/utils/currency'

export default function Products() {
  const { t } = useTranslation()
  const { i18n } = useTranslation()
  const { venueId } = useCurrentVenue()

  const location = useLocation()

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

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
                alt="product"
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

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products

    const lowerSearchTerm = searchTerm.toLowerCase()

    return products?.filter(product => {
      // Buscar en el name del producto, grupos de modificadores y categoría
      const nameMatches = product.name.toLowerCase().includes(lowerSearchTerm)
      const modifierGroupMatches =
        product.modifierGroups?.some(modifierGroup => modifierGroup.group?.name.toLowerCase().includes(lowerSearchTerm)) || false
      const categoryMatches = product.category?.name.toLowerCase().includes(lowerSearchTerm) || false
      return nameMatches || modifierGroupMatches || categoryMatches
    })
  }, [searchTerm, products])

  // if (isLoading) return <div>Loading...</div>

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">{t('products.title')}</h1>
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
      </div>
      <Input
        type="text"
        placeholder={t('common.search')}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="p-2 mt-4 mb-4 border rounded bg-bg-input max-w-72"
      />
      <DataTable
        data={filteredProducts}
        rowCount={products?.length}
        columns={columns}
        isLoading={isLoading}
        tableId="menu:products"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />
    </div>
  )
}
