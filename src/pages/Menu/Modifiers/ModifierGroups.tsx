import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Legacy api removed; use typed services instead
import DataTable from '@/components/data-table'
import DnDMultipleSelector from '@/components/draggable-multi-select'
import { ItemsCell } from '@/components/multiple-cell-values'
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  getModifierGroups,
  getProducts,
  getModifierGroup,
  assignModifierGroupToProduct,
  removeModifierGroupFromProduct,
  deleteModifierGroup,
} from '@/services/menu.service'
import { useForm } from 'react-hook-form'
import CreateModifier from './createModifier'
import { ModifierGroup } from '@/types'

export default function ModifierGroups() {
  const { t } = useTranslation('menu')
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [createModifier, setCreateModifier] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [modifierGroupToDelete, setModifierGroupToDelete] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  // Aggregate all modifiers from fetched modifier groups (backend has no venue-level modifiers endpoint)
  // Moved below modifierGroups query to avoid TDZ

  // Query to fetch all products for the venue
  const { data: allProducts } = useQuery({
    queryKey: ['products', venueId],
    queryFn: () => getProducts(venueId!),
    enabled: !!venueId,
  })

  const { data: modifierGroups, isLoading } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId!),
  })

  const allModifierOptions = useMemo(
    () =>
      (modifierGroups || [])
        .flatMap(group => group.modifiers?.map(m => ({ label: m.name, value: m.id, disabled: false })) || []),
    [modifierGroups],
  )

  const {
    data: modifierGroup,
    isSuccess: isModifierGroupSuccess,
    refetch: refetchModifierGroup,
  } = useQuery({
    queryKey: ['modifier-group', searchParams.get('modifierGroup'), venueId],
    queryFn: () => getModifierGroup(venueId!, searchParams.get('modifierGroup') as string),
    enabled: searchParams.has('modifierGroup') && !!venueId,
  })

  // Mutation for saving modifiers and products assignments
  const saveModifierGroup = useMutation<any, Error, any>({
    mutationFn: async (formValues: FormValues) => {
      const groupId = searchParams.get('modifierGroup') as string
      if (!venueId || !groupId) return

      // Compute selected product IDs from form
      const selectedProductIds = (formValues.avoqadoProduct || []).map(p => p.value)

      // Derive current assignments from products that include this group
      const currentAssignedIds = (allProducts || [])
        .filter(p => p.modifierGroups?.some(mg => mg.groupId === groupId))
        .map(p => p.id)

      const toAssign = selectedProductIds.filter(id => !currentAssignedIds.includes(id))
      const toRemove = currentAssignedIds.filter(id => !selectedProductIds.includes(id))

      // Perform assignments/removals in parallel
      await Promise.all([
        ...toAssign.map(productId =>
          assignModifierGroupToProduct(venueId, productId, {
            modifierGroupId: groupId,
            displayOrder: selectedProductIds.indexOf(productId),
          }),
        ),
        ...toRemove.map(productId => removeModifierGroupFromProduct(venueId, productId, groupId)),
      ])
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.toasts.updated'),
        description: t('modifiers.toasts.saved'),
      })
      // Invalidate all relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifier-group', searchParams.get('modifierGroup'), venueId] })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      // Close the sheet after success
      setSearchParams({})
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.saveError'),
        description: error.message || t('modifiers.toasts.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to delete a modifier group
  const deleteModifierGroupMutation = useMutation({
    mutationFn: async (modifierGroupId: string) => {
      return await deleteModifierGroup(venueId!, modifierGroupId)
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.toasts.deleted'),
        description: t('modifiers.toasts.deletedDesc'),
      })
      // Invalidate and refetch data
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      setDeleteDialogOpen(false)
      setModifierGroupToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.deleteError'),
        description: error.message || t('modifiers.toasts.deleteErrorDesc'),
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
          {t('modifiers.columns.name')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => cell.getValue() as string,
    },
    {
      id: 'modifiers',
      accessorKey: 'modifiers',
      header: t('modifiers.columns.modifiers'),
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'actions',
      header: t('modifiers.columns.actions'),
      cell: ({ row }) => {
        return (
          <div className="flex justify-end" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 dropdown-menu-trigger">
                  <span className="sr-only">{t('modifiers.actions.openMenu')}</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('modifiers.actions.title')}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`${row.original.id}`)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('modifiers.actions.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSearchParams({ modifierGroup: row.original.id })
                    setCreateModifier(false)
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {t('modifiers.actions.assignModifiersAndProducts')}
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
                  {t('modifiers.actions.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, modifierGroups: any[]) => {
    if (!searchTerm) return modifierGroups

    const lowerSearchTerm = searchTerm.toLowerCase()

    return modifierGroups.filter(modifierGroup => {
      const nameMatches = modifierGroup.name.toLowerCase().includes(lowerSearchTerm)
      const modifiersMatches = modifierGroup.modifiers?.some(menu => menu.name.toLowerCase().includes(lowerSearchTerm)) ?? false
      return nameMatches || modifiersMatches
    })
  }, [])

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Form configuration for the sheet
  type FormValues = {
    modifiers: { label: string; value: string; disabled: boolean }[]
    avoqadoProduct: { label: string; value: string; disabled: boolean }[]
  }

  const form = useForm<FormValues>({})

  // Update form values when modifierGroup data changes
  useEffect(() => {
    if (isModifierGroupSuccess && modifierGroup && allProducts) {
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
        // Selected products are those currently assigned to this modifier group
        avoqadoProduct: (allProducts
          .filter(p => p.modifierGroups?.some(mg => mg.groupId === modifierGroup.id))
          .map(product => ({
            label: typeof product?.name === 'string' ? product.name : '',
            value: product?.id || '',
            disabled: false,
          })) || []),
      })
    }
  }, [isModifierGroupSuccess, modifierGroup, allProducts, form])

  // Submit handler for assignments
  function onSubmit(formValues: FormValues) {
    // Send to API with form values (mutation computes diffs and syncs assignments)
    saveModifierGroup.mutate(formValues)
  }
  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('modifiers.title')}</h1>

        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>{t('modifiers.newModifierGroup')}</span>
          </Link>
        </Button>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('modifiers.dialogs.delete.title')}</DialogTitle>
              <DialogDescription>
                {t('modifiers.dialogs.delete.description')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => modifierGroupToDelete && deleteModifierGroupMutation.mutate(modifierGroupToDelete)}
                disabled={deleteModifierGroupMutation.isPending}
              >
                {deleteModifierGroupMutation.isPending ? t('modifiers.dialogs.delete.deleting') : t('modifiers.dialogs.delete.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={modifierGroups || []}
        rowCount={modifierGroups?.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('modifiers.searchPlaceholder')}
        onSearch={handleSearch}
        tableId="modifier-groups:list"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
        pagination={pagination}
        setPagination={setPagination}
      />
      <Sheet open={searchParams.has('modifierGroup')} onOpenChange={() => setSearchParams({})}>
        {isModifierGroupSuccess && modifierGroup && (
          <SheetContent className="w-1/2">
            {createModifier ? (
              <CreateModifier
                venueId={venueId!}
                modifierGroupId={searchParams.get('modifierGroup')!}
                onBack={() => setCreateModifier(false)}
                onSuccess={() => {
                  // Invalidate and refetch both queries
                  Promise.all([
                    // Refetch all modifiers to update the available options
                    queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId], refetchType: 'all' }),
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
                        // Keep products selection as-is; modifier creation doesn't change product assignments
                        avoqadoProduct: form.getValues('avoqadoProduct'),
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
                      {t('modifiers.forms.assignDescription')}
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setCreateModifier(true)} className="mt-4">
                          {t('modifiers.forms.createNewModifier')}
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
                          <FormLabel>{t('modifiers.forms.modifiersInGroup')}</FormLabel>
                          <FormControl>
                            {field.value && field.value.length > 0 ? (
                              <DnDMultipleSelector
                                placeholder={t('modifiers.forms.selectModifiers')}
                                options={allModifierOptions}
                                value={field.value}
                                onChange={field.onChange}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-20 text-muted-foreground">
                                {t('modifiers.forms.noModifiersAssigned')}
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
                          <FormLabel>{t('modifiers.forms.productsUsingGroup')}</FormLabel>
                          <FormControl>
                            {field.value && field.value.length > 0 ? (
                              <DnDMultipleSelector
                                placeholder={t('modifiers.forms.selectProducts')}
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
                              <div className="flex items-center justify-center h-20 text-muted-foreground">
                                {t('modifiers.forms.noProductsAssigned')}
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
                      {saveModifierGroup.isPending ? t('common.saving') : t('common.save')}
                    </Button>
                  </SheetFooter>
                </form>
              </Form>
            )}
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}
