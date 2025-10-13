import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import api from '@/api'
import DnDMultipleSelector from '@/components/draggable-multi-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { createModifierGroup as createModifierGroupService } from '@/services/menu.service'

// Schema for the form validation - will be created inside component to access t()
const createFormSchema = (t: any) => z.object({
  name: z.string().min(1, { message: t('modifiers.createGroup.nameRequired') }),
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
  const { t } = useTranslation('menu')
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
    resolver: zodResolver(createFormSchema(t)),
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
        title: t('modifiers.createGroup.toasts.created'),
        description: t('modifiers.createGroup.toasts.createdDesc'),
      })
      navigate(`/venues/${venueId}/menumaker/modifier-groups`)
    },
    onError: error => {
      toast({
        title: t('modifiers.createGroup.toasts.createError'),
        description: error.message || t('modifiers.createGroup.toasts.createErrorDesc'),
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
            <span>{t('forms.buttons.goBack')}</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{t('modifiers.createGroup.title')}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('modifiers.createGroup.basicInfo')}</CardTitle>
              <CardDescription>{t('modifiers.createGroup.basicInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name field */}
              <FormField
                control={form.control}
                name="name"
                rules={{ required: { value: true, message: t('modifiers.createGroup.nameRequired') } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.createGroup.groupName')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('modifiers.createGroup.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('modifiers.createGroup.nameDescription')}</FormDescription>
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
                      <FormLabel>{t('modifiers.createGroup.requiredSelection')}</FormLabel>
                      <FormDescription>{t('modifiers.createGroup.requiredSelectionDesc')}</FormDescription>
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
              <CardTitle>{t('modifiers.createGroup.selectionRules')}</CardTitle>
              <CardDescription>{t('modifiers.createGroup.selectionRulesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Min and Max Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('modifiers.createGroup.minSelections')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={watchRequired ? 1 : 0}
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>{t('modifiers.createGroup.minSelectionsDesc')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('modifiers.createGroup.maxSelections')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                      </FormControl>
                      <FormDescription>{t('modifiers.createGroup.maxSelectionsDesc')}</FormDescription>
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
                    <FormLabel>{t('modifiers.createGroup.multipleSelection')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder={t('modifiers.createGroup.multipleSelectionPlaceholder')}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
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
                      <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                    </FormControl>
                    <FormDescription>{t('modifiers.createGroup.maxPerModifierDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('modifiers.createGroup.modifiers')}</CardTitle>
              <CardDescription>{t('modifiers.createGroup.modifiersDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Modifiers Selector */}
              {!loadingModifiers && existingModifiers && (
                <FormField
                  control={form.control}
                  name="modifiers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('modifiers.createGroup.selectExistingModifiers')}</FormLabel>
                      <FormControl>
                        <DnDMultipleSelector
                          {...field}
                          options={existingModifiers.map(modifier => ({
                            label: modifier.name,
                            value: modifier.id,
                            disabled: false,
                          }))}
                          hidePlaceholderWhenSelected
                          placeholder={t('modifiers.createGroup.selectExistingPlaceholder')}
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
                <Label htmlFor="new-modifiers">{t('modifiers.createGroup.addNewModifiers')}</Label>
              </div>

              {/* New Modifiers Form */}
              {showNewModifierForm && (
                <div className="space-y-3 mt-4 border p-4 rounded-md">
                  <h3 className="text-sm font-medium">{t('modifiers.createGroup.newModifiers')}</h3>

                  {newModifiersList.map((modifier, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="col-span-2">
                        <Label htmlFor={`modifier-name-${index}`}>{t('forms.name')}</Label>
                        <Input
                          id={`modifier-name-${index}`}
                          value={modifier.name}
                          onChange={e => handleModifierChange(index, 'name', e.target.value)}
                          placeholder={t('modifiers.createGroup.modifierNamePlaceholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`modifier-price-${index}`}>{t('modifiers.create.extraPrice')}</Label>
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
                          {t('modifiers.createGroup.remove')}
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" onClick={addNewModifier} className="mt-2">
                    {t('modifiers.createGroup.addAnother')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => navigate(`/venues/${venueId}/menumaker/modifier-groups`)}>
              {t('forms.buttons.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? t('modifiers.createGroup.creating') : t('modifiers.createGroup.createButton')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
