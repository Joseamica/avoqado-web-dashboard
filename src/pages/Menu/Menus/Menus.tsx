import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getMenus } from '@/services/menu.service'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Menu } from '@/types'
import { formatDateInTimeZone } from '@/utils/luxon'

export default function Menus() {
  const { venueId } = useCurrentVenue()

  const location = useLocation()

  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['menus', venueId],
    queryFn: () => getMenus(venueId),
  })
  const columns: ColumnDef<Menu, unknown>[] = [
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
    {
      id: 'timeRange',
      meta: { label: 'Horarios del menú' },
      header: 'Horarios del menú',
      // No accessorKey since we're accessing multiple fields
      cell: ({ row }) => {
        const { availableFrom, availableUntil } = row.original

        if (!availableFrom || !availableUntil) {
          return <span>Siempre disponible</span>
        }

        const formattedStart = formatDateInTimeZone(availableFrom, 'America/Mexico_City')
        const formattedEnd = formatDateInTimeZone(availableUntil, 'America/Mexico_City')

        return (
          <span>
            {formattedStart} - {formattedEnd}
          </span>
        )
      },
    },
    {
      id: 'categories',
      accessorKey: 'categories',
      meta: { label: 'Categorías' },
      header: 'Categorías',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
  ]

  const filteredMenus = useMemo(() => {
    if (!searchTerm) return data

    const lowerSearchTerm = searchTerm.toLowerCase()

    return data?.filter(menu => {
      // Buscar en el name del menu o en las categorías
      const nameMatches = menu.name.toLowerCase().includes(lowerSearchTerm)
      const categoryMatches = menu.categories?.some(category => category.category.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || categoryMatches
    })
  }, [searchTerm, data])

  // if (isLoading) return <div>Loading...</div>
  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Menús</h1>
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nuevo menú</span>
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
        data={filteredMenus}
        rowCount={data?.length}
        columns={columns}
        isLoading={isLoading}
        tableId="menu:menus"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />
    </div>
  )
}
