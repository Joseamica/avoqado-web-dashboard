import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { createMenuCategory, getMenus, getProducts } from '@/services/menu.service'
import { Loader2, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react'
import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { ExampleCard } from '@/components/example-card'
import { Card, CardContent } from '@/components/ui/card'
import TimePicker from '@/components/time-picker'
import { Link, useLocation } from 'react-router-dom'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CategoryWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (categoryId: string) => void
}

type WizardStep = 1 | 2 | 3

interface CategoryFormData {
  name: string
  avoqadoMenus: Array<{ label: string; value: string }>
  avoqadoProducts: Array<{ label: string; value: string }>
  availableFrom: string
  availableUntil: string
  availableDays: Array<{ label: string; value: string }>
  active: boolean
}

export function CategoryWizardDialog({ open, onOpenChange, onSuccess }: CategoryWizardDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const location = useLocation()

  const [currentStep, setCurrentStep] = useState<WizardStep>(1)

  const form = useForm<CategoryFormData>({
    defaultValues: {
      name: '',
      avoqadoMenus: [],
      avoqadoProducts: [],
      availableFrom: '',
      availableUntil: '',
      availableDays: [],
      active: true,
    },
  })

  // Queries for Assignments Step
  const { data: menus, isLoading: isMenusLoading } = useQuery({
    queryKey: ['menus', venueId],
    queryFn: () => getMenus(venueId!),
    enabled: open && currentStep === 3,
  })

  const { data: products, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId!, { orderBy: 'name' }),
    enabled: open && currentStep === 3,
  })

  // Create Mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      // Transform data for API
      const transformedData = {
        name: data.name,
        active: data.active,
        availableFrom: data.availableFrom || null,
        availableUntil: data.availableUntil || null,
        availableDays: data.availableDays.map(d => d.value),
        avoqadoMenus: data.avoqadoMenus.map(m => ({ value: m.value, label: m.label })),
        avoqadoProducts: data.avoqadoProducts.map(p => ({ value: p.value, label: p.label })),
      }

      // Time validation logic
      if (transformedData.availableFrom && transformedData.availableUntil) {
        const fromTime = transformedData.availableFrom.split(':').map(Number)
        const untilTime = transformedData.availableUntil.split(':').map(Number)
        const fromMinutes = fromTime[0] * 60 + fromTime[1]
        const untilMinutes = untilTime[0] * 60 + untilTime[1]

        if (fromMinutes >= untilMinutes) {
          throw new Error(t('forms.messages.invalidScheduleDesc'))
        }
      }

      return await createMenuCategory(venueId!, transformedData)
    },
    onSuccess: data => {
      toast({
        title: t('forms.messages.categoryCreated', { name: data.name }),
        description: t('forms.messages.categoryCreatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['categories', venueId] })
      if (onSuccess) onSuccess(data.id)
      handleClose()
    },
    onError: (error: any) => {
      toast({
        title: t('forms.messages.saveError'),
        description: error.message || t('forms.messages.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const handleNext = async () => {
    let isValid = false
    if (currentStep === 1) {
      isValid = await form.trigger('name')
    } else if (currentStep === 2) {
      // Manual validation for time range if needed, though form submit handles it finally
      isValid = true
    } else {
      isValid = true
    }

    if (isValid) {
      setCurrentStep(prev => (prev + 1) as WizardStep)
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => (prev - 1) as WizardStep)
  }

  const handleClose = () => {
    form.reset()
    setCurrentStep(1)
    onOpenChange(false)
  }

  const onSubmit = () => {
    createCategoryMutation.mutate(form.getValues())
  }

  const progressPercentage = (currentStep / 3) * 100

  // Time range validation check for UI feedback
  const watchFrom = form.watch('availableFrom')
  const watchUntil = form.watch('availableUntil')
  const isTimeRangeInvalid =
    watchFrom &&
    watchUntil &&
    (() => {
      const [h1, m1] = watchFrom.split(':').map(Number)
      const [h2, m2] = watchUntil.split(':').map(Number)
      return h1 * 60 + m1 >= h2 * 60 + m2
    })()

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <DialogTitle>{t('categories.newCategory')}</DialogTitle>
            <DialogDescription>{t('wizard.subtitle')}</DialogDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground hover:text-primary">
            <Link to="create" state={{ from: location.pathname }}>
              {t('products.create.useManual')} &rarr;
            </Link>
          </Button>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {currentStep === 1
                ? t('wizard.step1.basicInfo')
                : currentStep === 2
                ? t('categoryDetail.sections.availability')
                : t('categoryDetail.sections.assignments')}
            </span>
            <span>{t('wizard.progress', { current: currentStep, total: 3 })}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <Form {...form}>
          <form
            onSubmit={e => {
              e.preventDefault()
              if (currentStep === 3) onSubmit()
              else handleNext()
            }}
            className="py-4"
          >
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <Card className="border-border/60">
                  <CardContent className="space-y-4 pt-6">
                    <FormField
                      control={form.control}
                      name="name"
                      rules={{ required: t('forms.validation.nameRequired') }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('forms.name')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('forms.labels.enterName')} {...field} autoFocus />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('modifiers.createGroup.examples.previewTitle')}</p>
                      <p className="text-sm font-semibold">{form.watch('name') || t('categories.newCategory')}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('wizard.step1.nameDescription')}</p>
                  </div>
                </ExampleCard>
              </div>
            )}

            {/* Step 2: Availability */}
            {currentStep === 2 && (
              <div className="flex flex-col xl:grid xl:grid-cols-[1.35fr_1fr] gap-6">
                <Card className="border-border/60">
                  <CardContent className="space-y-4 pt-6">
                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={form.control}
                        name="availableFrom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('forms.availableFrom')}</FormLabel>
                            <FormControl>
                              <TimePicker value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="availableUntil"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('forms.availableUntil')}</FormLabel>
                            <FormControl>
                              <TimePicker value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {isTimeRangeInvalid && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{t('forms.messages.invalidScheduleDesc')}</AlertDescription>
                      </Alert>
                    )}

                    <FormField
                      control={form.control}
                      name="availableDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('categoryDetail.labels.availableDays')}</FormLabel>
                          <FormControl>
                            <MultiSelectCombobox
                              options={[
                                { label: t('forms.daysOfWeek.monday'), value: 'MON' },
                                { label: t('forms.daysOfWeek.tuesday'), value: 'TUE' },
                                { label: t('forms.daysOfWeek.wednesday'), value: 'WED' },
                                { label: t('forms.daysOfWeek.thursday'), value: 'THU' },
                                { label: t('forms.daysOfWeek.friday'), value: 'FRI' },
                                { label: t('forms.daysOfWeek.saturday'), value: 'SAT' },
                                { label: t('forms.daysOfWeek.sunday'), value: 'SUN' },
                              ]}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder={t('categoryDetail.placeholders.selectDays')}
                              emptyText={t('categoryDetail.placeholders.noMoreDays')}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">{form.watch('name') || t('categories.newCategory')}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{t('categoryDetail.sections.availability')}</p>
                      {form.watch('availableFrom') && form.watch('availableUntil') && (
                        <p className="text-xs text-muted-foreground">
                          {form.watch('availableFrom')} - {form.watch('availableUntil')}
                        </p>
                      )}
                      {form.watch('availableDays') && form.watch('availableDays').length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {form.watch('availableDays').map((day: any) => (
                            <span key={day.value} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {day.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ExampleCard>
              </div>
            )}

            {/* Step 3: Assignments */}
            {currentStep === 3 && (
              <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <Card className="border-border/60">
                  <CardContent className="space-y-4 pt-6">
                    <FormField
                      control={form.control}
                      name="avoqadoMenus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('forms.labels.menusForCategory')}</FormLabel>
                          <FormControl>
                            <MultiSelectCombobox
                              options={(menus ?? []).map(m => ({ label: m.name, value: m.id }))}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder={t('forms.labels.selectMenus')}
                              emptyText={t('forms.labels.noMoreMenus')}
                              isLoading={isMenusLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="avoqadoProducts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('forms.labels.addProductsToCategory')}</FormLabel>
                          <FormControl>
                            <MultiSelectCombobox
                              options={(products ?? []).map(p => ({ label: p.name, value: p.id }))}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder={t('forms.labels.selectProducts')}
                              emptyText={t('forms.labels.noMoreProducts')}
                              isLoading={isProductsLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">{form.watch('name') || t('categories.newCategory')}</p>
                    {form.watch('avoqadoMenus') && form.watch('avoqadoMenus').length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">{t('forms.labels.menusForCategory')}</p>
                        <div className="flex flex-wrap gap-1">
                          {form.watch('avoqadoMenus').map((menu: any) => (
                            <span key={menu.value} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {menu.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {form.watch('avoqadoProducts') && form.watch('avoqadoProducts').length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">{t('forms.labels.addProductsToCategory')}</p>
                        <div className="flex flex-wrap gap-1">
                          {form
                            .watch('avoqadoProducts')
                            .slice(0, 5)
                            .map((product: any) => (
                              <span key={product.value} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {product.label}
                              </span>
                            ))}
                          {form.watch('avoqadoProducts').length > 5 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              +{form.watch('avoqadoProducts').length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </ExampleCard>
              </div>
            )}
          </form>
        </Form>

        <DialogFooter className="flex justify-between">
          {currentStep > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack} disabled={createCategoryMutation.isPending}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              {tCommon('back')}
            </Button>
          ) : (
            <div /> /* Spacer */
          )}

          <Button
            type="button"
            onClick={currentStep === 3 ? onSubmit : handleNext}
            disabled={createCategoryMutation.isPending || (currentStep === 2 && !!isTimeRangeInvalid)}
          >
            {createCategoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentStep === 3 ? t('wizard.finish') : tCommon('next')}
            {currentStep === 3 ? <Check className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
