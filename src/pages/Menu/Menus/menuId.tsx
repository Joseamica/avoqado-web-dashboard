import AlertDialogWrapper from '@/components/alert-dialog'
import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { deleteMenu, getMenu, getMenuCategories, updateMenu } from '@/services/menu.service'
import { MenuType } from '@/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ExampleCard } from '@/components/example-card'
import { Card as CardShadcn, CardContent as CardContentShadcn } from '@/components/ui/card'
import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { ArrowLeft, Calendar as CalendarIcon, Trash2 } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// ----------------------------
// Helpers y datos iniciales
// ----------------------------
type DayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

type DayItem = {
  value: DayCode
  selected: boolean
}

const DAY_ORDER: DayCode[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

const DAY_TRANSLATION_KEYS: Record<DayCode, string> = {
  MON: 'menuId.days.mon',
  TUE: 'menuId.days.tue',
  WED: 'menuId.days.wed',
  THU: 'menuId.days.thu',
  FRI: 'menuId.days.fri',
  SAT: 'menuId.days.sat',
  SUN: 'menuId.days.sun',
}

const getInitialDays = (): DayItem[] => DAY_ORDER.map(value => ({ value, selected: false }))

const getDayLabel = (t: (key: string) => string, day: DayCode) => t(DAY_TRANSLATION_KEYS[day])

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

function formatTimeOption(time24: string, locale: string) {
  const [hours, minutes] = time24.split(':').map(Number)
  const tempDate = new Date()
  tempDate.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(tempDate)
}

function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

function timeToPercentage(time: string) {
  return (parseTimeToMinutes(time) / 1440) * 100
}

// ----------------------------
// Componente para editar el menú
// ----------------------------
export default function MenuId() {
  const { t, i18n } = useTranslation('menu')
  const localeCode = i18n.language || 'en'
  const dateLocale = i18n.language?.startsWith('es') ? es : enUS
  const { menuId } = useParams()
  const { venueId } = useCurrentVenue()

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const from = (location.state as any)?.from || '/'

  // Consulta del menú a editar
  const { data: menuData, isLoading: isMenuLoading } = useQuery({
    queryKey: ['menus', menuId],
    queryFn: () => getMenu(venueId, menuId),
  })

  // Consulta de categorías del venue
  const { data: categories, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: !!venueId,
  })

  // Llamamos a useForm siempre, con defaultValues iniciales
  const form = useForm({
    defaultValues: {
      name: '',
      avoqadoMenus: [],
      avoqadoProducts: [],
      categories: [],
      days: getInitialDays(),
      startTime: '09:00',
      endTime: '19:30',
      isActive: true,
      isAllDay: false,
      startDate: null as Date | null,
      endDate: null as Date | null,
      type: MenuType.REGULAR as MenuType,
    },
    mode: 'onSubmit',
  })

  // Actualizamos el formulario cuando ya llegan los datos del menú
  React.useEffect(() => {
    if (menuData) {
      const availableDays = menuData.availableDays || []
      const isAllDayValue = !menuData.availableFrom && !menuData.availableUntil
      const defaultStartTime = menuData.availableFrom || '09:00'
      const defaultEndTime = menuData.availableUntil || '19:30'
      const formDays = DAY_ORDER.map(dayValue => ({
        value: dayValue,
        selected: availableDays.includes(dayValue),
      }))

      // Map categories for the MultipleSelector
      const categoriesForForm =
        menuData.categories?.map((categoryAssignment: any) => ({
          label: categoryAssignment.category?.name || '',
          value: categoryAssignment.categoryId,
          disabled: false,
        })) || []

      form.reset({
        name: menuData.name || '',
        avoqadoMenus: [], // Legacy property, no longer used
        avoqadoProducts: [], // Legacy property, no longer used
        categories: categoriesForForm,
        days: formDays,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        isActive: menuData.active,
        isAllDay: isAllDayValue,
        startDate: menuData.startDate ? new Date(menuData.startDate) : null,
        endDate: menuData.endDate ? new Date(menuData.endDate) : null,
        type: (menuData.type as MenuType) || MenuType.REGULAR,
      })
    }
  }, [menuData, form])

  // Mutation para actualizar el menú
  const updateMenuMutation = useMutation({
    mutationFn: async (formValues: any) => {
      return await updateMenu(venueId, menuId, formValues)
    },
    onSuccess: (data: any) => {
      toast({
        title: t('menuId.toast.menuUpdated', { name: data.name.toLowerCase() }),
        description: t('menuId.toast.menuUpdatedDesc'),
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: t('menuId.toast.errorSaving'),
        description: error.message || t('menuId.toast.errorSavingDesc'),
        variant: 'destructive',
      })
    },
  })

  // Mutation para toggle inmediato del estado activo
  const toggleActiveMutation = useMutation({
    mutationFn: async (active: boolean) => {
      return await updateMenu(venueId, menuId, { active })
    },
    onSuccess: (data: any) => {
      const statusKey = data.active ? 'menuId.toast.menuStatusActive' : 'menuId.toast.menuStatusInactive'
      toast({
        title: t(statusKey),
        description: t(`${statusKey}Desc`),
      })
    },
    onError: (error: any) => {
      // Revert the form state on error
      form.setValue('isActive', !form.getValues('isActive'))
      toast({
        title: t('menuId.toast.errorStatus'),
        description: error.message || t('menuId.toast.errorStatusDesc'),
        variant: 'destructive',
      })
    },
  })

  // Mutation para eliminar el menú
  const deleteMenuMutation = useMutation({
    mutationFn: async () => {
      await deleteMenu(venueId, menuId)
    },
    onSuccess: () => {
      toast({
        title: t('menuId.toast.menuDeleted'),
        description: t('menuId.toast.menuDeletedDesc'),
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: t('menuId.toast.errorDeleting'),
        description: t('menuId.toast.errorDeletingDesc', { message: error.message }),
        variant: 'destructive',
      })
    },
  })

  // Si aún se están cargando datos, mostramos el loading.
  if (isMenuLoading || isCategoriesLoading) {
    return <div>{t('menuId.loading')}</div>
  }

  // Obtenemos valores del formulario
  const days = form.watch('days')
  const startTime = form.watch('startTime')
  const endTime = form.watch('endTime')
  const isAllDay = form.watch('isAllDay')
  const isActive = form.watch('isActive')
  const startDate = form.watch('startDate')
  const endDate = form.watch('endDate')
  const menuType = form.watch('type')

  // Funciones para manejar cambios en el formulario
  function toggleDay(dayValue: DayCode) {
    const updatedDays = days.map((d: DayItem) => (d.value === dayValue ? { ...d, selected: !d.selected } : d))
    form.setValue('days', updatedDays, { shouldDirty: true })
    if (updatedDays.some((d: DayItem) => d.selected)) {
      form.clearErrors('days')
    }
  }

  function handleToggle(checked: boolean) {
    form.setValue('isActive', checked)
    toggleActiveMutation.mutate(checked)
  }

  function handleAllDayChange(e: React.ChangeEvent<HTMLInputElement>) {
    form.setValue('isAllDay', e.target.checked)
    if (e.target.checked) {
      form.clearErrors(['startTime', 'endTime'])
    }
  }

  function onSubmit(formValues: any) {
    form.clearErrors()
    const { name, categories, days, startTime, endTime, isAllDay, isActive, startDate, endDate, type } = formValues

    if (!name.trim()) {
      form.setError('name', { type: 'manual', message: t('menuId.validation.nameRequired') })
    }
    if (!days.some((day: DayItem) => day.selected)) {
      form.setError('days', {
        type: 'manual',
        message: t('menuId.validation.dayRequired'),
      })
    }

    // Validación para menús de temporada
    if (type === 'SEASONAL') {
      if (!startDate) {
        form.setError('startDate', { type: 'manual', message: t('menuId.validation.startDateRequired') })
      }
      if (!endDate) {
        form.setError('endDate', { type: 'manual', message: t('menuId.validation.endDateRequired') })
      }
      if (startDate && endDate && startDate >= endDate) {
        form.setError('endDate', { type: 'manual', message: t('menuId.validation.endDateAfterStart') })
      }
    }
    if (!isAllDay) {
      const startMinutes = parseTimeToMinutes(startTime)
      const endMinutes = parseTimeToMinutes(endTime)
      if (endMinutes - startMinutes < 60) {
        const errorMessage = t('menuId.validation.minInterval')
        form.setError('startTime', { type: 'manual', message: errorMessage })
        form.setError('endTime', { type: 'manual', message: errorMessage })
      }
    }

    const nameErrors = form.getFieldState('name').error
    const daysErrors = form.getFieldState('days').error
    const startTimeErrors = form.getFieldState('startTime').error
    const endTimeErrors = form.getFieldState('endTime').error
    const startDateErrors = form.getFieldState('startDate').error
    const endDateErrors = form.getFieldState('endDate').error
    if (nameErrors || daysErrors || startTimeErrors || endTimeErrors || startDateErrors || endDateErrors) {
      return
    }

    const selectedDays = days.filter((day: DayItem) => day.selected)
    const availableDaysPayload = selectedDays.map((day: DayItem) => day.value)

    // Extract just the category IDs from the MultipleSelector value format
    const categoryIds = categories.map((category: any) => category.value)

    const payload = {
      name,
      type,
      active: isActive,
      availableFrom: isAllDay ? null : startTime,
      availableUntil: isAllDay ? null : endTime,
      availableDays: availableDaysPayload,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      categoryIds: categoryIds, // Backend expects categoryIds, not categories
    }

    updateMenuMutation.mutate(payload)
  }

  // Cálculo para la barra de horas
  const startPercent = timeToPercentage(startTime)
  const endPercent = timeToPercentage(endTime)
  const barLeft = Math.min(startPercent, endPercent)
  const barRight = Math.max(startPercent, endPercent)
  const hourOptions = getHourOptions()

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{form.watch('name')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <AlertDialogWrapper
            triggerTitle={
              <span className="flex items-center">
                <Trash2 className="mr-2 h-4 w-4" />
                {t('menuId.dialogs.deleteButton')}
              </span>
            }
            triggerVariant="outline"
            title={t('menuId.dialogs.deleteTitle')}
            message={t('menuId.dialogs.deleteMessage')}
            rightButtonLabel={t('menuId.dialogs.deleteButton')}
            rightButtonVariant="destructive"
            onRightButtonClick={() => deleteMenuMutation.mutate()}
          />
          <Button
            disabled={!form.formState.isDirty || updateMenuMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
          >
            {updateMenuMutation.isPending ? t('menuId.buttons.saving') : t('menuId.buttons.save')}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
            <CardShadcn className="border-border/60">
              <CardContentShadcn className="space-y-6 pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{t('menuId.fields.menuActive')}</span>
                  <Switch checked={isActive} onCheckedChange={handleToggle} disabled={toggleActiveMutation.isPending} />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {isActive ? t('menuId.fields.menuActiveDesc') : t('menuId.fields.menuInactiveDesc')}
                </p>

                <FormField
                  control={form.control}
                  name="name"
                  rules={{
                    required: { value: true, message: t('menuId.validation.nameRequired') },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('menuId.fields.menuName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('menuId.fields.menuNamePlaceholder')} {...field} />
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
                          <SelectTrigger>
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

                {menuType === 'SEASONAL' && (
                  <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
                    <h3 className="font-medium mb-3 text-blue-900 dark:text-blue-200 text-sm">{t('menuId.seasonal.title')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-xs">{t('menuId.seasonal.startDate')}</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn('w-full pl-3 text-left font-normal text-sm', !field.value && 'text-muted-foreground')}
                                  >
                                    {field.value ? (
                                      format(field.value, 'PPP', { locale: dateLocale })
                                    ) : (
                                      <span>{t('menuId.seasonal.selectDate')}</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  locale={dateLocale}
                                  disabled={date => {
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    return date < today
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-xs">{t('menuId.seasonal.endDate')}</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn('w-full pl-3 text-left font-normal text-sm', !field.value && 'text-muted-foreground')}
                                  >
                                    {field.value ? (
                                      format(field.value, 'PPP', { locale: dateLocale })
                                    ) : (
                                      <span>{t('menuId.seasonal.selectDate')}</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  locale={dateLocale}
                                  disabled={date => {
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    const startDateValue = form.getValues('startDate')
                                    return date < today || (startDateValue && date <= startDateValue)
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <FormLabel>{t('menuId.fields.availableDays')}</FormLabel>
                    <div className="flex w-full mb-2 gap-2 flex-wrap mt-2">
                      {DAY_ORDER.map(dayCode => {
                        const isSelected = days.find(d => d.value === dayCode)?.selected
                        return (
                          <button
                            type="button"
                            key={dayCode}
                            onClick={() => toggleDay(dayCode)}
                            className={cn(
                              'px-3 py-1 cursor-pointer transition-colors rounded-full border text-xs',
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground border-input hover:bg-muted',
                            )}
                          >
                            {getDayLabel(t, dayCode)}
                          </button>
                        )
                      })}
                    </div>
                    {form.formState.errors.days && (
                      <p className="text-xs text-destructive mt-1">{form.formState.errors.days.message?.toString()}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="relative w-full h-8 overflow-hidden bg-muted rounded-lg">
                      {!isAllDay && (
                        <div
                          className="absolute top-0 bottom-0 bg-primary/20"
                          style={{ left: `${barLeft}%`, width: `${barRight - barLeft}%` }}
                        />
                      )}
                      {isAllDay && <div className="absolute top-0 bottom-0 w-full bg-primary/20" />}
                      <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none">
                        {[0, 6, 12, 18, 24].map(h => (
                          <span key={h} className="text-[10px] text-muted-foreground font-medium">
                            {h.toString().padStart(2, '0')}:00
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem className="flex-1 w-full">
                            <FormLabel className="text-xs">{t('menuId.fields.startTime')}</FormLabel>
                            <Select
                              disabled={isAllDay}
                              value={field.value}
                              onValueChange={value => {
                                field.onChange(value)
                                if (form.formState.errors.startTime) form.clearErrors('startTime')
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder={t('menuId.fields.selectTime')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>{t('menuId.fields.selectTime')}</SelectLabel>
                                  {hourOptions.map(time => (
                                    <SelectItem key={time} value={time}>
                                      {formatTimeOption(time, localeCode)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem className="flex-1 w-full">
                            <FormLabel className="text-xs">{t('menuId.fields.endTime')}</FormLabel>
                            <Select
                              disabled={isAllDay}
                              value={field.value}
                              onValueChange={value => {
                                field.onChange(value)
                                if (form.formState.errors.endTime) form.clearErrors('endTime')
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder={t('menuId.fields.selectTime')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>{t('menuId.fields.selectTime')}</SelectLabel>
                                  {hourOptions.map(time => (
                                    <SelectItem key={time} value={time}>
                                      {formatTimeOption(time, localeCode)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <input id="allDay" type="checkbox" className="w-4 h-4" checked={isAllDay} onChange={handleAllDayChange} />
                      <label htmlFor="allDay" className="text-sm font-medium cursor-pointer">
                        {t('menuId.fields.allDay')}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h2 className="text-sm font-semibold">{t('menuId.fields.categories')}</h2>
                  <FormField
                    control={form.control}
                    name="categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <MultiSelectCombobox
                            options={(categories ?? []).map((category: any) => ({
                              label: category.name,
                              value: category.id,
                              disabled: false,
                            }))}
                            selected={(field.value || []).map((c: any) => ({ label: c.label, value: c.value }))}
                            onChange={value => field.onChange(value)}
                            placeholder={t('menuId.fields.selectCategories')}
                            emptyText={t('menuId.fields.noCategoriesFound')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContentShadcn>
            </CardShadcn>

            <ExampleCard title={t('modifiers.createGroup.examples.previewTitle')}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{form.watch('name') || t('createMenu.title')}</p>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-medium',
                      isActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isActive ? t('forms.labels.active') : t('forms.labels.inactive')}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-primary/10">
                      <CalendarIcon className="w-3 h-3 text-primary" />
                    </div>
                    <p className="text-xs font-medium">{t('categoryDetail.sections.availability')}</p>
                  </div>

                  {isAllDay ? (
                    <p className="text-xs text-muted-foreground italic px-6">{t('menuId.fields.allDay')}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground px-6">
                      {formatTimeOption(startTime, localeCode)} - {formatTimeOption(endTime, localeCode)}
                    </p>
                  )}

                  {days.some(d => d.selected) && (
                    <div className="flex flex-wrap gap-1 px-6">
                      {days
                        .filter(d => d.selected)
                        .map(day => (
                          <span
                            key={day.value}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50"
                          >
                            {getDayLabel(t, day.value)}
                          </span>
                        ))}
                    </div>
                  )}

                  {menuType === 'SEASONAL' && startDate && endDate && (
                    <div className="px-6 pt-2">
                      <p className="text-[10px] text-primary font-medium">
                        {format(startDate, 'PP', { locale: dateLocale })} - {format(endDate, 'PP', { locale: dateLocale })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t border-dashed">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-primary/10">
                      <Trash2 className="w-3 h-3 text-primary rotate-45" /> {/* Using Trash2 as placeholder categories icon */}
                    </div>
                    <p className="text-xs font-medium">{t('menuId.fields.categories')}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 px-6">
                    {form.watch('categories').length > 0 ? (
                      form.watch('categories').map((cat: any) => (
                        <span key={cat.value} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {cat.label}
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">{t('menuId.fields.noCategoriesFound')}</p>
                    )}
                  </div>
                </div>
              </div>
            </ExampleCard>
          </div>
        </form>
      </Form>
    </div>
  )
}
