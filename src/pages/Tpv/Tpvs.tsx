import { getTpvs } from '@/services/tpv.service'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Terminal } from '@/types'
import { t } from 'i18next'

export default function Tpvs() {
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['tpvs', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: () => getTpvs(venueId, pagination),
  })

  const totalTpvs = data?.meta?.total || 0

  const columns: ColumnDef<Terminal, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: 'Nombre' },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Nombre
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ cell }) => <span>{cell.getValue() as string}</span>,
    },
    {
      id: 'serialNumber',
      accessorKey: 'serialNumber',
      sortDescFirst: true,
      meta: { label: 'Numero de serie' },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Numero de serie
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
    },
    {
      id: 'version',
      accessorKey: 'version',
      sortDescFirst: true,
      meta: { label: 'Versión' },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Versión
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, tpvs: any[]) => {
    if (!searchTerm) return tpvs

    const lowerSearchTerm = searchTerm.toLowerCase()

    return tpvs.filter(tpv => {
      const tpvIdMatch = tpv.id.toString().includes(lowerSearchTerm)
      const tpvNameMatch = tpv.name.toLowerCase().includes(lowerSearchTerm)
      const serialNumberMatch = tpv.serialNumber?.toLowerCase().includes(lowerSearchTerm)
      const versionMatch = tpv.version?.toLowerCase().includes(lowerSearchTerm)

      return tpvIdMatch || tpvNameMatch || serialNumberMatch || versionMatch
    })
  }, [])

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Terminales punto de venta</h1>
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nuevo dispositivo</span>
          </Link>
        </Button>
      </div>

      <DataTable
        data={data?.data || []}
        rowCount={totalTpvs}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('common.search')}
        onSearch={handleSearch}
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
        tableId="tpv:list"
        pagination={pagination}
        setPagination={setPagination}
      />
    </div>
  )
}
