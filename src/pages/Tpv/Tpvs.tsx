import { getTpvs } from '@/services/tpv.service'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Terminal } from '@/types'

export default function Tpvs() {
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
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
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Versión
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
    },
  ]

  const filteredTpvs = useMemo(() => {
    const currentTpvs = data?.data || []

    if (!searchTerm) return currentTpvs

    const lowerSearchTerm = searchTerm.toLowerCase()

    return currentTpvs.filter((tpv: Terminal) => {
      // Buscar en el name del tpv
      const nameMatches = tpv.name.toLowerCase().includes(lowerSearchTerm)
      return nameMatches
    })
  }, [searchTerm, data])

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex flex-row items-center justify-between">
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
      <Input
        type="text"
        placeholder="Buscar..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className={`p-2 mt-4 mb-4 border rounded bg-background border-border max-w-72`}
      />
      <Card>
        <CardContent className="p-0">
          <DataTable
            data={filteredTpvs}
            rowCount={totalTpvs}
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
