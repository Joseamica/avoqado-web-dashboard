import api from '@/api'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { themeClasses } from '@/lib/theme-utils'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'

export default function Waiters() {
  const { venueId } = useParams()

  const location = useLocation()

  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['waiters', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/waiters`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      })
      return response.data
    },
  })

  const totalWaiters = data?.meta?.total || 0

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
      cell: ({ cell }) => <span>{cell.getValue() as string}</span>,
    },
    {
      id: 'captain',
      accessorKey: 'captain',
      header: 'Capitán',
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
    const currentWaiters = data?.data || []

    if (!searchTerm) return currentWaiters

    const lowerSearchTerm = searchTerm.toLowerCase()

    return currentWaiters.filter(waiter => {
      // Buscar en el name del waiter o en los menús (avoqadoMenus.name)
      const nameMatches = waiter.name?.toLowerCase().includes(lowerSearchTerm) || false
      const menuMatches = waiter.avoqadoMenus?.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm)) || false
      return nameMatches || menuMatches
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 ${themeClasses.pageBg} ${themeClasses.text}`}>
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
        className={`p-2 mt-4 mb-4 border rounded ${themeClasses.inputBg} ${themeClasses.border} max-w-72`}
      />
      <Card>
        <CardContent className="p-0">
          <DataTable
            data={filteredWaiters}
            rowCount={totalWaiters}
            columns={columns}
            isLoading={isLoading}
            clickableRow={row => ({
              to: row.id,
              state: { from: location.pathname },
            })}
            pagination={pagination}
            setPagination={setPagination}
          />
        </CardContent>
      </Card>
    </div>
  )
}
