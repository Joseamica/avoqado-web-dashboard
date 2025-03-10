import api from '@/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'

export default function Waiters() {
  const { venueId } = useParams()

  const location = useLocation()

  const [searchTerm, setSearchTerm] = useState('')

  const { data: waiters, isLoading } = useQuery({
    queryKey: ['waiters', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/waiters`)
      return response.data
    },
  })
  console.log('LOG: waiters', waiters)

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.patch(`/v2/dashboard/${venueId}/soft-restaurant/waiters/sync`)

      return response.data
    },
    onSuccess: () => {
      console.log('Waiters synced successfully!')
    },
    onError: error => {
      console.error('Error syncing waiters:', error)
    },
  })

  const columns: ColumnDef<any, unknown>[] = [
    {
      id: 'nombre',
      accessorKey: 'nombre',
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
      id: 'captain',
      accessorKey: 'captain',
      header: 'Rol',
      enableColumnFilter: false,
      cell: ({ row }) => {
        return <span>{row.original.captain === true ? 'Si' : 'No'}</span>
      },
    },
    // {
    //   id: 'avoqadoProducts',
    //   accessorKey: 'avoqadoProducts',
    //   header: 'Productos',
    //   enableColumnFilter: false,
    //   cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    // },
  ]

  const filteredWaiters = useMemo(() => {
    if (!searchTerm) return waiters

    const lowerSearchTerm = searchTerm.toLowerCase()

    return waiters?.filter(waiter => {
      // Buscar en el name del waiter o en los menús (avoqadoMenus.name)
      const nameMatches = waiter.name.toLowerCase().includes(lowerSearchTerm)
      const menuMatches = waiter.avoqadoMenus.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || menuMatches
    })
  }, [searchTerm, waiters])

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Meseros</h1>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Syncing...' : 'Syncronizar Meseros'}
        </Button>
        {/* <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nuevo mesero</span>
          </Link>
        </Button> */}
      </div>
      <Input
        type="text"
        placeholder="Buscar..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="p-2 mt-4 mb-4 border rounded bg-bg-input max-w-72"
      />

      <DataTable data={filteredWaiters} rowCount={waiters?.length} columns={columns} isLoading={isLoading} />
    </div>
  )
}
