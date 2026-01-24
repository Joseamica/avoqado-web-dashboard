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
import { createMenu, getMenuCategories } from '@/services/menu.service'
import { MenuType } from '@/types'

import { Loader2, ChevronRight, ChevronLeft, Check, CalendarClock, List, AlertCircle } from 'lucide-react'
import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ExampleCard } from '@/components/example-card'
import { Card as CardShadcn, CardContent as CardContentShadcn } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface MenuWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (menuId: string) => void
}

type WizardStep = 1 | 2 | 3

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

interface MenuFormData {
  name: string
  active: boolean
  isAllDay: boolean
  startTime: string
  endTime: string
  days: {
    label: string
    selected: boolean
    value: DayOfWeek
  }[]
  selectedCategories: Array<{ label: string; value: string }>
  type: MenuType
}

const DAY_ORDER: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export function MenuWizardDialog({ open, onOpenChange, onSuccess }: MenuWizardDialogProps) {
  const { t, i18n } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState<WizardStep>(1)

  const getInitialDays = (): { label: string; selected: boolean; value: DayOfWeek }[] => {
    const dayTranslationKeys: Record<string, string> = {
      MONDAY: 'createMenu.days.mon',
      TUESDAY: 'createMenu.days.tue',
      WEDNESDAY: 'createMenu.days.wed',
      THURSDAY: 'createMenu.days.thu',
      FRIDAY: 'createMenu.days.fri',
      SATURDAY: 'createMenu.days.sat',
      SUNDAY: 'createMenu.days.sun',
    }
    return DAY_ORDER.map(day => ({
      label: t(dayTranslationKeys[day]),
      selected: false,
      value: day,
    }))
  }

  const form = useForm<MenuFormData>({
    defaultValues: {
      name: '',
      active: true,
      isAllDay: false,
      startTime: '09:00',
      endTime: '19:30',
      days: getInitialDays(),
      selectedCategories: [],
      type: MenuType.REGULAR,
    },
  })

  // Queries for Assignments Step
  const { data: categories, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: open && currentStep === 3,
  })

  // Create Mutation
  const createMenuMutation = useMutation({
    mutationFn: async (data: MenuFormData) => {
      // Transform data for API
      const selectedDays = data.days.filter(d => d.selected)
      const menuDays = selectedDays.map(day => ({
        day: day.value,
        isFixed: data.isAllDay,
        startTime: data.isAllDay ? null : data.startTime,
        endTime: data.isAllDay ? null : data.endTime,
      }))

      const payload = {
        name: data.name,
        active: data.active,
        type: data.type,
        categoryIds: data.selectedCategories.map(c => c.value),
        avoqadoProducts: [], // Not supporting direct product assignment in Menu Wizard for now, consistent with createMenu.tsx
        menuDays: menuDays,
      }

      return await createMenu(venueId!, payload)
    },
    onSuccess: data => {
      toast({
        title: t('createMenu.toast.menuCreated', { name: data.name }),
        description: t('createMenu.toast.menuCreatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['menus', venueId] })
      if (onSuccess) onSuccess(data.id)
      handleClose()
    },
    onError: (error: any) => {
      toast({
        title: t('createMenu.toast.errorSaving'),
        description: error.message || t('createMenu.toast.errorSavingDesc'),
        variant: 'destructive',
      })
    },
  })

  const handleNext = async () => {
    let isValid = false
    if (currentStep === 1) {
      isValid = await form.trigger('name')
    } else if (currentStep === 2) {
      const isDaysValid = form.getValues('days').some(d => d.selected)
      if (!isDaysValid) {
        form.setError('days', { type: 'manual', message: t('createMenu.validation.dayRequired') })
      } else {
        form.clearErrors('days')
      }

      const isTimeValid =
        form.getValues('isAllDay') ||
        (() => {
          const start = parseTimeToMinutes(form.getValues('startTime'))
          const end = parseTimeToMinutes(form.getValues('endTime'))
          return end - start >= 60
        })()

      if (!form.getValues('isAllDay') && !isTimeValid) {
        form.setError('startTime', { type: 'manual', message: t('createMenu.validation.minInterval') })
      } else {
        form.clearErrors('startTime')
      }

      isValid = isDaysValid && (form.getValues('isAllDay') || !!isTimeValid)
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
    form.reset({
      name: '',
      active: true,
      isAllDay: false,
      startTime: '09:00',
      endTime: '19:30',
      days: getInitialDays(),
      selectedCategories: [],
      type: MenuType.REGULAR,
    })
    setCurrentStep(1)
    onOpenChange(false)
  }

  const onSubmit = () => {
    createMenuMutation.mutate(form.getValues())
  }

  const progressPercentage = (currentStep / 3) * 100

  // Helpers
  function getHourOptions() {
    const options: string[] = []
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hour = h.toString().padStart(2, '0')
        const minute = m.toString().padStart(2, '0')
        options.push(`${hour}:${minute}`)
      }
    }
    return options
  }

  function formatTime(time24: string) {
    const [hours, minutes] = time24.split(':').map(Number)
    const tempDate = new Date()
    tempDate.setHours(hours, minutes, 0, 0)
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(tempDate)
  }

  function parseTimeToMinutes(time: string) {
    const [h, m] = time.split(':')
    return parseInt(h, 10) * 60 + parseInt(m, 10)
  }

  const hourOptions = getHourOptions()
  const isAllDay = form.watch('isAllDay')

  // Time validation check for step 2 button state
  const watchStart = form.watch('startTime')
  const watchEnd = form.watch('endTime')
  const isTimeInvalid = !isAllDay && parseTimeToMinutes(watchEnd) - parseTimeToMinutes(watchStart) < 60
  const isDaysInvalid = !form.watch('days').some(d => d.selected)

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createMenu.title')}</DialogTitle>
          <DialogDescription>{t('wizard.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {currentStep === 1
                ? t('wizard.step1.basicInfo')
                : currentStep === 2
                  ? t('categoryDetail.sections.availability')
                  : t('createMenu.fields.categories')}
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
              <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
                <CardShadcn className="border-border/60">
                  <CardContentShadcn className="space-y-4 pt-6">
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <List className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{t('wizard.step1.name')}</h3>
                        <p className="text-xs text-muted-foreground">{t('wizard.step1.nameDescription')}</p>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="name"
                      rules={{ required: t('createMenu.validation.nameRequired') }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('createMenu.fields.menuName')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('createMenu.fields.menuNamePlaceholder')}
                              className="border-transparent"
                              {...field}
                              autoFocus
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('menuId.fields.menuType')}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="border-transparent">
                                <SelectValue placeholder={t('menuId.fields.selectType')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="REGULAR">{t('menuId.types.regular')}</SelectItem>
                              <SelectItem value="BREAKFAST">{t('menuId.types.breakfast')}</SelectItem>
                              <SelectItem value="LUNCH">{t('menuId.types.lunch')}</SelectItem>
                              <SelectItem value="DINNER">{t('menuId.types.dinner')}</SelectItem>
                              <SelectItem value="SEASONAL">{t('menuId.types.seasonal')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">{t('createMenu.fields.menuActive')}</FormLabel>
                            <DialogDescription>{t('createMenu.fields.menuActiveDesc')}</DialogDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContentShadcn>
                </CardShadcn>

                <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">{form.watch('name') || t('createMenu.title')}</p>
                    <p className="text-xs text-muted-foreground">
                      {form.watch('active') ? t('forms.labels.active') : t('forms.labels.inactive')}
                    </p>
                  </div>
                </ExampleCard>
              </div>
            )}

            {/* Step 2: Availability */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
                <CardShadcn className="!bg-transparent border-border shadow-none">
                  <CardContentShadcn className="space-y-6 pt-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <CalendarClock className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{t('categoryDetail.sections.availability')}</h3>
                        <p className="text-xs text-muted-foreground">{t('createMenu.fields.availableDays')}</p>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('createMenu.fields.availableDays')}</FormLabel>
                          <div className="flex w-full mb-2 gap-2 flex-wrap">
                            {field.value.map((day, index) => (
                              <button
                                type="button"
                                key={day.value}
                                onClick={() => {
                                  const newDays = [...field.value]
                                  newDays[index].selected = !newDays[index].selected
                                  field.onChange(newDays)
                                }}
                                className={
                                  'px-3.5 py-1.5 cursor-pointer transition-colors rounded-full text-[13px] leading-none ' +
                                  (day.selected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/30 text-foreground hover:bg-muted/40')
                                }
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isAllDay"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={checked => {
                                field.onChange(checked)
                                if (checked) {
                                  const updatedDays = form.getValues('days').map(day => ({ ...day, selected: true }))
                                  form.setValue('days', updatedDays, { shouldDirty: true, shouldValidate: true })
                                  form.clearErrors('days')
                                  form.clearErrors(['startTime', 'endTime'])
                                } else {
                                  const updatedDays = form.getValues('days').map(day => ({ ...day, selected: false }))
                                  form.setValue('days', updatedDays, { shouldDirty: true, shouldValidate: true })
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>{t('createMenu.fields.allDay')}</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('createMenu.fields.startTime')}</FormLabel>
                            <FormControl>
                              <Select disabled={isAllDay} onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-transparent">
                                    <SelectValue placeholder={t('createMenu.fields.selectTime')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel>{t('createMenu.fields.selectTime')}</SelectLabel>
                                    {hourOptions.map(time => (
                                      <SelectItem key={time} value={time}>
                                        {formatTime(time)}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('createMenu.fields.endTime')}</FormLabel>
                            <FormControl>
                              <Select disabled={isAllDay} onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-transparent">
                                    <SelectValue placeholder={t('createMenu.fields.selectTime')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel>{t('createMenu.fields.selectTime')}</SelectLabel>
                                    {hourOptions.map(time => (
                                      <SelectItem key={time} value={time}>
                                        {formatTime(time)}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {isTimeInvalid && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{t('createMenu.validation.minInterval')}</AlertDescription>
                      </Alert>
                    )}
                  </CardContentShadcn>
                </CardShadcn>

                <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">{form.watch('name') || t('createMenu.title')}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{t('categoryDetail.sections.availability')}</p>
                      {isAllDay ? (
                        <p className="text-xs text-muted-foreground">{t('createMenu.fields.allDay')}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {formatTime(watchStart)} - {formatTime(watchEnd)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form
                          .watch('days')
                          .filter(d => d.selected)
                          .map(day => (
                            <span key={day.value} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {day.label}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </ExampleCard>
              </div>
            )}

            {/* Step 3: Assignments */}
            {currentStep === 3 && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
                <CardShadcn className="border-border/60">
                  <CardContentShadcn className="space-y-6 pt-6">
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <List className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{t('createMenu.fields.categories')}</h3>
                        <p className="text-xs text-muted-foreground">{t('createMenu.fields.selectCategories')}</p>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="selectedCategories"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('createMenu.fields.categories')}</FormLabel>
                          <FormControl>
                            <MultiSelectCombobox
                              options={(categories ?? []).map(c => ({ label: c.name, value: c.id }))}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder={t('createMenu.fields.selectCategories')}
                              emptyText={t('createMenu.fields.noCategoriesFound')}
                              isLoading={isCategoriesLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContentShadcn>
                </CardShadcn>

                <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">{form.watch('name') || t('createMenu.title')}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{t('createMenu.fields.categories')}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form.watch('selectedCategories').length > 0 ? (
                          form.watch('selectedCategories').map(cat => (
                            <span key={cat.value} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {cat.label}
                            </span>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic">{t('createMenu.fields.noCategoriesFound')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </ExampleCard>
              </div>
            )}
          </form>
        </Form>

        <DialogFooter className="flex justify-between">
          {currentStep > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack} disabled={createMenuMutation.isPending}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              {tCommon('back')}
            </Button>
          ) : (
            <div /> /* Spacer */
          )}

          <Button
            type="button"
            onClick={currentStep === 3 ? onSubmit : handleNext}
            disabled={createMenuMutation.isPending || (currentStep === 2 && (!!isTimeInvalid || !!isDaysInvalid))}
          >
            {createMenuMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentStep === 3 ? t('wizard.finish') : tCommon('next')}
            {currentStep === 3 ? <Check className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
