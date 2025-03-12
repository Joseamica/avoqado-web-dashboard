import api from '@/api'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { Input } from '@/components/ui/input'
import { Payment } from '@/types'
import { Currency } from '@/utils/currency'
import getIcon from '@/utils/getIcon'
export default function Payments() {
  const { venueId } = useParams()

  const [searchTerm, setSearchTerm] = useState('')

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/payments`)
      return response.data
    },
  })

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
        return <>{!info.getValue() ? 'No asignado' : (info.getValue() as string)}</>
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

        let bg = 'bg-[#D1FDDD]' // Color por defecto
        let text = 'text-[#6DA37B]'

        if (tipPercentage < 7) {
          bg = 'bg-[#FDE2E2]'
          text = 'text-[#D64545]'
        } else if (tipPercentage >= 7 && tipPercentage < 10) {
          bg = 'bg-[#FAF5D4]'
          text = 'text-[#DDB082]'
        }

        return (
          <div className={`flex flex-col space-y-1 items-center `}>
            <span className="text-[12px] font-semibold text-dashboard-gray_darkest">{tipPercentage.toFixed(1)}%</span>
            <p className={`${bg} ${text} px-3 py-1 font-medium  rounded-full`}>{Currency(totalTip * 100)}</p>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },

    {
      accessorKey: 'cardBrand',
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Tarjeta
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        )
      },
      cell: ({ cell, row }) => {
        const value = cell.getValue() as string
        const last4 = row.original.last4

        return (
          <div className="space-x-2 flex flex-row">
            {value ? (
              <>
                <span> {getIcon(value)}</span> <span className="text-[16px] font-[600] text-dashboard-gray_darkest">{last4}</span>
              </>
            ) : (
              'CASH'
            )}
          </div>
        )
      },
      footer: props => props.column.id,
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
    if (!searchTerm) return payments

    const lowerSearchTerm = searchTerm.toLowerCase()

    return payments?.filter(payment => {
      // Check if amount matches
      const amountMatch = payment.amount.toLowerCase().includes(lowerSearchTerm)

      // Check if waiter exists and has a matching name
      const waiterMatches = payment.waiter && payment.waiter.nombre.toLowerCase().includes(lowerSearchTerm)

      return amountMatch || waiterMatches
    })
  }, [searchTerm, payments])

  return (
    <div className="p-4">
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
        className="p-2 mt-4 mb-4 border rounded bg-bg-input max-w-72"
      />

      <DataTable data={filteredPayments} rowCount={payments?.length} columns={columns} isLoading={isLoading} />
    </div>
  )
}
