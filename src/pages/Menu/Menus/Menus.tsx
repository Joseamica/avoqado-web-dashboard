import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import api from '@/api'
import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { AvoqadoMenu } from '@/types'
import { formatDateInTimeZone } from '@/utils/luxon'

export default function Menus() {
  const { venueId } = useParams()

  const location = useLocation()

  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['avoqado-menus', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/avoqado-menus`)
      return response.data
    },
  })
  const columns: ColumnDef<AvoqadoMenu, unknown>[] = [
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
      id: 'timeRange',
      header: 'Horarios del menú',
      // No accessorKey since we're accessing multiple fields
      cell: ({ row }) => {
        const { startTimeV2, endTimeV2 } = row.original

        const formattedStart = formatDateInTimeZone(startTimeV2, 'America/Mexico_City')
        const formattedEnd = formatDateInTimeZone(endTimeV2, 'America/Mexico_City')

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
      header: 'Categorías',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
  ]

  const filteredAvoqadoMenus = useMemo(() => {
    if (!searchTerm) return data?.avoqadoMenus

    const lowerSearchTerm = searchTerm.toLowerCase()

    return data?.avoqadoMenus?.filter(avoqadoMenu => {
      // Buscar en el name del avoqadoMenu o en los menús (avoqadoMenus.name)
      const nameMatches = avoqadoMenu.name.toLowerCase().includes(lowerSearchTerm)
      const categoryMatches = avoqadoMenu.categories.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || categoryMatches
    })
  }, [searchTerm, data?.avoqadoMenus])

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
        data={filteredAvoqadoMenus}
        rowCount={data?.avoqadoMenus?.length}
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
