import { getModifierGroup, getModifierGroups, getProducts, updateModifierGroup, deleteModifierGroup } from '@/services/menu.service'
import AlertDialogWrapper from '@/components/alert-dialog'
import DnDMultipleSelector from '@/components/draggable-multi-select'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import CreateModifier from './createModifier'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import EditModifier from './EditModifier'

export default function ModifierGroupId() {
  const { modifierGroupId } = useParams()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [createModifier, setCreateModifier] = useState(false)
  const [editingModifierId, setEditingModifierId] = useState<string | null>(null)
  const [isCreateModifierSheetOpen, setIsCreateModifierSheetOpen] = useState(false)

  const from = (location.state as any)?.from || `/venues/${venueId}/menumaker/modifier-groups`

  // Fetch modifier group data
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['modifier-group', modifierGroupId, venueId],
    queryFn: async () => {
      console.log('Fetching modifier group:', { venueId, modifierGroupId })
      try {
        const result = await getModifierGroup(venueId!, modifierGroupId!)
        console.log('Modifier group result:', result)
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
    queryKey: ['products', venueId],
    queryFn: () => getProducts(venueId!),
    enabled: !!venueId,
  })

  // Mutation to update the modifier group details
  const updateModifierGroupDetails = useMutation({
    mutationFn: async (details: { name: string; description?: string }) => {
      return await updateModifierGroup(venueId!, modifierGroupId!, details)
    },
    onSuccess: () => {
      toast({
        title: 'Grupo modificador actualizado',
        description: 'Los detalles del grupo se han actualizado correctamente.',
      })
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al actualizar el grupo modificador.',
        variant: 'destructive',
      })
    },
  })

  // Mutation to update modifiers and products for the group
  const saveModifierGroup = useMutation({
    mutationFn: async (formValues: FormValues) => {
      return await updateModifierGroup(venueId!, modifierGroupId!, formValues)
    },
    onSuccess: () => {
      toast({
        title: 'Grupo modificador actualizado',
        description: 'Los cambios se han guardado correctamente.',
      })
      // Invalidate all relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
      queryClient.invalidateQueries({ queryKey: ['modifiers', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar los cambios.',
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
        title: 'Grupo modificador eliminado',
        description: 'El grupo modificador ha sido eliminado correctamente.',
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar',
        description: error.message || 'Hubo un problema al eliminar el grupo modificador.',
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
  }

  // Initialize form
  const form = useForm<FormValues>()

  // Update form values when data is loaded
  useEffect(() => {
    if (data) {
      form.reset({
        groupName: data.name,
        description: data.description,
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

  // Close the create modifier sheet when we're done
  const handleCloseCreateModifierSheet = () => {
    setIsCreateModifierSheetOpen(false)
  }

  // Submit handler for form
  function onSubmit(formValues: FormValues) {
    // Update basic details (name and description)
    if (form.formState.dirtyFields.groupName || form.formState.dirtyFields.description) {
      updateModifierGroupDetails.mutate({
        name: typeof formValues.groupName === 'string' ? formValues.groupName : '',
        description: typeof formValues.description === 'string' ? formValues.description : '',
      })
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
  }

  if (isLoading) {
    return <div className="p-4">Cargando...</div>
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <div className="text-red-500 mb-2">Error loading modifier group</div>
        <div className="text-sm text-muted-foreground mb-2">
          {isError ? 'Failed to fetch modifier group data' : 'No data returned from server'}
        </div>
        {error && (
          <div className="text-xs text-red-400 bg-red-50 p-2 rounded mb-4">{error instanceof Error ? error.message : 'Unknown error'}</div>
        )}
        <div className="mt-4">
          <Link to={from} className="text-blue-500 hover:underline">
            ← Back to Modifier Groups
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
            triggerTitle="Eliminar"
            title="Eliminar grupo modificador"
            message="¿Estás seguro de que deseas eliminar este grupo modificador? Esta acción no se puede deshacer."
            rightButtonLabel="Eliminar"
            rightButtonVariant="destructive"
            onRightButtonClick={() => deleteModifierGroupMutation.mutate()}
          />
          <Button
            disabled={!form.formState.isDirty || updateModifierGroupDetails.isPending || saveModifierGroup.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {updateModifierGroupDetails.isPending || saveModifierGroup.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Sheet for creating a new modifier */}
      <Sheet open={isCreateModifierSheetOpen} onOpenChange={setIsCreateModifierSheetOpen}>
        <SheetContent className="sm:max-w-md md:max-w-lg">
          <SheetHeader>
            <SheetTitle>Crear nuevo modificador</SheetTitle>
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

      {editingModifierId ? (
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
      ) : createModifier ? (
        <CreateModifier
          venueId={venueId || ''}
          modifierGroupId={modifierGroupId || ''}
          onBack={() => setCreateModifier(false)}
          onSuccess={() => {
            setCreateModifier(false)
            queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
          }}
        />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información del grupo</h3>
              <FormField
                control={form.control}
                name="groupName"
                defaultValue={typeof data.name === 'string' ? data.name : ''}
                rules={{
                  required: { value: true, message: 'El nombre es obligatorio' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Grupo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre del grupo"
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
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Descripción opcional"
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

            <FormField
              control={form.control}
              name="modifiers"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <div className="flex items-center gap-2">
                    <FormLabel>Asignar modificadores</FormLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="rounded-full border bg-muted w-5 h-5 inline-flex items-center justify-center text-xs font-semibold">
                          ?
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Para crear un modificador haz click en la barra y selecciona Agregar modificador</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <DnDMultipleSelector
                      showAddItemText={true}
                      itemName="modificador"
                      // showViewIcon={true}
                      onViewOption={option => {
                        if (option.value === '_new') {
                          // Handle "Add new modifier" click - show sheet instead of navigating
                          setIsCreateModifierSheetOpen(true)
                        } else {
                          // Handle view existing modifier click
                          navigate(`/venues/${venueId}/menumaker/modifier-groups/${option.value}`)
                        }
                      }}
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
                    <FormLabel>Asignar productos</FormLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="rounded-full bg-muted w-5 h-5 inline-flex items-center justify-center text-xs font-semibold border">
                          ?
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Para crear un producto haz click en la barra y selecciona Agregar producto</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <DnDMultipleSelector
                      showViewIcon={true}
                      showAddItemText={true}
                      itemName="producto"
                      onViewOption={option => {
                        if (option.value === '_new') {
                          // Handle "Add new product" click
                          navigate(`/venues/${venueId}/menumaker/products/create`)
                        } else {
                          // Handle view existing product click
                          navigate(`/venues/${venueId}/menumaker/products/${option.value}`)
                        }
                      }}
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
      )}
    </div>
  )
}
