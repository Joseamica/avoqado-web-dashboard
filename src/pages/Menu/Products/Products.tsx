import api from '@/api'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, UploadCloud } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Category } from '@/types'
import { Currency } from '@/utils/currency'

export default function Products() {
  const { venueId } = useParams()

  const location = useLocation()

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', venueId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/products`)
      return response.data
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: boolean }) => {
      await api.patch(`/v1/dashboard/${venueId}/products/toggle-status`, {
        productId,
        status,
      })
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })

      toast({
        title: `Producto ${data.status ? 'activado' : 'desactivado'}`,
        description: 'Los cambios se han guardado correctamente.',
      })
    },
  })

  const columns: ColumnDef<Category, unknown>[] = [
    {
      id: 'imageUrl',
      accessorKey: 'imageUrl',
      sortDescFirst: true,
      header: () => <div className=" flex-row-center">Foto</div>,

      cell: ({ cell }) => {
        return (
          <div className="w-12 h-12 overflow-hidden bg-gray-200">
            {cell.getValue() ? (
              <img src={cell.getValue() as string} alt="product" className="object-fill h-14 w-14" />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <UploadCloud className="w-4 h-4" />
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
      // Buscar en el name del category o en los menús (avoqadoMenus.name)
      const nameMatches = product.name.toLowerCase().includes(lowerSearchTerm)
      const modifierGroupMatches = product.modifierGroups.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      const categoryMatches = product.categories.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
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
