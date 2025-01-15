import api from '@/api'
import { useToast } from '@/hooks/use-toast'
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

import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AvoqadoMenu, AvoqadoProduct, Category } from '@/types'
import { DataTablePagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ItemsCell } from '@/components/multiple-cell-values'

export default function Categories() {
  const { venueId } = useParams()

  const location = useLocation()

  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  const {
    data: categories,
    isLoading,
    isError,
    error,
    isSuccess,
  } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/get-categories`)
      return response.data
    },
  })
  const { toast } = useToast()
  const columns: ColumnDef<Category, unknown>[] = [
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
      id: 'avoqadoMenus',
      accessorKey: 'avoqadoMenus',
      header: 'Menús',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'avoqadoProducts',
      accessorKey: 'avoqadoProducts',
      header: 'Productos',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
  ]

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories

    const lowerSearchTerm = searchTerm.toLowerCase()

    return categories?.filter(category => {
      // Buscar en el name del category o en los menús (avoqadoMenus.name)
      const nameMatches = category.name.toLowerCase().includes(lowerSearchTerm)
      const menuMatches = category.avoqadoMenus.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || menuMatches
    })
  }, [searchTerm, categories])
  const table = useReactTable({
    data: filteredCategories || [],
    columns,
    rowCount: categories?.length,
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
        <h1 className="text-xl font-semibold">Categorias</h1>
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nueva categoría</span>
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
