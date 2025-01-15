import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import api from '@/api'
import { ItemsCell } from '@/components/multiple-cell-values'
import { DataTablePagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { AvoqadoMenu } from '@/types'
import { formatDateInTimeZone } from '@/utils/luxon'

export default function Menus() {
  const { venueId } = useParams()

  const location = useLocation()

  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  const { data, isLoading, isError, error, isSuccess } = useQuery({
    queryKey: ['avoqado-menus', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/avoqado-menus`)
      return response.data
    },
  })
  const { toast } = useToast()
  const columns: ColumnDef<AvoqadoMenu, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          Nombre
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ row, cell }) => {
        return (
          <Link
            to={row.original.id}
            className="text-links hover:underline"
            state={{
              from: location.pathname,
            }}
          >
            {cell.getValue() as string}
          </Link>
        )
      },
    },
    {
      id: 'timeRange',
      header: 'Horarios del menú',
      // No accessorKey since we're accessing multiple fields
      cell: ({ row }) => {
        const { startTimeV2, endTimeV2 } = row.original

        const formattedStart = formatDateInTimeZone(startTimeV2, 'America/Mexico_City')
        const formattedEnd = formatDateInTimeZone(endTimeV2, 'America/Mexico_City')

        return (
          <span>
            {formattedStart} - {formattedEnd}
          </span>
        )
      },
    },
    {
      id: 'categories',
      accessorKey: 'categories',
      header: 'Categorías',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
  ]

  const filteredAvoqadoMenus = useMemo(() => {
    if (!searchTerm) return data?.avoqadoMenus

    const lowerSearchTerm = searchTerm.toLowerCase()

    return data?.avoqadoMenus?.filter(avoqadoMenu => {
      // Buscar en el name del avoqadoMenu o en los menús (avoqadoMenus.name)
      const nameMatches = avoqadoMenu.name.toLowerCase().includes(lowerSearchTerm)
      const categoryMatches = avoqadoMenu.categories.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || categoryMatches
    })
  }, [searchTerm, data?.avoqadoMenus])

  const table = useReactTable({
    data: filteredAvoqadoMenus || [],
    columns,
    rowCount: data?.avoqadoMenus?.length,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 10,
      minSize: 200, //enforced during column resizing
    },
    debugTable: true,

    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    sortDescFirst: true, //sort by all columns in descending order first (default is ascending for string columns and descending for number columns)

    getPaginationRowModel: getPaginationRowModel(),
    // initialState: {
    //   sorting: [{ id: 'createdAt', desc: true }],
    // },
  })
  if (isLoading) return <div>Loading...</div>
  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Menús</h1>
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nuevo menú</span>
          </Link>
        </Button>
      </div>
      <Input
        type="text"
        placeholder="Buscar..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="p-2 mt-4 mb-4 border rounded bg-bg-input max-w-72"
      />
      <Table className="mb-4 bg-white rounded-xl">
        {/* <TableCaption>Lista de los pagos realizados.</TableCaption> */}
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                return (
                  <TableHead key={header.id} className="p-4">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {/* {header.column.getCanFilter() ? (
                  <div>
                    <Filter column={header.column} table={table} />
                  </div>
                ) : null} */}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="p-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-10 text-center">
                Sin resultados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DataTablePagination table={table} />
    </div>
  )
}
