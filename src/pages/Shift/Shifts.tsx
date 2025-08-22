import api from '@/api'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import DataTable from '@/components/data-table'
import { Input } from '@/components/ui/input'
// import { Shift } from '@/types'
import { Currency } from '@/utils/currency'
import { useCurrentVenue } from '@/hooks/use-current-venue'
export default function Shifts() {
  const { venueId } = useCurrentVenue()
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/shifts`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      })
      return response.data
    },
  })

  const totalShifts = data?.meta?.totalCount || 0

  const columns: ColumnDef<any, unknown>[] = [
    {
      accessorFn: row => {
        return row.endTime ? 'Cerrado' : 'Abierto'
      },
      id: 'active',
      sortDescFirst: true,
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Estado
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as string

        if (value === 'Abierto') {
          return (
            <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">Abierto</span>
          )
        } else {
          return (
            <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full font-medium">Cerrado</span>
          )
        }
      },
    },
    {
      accessorKey: 'id',
      sortDescFirst: true,
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            ID Turno
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as string
        return value.slice(-8) // Show last 8 characters of ID
      },
    },
    {
      accessorKey: 'startTime',
      sortDescFirst: true,
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Apertura
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as string
        const date = new Date(value)
        const monthName = date.toLocaleString('es-ES', { month: 'short' }).toUpperCase()
        const year = date.getUTCFullYear()
        const last2Year = year.toString().slice(-2)

        const day = date.getDate()
        const hour = date.getHours()
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const ampm = date.getHours() >= 12 ? 'pm' : 'am'

        return (
          <div className="flex flex-col space-y-2">
            <span className="font-[600] text-[14px]">{`${hour}:${minutes}${ampm}`}</span>
            <span className="font-[400] text-dashboard-gray_darker text-[12px]">{`${day}/${monthName}/${last2Year}`}</span>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'endTime',
      sortDescFirst: true,
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Cierre
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell }) => {
        if (!cell.getValue()) return '-'
        const value = cell.getValue() as string
        const date = new Date(value)
        const monthName = date.toLocaleString('es-ES', { month: 'short' }).toUpperCase()
        const year = date.getUTCFullYear()
        const last2Year = year.toString().slice(-2)

        const day = date.getDate()
        const hour = date.getHours()
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const ampm = date.getHours() >= 12 ? 'pm' : 'am'

        return (
          <div className="flex flex-col space-y-2">
            <span className="font-[600] text-[14px]">{`${hour}:${minutes}${ampm}`}</span>
            <span className="font-[400] text-dashboard-gray_darker text-[12px]">{`${day}/${monthName}/${last2Year}`}</span>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'datetime',
    },

    {
      accessorKey: 'totalTips',
      id: 'totalTips',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Propina Total
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => {
        const totalTips = row.original.totalTips || 0
        const totalSales = row.original.totalSales || 0
        const tipPercentage = totalSales !== 0 ? (totalTips / totalSales) * 100 : 0

        let tipClasses = {
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-700 dark:text-green-400',
        }

        if (tipPercentage < 7) {
          tipClasses = {
            bg: 'bg-red-100 dark:bg-red-900/30',
            text: 'text-red-700 dark:text-red-400',
          }
        } else if (tipPercentage >= 7 && tipPercentage < 10) {
          tipClasses = {
            bg: 'bg-yellow-100 dark:bg-yellow-900/30',
            text: 'text-yellow-700 dark:text-yellow-400',
          }
        }

        return (
          <div className="flex flex-col space-y-1 items-center">
            <span className="text-[12px] font-semibold text-muted-foreground">{tipPercentage.toFixed(1)}%</span>
            <p className={`${tipClasses.bg} ${tipClasses.text} px-3 py-1 font-medium rounded-full`}>{Currency(totalTips)}</p>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },

    {
      accessorKey: 'totalSales',
      id: 'totalSales',
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Subtotal
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as number
        return value ? Currency(value) : '0.00'
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },

    {
      accessorFn: row => {
        const totalSales = row.totalSales || 0
        const totalTips = row.totalTips || 0
        return totalSales + totalTips
      },
      id: 'totalAmount',
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Total
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as number
        return value ? Currency(value) : '0.00'
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },
  ]

  const filteredShifts = useMemo(() => {
    const currentShifts = data?.data || []

    if (!searchTerm) return currentShifts

    const lowerSearchTerm = searchTerm.toLowerCase()

    return currentShifts.filter(shift => {
      // Search by shift ID or staff name
      const shiftIdMatch = shift.id.toString().includes(lowerSearchTerm)
      const staffNameMatch = shift.staff ? 
        `${shift.staff.firstName} ${shift.staff.lastName}`.toLowerCase().includes(lowerSearchTerm) : false
      const totalSalesMatch = shift.totalSales.toString().includes(lowerSearchTerm)

      return shiftIdMatch || staffNameMatch || totalSalesMatch
    })
  }, [searchTerm, data])

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Turnos</h1>
        {/* <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending ? 'Syncing...' : 'Syncronizar Meseros'}
    </Button> */}
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
        className="p-2 mt-4 mb-4 border rounded bg-input border-border max-w-72"
      />

      <DataTable
        data={filteredShifts}
        rowCount={totalShifts}
        columns={columns}
        isLoading={isLoading}
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
        pagination={pagination}
        setPagination={setPagination}
      />
    </div>
  )
}
