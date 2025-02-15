import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import api from '@/api'
import DnDMultipleSelector from '@/components/draggable-multi-select'
import { ItemsCell } from '@/components/multiple-cell-values'
import { DataTablePagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { ModifierGroup } from '@/types'
import { useForm } from 'react-hook-form'

export default function Modifiers() {
  const { venueId } = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const [createModifier, setCreateModifier] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()

  const { data: modifierGroups, isLoading } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/modifier-groups`)
      return response.data
    },
  })

  const {
    data: modifierGroup,
    isLoading: isModifierGroupLoading,
    isError: isModifierGroupError,
    error: modifierGroupError,
    isSuccess: isModifierGroupSuccess,
  } = useQuery({
    queryKey: ['modifier-group', searchParams.get('modifierGroup'), venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/modifier-group/${searchParams.get('modifierGroup')}`)
      return response.data
    },
    enabled: searchParams.has('modifierGroup') && !!modifierGroups,
  })

  const saveProduct = useMutation({
    mutationFn: async formValues => {
      const response = await api.patch(`/v2/dashboard/${venueId}/modifier-group/${searchParams.get('modifierGroup')}`, formValues)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: 'Producto guardado',
        description: 'Los cambios se han guardado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['product', searchParams.get('modifierGroup')] }) // Refetch product data
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar los cambios.',
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<ModifierGroup, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center cursor-pointer">
          Nombre
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ row, cell }) => (
        <button
          // Prevent the row's onClick from triggering when clicking the button
          onClick={e => {
            e.stopPropagation()
            setSearchParams({ modifierGroup: row.original.id })
          }}
          className="text-links hover:underline"
        >
          {cell.getValue() as string}
        </button>
      ),
    },
    {
      id: 'modifiers',
      accessorKey: 'modifiers',
      header: 'Modificadores',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
  ]

  const filteredModifierGroups = useMemo(() => {
    if (!searchTerm) return modifierGroups

    const lowerSearchTerm = searchTerm.toLowerCase()

    return modifierGroups?.filter(modifierGroup => {
      const nameMatches = modifierGroup.name.toLowerCase().includes(lowerSearchTerm)
      const modifiersMatches = modifierGroup.modifiers.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || modifiersMatches
    })
  }, [searchTerm, modifierGroups])

  const table = useReactTable({
    data: filteredModifierGroups || [],
    columns,
    rowCount: modifierGroups?.length,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 10,
      minSize: 200, // enforced during column resizing
    },
    debugTable: true,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    sortDescFirst: true, // sort by all columns in descending order first
    getPaginationRowModel: getPaginationRowModel(),
  })

  // Configuración del formulario
  // const form = useForm<z.infer<typeof FormSchema>>({
  // resolver: zodResolver(FormSchema),
  const form = useForm({
    // defaultValues: {
    //   name: '',
    //   description: '',
    //   imageUrl: '',
    //   categories: [],
    // },
    // values: {
    //   name: data?.avoqadoProduct.name || '',
    //   description: data?.avoqadoProduct.description || '',
    //   imageUrl: data?.avoqadoProduct.imageUrl || '',
    //   categories: [],
    // },
  })

  // Update formData when modifierGroup data is fetched
  // useEffect(() => {
  //   if (isModifierGroupSuccess && modifierGroup) {
  //     setFormData({
  //       name: modifierGroup.name || '',
  //       username: modifierGroup.username || '',
  //     })
  //   }
  // }, [isModifierGroupSuccess, modifierGroup])

  // Handle input changes
  // const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const { id, value } = e.target
  //   setFormData(prev => ({
  //     ...prev,
  //     [id]: value,
  //   }))
  // }

  // // Handle form submission
  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault()
  //   try {
  //     // Example API call to update the modifier group
  //     await api.put(`/v2/dashboard/${venueId}/modifier-group/${modifierGroup.id}`, formData)
  //     toast({
  //       title: 'Success',
  //       description: 'Modifier group updated successfully.',
  //     })
  //     // queryClient.invalidateQueries(['modifier-groups', se, venueId])
  //     setSearchParams({}) // Close the sheet
  //   } catch (err) {
  //     toast({
  //       title: 'Error',
  //       description: 'Failed to update modifier group.',
  //     })
  //   }
  // }

  // Manejador del submit
  // function onSubmit(formValues: z.infer<typeof FormSchema>) {
  function onSubmit(formValues) {
    console.log('LOG: formValues', formValues)
    // formValues.avoqadoProduct is what the DraggableMultipleSelector returns
    // Add an order index to each item
    formValues.avoqadoProduct = formValues.avoqadoProduct.map((item, idx) => ({
      ...item,
      order: idx,
    }))

    saveProduct.mutate({
      ...formValues,
    })
  }

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold">Grupos modificadores</h1>

        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>Nuevo grupo modificador</span>
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
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} className="p-4">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Render skeleton rows while loading
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                {columns.map(column => (
                  <TableCell key={column.id} className="p-4">
                    <Skeleton className="w-full h-4" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : isModifierGroupError ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-10 text-center text-red-500">
                Error: {(modifierGroupError as Error).message}
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            // Render actual data rows
            table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setSearchParams({ modifierGroup: row.original.id })}
                tabIndex={0} // Make row focusable
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSearchParams({ modifierGroup: row.original.id })
                  }
                }}
                role="button" // Indicate that the row is clickable
                aria-pressed={searchParams.get('modifierGroup') === row.original.id}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="p-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            // Render "No results" message
            <TableRow>
              <TableCell colSpan={columns.length} className="h-10 text-center">
                Sin resultados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Sheet open={searchParams.has('modifierGroup')} onOpenChange={() => setSearchParams({})}>
        {isModifierGroupSuccess && modifierGroup && (
          <SheetContent className="w-1/2">
            {createModifier ? (
              <button onClick={() => setCreateModifier(false)} className="flex flex-row items-center space-x-5">
                <ChevronLeft /> <span>{modifierGroup.name}</span>
              </button>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 ">
                  <SheetHeader>
                    <SheetTitle>{modifierGroup?.name}</SheetTitle>
                    <SheetDescription>Edita este grupo modificador.</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    <FormField
                      control={form.control}
                      name="modifiers"
                      defaultValue={modifierGroup.modifiers.map(modifier => ({
                        label: modifier.name,
                        value: modifier.id,
                        disabled: false,
                      }))}
                      rules={{
                        required: { value: true, message: 'Selecciona al menos una categoría.' },
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <div className="justify-between space-x-3 flex-row-center">
                            <FormLabel>Modificadores</FormLabel>
                            <Button type="button" variant="outline" onClick={() => setCreateModifier(true)}>
                              Crear nuevo modificador
                            </Button>
                          </div>
                          <FormDescription>Se aplicó a {modifierGroup.modifiers.length} modificadores.</FormDescription>
                          <FormControl>
                            <DnDMultipleSelector
                              {...field}
                              options={modifierGroup.modifiers.map(modifierGroup => ({
                                label: modifierGroup.name,
                                value: modifierGroup.id,
                                disabled: false,
                              }))}
                              hidePlaceholderWhenSelected
                              placeholder="Organiza o selecciona los modificadores..."
                              enableReordering={true} // Enable DnDKit-based reordering
                              creatable={true}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="avoqadoProduct"
                      defaultValue={modifierGroup.avoqadoProducts.map(avoqadoProduct => ({
                        label: avoqadoProduct.name,
                        value: avoqadoProduct.id,
                        disabled: false,
                      }))}
                      rules={{
                        required: { value: true, message: 'Selecciona al menos una categoría.' },
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Añadir productos</FormLabel>
                          <FormDescription>Se aplicó a {modifierGroup.avoqadoProducts.length} productos.</FormDescription>
                          <FormControl>
                            <DnDMultipleSelector
                              {...field}
                              options={modifierGroup.avoqadoProducts.map(avoqadoProduct => ({
                                label: avoqadoProduct.name,
                                value: avoqadoProduct.id,
                                disabled: false,
                              }))}
                              hidePlaceholderWhenSelected
                              placeholder="Organiza o selecciona productos..."
                              enableReordering={true}
                              creatable={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <SheetFooter>
                    <SheetClose asChild>
                      <Button type="submit">Save changes</Button>
                    </SheetClose>
                  </SheetFooter>
                </form>
              </Form>
            )}
          </SheetContent>
        )}
      </Sheet>
      <DataTablePagination table={table} />
    </div>
  )
}
