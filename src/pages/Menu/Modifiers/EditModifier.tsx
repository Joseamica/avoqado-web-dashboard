import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { updateModifier } from '@/services/menu.service'

// Define form values type
type FormValues = {
  name: string
  price: number
  active: boolean
}

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
      active: initialValues.active,
    },
  })

  // Initialize form with the provided initial values
  useEffect(() => {
    form.reset({
      name: initialValues.name,
      price: initialValues.price,
      active: initialValues.active,
    })
  }, [initialValues, form])

  // Mutation for updating the modifier
  const updateModifierMutation = useMutation<unknown, Error, FormValues>({
    mutationFn: async formValues => {
      const payload = {
        name: formValues.name,
        price: formValues.price,
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
    updateModifierMutation.mutate(values)
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
            <Button type="submit" disabled={updateModifierMutation.isPending || !form.formState.isDirty}>
              {updateModifierMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
