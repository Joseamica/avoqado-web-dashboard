import api from '@/api'
import { Button } from '@/components/ui/button'
import { themeClasses } from '@/lib/theme-utils'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { Input } from '@/components/ui/input'
import { Bill } from '@/types'
import { Currency } from '@/utils/currency'

export default function Bills() {
  const { venueId } = useParams()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['bills', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/bills`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      })
      return response.data
    },
  })

  const totalBills = data?.meta?.total || 0

  // Memoize columns definition to prevent unnecessary re-renders
  const columns = useMemo<ColumnDef<Bill, unknown>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        sortDescFirst: true,
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Fecha
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
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
        accessorKey: 'folio',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Folio
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: info => <>{!info.getValue() ? '-' : (info.getValue() as string)}</>,
      },
      {
        accessorKey: 'billName',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Nombre
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: info => <>{!info.getValue() ? '-' : (info.getValue() as string)}</>,
      },

      {
        accessorKey: 'waiterName',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Mesero
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: info => <>{!info.getValue() ? '-' : (info.getValue() as string)}</>,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Estado
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const status = cell.getValue() as string

          let statusClasses = {
            bg: themeClasses.neutral.bg,
            text: themeClasses.neutral.text,
          }

          if (status === 'PAID' || status === 'CLOSED') {
            statusClasses = {
              bg: themeClasses.success.bg,
              text: themeClasses.success.text,
            }
          } else if (status === 'OPEN' || status === 'PENDING') {
            statusClasses = {
              bg: themeClasses.warning.bg,
              text: themeClasses.warning.text,
            }
          } else if (status === 'CANCELED' || status === 'DELETED') {
            statusClasses = {
              bg: themeClasses.error.bg,
              text: themeClasses.error.text,
            }
          }

          const statusMap: Record<string, string> = {
            OPEN: 'Abierta',
            PAID: 'Pagada',
            PENDING: 'Pendiente',
            CLOSED: 'Cerrada',
            CANCELED: 'Cancelada',
            PRECREATED: 'Pre-creada',
            WITHOUT_TABLE: 'Sin mesa',
            DELETED: 'Eliminada',
            EARLYACCESS: 'Acceso anticipado',
            COURTESY: 'Cortesía',
          }

          return (
            <div className="flex justify-center">
              <span className={`${statusClasses.bg} ${statusClasses.text} px-3 py-1 font-medium rounded-full`}>
                {statusMap[status] || status}
              </span>
            </div>
          )
        },
      },
      {
        accessorFn: row => {
          const total = row.total ? parseFloat(row.total) : 0
          return total
        },
        id: 'total',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Total
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = cell.getValue() as number
          return value ? Currency(value) : '$0.00'
        },
        footer: props => props.column.id,
        // Using a custom sort function for numeric values
        sortingFn: (rowA, rowB, columnId) => {
          const valueA = rowA.getValue(columnId) as number
          const valueB = rowB.getValue(columnId) as number
          return valueA - valueB
        },
      },
    ],
    [],
  )

  const filteredBills = useMemo(() => {
    // Fix: Correctly access the data array from the API response
    const bills = data?.data || []
    if (!searchTerm) return bills

    const lowerSearchTerm = searchTerm.toLowerCase()

    return bills?.filter(bill => {
      // Filter by folio
      const folioMatch = bill.folio && bill.folio.toLowerCase().includes(lowerSearchTerm)

      // Filter by bill name
      const billNameMatch = bill.billName && bill.billName.toLowerCase().includes(lowerSearchTerm)

      // Filter by table number (convert to string first)
      const tableMatch = bill.tableNumber && String(bill.tableNumber).includes(lowerSearchTerm)

      // Filter by waiter name
      const waiterMatch = bill.waiterName && bill.waiterName.toLowerCase().includes(lowerSearchTerm)

      // Filter by total amount (convert to string first)
      const totalMatch = bill.total && String(bill.total).includes(lowerSearchTerm)

      return folioMatch || billNameMatch || tableMatch || waiterMatch || totalMatch
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Cuentas</h1>
      </div>

      <Input
        type="text"
        placeholder="Buscar por folio, nombre, mesa o mesero..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className={`p-2 mt-4 mb-4 border rounded ${themeClasses.inputBg} ${themeClasses.border} max-w-72`}
      />

      {error && (
        <div className={`p-4 mb-4 rounded ${themeClasses.error.bg} ${themeClasses.error.text}`}>
          Error al cargar cuentas: {(error as Error).message}
        </div>
      )}

      <DataTable
        data={filteredBills}
        rowCount={totalBills}
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
