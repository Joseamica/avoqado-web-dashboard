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
import { Payment } from '@/types'
import { Currency } from '@/utils/currency'
import getIcon from '@/utils/getIcon'
export default function Payments() {
  const { venueId } = useParams()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['payments', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/payments`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      })
      return response.data
    },
  })
  console.log(data)
  const totalPayments = data?.meta?.total || 0

  const columns: ColumnDef<Payment, unknown>[] = [
    {
      accessorKey: 'createdAt',
      sortDescFirst: true, //sort by name in descending order first (default is ascending for string columns)

      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Fecha
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as string
        const date = new Date(value)
        const monthName = date.toLocaleString('es-ES', { month: 'short' }).toUpperCase()
        const year = date.getUTCFullYear()
        const last2Year = year.toString().slice(-2) // Extrae los dos últimos dígitos, '24'

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
      accessorKey: 'waiter.nombre', // Access the nested 'name' property inside 'waiter'
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Mesero
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: info => {
        return <>{!info.getValue() ? '-' : (info.getValue() as string)}</>
      },
    },
    {
      accessorFn: row => {
        const totalTip = row.tips?.reduce((sum, tip) => sum + parseFloat(tip.amount), 0) || 0
        return totalTip / 100
      },
      id: 'totalTipAmount',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Propina Total
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ cell, row }) => {
        const totalTip = cell.getValue() as number
        const subtotal = parseFloat(row.original.amount) / 100 || 0
        const tipPercentage = subtotal !== 0 ? (totalTip / subtotal) * 100 : 0

        let tipClasses = {
          bg: themeClasses.success.bg,
          text: themeClasses.success.text,
        }

        if (tipPercentage < 7) {
          tipClasses = {
            bg: themeClasses.error.bg,
            text: themeClasses.error.text,
          }
        } else if (tipPercentage >= 7 && tipPercentage < 10) {
          tipClasses = {
            bg: themeClasses.warning.bg,
            text: themeClasses.warning.text,
          }
        }

        return (
          <div className="flex flex-col space-y-1 items-center">
            <span className={`text-[12px] font-semibold ${themeClasses.textSubtle}`}>{tipPercentage.toFixed(1)}%</span>
            <p className={`${tipClasses.bg} ${tipClasses.text} px-3 py-1 font-medium rounded-full`}>{Currency(totalTip * 100)}</p>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },

    {
      accessorKey: 'method',
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Método de pago
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell, row }) => {
        const last4 = row.original.last4
        const method = cell.getValue() as string
        const cardBrand = row.original.cardBrand

        const translatedMethod = method === 'CARD' ? 'Tarjeta' : method === 'CASH' ? 'Efectivo' : method

        return (
          <div className="space-x-2 flex flex-row items-center">
            {method === 'CARD' ? (
              <>
                <span>{getIcon(cardBrand)}</span>
                <span className={`text-[12px] font-[600] ${themeClasses.textSubtle}`}>{last4 ? last4.slice(-4) : 'Tarjeta'}</span>
              </>
            ) : (
              <span className={`text-[12px] font-[600] ${themeClasses.textSubtle}`}>{translatedMethod}</span>
            )}
          </div>
        )
      },
    },
    {
      accessorFn: row => parseFloat(row.amount) / 100,
      id: 'amount',
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
        return value ? Currency(value * 100) : '0.00'
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },

    {
      accessorFn: row => {
        const totalTip = row.tips?.reduce((sum, tip) => sum + parseFloat(tip.amount), 0) || 0
        const subtotal = parseFloat(row.amount) || 0
        return (totalTip + subtotal) / 100
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
        return value ? Currency(value * 100) : '0.00'
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },
  ]

  const filteredPayments = useMemo(() => {
    const payments = data?.data || []
    if (!searchTerm) return payments

    const lowerSearchTerm = searchTerm.toLowerCase()

    return payments?.filter(payment => {
      // Check if amount matches
      const amountMatch = payment.amount.toLowerCase().includes(lowerSearchTerm)

      // Check if waiter exists and has a matching name
      const waiterMatches = payment.waiter && payment.waiter.nombre.toLowerCase().includes(lowerSearchTerm)

      return amountMatch || waiterMatches
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Pagos</h1>
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
        className={`p-2 mt-4 mb-4 border rounded ${themeClasses.inputBg} ${themeClasses.border} max-w-72`}
      />

      <DataTable
        data={filteredPayments}
        rowCount={totalPayments}
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
