import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Info,
  ListChecks,
  Loader2,
  Package,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import DOMPurify from 'dompurify'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import DnDMultipleSelector, { Option } from '@/components/draggable-multi-select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { assignModifierGroupToProduct, createModifierGroup as createModifierGroupService, getProducts } from '@/services/menu.service'

type CreateModifierGroupWizardProps = {
  onCancel?: () => void
  onSuccess?: () => void
}

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
            disable: z.boolean().optional(),
          }),
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
        const names = data.newModifiers.filter(m => m.name.trim() !== '').map(m => m.name.trim().toLowerCase())
        return names.length === new Set(names).size
      },
      {
        message: t('modifiers.createGroup.errors.duplicateNames'),
        path: ['newModifiers'],
      },
    )

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

const TOTAL_STEPS = 5
type WizardStep = 1 | 2 | 3 | 4 | 5

export function CreateModifierGroupWizard({ onCancel, onSuccess }: CreateModifierGroupWizardProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)

  const canCreate = can('menu:create')

  useEffect(() => {
    if (!canCreate) {
      toast({
        title: tCommon('errors.unauthorized'),
        description: tCommon('errors.noPermission'),
        variant: 'destructive',
      })

      if (onCancel) {
        onCancel()
      } else {
        navigate('../', { replace: true })
      }
    }
  }, [canCreate, navigate, onCancel, tCommon, toast])

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
      newModifiers: [{ name: '', extraPrice: 0 }],
      selectedProducts: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'newModifiers',
  })

  const createModifierGroupMutation = useMutation({
    mutationFn: async ({ groupData, productIds }: { groupData: Record<string, unknown>; productIds: string[] }) => {
      const createdGroup = await createModifierGroupService(venueId!, groupData)

      if (productIds && productIds.length > 0) {
        await Promise.all(
          productIds.map((productId, index) =>
            assignModifierGroupToProduct(venueId!, productId, {
              modifierGroupId: createdGroup.id,
              displayOrder: index,
            }),
          ),
        )
      }

      return createdGroup
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.createGroup.toasts.created'),
        description: t('modifiers.createGroup.toasts.createdDesc'),
      })

      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })

      if (onSuccess) {
        onSuccess()
        return
      }

      setTimeout(() => {
        navigate('../', { replace: true })
      }, 100)
    },
    onError: (error: any) => {
      let errorMessage = t('modifiers.createGroup.toasts.createErrorDesc')

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

  const sanitizeInput = (value: string): string => {
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] })
  }

  function onSubmit(values: FormValues): void {
    const validModifiers = values.newModifiers
      .filter(mod => mod.name.trim() !== '')
      .map(mod => ({
        name: sanitizeInput(mod.name.trim()),
        price: mod.extraPrice,
        active: true,
      }))

    const { selectedProducts } = values
    const productIds = (selectedProducts || []).map(p => p.value)

    const groupData = {
      name: sanitizeInput(values.name.trim()),
      required: values.required,
      allowMultiple: values.max > 1,
      minSelections: values.min,
      maxSelections: values.max,
      modifiers: validModifiers,
      active: true,
    }

    createModifierGroupMutation.mutate({
      groupData,
      productIds,
    })
  }

  const addNewModifier = (): void => {
    append({ name: '', extraPrice: 0 })
  }

  const minValue = useMemo(() => (watchRequired ? 1 : 0), [watchRequired])
  const watchedName = form.watch('name')
  const watchedMin = form.watch('min')
  const watchedMax = form.watch('max')
  const watchedModifiers = form.watch('newModifiers')
  const watchedProducts = form.watch('selectedProducts')

  const previewName = watchedName?.trim() || t('modifiers.createGroup.examples.sampleName')
  const requiredLabel = watchRequired
    ? t('modifiers.createGroup.reviewRequiredYes')
    : t('modifiers.createGroup.reviewRequiredNo')

  const selectionMin = typeof watchedMin === 'number' && Number.isFinite(watchedMin) ? watchedMin : 0
  const selectionMax = typeof watchedMax === 'number' && Number.isFinite(watchedMax) ? watchedMax : 0

  const selectionSummary = useMemo(() => {
    if (watchRequired) {
      if (selectionMin === selectionMax) {
        return t('modifiers.createGroup.examples.selectionExact', { count: selectionMin })
      }
      return t('modifiers.createGroup.examples.selectionRange', { min: selectionMin, max: selectionMax })
    }
    return t('modifiers.createGroup.examples.selectionUpTo', { count: selectionMax })
  }, [t, watchRequired, selectionMin, selectionMax])

  const previewModifiers = useMemo(() => {
    const custom = (watchedModifiers || [])
      .filter(mod => mod.name.trim() !== '')
      .map(mod => ({ name: mod.name.trim(), extraPrice: mod.extraPrice }))

    if (custom.length > 0) {
      return custom
    }

    return [
      { name: t('modifiers.createGroup.examples.modifierSample1'), extraPrice: 10 },
      { name: t('modifiers.createGroup.examples.modifierSample2'), extraPrice: 15 },
      { name: t('modifiers.createGroup.examples.modifierSample3'), extraPrice: 5 },
    ]
  }, [t, watchedModifiers])

  const previewProducts = useMemo(() => {
    const custom = (watchedProducts || []).map(product => product.label).filter(Boolean)
    if (custom.length > 0) {
      return custom
    }

    return [
      t('modifiers.createGroup.examples.productSample1'),
      t('modifiers.createGroup.examples.productSample2'),
      t('modifiers.createGroup.examples.productSample3'),
    ]
  }, [t, watchedProducts])

  const formatExtraPrice = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return t('modifiers.createGroup.examples.freeLabel')
    }
    return `+${value.toFixed(2)}`
  }

  const steps = useMemo(
    () => [
      {
        title: t('modifiers.createGroup.basicInfo'),
        description: t('modifiers.createGroup.basicInfoDesc'),
        icon: Info,
      },
      {
        title: t('modifiers.createGroup.selectionRules'),
        description: t('modifiers.createGroup.selectionRulesDesc'),
        icon: SlidersHorizontal,
      },
      {
        title: t('modifiers.createGroup.modifiers'),
        description: t('modifiers.createGroup.modifiersDesc'),
        icon: ListChecks,
      },
      {
        title: t('modifiers.createGroup.productAssignment'),
        description: t('modifiers.createGroup.productAssignmentDesc'),
        icon: Package,
      },
      {
        title: t('modifiers.createGroup.reviewTitle'),
        description: t('modifiers.createGroup.reviewDesc'),
        icon: CheckCircle2,
      },
    ],
    [t],
  )

  const currentStepMeta = steps[currentStep - 1]
  const progressPercentage = (currentStep / TOTAL_STEPS) * 100
  const isLoading = form.formState.isSubmitting || createModifierGroupMutation.isPending

  const InfoTooltip = ({ content }: { content: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={content} className="text-muted-foreground/70 hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs leading-relaxed">{content}</TooltipContent>
    </Tooltip>
  )

  const ExampleCard = ({ title, icon: Icon = Sparkles, children }: { title: string; icon?: LucideIcon; children: ReactNode }) => (
    <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </div>
      {children}
    </div>
  )

  const handleNext = async () => {
    let isValid = true

    if (currentStep === 1) {
      isValid = await form.trigger(['name', 'required'])
    } else if (currentStep === 2) {
      isValid = await form.trigger(['min', 'max'])
    } else if (currentStep === 3) {
      isValid = await form.trigger(['newModifiers'])
    }

    if (!isValid) {
      return
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => (prev + 1) as WizardStep)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => (prev - 1) as WizardStep)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      navigate('../')
    }
  }

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  const handleCreate = () => {
    form.handleSubmit(onSubmit)()
  }

  if (!canCreate) {
    return null
  }

  return (
    <div className="space-y-4">
      {!navigator.onLine && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{tCommon('errors.offline')}</AlertTitle>
          <AlertDescription>{tCommon('errors.offlineDescription')}</AlertDescription>
        </Alert>
      )}

      <TooltipProvider delayDuration={0}>
        <Form {...form}>
          <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{currentStepMeta?.title}</span>
                <span>
                  {tCommon('step')} {currentStep} {tCommon('of')} {TOTAL_STEPS}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted/40">
                  {currentStepMeta?.icon ? <currentStepMeta.icon className="h-5 w-5 text-muted-foreground" /> : null}
                </div>
                <h2 className="text-xl font-semibold">{currentStepMeta?.title}</h2>
                <p className="text-sm text-muted-foreground">{currentStepMeta?.description}</p>
              </div>

              {currentStep === 1 && (
                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                  <Card className="border-border/60">
                    <CardContent className="space-y-4 pt-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center gap-2">
                              <FormLabel>{t('modifiers.createGroup.groupName')}</FormLabel>
                              <InfoTooltip content={t('modifiers.createGroup.nameDescription')} />
                            </div>
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

                      <FormField
                        control={form.control}
                        name="required"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <FormLabel>{t('modifiers.createGroup.requiredSelection')}</FormLabel>
                                <InfoTooltip content={t('modifiers.createGroup.requiredSelectionDesc')} />
                              </div>
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

                  <ExampleCard title={t('modifiers.createGroup.examples.title')}>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t('modifiers.createGroup.examples.previewTitle')}</p>
                        <p className="text-sm font-semibold">{previewName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('modifiers.createGroup.examples.basicExample')}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{requiredLabel}</span>
                      </div>
                    </div>
                  </ExampleCard>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                  <Card className="border-border/60">
                    <CardContent className="space-y-4 pt-6">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="min"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-2">
                                <FormLabel>{t('modifiers.createGroup.minSelections')}</FormLabel>
                                <InfoTooltip content={t('modifiers.createGroup.minSelectionsDesc')} />
                              </div>
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
                              <div className="flex items-center gap-2">
                                <FormLabel>{t('modifiers.createGroup.maxSelections')}</FormLabel>
                                <InfoTooltip content={t('modifiers.createGroup.maxSelectionsDesc')} />
                              </div>
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
                    </CardContent>
                  </Card>

                  <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">{previewName}</p>
                      <p className="text-xs text-muted-foreground">{selectionSummary}</p>
                    </div>
                  </ExampleCard>
                </div>
              )}

              {currentStep === 3 && (
                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                  <Card className="border-border/60">
                    <CardContent className="space-y-4 pt-6">
                      <div className="space-y-3 border rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium">{t('modifiers.createGroup.newModifiers')}</h3>
                          <InfoTooltip content={t('modifiers.createGroup.modifiersDesc')} />
                        </div>

                        {fields.map((field, index) => (
                          <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div className="md:col-span-2 space-y-2">
                              <Label htmlFor={`modifier-name-${index}`}>{t('forms.name')}</Label>
                              <Input
                                id={`modifier-name-${index}`}
                                placeholder={t('modifiers.createGroup.modifierNamePlaceholder')}
                                maxLength={100}
                                {...form.register(`newModifiers.${index}.name`)}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`modifier-price-${index}`}>{t('modifiers.create.extraPrice')}</Label>
                                <InfoTooltip content={t('modifiers.create.extraPriceDescription')} />
                              </div>
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

                        {form.formState.errors.newModifiers?.message ? (
                          <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.newModifiers?.message}</p>
                        ) : null}

                        <Button type="button" variant="outline" size="sm" onClick={addNewModifier} className="mt-2">
                          {t('modifiers.createGroup.addAnother')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{previewName}</p>
                        <p className="text-xs text-muted-foreground">{selectionSummary}</p>
                      </div>
                      <div className="space-y-2">
                        {previewModifiers.map((mod, index) => (
                          <div key={`${mod.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                            <span className="font-medium">{mod.name}</span>
                            <span className="text-muted-foreground">{formatExtraPrice(mod.extraPrice)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ExampleCard>
                </div>
              )}

              {currentStep === 4 && (
                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                  <Card className="border-border/60">
                    <CardContent className="space-y-4 pt-6">
                      <FormField
                        control={form.control}
                        name="selectedProducts"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center gap-2">
                              <FormLabel>{t('modifiers.detail.assignProducts')}</FormLabel>
                              <InfoTooltip content={t('modifiers.detail.productTooltip')} />
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
                                        disable: false,
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

                  <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                    <div className="space-y-3">
                      {(watchedProducts || []).length === 0 && (
                        <p className="text-xs text-muted-foreground">{t('modifiers.createGroup.examples.productsFallback')}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {previewProducts.map(product => (
                          <span key={product} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                            {product}
                          </span>
                        ))}
                      </div>
                    </div>
                  </ExampleCard>
                </div>
              )}

              {currentStep === 5 && (() => {
                const reviewValues = form.getValues()
                const reviewModifiers = reviewValues.newModifiers.filter(mod => mod.name.trim() !== '')
                const reviewProducts = reviewValues.selectedProducts ?? []
                const previewProductLabels = reviewProducts.length > 0 ? reviewProducts.map(product => product.label) : previewProducts
                const reviewPreviewModifiers = reviewModifiers.length > 0 ? reviewModifiers : previewModifiers

                return (
                  <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                    <Card className="border-border/60">
                      <CardContent className="space-y-6 pt-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{t('forms.name')}</p>
                            <p className="font-medium">{reviewValues.name || tCommon('na')}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.requiredSelection')}</p>
                            <p className="font-medium">
                              {reviewValues.required
                                ? t('modifiers.createGroup.reviewRequiredYes')
                                : t('modifiers.createGroup.reviewRequiredNo')}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.minSelections')}</p>
                            <p className="font-medium">{reviewValues.min}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.maxSelections')}</p>
                            <p className="font-medium">{reviewValues.max}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.modifiers')}</p>
                          {reviewModifiers.map((mod, index) => (
                            <div key={`${mod.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                              <span className="text-sm font-medium">{mod.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {Number.isFinite(mod.extraPrice) ? mod.extraPrice.toFixed(2) : '0.00'}
                              </span>
                            </div>
                          ))}
                          {reviewModifiers.length === 0 && (
                            <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.reviewNoModifiers')}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.productAssignment')}</p>
                          {reviewProducts.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {reviewProducts.map(product => (
                                <span key={product.value} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                                  {product.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.reviewNoProducts')}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')} icon={CheckCircle2}>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{reviewValues.name || previewName}</p>
                          <p className="text-xs text-muted-foreground">{selectionSummary}</p>
                        </div>
                        <div className="space-y-2">
                          {reviewPreviewModifiers.map((mod, index) => (
                            <div key={`${mod.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                              <span className="font-medium">{mod.name}</span>
                              <span className="text-muted-foreground">{formatExtraPrice(mod.extraPrice)}</span>
                            </div>
                          ))}
                        </div>
                        {previewProductLabels.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {previewProductLabels.map(product => (
                              <span key={product} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                                {product}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </ExampleCard>
                  </div>
                )
              })()}
            </div>


            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 1 || isLoading}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                {tCommon('back')}
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={currentStep < TOTAL_STEPS ? handleNext : handleCreate}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {currentStep < TOTAL_STEPS ? (
                    <>
                      {tCommon('next')}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      {t('modifiers.createGroup.createButton')}
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </TooltipProvider>
    </div>
  )
}
