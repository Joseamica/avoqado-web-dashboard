import { getProducts, updateProduct } from '@/services/menu.service'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, UploadCloud, ImageIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
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
        return old.map(product => 
          product.id === productId 
            ? { ...product, active: status }
            : product
        )
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
    onSuccess: (data) => {
      toast({
        title: `Producto ${data.status ? 'activado' : 'desactivado'}`,
        description: 'Los cambios se han guardado correctamente.',
      })
    },
  })

  const columns: ColumnDef<Product, unknown>[] = [
    {
      id: 'imageUrl',
      accessorKey: 'imageUrl',
      sortDescFirst: true,
      header: () => <div className=" flex-row-center">Foto</div>,

      cell: ({ cell, row }) => {
        const imageUrl = cell.getValue() as string
        const productId = row.original.id
        const hasError = imageErrors[productId]

        return (
          <div className="w-12 h-12 overflow-hidden bg-gray-200 rounded">
            {imageUrl && !hasError ? (
              <img 
                src={imageUrl} 
                alt="product" 
                className="object-cover h-12 w-12" 
                onError={() => setImageErrors(prev => ({ ...prev, [productId]: true }))}
              />
            ) : imageUrl && hasError ? (
              <div className="flex items-center justify-center w-full h-full bg-gray-100">
                <ImageIcon className="w-4 h-4 text-gray-400" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <UploadCloud className="w-4 h-4 text-gray-400" />
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
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          Nombre
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
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          Precio
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
      header: 'Categorías',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'modifierGroups',
      accessorKey: 'modifierGroups',
      header: 'Grupos Modificadores',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'updatedAt',
      accessorKey: 'updatedAt',
      header: 'Ultima actualización',
      enableColumnFilter: false,
      cell: ({ cell }) => {
        const updatedAt = cell.getValue() as string
        return (
          <span>
            {new Date(updatedAt).toLocaleDateString('es-MX', {
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
        <h1 className="text-xl font-semibold">Productos</h1>
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nuevo producto</span>
          </Link>
        </Button>
      </div>
      <Input
        type="text"
        placeholder="Buscar..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="p-2 mt-4 mb-4 border rounded bg-bg-input max-w-72"
      />
      <DataTable
        data={filteredProducts}
        rowCount={products?.length}
        columns={columns}
        isLoading={isLoading}
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />
    </div>
  )
}
