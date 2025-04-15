import api from '@/api'
import { Button } from '@/components/ui/button'
import { themeClasses } from '@/lib/theme-utils'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Computer, Smartphone } from 'lucide-react'
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

  const { data, isLoading, error } = useQuery({
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

  const totalPayments = data?.meta?.total || 0

  // Memoize columns definition to prevent unnecessary re-renders
  const columns = useMemo<ColumnDef<Payment, unknown>[]>(
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
        accessorKey: 'waiter.nombre',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Mesero
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: info => <>{!info.getValue() ? '-' : (info.getValue() as string)}</>,
      },
      {
        accessorFn: row => {
          // Safely calculate total tip with proper defaults
          const totalTip = (row.tips || []).reduce((sum, tip) => sum + parseFloat(tip.amount || '0'), 0) || 0
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
          const subtotal = row.original.amount ? parseFloat(row.original.amount) / 100 : 0
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
        // Using a custom sort function for numeric values
        sortingFn: (rowA, rowB, columnId) => {
          const valueA = rowA.getValue(columnId) as number
          const valueB = rowB.getValue(columnId) as number
          return valueA - valueB
        },
      },
      {
        accessorKey: 'source',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Origen
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const source = cell.getValue() as string

          if (source === 'POS') {
            return (
              <div className="space-x-2 flex flex-row items-center">
                <Computer className="h-4 w-4 text-gray-500" />
                <span className={`text-[12px] font-[600] ${themeClasses.textSubtle}`}>POS</span>
              </div>
            )
          } else if (source === 'AVOQADO_TPV') {
            return (
              <div className="space-x-2 flex flex-row items-center">
                <Smartphone className="h-4 w-4 text-gray-500" />
                <span className={`text-[12px] font-[600] ${themeClasses.textSubtle}`}>TPV</span>
              </div>
            )
          }

          return <span className={`text-[12px] font-[600] ${themeClasses.textSubtle}`}>{source || '-'}</span>
        },
      },
      {
        accessorKey: 'method',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Método de pago
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
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
        accessorFn: row => {
          const amount = row.amount ? parseFloat(row.amount) : 0
          return amount / 100
        },
        id: 'amount',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Subtotal
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = cell.getValue() as number
          // Fix: Don't multiply by 100 again as it was already converted to display format
          return value ? Currency(value * 100) : '0.00'
        },
        footer: props => props.column.id,
        // Using a custom sort function for numeric values
        sortingFn: (rowA, rowB, columnId) => {
          const valueA = rowA.getValue(columnId) as number
          const valueB = rowB.getValue(columnId) as number
          return valueA - valueB
        },
      },
      {
        accessorFn: row => {
          const totalTip = (row.tips || []).reduce((sum, tip) => sum + parseFloat(tip.amount || '0'), 0) || 0
          const subtotal = row.amount ? parseFloat(row.amount) : 0
          return (totalTip + subtotal) / 100
        },
        id: 'totalAmount',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Total
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ cell }) => {
          const value = cell.getValue() as number
          // Fix: Don't multiply by 100 again as it was already converted to display format
          return value ? Currency(value * 100) : '0.00'
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

  const filteredPayments = useMemo(() => {
    const payments = data?.data || []
    if (!searchTerm) return payments

    const lowerSearchTerm = searchTerm.toLowerCase()

    return payments?.filter(payment => {
      // Fix: Convert amount to string before using toLowerCase()
      const amountMatch = String(payment.amount || '0')
        .toLowerCase()
        .includes(lowerSearchTerm)

      // Check if waiter exists and has a matching name
      const waiterMatches = payment.waiter && payment.waiter.nombre && payment.waiter.nombre.toLowerCase().includes(lowerSearchTerm)

      return amountMatch || waiterMatches
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Pagos</h1>
        {/* Commented code removed for clarity */}
      </div>

      <Input
        type="text"
        placeholder="Buscar..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className={`p-2 mt-4 mb-4 border rounded ${themeClasses.inputBg} ${themeClasses.border} max-w-72`}
      />

      {error && (
        <div className={`p-4 mb-4 rounded ${themeClasses.error.bg} ${themeClasses.error.text}`}>
          Error al cargar pagos: {(error as Error).message}
        </div>
      )}

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
