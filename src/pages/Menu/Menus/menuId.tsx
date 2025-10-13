import MultipleSelector from '@/components/multi-selector'
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
import { getMenu, getMenuCategories, updateMenu } from '@/services/menu.service'
import { MenuType } from '@/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// ----------------------------
// Helpers y datos iniciales
// ----------------------------
type DayItem = {
  label: string
  selected: boolean
}

const getInitialDays = (t: (key: string) => string): DayItem[] => [
  { label: t('menuId.days.mon'), selected: false },
  { label: t('menuId.days.tue'), selected: false },
  { label: t('menuId.days.wed'), selected: false },
  { label: t('menuId.days.thu'), selected: false },
  { label: t('menuId.days.fri'), selected: false },
  { label: t('menuId.days.sat'), selected: false },
  { label: t('menuId.days.sun'), selected: false },
]

function dayLabelToEnum(label: string): string {
  switch (label) {
    case 'Lun':
      return 'MON'
    case 'Mar':
      return 'TUE'
    case 'Mié':
      return 'WED'
    case 'Jue':
      return 'THU'
    case 'Vie':
      return 'FRI'
    case 'Sáb':
      return 'SAT'
    case 'Dom':
      return 'SUN'
    default:
      return 'MON'
  }
}

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

function convertTo12h(time24: string) {
  const [rawHours, minutes] = time24.split(':').map(Number)
  const ampm = rawHours >= 12 ? 'PM' : 'AM'
  const hours = rawHours % 12 || 12
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`
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
  const { t } = useTranslation('menu')
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
      days: getInitialDays(t),
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
      const formDays = getInitialDays(t).map(day => ({
        ...day,
        selected: availableDays.includes(dayLabelToEnum(day.label)),
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
      toast({
        title: t(`menu.menuId.toast.menuStatus${data.active ? 'Active' : 'Inactive'}`),
        description: t(`menu.menuId.toast.menuStatus${data.active ? 'Active' : 'Inactive'}Desc`),
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
  function toggleDay(dayLabel: string) {
    const updatedDays = days.map((d: DayItem) => (d.label === dayLabel ? { ...d, selected: !d.selected } : d))
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
    const availableDaysPayload = selectedDays.map((day: DayItem) => dayLabelToEnum(day.label))

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
          <div className="max-w-2xl p-4 space-y-4 border rounded-md">
            <div className="flex items-center justify-between mb-4">
              <span className="mr-2 font-bold">{t('menuId.fields.menuActive')}</span>
              <Switch checked={isActive} onCheckedChange={handleToggle} disabled={toggleActiveMutation.isPending} />
            </div>
            <p className="mb-3 text-sm">
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
                <h3 className="font-medium mb-3 text-blue-900 dark:text-blue-200">{t('menuId.seasonal.title')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>{t('menuId.seasonal.startDate')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                              >
                                {field.value ? format(field.value, 'PPP', { locale: es }) : <span>{t('menuId.seasonal.selectDate')}</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
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
                        <FormLabel>{t('menuId.seasonal.endDate')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                              >
                                {field.value ? format(field.value, 'PPP', { locale: es }) : <span>{t('menuId.seasonal.selectDate')}</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={date => {
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)
                                const startDate = form.getValues('startDate')
                                return date < today || (startDate && date <= startDate)
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

                {startDate && endDate && (
                  <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900/50 rounded text-sm text-blue-800 dark:text-blue-200">
                    <strong>{t('menuId.seasonal.preview')}:</strong> {t('menuId.seasonal.previewText', {
                      startDate: format(startDate, 'PPP', { locale: es }),
                      endDate: format(endDate, 'PPP', { locale: es })
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <FormLabel>{t('menuId.fields.availableDays')}</FormLabel>
              <div className="flex w-full mb-2">
                {days.map((day: DayItem) => (
                  <button
                    type="button"
                    key={day.label}
                    onClick={() => toggleDay(day.label)}
                    className={
                      'px-3 py-1 cursor-pointer transition-colors w-full ' +
                      (day.selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')
                    }
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {form.formState.errors.days && <p className="text-sm text-red-500">{form.formState.errors.days.message?.toString()}</p>}
            </div>

            <div className="relative w-full h-6 overflow-hidden bg-muted rounded-sm">
              {!isAllDay && (
                <div className="absolute top-0 bottom-0 bg-green-500" style={{ left: `${barLeft}%`, width: `${barRight - barLeft}%` }} />
              )}
              {isAllDay && <div className="absolute top-0 bottom-0 w-full bg-green-500" />}
            </div>

            <div className="flex justify-between w-full text-xs text-muted-foreground">
              <span>00:00</span>
              <span>03:00</span>
              <span>06:00</span>
              <span>09:00</span>
              <span>12:00</span>
              <span>15:00</span>
              <span>18:00</span>
              <span>21:00</span>
              <span>24:00</span>
            </div>

            <div className="flex items-center space-x-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('menuId.fields.startTime')}</FormLabel>
                    <Select
                      disabled={isAllDay}
                      value={field.value}
                      onValueChange={value => {
                        field.onChange(value)
                        if (form.formState.errors.startTime) form.clearErrors('startTime')
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder={t('menuId.fields.selectTime')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>{t('menuId.fields.selectTime')}</SelectLabel>
                          {hourOptions.map(time => (
                            <SelectItem key={time} value={time}>
                              {convertTo12h(time)}
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
                  <FormItem>
                    <FormLabel>{t('menuId.fields.endTime')}</FormLabel>
                    <Select
                      disabled={isAllDay}
                      value={field.value}
                      onValueChange={value => {
                        field.onChange(value)
                        if (form.formState.errors.endTime) form.clearErrors('endTime')
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder={t('menuId.fields.selectTime')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>{t('menuId.fields.selectTime')}</SelectLabel>
                          {hourOptions.map(time => (
                            <SelectItem key={time} value={time}>
                              {convertTo12h(time)}
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

            <div className="flex items-center space-x-2">
              <input id="allDay" type="checkbox" className="w-4 h-4" checked={isAllDay} onChange={handleAllDayChange} />
              <label htmlFor="allDay" className="text-sm font-semibold">
                {t('menuId.fields.allDay')}
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{t('menuId.fields.categories')}</h2>
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <MultipleSelector
                      {...field}
                      options={(categories ?? []).map((category: any) => ({
                        label: category.name,
                        value: category.id,
                        disabled: false,
                      }))}
                      hidePlaceholderWhenSelected
                      placeholder={t('menuId.fields.selectCategories')}
                      emptyIndicator={t('menuId.fields.noCategoriesFound')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  )
}
