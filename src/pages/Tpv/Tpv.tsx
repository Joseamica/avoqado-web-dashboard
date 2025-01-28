import api from '@/api'
import { useQuery } from '@tanstack/react-query'
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
import { Link, useLocation, useParams } from 'react-router-dom'

import { DataTablePagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tpv } from '@/types'

export default function Tpvs() {
  const { venueId } = useParams()

  const location = useLocation()

  const [searchTerm, setSearchTerm] = useState('')

  const { data: tpvs, isLoading } = useQuery({
    queryKey: ['tpvs', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/tpvs`)
      return response.data
    },
  })

  const columns: ColumnDef<Tpv, unknown>[] = [
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
      id: 'serial',
      accessorKey: 'serial',
      sortDescFirst: true,
      header: ({ column }) => <div className=" flex-row-center">Numero de serie</div>,

      //   cell: ({ cell }) => {
      //     const price = cell.getValue() as number
      //     return <ul>{Currency(price, false)}</ul>
      //   },
    },
    {
      id: 'version',
      accessorKey: 'version',
      sortDescFirst: true,
      header: ({ column }) => <div className=" flex-row-center">Versión</div>,

      //   cell: ({ cell }) => {
      //     const price = cell.getValue() as number
      //     return <ul>{Currency(price, false)}</ul>
      //   },
    },
  ]

  const filteredTpvs = useMemo(() => {
    if (!searchTerm) return tpvs

    const lowerSearchTerm = searchTerm.toLowerCase()

    return tpvs?.filter((tpv: Tpv) => {
      // Buscar en el name del category o en los menús (avoqadoMenus.name)
      const nameMatches = tpv.name.toLowerCase().includes(lowerSearchTerm)
      //   const modifierGroupMatches = tpv.modifierGroups.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      //   const categoryMatches = tpv.categories.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches
      //    || modifierGroupMatches || categoryMatches
    })
  }, [searchTerm, tpvs])

  const table = useReactTable({
    data: filteredTpvs || [],
    columns,
    rowCount: tpvs?.length,
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
    initialState: {
      sorting: [{ id: 'name', desc: true }],
    },
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="p-4">
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
