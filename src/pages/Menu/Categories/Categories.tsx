import api from '@/api'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Category } from '@/types'

export default function Categories() {
  const { venueId } = useParams()

  const location = useLocation()

  const [searchTerm, setSearchTerm] = useState('')

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/get-categories`)
      return response.data
    },
  })

  const columns: ColumnDef<Category, unknown>[] = [
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

      cell: ({ row, cell }) => {
        return (
          <Link
            to={row.original.id}
            className="text-links hover:underline"
            state={{
              from: location.pathname,
            }}
          >
            {cell.getValue() as string}
          </Link>
        )
      },
    },
    {
      id: 'avoqadoMenus',
      accessorKey: 'avoqadoMenus',
      header: 'Menús',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'avoqadoProducts',
      accessorKey: 'avoqadoProducts',
      header: 'Productos',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
  ]

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories

    const lowerSearchTerm = searchTerm.toLowerCase()

    return categories?.filter(category => {
      // Buscar en el name del category o en los menús (avoqadoMenus.name)
      const nameMatches = category.name.toLowerCase().includes(lowerSearchTerm)
      const menuMatches = category.avoqadoMenus.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || menuMatches
    })
  }, [searchTerm, categories])

  // if (isLoading) return <LoadingScreen message="Partiendo la cuenta y el aguacate…" />

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Categorias</h1>
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nueva categoría</span>
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
      <DataTable data={filteredCategories} rowCount={categories?.length} columns={columns} isLoading={isLoading} />
    </div>
  )
}
