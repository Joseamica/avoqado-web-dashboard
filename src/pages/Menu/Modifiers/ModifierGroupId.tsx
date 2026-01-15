import { getModifierGroup, getModifierGroups, getProducts, updateModifierGroup, deleteModifierGroup } from '@/services/menu.service'
import AlertDialogWrapper from '@/components/alert-dialog'
import DnDMultipleSelector from '@/components/draggable-multi-select'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CreateModifier from './createModifier'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import EditModifier from './EditModifier'

export default function ModifierGroupId() {
  const { t } = useTranslation('menu')
  const { modifierGroupId } = useParams()
  const { venueId, fullBasePath } = useCurrentVenue()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [editingModifierId, setEditingModifierId] = useState<string | null>(null)
  const [isCreateModifierSheetOpen, setIsCreateModifierSheetOpen] = useState(false)

  const from = (location.state as any)?.from || `${fullBasePath}/menumaker/modifier-groups`

  // Fetch modifier group data
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['modifier-group', modifierGroupId, venueId],
    queryFn: async () => {
      console.log('Fetching modifier group:', { venueId, modifierGroupId })
      try {
        const result = await getModifierGroup(venueId!, modifierGroupId!)
        return result
      } catch (err) {
        console.error('Error fetching modifier group:', err)
        throw err
      }
    },
    enabled: !!modifierGroupId && !!venueId,
  })

  // Query to fetch all modifier groups to get all modifiers
  const { data: allModifierGroups } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId!),
    enabled: !!venueId,
  })

  // Extract all modifiers from modifier groups
  const allModifiers = allModifierGroups?.flatMap(group => group.modifiers || []) || []

  // Query to fetch all products for the venue
  const { data: allProducts } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId!, { orderBy: 'name' }),
    enabled: !!venueId,
  })

  // Mutation to update the modifier group details
  const updateModifierGroupDetails = useMutation({
    mutationFn: async (details: {
      name: string
      description?: string
      required: boolean
      minSelections: number
      maxSelections: number | null
      allowMultiple: boolean
      multipleSelectionAmount?: number
      multiMax?: number
    }) => {
      return await updateModifierGroup(venueId!, modifierGroupId!, details)
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.toasts.updated'),
        description: t('modifiers.detail.toasts.updatedDesc'),
      })
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.updateError'),
        description: error.message || t('modifiers.detail.toasts.updateErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to update modifiers and products for the group
  const saveModifierGroup = useMutation({
    mutationFn: async (payload: ModifierGroupUpdatePayload) => {
      return await updateModifierGroup(venueId!, modifierGroupId!, payload)
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.toasts.updated'),
        description: t('modifiers.toasts.saved'),
      })
      // Invalidate all relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifiers', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.updateError'),
        description: error.message || t('forms.messages.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to delete the modifier group
  const deleteModifierGroupMutation = useMutation({
    mutationFn: async () => {
      return await deleteModifierGroup(venueId!, modifierGroupId!)
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.toasts.deleted'),
        description: t('modifiers.detail.toasts.deletedDesc'),
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.deleteError'),
        description: error.message || t('modifiers.detail.toasts.deleteErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Define the form type
  type FormValues = {
    modifiers: { label: string; value: string; disabled: boolean }[]
    avoqadoProduct: { label: string; value: string; disabled: boolean }[]
    groupName?: string
    description?: string
    required: boolean
    minSelections: number
    maxSelections: number | null
    multipleSelectionAmount?: number
    multiMax?: number
  }

  type ModifierGroupUpdatePayload = {
    avoqadoProduct: { label: string; value: string; disabled: boolean; order: number }[]
    modifiers: { name: string; price: number; active: boolean; order: number }[]
  }

  // Initialize form
  const form = useForm<FormValues>()

  // Update form values when data is loaded
  useEffect(() => {
    if (data) {
      form.reset({
        groupName: data.name,
        description: data.description,
        required: data.required ?? false,
        minSelections: typeof data.minSelections === 'number' ? data.minSelections : 0,
        maxSelections: typeof data.maxSelections === 'number' ? data.maxSelections : 1,
        multipleSelectionAmount: (data as { multipleSelectionAmount?: number })?.multipleSelectionAmount ?? 0,
        multiMax: (data as { multiMax?: number })?.multiMax ?? 1,
        modifiers: (data.modifiers || []).map(modifier => ({
          label: modifier.name,
          value: modifier.id,
          disabled: false,
        })),
        avoqadoProduct: (allProducts || [])
          .filter(product => product.modifierGroups?.some(mg => mg.groupId === data.id))
          .map(product => ({
            label: product.name,
            value: product.id,
            disabled: false,
          })),
      })
    }
  }, [data, form, allProducts])

  const watchRequired = form.watch('required')
  useEffect(() => {
    if (watchRequired) {
      const currentMin = form.getValues('minSelections')
      if (typeof currentMin === 'number' && currentMin < 1) {
        form.setValue('minSelections', 1, { shouldValidate: true, shouldDirty: true })
      }
    }
  }, [watchRequired, form])

  // Close the create modifier sheet when we're done
  const handleCloseCreateModifierSheet = () => {
    setIsCreateModifierSheetOpen(false)
  }

  // Submit handler for form
  function onSubmit(formValues: FormValues) {
    const minSelections = typeof formValues.minSelections === 'number' ? formValues.minSelections : 0
    const maxSelections = typeof formValues.maxSelections === 'number' ? formValues.maxSelections : 1

    const hasDetailsChanges =
      form.formState.dirtyFields.groupName ||
      form.formState.dirtyFields.description ||
      form.formState.dirtyFields.required ||
      form.formState.dirtyFields.minSelections ||
      form.formState.dirtyFields.maxSelections ||
      form.formState.dirtyFields.multipleSelectionAmount ||
      form.formState.dirtyFields.multiMax

    // Update basic details (name, description, rules)
    if (hasDetailsChanges) {
      const originalMaxSelections =
        data?.maxSelections === null
          ? null
          : typeof data?.maxSelections === 'number'
            ? data.maxSelections
            : maxSelections
      const resolvedMaxSelections = form.formState.dirtyFields.maxSelections ? maxSelections : originalMaxSelections
      const resolvedRequired = form.formState.dirtyFields.required ? formValues.required : data?.required ?? formValues.required
      const resolvedMinSelections = form.formState.dirtyFields.minSelections
        ? minSelections
        : typeof data?.minSelections === 'number'
          ? data.minSelections
          : minSelections
      const resolvedAllowMultiple = form.formState.dirtyFields.maxSelections
        ? (resolvedMaxSelections ?? 1) > 1
        : data?.allowMultiple ?? (resolvedMaxSelections ?? 1) > 1
      const resolvedMultipleSelectionAmount = form.formState.dirtyFields.multipleSelectionAmount
        ? (formValues.multipleSelectionAmount ?? 0)
        : (data as { multipleSelectionAmount?: number })?.multipleSelectionAmount ?? formValues.multipleSelectionAmount ?? 0
      const resolvedMultiMax = form.formState.dirtyFields.multiMax
        ? (formValues.multiMax ?? 1)
        : (data as { multiMax?: number })?.multiMax ?? formValues.multiMax ?? 1

      const details: {
        name: string
        description?: string
        required: boolean
        minSelections: number
        maxSelections: number | null
        allowMultiple: boolean
        multipleSelectionAmount?: number
        multiMax?: number
      } = {
        name: typeof formValues.groupName === 'string' ? formValues.groupName : '',
        description: typeof formValues.description === 'string' ? formValues.description : '',
        required: resolvedRequired,
        minSelections: resolvedMinSelections,
        maxSelections: resolvedMaxSelections,
        allowMultiple: resolvedAllowMultiple,
      }
      if (
        form.formState.dirtyFields.multipleSelectionAmount ||
        (data && 'multipleSelectionAmount' in data)
      ) {
        details.multipleSelectionAmount = resolvedMultipleSelectionAmount
      }
      if (
        form.formState.dirtyFields.multiMax ||
        (data && 'multiMax' in data)
      ) {
        details.multiMax = resolvedMultiMax
      }

      updateModifierGroupDetails.mutate(details)
    }

    // Process modifiers and products assignments
    if (form.formState.dirtyFields.modifiers || form.formState.dirtyFields.avoqadoProduct) {
      // Process the products - add an order index to each item
      const processedProducts =
        formValues.avoqadoProduct?.map((item, idx) => ({
          ...item,
          order: idx,
        })) || []

      // Process the modifiers - also add an order index
      const processedModifiers =
        formValues.modifiers
          ?.map((item, idx) => {
            if (!item?.value || item.value === '_new') {
              return null
            }

            const modifierDetails = allModifiers?.find(modifier => modifier.id === item.value)
            const name = modifierDetails?.name ?? item.label

            if (!name || name.trim() === '') {
              return null
            }

            return {
              name,
              price: Number(modifierDetails?.price ?? 0),
              active: modifierDetails?.active ?? true,
              order: idx,
            }
          })
          .filter((modifier): modifier is { name: string; price: number; active: boolean; order: number } => modifier !== null) || []

      // Create the payload with both processed arrays
      const payload = {
        avoqadoProduct: processedProducts,
        modifiers: processedModifiers,
      }

      // Send to API
      saveModifierGroup.mutate(payload)
    }
  }

  if (isLoading) {
    return <div className="p-4">{t('forms.messages.loading')}</div>
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <div className="text-destructive mb-2">{t('modifiers.detail.errorLoading')}</div>
        <div className="text-sm text-muted-foreground mb-2">
          {isError ? t('modifiers.detail.errorFetching') : t('modifiers.detail.noData')}
        </div>
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded mb-4">
            {error instanceof Error ? error.message : t('modifiers.detail.unknownError')}
          </div>
        )}
        <div className="mt-4">
          <Link to={from} className="text-primary hover:underline">
            {t('modifiers.detail.backToGroups')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-10">
      {/* Top bar */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-card border-b border-border top-14">
        <div className="space-x-4 flex items-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{data.name}</span>
        </div>
        <div className="space-x-3 flex items-center">
          <AlertDialogWrapper
            triggerTitle={t('modifiers.actions.delete')}
            title={t('modifiers.dialogs.deleteTitle')}
            message={t('modifiers.dialogs.deleteDescription')}
            rightButtonLabel={t('modifiers.dialogs.deleteConfirm')}
            rightButtonVariant="destructive"
            onRightButtonClick={() => deleteModifierGroupMutation.mutate()}
          />
          <Button
            disabled={!form.formState.isDirty || updateModifierGroupDetails.isPending || saveModifierGroup.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {updateModifierGroupDetails.isPending || saveModifierGroup.isPending ? t('modifiers.toasts.saving') : t('modifiers.forms.save')}
          </Button>
        </div>
      </div>

      {/* Sheet for creating a new modifier */}
      <Sheet open={isCreateModifierSheetOpen} onOpenChange={setIsCreateModifierSheetOpen}>
        <SheetContent className="sm:max-w-md md:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t('modifiers.forms.createNewModifier')}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <CreateModifier
              venueId={venueId || ''}
              modifierGroupId={modifierGroupId || ''}
              onBack={handleCloseCreateModifierSheet}
              onSuccess={() => {
                handleCloseCreateModifierSheet()
                queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet for editing an existing modifier */}
      <Sheet open={!!editingModifierId} onOpenChange={open => !open && setEditingModifierId(null)}>
        <SheetContent className="sm:max-w-md md:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t('modifiers.editModifier.title')}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {editingModifierId && data?.modifiers && (
              <EditModifier
                venueId={venueId}
                modifierId={editingModifierId}
                modifierGroupId={modifierGroupId}
                onBack={() => setEditingModifierId(null)}
                onSuccess={() => {
                  setEditingModifierId(null)
                  queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
                }}
                initialValues={{
                  name: data.modifiers.find(m => m.id === editingModifierId)?.name || '',
                  price: data.modifiers.find(m => m.id === editingModifierId)?.price || 0,
                  active: data.modifiers.find(m => m.id === editingModifierId)?.active ?? true,
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('modifiers.detail.groupInformation')}</h3>
            <FormField
              control={form.control}
              name="groupName"
              defaultValue={typeof data.name === 'string' ? data.name : ''}
              rules={{
                required: { value: true, message: t('modifiers.detail.nameRequired') },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('modifiers.detail.groupName')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('modifiers.detail.groupNamePlaceholder')}
                      value={typeof field.value === 'string' ? field.value : ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="max-w-96"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              defaultValue={typeof data.description === 'string' ? data.description : ''}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('forms.description')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('modifiers.detail.descriptionPlaceholder')}
                      name={field.name}
                      value={typeof field.value === 'string' ? field.value : ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      disabled={field.disabled}
                      className="max-w-96"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('modifiers.createGroup.selectionRules')}</h3>
            <FormField
              control={form.control}
              name="required"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t('modifiers.createGroup.requiredSelection')}</FormLabel>
                    <FormDescription>{t('modifiers.createGroup.requiredSelectionDesc')}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minSelections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.createGroup.minSelections')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={watchRequired ? 1 : 0}
                        value={field.value ?? ''}
                        onChange={e => {
                          const val = e.target.value
                          field.onChange(val === '' ? '' : parseInt(val) || 0)
                        }}
                        onBlur={e => {
                          const val = e.target.value
                          field.onChange(val === '' ? 0 : parseInt(val) || 0)
                          field.onBlur()
                        }}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>{t('modifiers.createGroup.minSelectionsDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxSelections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.createGroup.maxSelections')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value ?? ''}
                        onChange={e => {
                          const val = e.target.value
                          field.onChange(val === '' ? '' : parseInt(val) || 1)
                        }}
                        onBlur={e => {
                          const val = e.target.value
                          field.onChange(val === '' ? 1 : parseInt(val) || 1)
                          field.onBlur()
                        }}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>{t('modifiers.createGroup.maxSelectionsDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="multipleSelectionAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('modifiers.createGroup.multipleSelection')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('modifiers.createGroup.multipleSelectionPlaceholder')}
                      value={field.value === 0 ? '' : field.value ?? ''}
                      onChange={e => {
                        const val = e.target.value
                        field.onChange(val === '' ? '' : parseInt(val) || 0)
                      }}
                      onBlur={e => {
                        const val = e.target.value
                        field.onChange(val === '' ? 0 : parseInt(val) || 0)
                        field.onBlur()
                      }}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>{t('modifiers.createGroup.multipleSelectionDesc')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="multiMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('modifiers.createGroup.maxPerModifier')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      value={field.value === 1 ? '' : field.value ?? ''}
                      onChange={e => {
                        const val = e.target.value
                        field.onChange(val === '' ? '' : parseInt(val) || 1)
                      }}
                      onBlur={e => {
                        const val = e.target.value
                        field.onChange(val === '' ? 1 : parseInt(val) || 1)
                        field.onBlur()
                      }}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>{t('modifiers.createGroup.maxPerModifierDesc')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator className="my-6" />

          <FormField
            control={form.control}
            name="modifiers"
            render={({ field }) => (
              <FormItem className="mt-4">
                <div className="flex items-center gap-2">
                  <FormLabel>{t('modifiers.detail.assignModifiers')}</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="rounded-full border bg-muted w-5 h-5 inline-flex items-center justify-center text-xs font-semibold">
                        ?
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('modifiers.detail.modifierTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <FormControl>
                  <DnDMultipleSelector
                    showAddItemText={true}
                    showViewIcon={true}
                    itemName={t('modifiers.detail.modifierItem')}
                    onViewOption={option => {
                      if (option.value === '_new') {
                        // Handle "Add new modifier" click - show sheet
                        setIsCreateModifierSheetOpen(true)
                      } else {
                        // Handle edit existing modifier click - open sheet to edit this specific modifier
                        setEditingModifierId(option.value)
                      }
                    }}
                    placeholder={t('modifiers.detail.selectModifiersPlaceholder')}
                    options={
                      allModifiers
                        ? allModifiers.map(modifier => ({
                            label: modifier.name,
                            value: modifier.id,
                            disabled: false,
                          }))
                        : []
                    }
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator className="my-6" />

          <FormField
            control={form.control}
            name="avoqadoProduct"
            render={({ field }) => (
              <FormItem className="mt-4">
                <div className="flex items-center gap-2">
                  <FormLabel>{t('modifiers.detail.assignProducts')}</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="rounded-full bg-muted w-5 h-5 inline-flex items-center justify-center text-xs font-semibold border">
                        ?
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('modifiers.detail.productTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <FormControl>
                  <DnDMultipleSelector
                    showViewIcon={true}
                    showAddItemText={true}
                    itemName={t('modifiers.detail.productItem')}
                    onViewOption={option => {
                      if (option.value === '_new') {
                        // Handle "Add new product" click
                        navigate(`${fullBasePath}/menumaker/products/create`)
                      } else {
                        // Handle view existing product click
                        navigate(`${fullBasePath}/menumaker/products/${option.value}`)
                      }
                    }}
                    placeholder={t('modifiers.detail.selectProductsPlaceholder')}
                    options={
                      allProducts
                        ? allProducts.map(product => ({
                            label: product.name,
                            value: product.id,
                            disabled: false,
                          }))
                        : []
                    }
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}
