import { getMenuCategories } from '@/services/menu.service'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { MenuCategory } from '@/types'

export default function Categories() {
  const { venueId } = useCurrentVenue()

  const location = useLocation()

  const [searchTerm, setSearchTerm] = useState('')

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: () => getMenuCategories(venueId),
  })

  const columns: ColumnDef<MenuCategory, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: 'Nombre' },
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
    // {
    //   id: 'avoqadoMenus',
    //   accessorKey: 'avoqadoMenus',
    //   header: 'Menús',
    //   enableColumnFilter: false,
    //   cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    // },
    // {
    //   id: 'avoqadoProducts',
    //   accessorKey: 'avoqadoProducts',
    //   header: 'Productos',
    //   enableColumnFilter: false,
    //   cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    // },
  ]

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories

    const lowerSearchTerm = searchTerm.toLowerCase()

    return categories?.filter(category => {
      // Buscar en el name del category o en los menús asignados
      const nameMatches = category.name.toLowerCase().includes(lowerSearchTerm)
      const menuMatches = category.menus?.some(menuAssignment => menuAssignment.menu?.name.toLowerCase().includes(lowerSearchTerm)) || false
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
      <DataTable
        data={filteredCategories}
        rowCount={categories?.length}
        columns={columns}
        isLoading={isLoading}
        tableId="menu:categories"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />
    </div>
  )
}
