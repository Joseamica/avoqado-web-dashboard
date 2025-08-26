import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ChevronLeft } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import api from '@/api'
import { createModifierGroup as createModifierGroupService } from '@/services/menu.service'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import DnDMultipleSelector from '@/components/draggable-multi-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// Schema for the form validation
const formSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio' }),
  required: z.boolean().default(false),
  min: z.number().int().min(0).default(0),
  max: z.number().int().min(1).default(1),
  multipleSelectionAmount: z.number().int().min(0).default(0),
  multiMax: z.number().int().min(1).default(1),
  modifiers: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        disabled: z.boolean().optional(),
        extraPrice: z.number().optional(),
      }),
    )
    .optional(),
  newModifiers: z
    .array(
      z.object({
        name: z.string(),
        extraPrice: z.number().optional(),
      }),
    )
    .optional(),
})

export default function CreateModifierGroup() {
  const { venueId } = useCurrentVenue()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [showNewModifierForm, setShowNewModifierForm] = useState(false)
  const [newModifiersList, setNewModifiersList] = useState([{ name: '', extraPrice: 0 }])

  // Query existing modifiers to select from
  const { data: existingModifiers, isLoading: loadingModifiers } = useQuery({
    queryKey: ['modifiers', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/modifiers`)
      return response.data
    },
  })

  // Initialize the form with default values
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      required: false,
      min: 0,
      max: 1,
      multipleSelectionAmount: 0,
      multiMax: 1,
      modifiers: [],
      newModifiers: [{ name: '', extraPrice: 0 }],
    },
  })

  // For creating the modifier group
  const createModifierGroupMutation = useMutation({
    mutationFn: async formValues => {
      return await createModifierGroupService(venueId!, formValues)
    },
    onSuccess: () => {
      toast({
        title: 'Grupo modificador creado',
        description: 'El grupo modificador se ha creado correctamente.',
      })
      navigate(`/venues/${venueId}/menumaker/modifier-groups`)
    },
    onError: error => {
      toast({
        title: 'Error al crear',
        description: error.message || 'Hubo un problema al crear el grupo modificador.',
        variant: 'destructive',
      })
    },
  })

  // Add a new empty modifier to the list
  const addNewModifier = () => {
    setNewModifiersList([...newModifiersList, { name: '', extraPrice: 0 }])
  }

  // Remove a modifier from the list
  const removeNewModifier = index => {
    const updatedList = [...newModifiersList]
    updatedList.splice(index, 1)
    setNewModifiersList(updatedList)
  }

  // Handle input changes for new modifiers
  const handleModifierChange = (index, field, value) => {
    const updatedList = [...newModifiersList]
    updatedList[index][field] = value
    setNewModifiersList(updatedList)
  }

  // Watch for required field changes to update min value
  const watchRequired = form.watch('required')

  useEffect(() => {
    if (watchRequired) {
      // If required is true, set min to at least 1
      const currentMin = form.getValues('min')
      if (currentMin < 1) {
        form.setValue('min', 1)
      }
    }
  }, [watchRequired, form])

  // Handle form submission
  function onSubmit(values) {
    // Process the form data
    const formData = { ...values }

    // If we have new modifiers, add them to the payload
    if (showNewModifierForm && newModifiersList.length > 0) {
      // Filter out empty entries
      const validNewModifiers = newModifiersList.filter(mod => mod.name.trim() !== '')
      formData.newModifiers = validNewModifiers
    }

    // Submit the data
    createModifierGroupMutation.mutate(formData)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-row items-center space-x-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/venues/${venueId}/menumaker/modifier-groups`}>
            <ChevronLeft className="w-4 h-4" />
            <span>Volver</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Crear Grupo Modificador</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
              <CardDescription>Configura la información principal del grupo modificador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name field */}
              <FormField
                control={form.control}
                name="name"
                rules={{ required: { value: true, message: 'El nombre es obligatorio' } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del grupo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Tipo de pan, Ingredientes extra..." {...field} />
                    </FormControl>
                    <FormDescription>Nombre que identifica este grupo de modificadores</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Required field */}
              <FormField
                control={form.control}
                name="required"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Selección obligatoria</FormLabel>
                      <FormDescription>El cliente debe seleccionar al menos un modificador</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reglas de Selección</CardTitle>
              <CardDescription>Define cómo los clientes pueden seleccionar los modificadores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Min and Max Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mínimo de selecciones</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={watchRequired ? 1 : 0}
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Cantidad mínima que el cliente debe seleccionar</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máximo de selecciones</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                      </FormControl>
                      <FormDescription>Cantidad máxima que el cliente puede seleccionar</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Multiple Selection Fields */}
              <FormField
                control={form.control}
                name="multipleSelectionAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selección múltiple</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0 significa sin límite"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>0 significa un modificador, cualquier otro número permite selección múltiple</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="multiMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo por modificador</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                    </FormControl>
                    <FormDescription>Cantidad máxima de veces que se puede seleccionar un mismo modificador</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modificadores</CardTitle>
              <CardDescription>Selecciona los modificadores para este grupo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Modifiers Selector */}
              {!loadingModifiers && existingModifiers && (
                <FormField
                  control={form.control}
                  name="modifiers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seleccionar modificadores existentes</FormLabel>
                      <FormControl>
                        <DnDMultipleSelector
                          {...field}
                          options={existingModifiers.map(modifier => ({
                            label: modifier.name,
                            value: modifier.id,
                            disabled: false,
                          }))}
                          hidePlaceholderWhenSelected
                          placeholder="Selecciona modificadores existentes..."
                          enableReordering={true}
                          creatable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Add New Modifiers Toggle */}
              <div className="flex items-center space-x-2">
                <Switch id="new-modifiers" checked={showNewModifierForm} onCheckedChange={setShowNewModifierForm} />
                <Label htmlFor="new-modifiers">Agregar nuevos modificadores</Label>
              </div>

              {/* New Modifiers Form */}
              {showNewModifierForm && (
                <div className="space-y-3 mt-4 border p-4 rounded-md">
                  <h3 className="text-sm font-medium">Nuevos Modificadores</h3>

                  {newModifiersList.map((modifier, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="col-span-2">
                        <Label htmlFor={`modifier-name-${index}`}>Nombre</Label>
                        <Input
                          id={`modifier-name-${index}`}
                          value={modifier.name}
                          onChange={e => handleModifierChange(index, 'name', e.target.value)}
                          placeholder="Nombre del modificador"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`modifier-price-${index}`}>Precio extra</Label>
                        <Input
                          id={`modifier-price-${index}`}
                          type="number"
                          value={modifier.extraPrice}
                          onChange={e => handleModifierChange(index, 'extraPrice', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {index > 0 && (
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeNewModifier(index)} className="mt-1">
                          Eliminar
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" onClick={addNewModifier} className="mt-2">
                    Agregar otro modificador
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => navigate(`/venues/${venueId}/menumaker/modifier-groups`)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? 'Creando...' : 'Crear Grupo Modificador'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
