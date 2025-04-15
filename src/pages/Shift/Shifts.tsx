import api from '@/api'
import { Button } from '@/components/ui/button'
import { themeClasses } from '@/lib/theme-utils'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { Input } from '@/components/ui/input'
// import { Shift } from '@/types'
import { Currency } from '@/utils/currency'
export default function Shifts() {
  const { venueId } = useParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/shifts`, {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      })
      return response.data
    },
  })

  // const shifts = data?.data || []
  const totalShifts = data?.meta?.total || 0

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
            <span className={`px-3 py-1 ${themeClasses.success.bg} ${themeClasses.success.text} rounded-full font-medium`}>Abierto</span>
          )
        } else {
          return (
            <span className={`px-3 py-1 ${themeClasses.neutral.bg} ${themeClasses.neutral.text} rounded-full font-medium`}>Cerrado</span>
          )
        }
      },
    },
    {
      accessorKey: 'turnId',
      sortDescFirst: true,
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Turno
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
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
      accessorFn: row => {
        const totalTip = row.tips?.reduce((sum, tip) => sum + parseFloat(tip.amount), 0) || 0
        return totalTip / 100
      },
      id: 'payments',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Propina Total
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => {
        const payments = row.original.payments

        const totalTips = payments.reduce((acc, payment) => {
          const tipsSum = payment.tips.reduce((tipAcc, tip) => tipAcc + parseFloat(tip.amount), 0)
          return acc + tipsSum
        }, 0)

        const total = payments.reduce((acc, payment) => acc + Number(payment.amount), 0)
        const tipPercentage = total !== 0 ? (totalTips / total) * 100 : 0

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
            <p className={`${tipClasses.bg} ${tipClasses.text} px-3 py-1 font-medium rounded-full`}>{Currency(totalTips)}</p>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },

    {
      accessorFn: row => {
        const payments = row.payments
        const total = payments.reduce((acc, payment) => acc + Number(payment.amount), 0)
        return total
      },
      id: 'payments.total',
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
        const payments = row.payments

        const totalTips = payments.reduce((acc, payment) => {
          const tipsSum = payment.tips.reduce((tipAcc, tip) => tipAcc + parseFloat(tip.amount), 0)
          return acc + tipsSum
        }, 0)
        const totalAmount = payments.reduce((acc, payment) => acc + Number(payment.amount), 0)
        return totalAmount + totalTips
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
    const currentShifts = data || []

    if (!searchTerm) return currentShifts

    const lowerSearchTerm = searchTerm.toLowerCase()

    return currentShifts.filter(shift => {
      // Convertimos turnId a string para poder usar includes
      const turnIdMatch = shift.turnId.toString().includes(lowerSearchTerm)
      const amountMatch = shift.payments
        .reduce((acc, payment) => acc + Number(payment.amount), 0)
        .toString()
        .includes(lowerSearchTerm)

      return turnIdMatch || amountMatch
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Turnos (CORREGIR)</h1>
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
