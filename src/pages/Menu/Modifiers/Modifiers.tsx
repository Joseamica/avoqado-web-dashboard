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
import { ArrowUpDown, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import api from '@/api'
import DnDMultipleSelector from '@/components/draggable-multi-select'
import { ItemsCell } from '@/components/multiple-cell-values'
import { DataTablePagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { ModifierGroup } from '@/types'
import { useForm } from 'react-hook-form'
import CreateModifier from './createModifier'

export default function Modifiers() {
  const { venueId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [createModifier, setCreateModifier] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [modifierGroupToDelete, setModifierGroupToDelete] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  // Query to fetch all modifiers to use in the selector
  const { data: allModifiers } = useQuery({
    queryKey: ['modifiers', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/modifiers`)
      return response.data
    },
    enabled: !!venueId,
  })

  // Query to fetch all products for the venue
  const { data: allProducts } = useQuery({
    queryKey: ['products', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/products`)
      return response.data
    },
    enabled: !!venueId,
  })

  const { data: modifierGroups, isLoading } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/modifier-groups`)
      return response.data
    },
  })

  const {
    data: modifierGroup,
    isError: isModifierGroupError,
    error: modifierGroupError,
    isSuccess: isModifierGroupSuccess,
    refetch: refetchModifierGroup,
  } = useQuery({
    queryKey: ['modifier-group', searchParams.get('modifierGroup'), venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/modifier-group/${searchParams.get('modifierGroup')}`)
      return response.data
    },
    enabled: searchParams.has('modifierGroup') && !!modifierGroups,
  })

  // Mutation for saving modifiers and products assignments
  const saveModifierGroup = useMutation<any, Error, any>({
    mutationFn: async formValues => {
      const response = await api.patch(`/v2/dashboard/${venueId}/modifier-group/${searchParams.get('modifierGroup')}`, formValues)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: 'Grupo modificador actualizado',
        description: 'Los cambios se han guardado correctamente.',
      })
      // Invalidate all relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifier-group', searchParams.get('modifierGroup'), venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifiers', venueId] })
      // Close the sheet after success
      setSearchParams({})
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar los cambios.',
        variant: 'destructive',
      })
    },
  })

  // Mutation to delete a modifier group
  const deleteModifierGroupMutation = useMutation({
    mutationFn: async (modifierGroupId: string) => {
      return await api.delete(`/v2/dashboard/${venueId}/modifier-group/${modifierGroupId}`)
    },
    onSuccess: () => {
      toast({
        title: 'Grupo modificador eliminado',
        description: 'El grupo modificador ha sido eliminado correctamente.',
      })
      // Invalidate and refetch data
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      setDeleteDialogOpen(false)
      setModifierGroupToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar',
        description: error.message || 'Hubo un problema al eliminar el grupo modificador.',
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

      cell: ({ cell }) => cell.getValue() as string,
    },
    {
      id: 'modifiers',
      accessorKey: 'modifiers',
      header: 'Modificadores',
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        return (
          <div className="flex justify-end" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 dropdown-menu-trigger">
                  <span className="sr-only">Abrir menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`${row.original.id}`)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSearchParams({ modifierGroup: row.original.id })
                    setCreateModifier(false)
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Asignar modificadores y productos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setModifierGroupToDelete(row.original.id)
                    setDeleteDialogOpen(true)
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
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

  // --- Cascade: Added useEffect to reset row selection when table data changes ---
  // This helps prevent infinite loops when the venue changes and the table's selected state
  // becomes inconsistent with the new data.
  useEffect(() => {
    if (table) {
      // Resetting row selection when the data (filteredModifierGroups) changes.
      // This is important when the venueId changes and new data is fetched.
      table.resetRowSelection() // Calling with no arguments or `false` clears selection but keeps a ref to the old selection for performance.
      // `true` forces a full reset which might be safer here if issues persist.
    }
  }, [filteredModifierGroups, table])
  // --- End Cascade change ---

  // Form configuration for the sheet
  type FormValues = {
    modifiers: { label: string; value: string; disabled: boolean }[]
    avoqadoProduct: { label: string; value: string; disabled: boolean }[]
  }

  const form = useForm<FormValues>({})

  // Update form values when modifierGroup data changes
  useEffect(() => {
    if (isModifierGroupSuccess && modifierGroup) {
      const selectedModifierIds = modifierGroup.modifiers.map(mod => mod.id)

      form.reset({
        modifiers: selectedModifierIds.map(id => {
          const modifier = modifierGroup.modifiers.find(m => m.id === id)
          return {
            label: typeof modifier?.name === 'string' ? modifier.name : '',
            value: modifier?.id || '',
            disabled: false,
          }
        }),
        avoqadoProduct: modifierGroup.avoqadoProducts.map(product => ({
          label: typeof product?.name === 'string' ? product.name : '',
          value: product?.id || '',
          disabled: false,
        })),
      })
    }
  }, [isModifierGroupSuccess, modifierGroup, form])

  // Submit handler for assignments
  function onSubmit(formValues: FormValues) {
    // Process the products - add an order index to each item
    const processedProducts =
      formValues.avoqadoProduct?.map((item, idx) => ({
        ...item,
        order: idx,
      })) || []

    // Process the modifiers - also add an order index
    const processedModifiers =
      formValues.modifiers?.map((item, idx) => ({
        ...item,
        order: idx,
      })) || []

    // Create the payload with both processed arrays
    const payload = {
      avoqadoProduct: processedProducts,
      modifiers: processedModifiers,
    }

    // Send to API
    saveModifierGroup.mutate(payload)
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar grupo modificador</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar este grupo modificador? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => modifierGroupToDelete && deleteModifierGroupMutation.mutate(modifierGroupToDelete)}
                disabled={deleteModifierGroupMutation.isPending}
              >
                {deleteModifierGroupMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
              <TableRow key={index} className="cursor-pointer" onClick={() => setSearchParams({ modifierGroup: String(index) })}>
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
                data-state={row.getIsSelected() && 'selected'}
                onClick={e => {
                  // Check if the click is not on the action dropdown
                  if (!(e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
                    navigate(`${row.original.id}`)
                  }
                }}
                className="cursor-pointer"
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
              <CreateModifier
                venueId={venueId}
                modifierGroupId={searchParams.get('modifierGroup')}
                onBack={() => setCreateModifier(false)}
                onSuccess={() => {
                  // Invalidate and refetch both queries
                  Promise.all([
                    // Refetch all modifiers to update the available options
                    queryClient.invalidateQueries({
                      queryKey: ['modifiers', venueId],
                      refetchType: 'all',
                    }),
                    // Refetch the specific modifier group to update the selected modifiers
                    refetchModifierGroup(),
                  ]).then(([_, modifierGroupResult]) => {
                    if (modifierGroupResult.data) {
                      // Get the IDs of modifiers that are part of this group
                      const selectedModifierIds = modifierGroupResult.data.modifiers.map(mod => mod.id)

                      // Update the form with the latest data
                      form.reset({
                        // For modifiers, we track which ones are already selected in this group
                        modifiers: selectedModifierIds.map(id => {
                          const modifier = modifierGroupResult.data.modifiers.find(m => m.id === id)
                          return {
                            label: modifier.name,
                            value: modifier.id,
                            disabled: false,
                          }
                        }),
                        // For products, same as before
                        avoqadoProduct: modifierGroupResult.data.avoqadoProducts.map(product => ({
                          label: product.name,
                          value: product.id,
                          disabled: false,
                        })),
                      })
                    }
                    // Hide the create form only after data is refreshed
                    setCreateModifier(false)
                  })
                }}
              />
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6">
                  <SheetHeader>
                    <SheetTitle>{modifierGroup.name}</SheetTitle>
                    <SheetDescription>
                      Asigna modificadores y productos a este grupo.
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setCreateModifier(true)} className="mt-4">
                          Crear nuevo modificador
                        </Button>
                      </div>
                    </SheetDescription>
                  </SheetHeader>

                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="modifiers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modificadores en este grupo</FormLabel>
                          <FormControl>
                            {field.value && field.value.length > 0 ? (
                              <DnDMultipleSelector
                                placeholder="Seleccionar modificadores..."
                                options={
                                  allModifiers
                                    ? allModifiers.map(modifier => ({
                                        label: modifier.name,
                                        value: modifier.id,
                                        disabled: false,
                                      }))
                                    : []
                                }
                                value={field.value}
                                onChange={field.onChange}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-20 text-gray-400">
                                No hay modificadores asignados a este grupo
                              </div>
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="avoqadoProduct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Productos que usan este grupo de modificadores</FormLabel>
                          <FormControl>
                            {field.value && field.value.length > 0 ? (
                              <DnDMultipleSelector
                                placeholder="Seleccionar productos..."
                                options={
                                  allProducts
                                    ? allProducts.map(product => ({
                                        label: product.name,
                                        value: product.id,
                                        disabled: false,
                                      }))
                                    : []
                                }
                                value={field.value}
                                onChange={field.onChange}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-20 text-gray-400">
                                No hay productos asignados a este grupo modificador
                              </div>
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <SheetFooter>
                    <Button type="submit" disabled={!form.formState.isDirty || saveModifierGroup.isPending} className="ml-auto">
                      {saveModifierGroup.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
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
