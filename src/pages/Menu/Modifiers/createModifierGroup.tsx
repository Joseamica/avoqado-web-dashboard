import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import DOMPurify from 'dompurify'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { createModifierGroup as createModifierGroupService, getProducts, assignModifierGroupToProduct } from '@/services/menu.service'
import DnDMultipleSelector, { Option } from '@/components/draggable-multi-select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useQuery } from '@tanstack/react-query'

// Schema for the form validation with proper constraints
const createFormSchema = (t: any) =>
  z
    .object({
      name: z
        .string()
        .min(1, { message: t('modifiers.createGroup.nameRequired') })
        .max(100, { message: t('modifiers.createGroup.nameTooLong') }),
      required: z.boolean().default(false),
      min: z.number().int().min(0).default(0),
      max: z.number().int().min(1).default(1),
      multipleSelectionAmount: z.number().int().min(0).default(0),
      multiMax: z.number().int().min(1).default(1),
      newModifiers: z
        .array(
          z.object({
            name: z.string(),
            extraPrice: z.number().min(0).default(0),
          }),
        )
        .default([{ name: '', extraPrice: 0 }]),
      selectedProducts: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
            disable: z.boolean().optional(), // Note: Option interface uses 'disable' not 'disabled'
          })
        )
        .optional()
        .default([]),
    })
    .refine(data => data.min <= data.max, {
      message: t('modifiers.createGroup.errors.minMaxInvalid'),
      path: ['max'],
    })
    .refine(data => !data.required || data.min >= 1, {
      message: t('modifiers.createGroup.errors.requiredMinInvalid'),
      path: ['min'],
    })
    .refine(
      data => {
        // At least one modifier with a name must be present
        const hasValidModifier = data.newModifiers.some(m => m.name.trim() !== '')
        return hasValidModifier
      },
      {
        message: t('modifiers.createGroup.errors.noModifiers'),
        path: ['newModifiers'],
      },
    )
    .refine(
      data => {
        // Check for duplicate modifier names
        const names = data.newModifiers.filter(m => m.name.trim() !== '').map(m => m.name.trim().toLowerCase())
        return names.length === new Set(names).size
      },
      {
        message: t('modifiers.createGroup.errors.duplicateNames'),
        path: ['newModifiers'],
      },
    )

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

export default function CreateModifierGroup() {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  // Check permissions
  useEffect(() => {
    if (!can('menu:create')) {
      toast({
        title: tCommon('errors.unauthorized'),
        description: tCommon('errors.noPermission'),
        variant: 'destructive',
      })
      navigate('../', { replace: true })
    }
  }, [can, navigate, tCommon, toast])

  // Query to fetch all products for the venue
  const { data: allProducts } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId!, { orderBy: 'name' }),
    enabled: !!venueId,
  })

  // Initialize the form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema(t)),
    defaultValues: {
      name: '',
      required: false,
      min: 0,
      max: 1,
      multipleSelectionAmount: 0,
      multiMax: 1,
      newModifiers: [{ name: '', extraPrice: 0 }],
      selectedProducts: [],
    },
  })

  // Use useFieldArray for proper form state management
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'newModifiers',
  })

  // For creating the modifier group
  const createModifierGroupMutation = useMutation({
    mutationFn: async ({ groupData, productIds }: { groupData: Omit<FormValues, 'selectedProducts'>; productIds: string[] }) => {
      try {
        // Step 1: Create the modifier group (without selectedProducts)
        console.log('Creating modifier group with data:', groupData)
        const createdGroup = await createModifierGroupService(venueId!, groupData)
        console.log('Modifier group created:', createdGroup)

        // Step 2: Assign products to the group if any were selected
        if (productIds && productIds.length > 0) {
          console.log('Assigning products:', productIds)
          const assignmentResults = await Promise.all(
            productIds.map((productId, index) =>
              assignModifierGroupToProduct(venueId!, productId, {
                modifierGroupId: createdGroup.id,
                displayOrder: index,
              }).catch(err => {
                console.error(`Failed to assign product ${productId}:`, err)
                throw err
              })
            )
          )
          console.log('Products assigned successfully:', assignmentResults)
        }

        return createdGroup
      } catch (error) {
        console.error('Error in createModifierGroupMutation:', error)
        throw error
      }
    },
    onSuccess: (data) => {
      toast({
        title: t('modifiers.createGroup.toasts.created'),
        description: t('modifiers.createGroup.toasts.createdDesc'),
      })

      console.log('ModifierGroup created successfully:', data)
      console.log('VenueId:', venueId)
      console.log('Navigating to:', `/venues/${venueId}/menumaker/modifier-groups`)

      // Invalidate cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })

      // Use setTimeout to ensure navigation happens after state updates
      // Navigate using relative path
      setTimeout(() => {
        navigate('../', { replace: true })
      }, 100)
    },
    onError: (error: any) => {
      let errorMessage = t('modifiers.createGroup.toasts.createErrorDesc')

      // Handle specific error cases
      if (error.response?.status === 409) {
        errorMessage = t('modifiers.createGroup.errors.nameExists')
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || t('modifiers.createGroup.errors.invalidData')
      } else if (!navigator.onLine) {
        errorMessage = tCommon('errors.offlineDescription')
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      }

      toast({
        title: t('modifiers.createGroup.toasts.createError'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  // Watch for required field changes to update min value
  const watchRequired = form.watch('required')

  useEffect(() => {
    if (watchRequired) {
      const currentMin = form.getValues('min')
      if (currentMin < 1) {
        form.setValue('min', 1, { shouldValidate: true, shouldDirty: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchRequired])

  // Sanitize input to prevent XSS
  const sanitizeInput = (value: string): string => {
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] })
  }

  // Handle form submission
  function onSubmit(values: FormValues): void {
    // Filter out empty modifiers and sanitize names
    const validModifiers = values.newModifiers
      .filter(mod => mod.name.trim() !== '')
      .map(mod => ({
        name: sanitizeInput(mod.name.trim()),
        price: mod.extraPrice, // Backend expects 'price', not 'extraPrice'
        active: true, // Default to active
      }))

    // Separate selectedProducts from the rest of the data
    const { selectedProducts, ...restValues } = values

    // Extract product IDs from Option objects
    const productIds = (selectedProducts || []).map(p => p.value)

    // Map frontend field names to backend field names
    const groupData = {
      name: sanitizeInput(values.name.trim()),
      required: values.required,
      allowMultiple: values.max > 1, // Allow multiple if max > 1
      minSelections: values.min, // Backend expects 'minSelections'
      maxSelections: values.max, // Backend expects 'maxSelections'
      modifiers: validModifiers, // Backend expects 'modifiers', not 'newModifiers'
      active: true, // Default to active
      // Note: multipleSelectionAmount and multiMax don't exist in backend schema
      // They are stored in the form but not sent to the backend
    }

    // Submit the data with separated product IDs
    createModifierGroupMutation.mutate({
      groupData,
      productIds,
    })
  }

  // Add a new empty modifier to the list
  const addNewModifier = (): void => {
    append({ name: '', extraPrice: 0 })
  }

  // Memoize watchRequired to prevent unnecessary re-renders
  const minValue = useMemo(() => (watchRequired ? 1 : 0), [watchRequired])

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-row items-center space-x-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="../">
            <ChevronLeft className="w-4 h-4" />
            <span>{t('forms.buttons.goBack')}</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{t('modifiers.createGroup.title')}</h1>
      </div>

      {/* Show offline warning */}
      {!navigator.onLine && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{tCommon('errors.offline')}</AlertTitle>
          <AlertDescription>{tCommon('errors.offlineDescription')}</AlertDescription>
        </Alert>
      )}

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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.createGroup.groupName')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('modifiers.createGroup.namePlaceholder')}
                        maxLength={100}
                        {...field}
                        onChange={e => field.onChange(e.target.value)}
                      />
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
                          min={minValue}
                          value={field.value === 0 ? '' : field.value}
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
                  name="max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('modifiers.createGroup.maxSelections')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value === 1 ? '' : field.value}
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
                        value={field.value === 0 ? '' : field.value}
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
                        value={field.value === 1 ? '' : field.value}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('modifiers.createGroup.modifiers')}</CardTitle>
              <CardDescription>{t('modifiers.createGroup.modifiersDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Modifiers Form */}
              <div className="space-y-3 border p-4 rounded-md">
                <h3 className="text-sm font-medium">{t('modifiers.createGroup.newModifiers')}</h3>

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                      <Label htmlFor={`modifier-name-${index}`}>{t('forms.name')}</Label>
                      <Input
                        id={`modifier-name-${index}`}
                        placeholder={t('modifiers.createGroup.modifierNamePlaceholder')}
                        maxLength={100}
                        {...form.register(`newModifiers.${index}.name`)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`modifier-price-${index}`}>{t('modifiers.create.extraPrice')}</Label>
                      <Input
                        id={`modifier-price-${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        {...form.register(`newModifiers.${index}.extraPrice`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="flex gap-2">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => remove(index)}
                          aria-label={t('modifiers.createGroup.removeModifier', {
                            name: form.watch(`newModifiers.${index}.name`) || t('modifiers.createGroup.modifier', { index: index + 1 }),
                          })}
                        >
                          {t('modifiers.createGroup.remove')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <FormMessage>{form.formState.errors.newModifiers?.message}</FormMessage>

                <Button type="button" variant="outline" size="sm" onClick={addNewModifier} className="mt-2">
                  {t('modifiers.createGroup.addAnother')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('modifiers.createGroup.productAssignment')}</CardTitle>
              <CardDescription>{t('modifiers.createGroup.productAssignmentDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="selectedProducts"
                render={({ field }) => (
                  <FormItem>
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
                            navigate(`/venues/${venueId}/menumaker/products/create`)
                          } else {
                            navigate(`/venues/${venueId}/menumaker/products/${option.value}`)
                          }
                        }}
                        placeholder={t('modifiers.detail.selectProductsPlaceholder')}
                        options={
                          allProducts
                            ? allProducts.map(product => ({
                                label: product.name,
                                value: product.id,
                                disable: false, // Note: Option interface uses 'disable' not 'disabled'
                              }))
                            : []
                        }
                        value={(field.value || []) as Option[]}
                        onChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => navigate('../')}>
              {t('forms.buttons.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || createModifierGroupMutation.isPending || !form.formState.isDirty}
            >
              {form.formState.isSubmitting || createModifierGroupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('modifiers.createGroup.creating')}
                </>
              ) : (
                t('modifiers.createGroup.createButton')
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
