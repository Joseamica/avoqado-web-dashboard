import api from '@/api'
import { Button } from '@/components/ui/button'
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

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shifts', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/shifts`)
      return response.data
    },
  })

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
          return <span className="px-3 py-1 text-green-700 bg-green-100 rounded-full font-medium">Abierto</span>
        } else {
          return <span className="px-3 py-1 text-gray-700 bg-gray-100 rounded-full font-medium">Cerrado</span>
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

        let bg = 'bg-[#D1FDDD]'
        let text = 'text-[#6DA37B]'

        if (tipPercentage < 7) {
          bg = 'bg-[#FDE2E2]'
          text = 'text-[#D64545]'
        } else if (tipPercentage >= 7 && tipPercentage < 10) {
          bg = 'bg-[#FAF5D4]'
          text = 'text-[#DDB082]'
        }

        return (
          <div className="flex flex-col space-y-1 items-center">
            <span className="text-[12px] font-semibold text-dashboard-gray_darkest">{tipPercentage.toFixed(1)}%</span>
            <p className={`${bg} ${text} px-3 py-1 font-medium rounded-full`}>{Currency(totalTips)}</p>
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
    if (!searchTerm) return shifts

    const lowerSearchTerm = searchTerm.toLowerCase()

    return shifts?.filter(shift => {
      // Convertimos turnId a string para poder usar includes
      const turnIdMatch = shift.turnId.toString().includes(lowerSearchTerm)
      const amountMatch = shift.payments
        .reduce((acc, payment) => acc + Number(payment.amount), 0)
        .toString()
        .includes(lowerSearchTerm)
      // Aquí podrías agregar más condiciones de filtrado (por ejemplo, por nombre de mesero)

      return turnIdMatch || amountMatch
    })
  }, [searchTerm, shifts])

  return (
    <div className="p-4">
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
        className="p-2 mt-4 mb-4 border rounded bg-bg-input max-w-72"
      />

      <DataTable data={filteredShifts} rowCount={shifts?.length} columns={columns} isLoading={isLoading} />
    </div>
  )
}
