import api from '@/api'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
// import { Shift } from '@/types'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { useLocation } from 'react-router-dom'
export default function Shifts() {
  const { t, i18n } = useTranslation()
  const localeCode = getIntlLocale(i18n.language)
  const { venueId } = useCurrentVenue()
  const location = useLocation()
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
        return row.endTime ? t('shifts.closed') : t('shifts.open')
      },
      id: 'active',
      sortDescFirst: true,
      header: t('shifts.columns.status'),
      cell: ({ cell }) => {
        const value = cell.getValue() as string

        if (value === t('shifts.open')) {
          return (
            <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">
              {t('shifts.open')}
            </span>
          )
        } else {
          return <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full font-medium">{t('shifts.closed')}</span>
        }
      },
    },
    {
      accessorKey: 'id',
      sortDescFirst: true,
      header: t('shifts.columns.shiftId'),
      cell: ({ cell }) => {
        const value = cell.getValue() as string
        return value.slice(-8) // Show last 8 characters of ID
      },
    },
    {
      accessorKey: 'startTime',
      sortDescFirst: true,
      header: t('shifts.columns.openTime'),
      cell: ({ cell }) => {
        const value = cell.getValue() as string
        const date = new Date(value)
        const monthName = date.toLocaleString(localeCode, { month: 'short' }).toUpperCase()
        const year = date.getUTCFullYear()
        const last2Year = year.toString().slice(-2)

        const day = date.getDate()
        const hour = date.getHours()
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const ampm = date.getHours() >= 12 ? 'pm' : 'am'

        return (
          <div className="flex flex-col space-y-2">
            <span className="text-sm font-medium">{`${hour}:${minutes}${ampm}`}</span>
            <span className="text-xs text-muted-foreground">{`${day}/${monthName}/${last2Year}`}</span>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'endTime',
      sortDescFirst: true,
      header: t('shifts.columns.closeTime'),
      cell: ({ cell }) => {
        if (!cell.getValue()) return '-'
        const value = cell.getValue() as string
        const date = new Date(value)
        const localeCode = getIntlLocale(i18n.language)
        const monthName = date.toLocaleString(localeCode, { month: 'short' }).toUpperCase()
        const year = date.getUTCFullYear()
        const last2Year = year.toString().slice(-2)

        const day = date.getDate()
        const hour = date.getHours()
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const ampm = date.getHours() >= 12 ? 'pm' : 'am'

        return (
          <div className="flex flex-col space-y-2">
            <span className="text-sm font-medium">{`${hour}:${minutes}${ampm}`}</span>
            <span className="text-xs text-muted-foreground">{`${day}/${monthName}/${last2Year}`}</span>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'datetime',
    },

    {
      accessorKey: 'totalTips',
      id: 'totalTips',
      header: t('shifts.columns.totalTip'),
      cell: ({ row }) => {
        // Robust locale-aware parse: handles "1,231.00", "1.231,00", and plain numbers
        const parseAmount = (v: any): number => {
          if (typeof v === 'number') return Number.isFinite(v) ? v : 0
          if (v == null) return 0
          let s = String(v).trim()
          // Drop currency symbols and spaces
          s = s.replace(/[^0-9.,-]/g, '')
          if (!s) return 0
          const lastComma = s.lastIndexOf(',')
          const lastDot = s.lastIndexOf('.')
          const hasComma = lastComma !== -1
          const hasDot = lastDot !== -1
          if (hasComma && hasDot) {
            // Assume the right-most separator is the decimal, drop the other as thousand
            if (lastComma > lastDot) {
              s = s.replace(/\./g, '') // remove thousands dots
              s = s.replace(',', '.') // decimal comma -> dot
            } else {
              s = s.replace(/,/g, '') // remove thousands commas
              // decimal dot stays
            }
          } else if (hasComma && !hasDot) {
            // Treat comma as decimal
            s = s.replace(',', '.')
          }
          // Only dot or plain digits: nothing to do
          const n = Number(s)
          return Number.isFinite(n) ? n : 0
        }

        const totalTips = parseAmount(row.original.totalTips)
        const totalSales = parseAmount(row.original.totalSales)
        const providedSubtotal = parseAmount((row.original as any).subtotal)
        // Prefer provided subtotal; else use (sales - tips) if that seems valid
        let subtotal = providedSubtotal > 0 ? providedSubtotal : totalSales - totalTips
        if (subtotal <= 0) subtotal = totalSales // fallback
        let tipPercentage = subtotal > 0 ? (totalTips / subtotal) * 100 : 0
        if ((subtotal <= 0 || !Number.isFinite(tipPercentage)) && totalTips > 0) {
          const gross = totalSales + totalTips
          if (gross > 0) tipPercentage = (totalTips / gross) * 100
        }
        // Fallback to provided percentage field if available
        const providedPct = Number((row.original as any).tipPercentage ?? (row.original as any).tipsPercentage)
        if (!Number.isFinite(tipPercentage) || tipPercentage === 0) {
          if (Number.isFinite(providedPct) && providedPct > 0) tipPercentage = providedPct
        }

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
            <span className="text-xs font-semibold text-muted-foreground">{tipPercentage.toFixed(1)}%</span>
            <Badge variant="soft" className={`${tipClasses.bg} ${tipClasses.text} border-transparent`}>
              {Currency(totalTips)}
            </Badge>
          </div>
        )
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },

    {
      accessorKey: 'totalSales',
      id: 'totalSales',
      header: t('shifts.columns.subtotal'),
      cell: ({ cell }) => {
        const value = cell.getValue() as number
        return value ? Currency(value) : Currency(0)
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
      header: t('shifts.columns.total'),
      cell: ({ cell }) => {
        const value = cell.getValue() as number
        return value ? Currency(value) : Currency(0)
      },
      footer: props => props.column.id,
      sortingFn: 'alphanumeric',
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, shifts: any[]) => {
    if (!searchTerm) return shifts

    const lowerSearchTerm = searchTerm.toLowerCase()

    return shifts.filter(shift => {
      // Search by shift ID or staff name
      const shiftIdMatch = shift.id.toString().includes(lowerSearchTerm)
      const staffNameMatch = shift.staff
        ? `${shift.staff.firstName} ${shift.staff.lastName}`.toLowerCase().includes(lowerSearchTerm)
        : false
      const totalSalesMatch = shift.totalSales.toString().includes(lowerSearchTerm)

      return shiftIdMatch || staffNameMatch || totalSalesMatch
    })
  }, [])

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('shifts.title')}</h1>
        {/* <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending ? 'Syncing...' : 'Syncronizar Meseros'}
    </Button> */}
        {/* TODO: Add create waiter CTA if needed */}
      </div>

      <DataTable
        data={data?.data || []}
        rowCount={totalShifts}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('common.search')}
        onSearch={handleSearch}
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
