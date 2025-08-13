import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createModifier as createModifierService } from '@/services/menu.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

// Schema for the form validation
// Define form values type
type FormValues = {
  name: string
  extraPrice: number
  available: boolean
  active: boolean
}

const formSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio' }),
  extraPrice: z.number().min(0).default(0),
  available: z.boolean().default(true),
  active: z.boolean().default(true),
})

interface CreateModifierProps {
  venueId: string
  modifierGroupId: string
  onBack: () => void
  onSuccess: () => void
}

export default function CreateModifier({ venueId, modifierGroupId, onBack, onSuccess }: CreateModifierProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Initialize the form with default values
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      extraPrice: 0,
      available: true,
      active: true,
    },
  })

  // For creating the modifier
  const createModifierMutation = useMutation<unknown, Error, FormValues>({
    mutationFn: async formValues => {
      // Create the modifier with the modifierGroupId included
      const payload = {
        name: formValues.name,
        extraPrice: formValues.extraPrice,
        available: formValues.available,
        active: formValues.active,
      }
      return await createModifierService(venueId, modifierGroupId, payload)
    },
    onSuccess: _data => {
      toast({
        title: 'Modificador creado',
        description: 'El modificador se ha creado correctamente y añadido al grupo.',
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

      // Call the success callback (without arguments as defined in the interface)
      onSuccess()
    },
    onError: error => {
      toast({
        title: 'Error al crear',
        description: error.message || 'Hubo un problema al crear el modificador.',
        variant: 'destructive',
      })
    },
  })

  // Handle form submission
  function onSubmit(values: FormValues) {
    createModifierMutation.mutate(values)
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del modificador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name field */}
              <FormField
                control={form.control}
                name="name"
                rules={{ required: { value: true, message: 'El nombre es obligatorio' } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <div>
                        <Input placeholder="Ej: Sin sal, Con queso extra..." {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>Nombre que identifica este modificador</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price field */}
              <FormField
                control={form.control}
                name="extraPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio extra</FormLabel>
                    <FormControl>
                      <div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value}
                          onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>Costo adicional por este modificador (0 si no tiene costo extra)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Available field */}
              <FormField
                control={form.control}
                name="available"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Disponible</FormLabel>
                      <FormDescription>Indica si este modificador está disponible para selección</FormDescription>
                    </div>
                    <FormControl>
                      <div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Active field */}
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>Indica si este modificador está activo en el sistema</FormDescription>
                    </div>
                    <FormControl>
                      <div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onBack}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? 'Creando...' : 'Crear Modificador'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
