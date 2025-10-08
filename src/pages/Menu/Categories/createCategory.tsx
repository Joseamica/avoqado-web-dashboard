import { createMenuCategory, getMenus, getProducts } from '@/services/menu.service'
import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { LoadingScreen } from '@/components/spinner'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import TimePicker from '@/components/time-picker'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'

export default function CreateCategory() {
  const { t } = useTranslation()
  const { venueId } = useCurrentVenue()

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { data: menus, isLoading: isMenusLoading } = useQuery({
    queryKey: ['menus', venueId],
    queryFn: () => getMenus(venueId!),
    enabled: !!venueId,
  })

  const { data: products, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', venueId],
    queryFn: () => getProducts(venueId!),
    enabled: !!venueId,
  })

  const from = (location.state as any)?.from || '/'

  const createCategory = useMutation({
    mutationFn: async formValues => {
      return await createMenuCategory(venueId!, formValues)
    },
    onSuccess: (_, data: any) => {
      toast({
        title: t('menu.forms.messages.categoryCreated', { name: data.name.toLowerCase() }),
        description: t('menu.forms.messages.categoryCreatedDesc'),
      })
      navigate(from)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error.message || t('menu.forms.messages.saveErrorDesc')
      toast({
        title: t('menu.forms.messages.saveError'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const form = useForm({
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

  useEffect(() => {
    if ((menus?.length ?? 0) > 0 && location.search) {
      const params = new URLSearchParams(location.search)
      const menuIdFromQuery = params.get('menuId')
      if (menuIdFromQuery) {
        const selectedMenuFromData = menus!.find(menu => menu.id === menuIdFromQuery)
        if (selectedMenuFromData) {
          const menuToSetInForm = [
            {
              value: selectedMenuFromData.id,
              label: selectedMenuFromData.name,
              disabled: false,
            },
          ]
          form.setValue('avoqadoMenus', menuToSetInForm)
        }
      }
    }
  }, [menus, location.search, form])

  // Manejador del submit
  // function onSubmit(formValues: z.infer<typeof FormSchema>) {
  function onSubmit(formValues: any) {
    // Transform the data to match server expectations
    const transformedData = {
      ...formValues,
      // Transform availableDays from MultiSelector format to server format
      availableDays: formValues.availableDays?.map((day: any) => day.value || day) || [],
      // Transform avoqadoMenus from MultiSelector format to server format
      avoqadoMenus:
        formValues.avoqadoMenus?.map((menu: any) => ({
          value: menu.value || menu.id,
          label: menu.label || menu.name,
          disabled: menu.disabled || false,
        })) || [],
      // Transform avoqadoProducts from MultiSelector format to server format
      avoqadoProducts:
        formValues.avoqadoProducts?.map((product: any) => ({
          value: product.value || product.id,
          label: product.label || product.name,
          disabled: product.disabled || false,
        })) || [],
    }

    // Handle time values: send null for empty values, keep valid times
    if (!transformedData.availableFrom || transformedData.availableFrom.trim() === '') {
      transformedData.availableFrom = null
    }
    if (!transformedData.availableUntil || transformedData.availableUntil.trim() === '') {
      transformedData.availableUntil = null
    }

    // Validate time range - availableFrom should be before availableUntil
    if (transformedData.availableFrom && transformedData.availableUntil) {
      const fromTime = transformedData.availableFrom.split(':').map(Number)
      const untilTime = transformedData.availableUntil.split(':').map(Number)

      const fromMinutes = fromTime[0] * 60 + fromTime[1]
      const untilMinutes = untilTime[0] * 60 + untilTime[1]

      if (fromMinutes >= untilMinutes) {
        toast({
          title: t('menu.forms.messages.invalidSchedule'),
          description: t('menu.forms.messages.invalidScheduleDesc'),
          variant: 'destructive',
        })
        return // Don't submit if time range is invalid
      }
    }

    createCategory.mutate(transformedData)
  }

  if (isMenusLoading || isProductsLoading) {
    return <LoadingScreen message={t('menu.forms.messages.loading')} />
  }

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <button type="button" onClick={() => history.back()} className="cursor-pointer bg-transparent">
            <ArrowLeft />
          </button>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <Button
            variant={form.watch('active') ? 'default' : 'secondary'}
            size="sm"
            onClick={() => {
              const currentActive = form.getValues('active')
              form.setValue('active', !currentActive)
            }}
          >
            {form.watch('active') ? t('menu.forms.labels.active') : t('menu.forms.labels.inactive')}
          </Button>
          <LoadingButton loading={createCategory.isPending} onClick={form.handleSubmit(onSubmit)} variant="default">
            {createCategory.isPending ? t('common.saving') : t('common.save')}
          </LoadingButton>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 ">
          <h1 className="text-xl font-semibold">{t('menu.forms.labels.newCategory')}</h1>

          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: t('menu.forms.validation.nameRequired') },
              minLength: { value: 3, message: t('menu.forms.validation.nameMinLength') },
              maxLength: { value: 30, message: t('menu.forms.validation.nameMaxLength') },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('menu.forms.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('menu.forms.labels.enterName')} className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name="avoqadoMenus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('menu.forms.labels.menusForCategory')}</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={(menus ?? []).map(menu => ({
                      label: menu.name,
                      value: menu.id,
                      disabled: false,
                    }))}
                    hidePlaceholderWhenSelected
                    placeholder={t('menu.forms.labels.selectMenus')}
                    emptyIndicator={t('menu.forms.labels.noMoreMenus')}
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
                <FormLabel>{t('menu.forms.labels.addProductsToCategory')}</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={(products ?? []).map(product => ({
                      label: product.name,
                      value: product.id,
                      disabled: false,
                    }))}
                    hidePlaceholderWhenSelected
                    placeholder={t('menu.forms.labels.selectProducts')}
                    emptyIndicator={t('menu.forms.labels.noMoreProducts')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="availableFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('menu.forms.availableFrom')}</FormLabel>
                  <FormControl>
                    <TimePicker value={field.value} onChange={field.onChange} placeholder={t('menu.categoryDetail.placeholders.selectStartTime')} />
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
                  <FormLabel>{t('menu.forms.availableUntil')}</FormLabel>
                  <FormControl>
                    <TimePicker value={field.value} onChange={field.onChange} placeholder={t('menu.categoryDetail.placeholders.selectEndTime')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Time range validation message */}
          {(() => {
            const fromValue = form.watch('availableFrom')
            const untilValue = form.watch('availableUntil')

            if (fromValue && untilValue) {
              const fromTime = fromValue.split(':').map(Number)
              const untilTime = untilValue.split(':').map(Number)
              const fromMinutes = fromTime[0] * 60 + fromTime[1]
              const untilMinutes = untilTime[0] * 60 + untilTime[1]

              if (fromMinutes >= untilMinutes) {
                return (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                    ⚠️ {t('menu.forms.messages.invalidScheduleDesc')}
                  </div>
                )
              }
            }
            return null
          })()}

          <FormField
            control={form.control}
            name="availableDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('menu.categoryDetail.labels.availableDays')}</FormLabel>
                <FormControl>
                  <MultipleSelector
                    {...field}
                    options={[
                      { label: t('menu.forms.daysOfWeek.monday'), value: 'MON', disabled: false },
                      { label: t('menu.forms.daysOfWeek.tuesday'), value: 'TUE', disabled: false },
                      { label: t('menu.forms.daysOfWeek.wednesday'), value: 'WED', disabled: false },
                      { label: t('menu.forms.daysOfWeek.thursday'), value: 'THU', disabled: false },
                      { label: t('menu.forms.daysOfWeek.friday'), value: 'FRI', disabled: false },
                      { label: t('menu.forms.daysOfWeek.saturday'), value: 'SAT', disabled: false },
                      { label: t('menu.forms.daysOfWeek.sunday'), value: 'SUN', disabled: false },
                    ]}
                    hidePlaceholderWhenSelected
                    placeholder={t('menu.categoryDetail.placeholders.selectDays')}
                    emptyIndicator={t('menu.categoryDetail.placeholders.noMoreDays')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}
