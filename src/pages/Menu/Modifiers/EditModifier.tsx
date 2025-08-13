import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { getModifier, updateModifier } from '@/services/menu.service'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

// Define form schema for validation
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().min(0, 'Price must be a positive number'),
  available: z.boolean().default(true),
  active: z.boolean().default(true),
})

type FormValues = z.infer<typeof formSchema>

// Props for the EditModifier component
interface EditModifierProps {
  venueId: string
  modifierId: string
  modifierGroupId: string
  onBack: () => void
  onSuccess: () => void
  initialValues: {
    name: string
    price: number
    available: boolean
    active: boolean
  }
}

export default function EditModifier({ venueId, modifierId, modifierGroupId, onBack, onSuccess, initialValues }: EditModifierProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Setup the form
  const form = useForm<FormValues>({
    defaultValues: {
      name: initialValues.name,
      price: initialValues.price,
      available: initialValues.available,
      active: initialValues.active,
    },
  })

  // Query to fetch modifier details if needed
  const { data: modifierDetails } = useQuery({
    queryKey: ['modifier', modifierId, venueId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/${modifierId}`)
      return response.data
    },
    enabled: !!modifierId && !initialValues.name, // Only fetch if we don't have initial values
  })

  // Update the form when we get modifier details (if needed)
  useEffect(() => {
    if (modifierDetails) {
      form.reset({
        name: modifierDetails.name,
        price: modifierDetails.price,
        available: modifierDetails.available,
        active: modifierDetails.active,
      })
    }
  }, [modifierDetails, form])

  // Mutation for updating the modifier
  const updateModifierMutation = useMutation<unknown, Error, FormValues>({
    mutationFn: async formValues => {
      const payload = {
        name: formValues.name,
        price: formValues.price,
        available: formValues.available,
        active: formValues.active,
      }
      return await updateModifier(venueId, modifierGroupId, modifierId, payload)
    },
    onSuccess: () => {
      toast({
        title: 'Modificador actualizado',
        description: 'El modificador se ha actualizado correctamente.',
      })

      // Invalidate and force refetch the relevant queries
      queryClient.invalidateQueries({
        queryKey: ['modifier-groups', venueId],
        refetchType: 'all',
      })

      queryClient.invalidateQueries({
        queryKey: ['modifier-group', modifierGroupId, venueId],
        refetchType: 'all',
      })

      queryClient.invalidateQueries({
        queryKey: ['modifiers', venueId],
        refetchType: 'all',
      })

      // Call the success callback
      onSuccess()
    },
    onError: error => {
      toast({
        title: 'Error',
        description: `Error al actualizar el modificador: ${error.message}`,
        variant: 'destructive',
      })
    },
  })

  // Submit handler
  function onSubmit(values: FormValues) {
    updateModifier.mutate(values)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Editar Modificador</h2>
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            rules={{ required: 'El nombre es obligatorio' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del modificador" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            rules={{ required: 'El precio es obligatorio' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={field.value}
                    onChange={e => {
                      const value = e.target.value
                      field.onChange(value === '' ? '' : parseFloat(value))
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="available"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Disponible</FormLabel>
                  <FormDescription>Indica si este modificador está disponible para ser añadido a productos.</FormDescription>
                </div>
                <FormControl>
                  <div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Activo</FormLabel>
                  <FormDescription>Activa o desactiva este modificador.</FormDescription>
                </div>
                <FormControl>
                  <div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateModifier.isPending || !form.formState.isDirty}>
              {updateModifier.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
