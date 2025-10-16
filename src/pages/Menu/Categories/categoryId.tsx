import { getMenuCategory, updateMenuCategory, deleteMenuCategory, getMenus, getProducts } from '@/services/menu.service'
import AlertDialogWrapper from '@/components/alert-dialog'
import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import TimePicker from '@/components/time-picker'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function CategoryId() {
  const { t } = useTranslation('menu')
  const { categoryId } = useParams()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const getDayLabel = (day: string) => {
    const dayLabels: Record<string, string> = {
      MON: t('forms.daysOfWeek.monday'),
      TUE: t('forms.daysOfWeek.tuesday'),
      WED: t('forms.daysOfWeek.wednesday'),
      THU: t('forms.daysOfWeek.thursday'),
      FRI: t('forms.daysOfWeek.friday'),
      SAT: t('forms.daysOfWeek.saturday'),
      SUN: t('forms.daysOfWeek.sunday'),
    }
    return dayLabels[day] || day
  }

  const { data, isLoading } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => getMenuCategory(venueId!, categoryId!),
  })

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

  const saveCategory = useMutation({
    mutationFn: async formValues => {
      return await updateMenuCategory(venueId!, categoryId!, formValues)
    },
    onSuccess: () => {
      toast({
        title: t('categoryDetail.toasts.saved'),
        description: t('categories.toasts.saved'),
      })
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] }) // Refetch product data
    },
    onError: (error: any) => {
      toast({
        title: t('forms.messages.saveError'),
        description: error.message || t('forms.messages.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) => {
      return await updateMenuCategory(venueId!, categoryId!, { active })
    },
    onSuccess: (_, newActiveState) => {
      toast({
        title: newActiveState ? t('categoryDetail.toasts.activated') : t('categoryDetail.toasts.paused'),
        description: newActiveState ? t('categoryDetail.toasts.activatedDesc') : t('categoryDetail.toasts.pausedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] })
      form.setValue('active', newActiveState) // Update form state
    },
    onError: (error: any) => {
      const currentActive = form.getValues('active')
      form.setValue('active', currentActive) // Revert on error
      toast({
        title: t('categoryDetail.toasts.statusError'),
        description: error.message || t('categoryDetail.toasts.statusErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async () => {
      await deleteMenuCategory(venueId!, categoryId!)
    },
    onSuccess: () => {
      toast({
        title: t('categoryDetail.toasts.deleted'),
        description: t('categoryDetail.toasts.deletedDesc'),
      })
      navigate(from)
    },
  })

  const form = useForm({})

  // Initialize form with server data when it loads
  useEffect(() => {
    if (data) {
      form.setValue('active', data.active ?? true)
    }
  }, [data, form])

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
          title: t('forms.messages.invalidSchedule'),
          description: t('forms.messages.invalidScheduleDesc'),
          variant: 'destructive',
        })
        return // Don't submit if time range is invalid
      }
    }

    saveCategory.mutate(transformedData)
  }

  if (isLoading || isMenusLoading || isProductsLoading) {
    return (
      <div className="p-4">
        <div className="flex flex-row justify-between">
          <div className="space-x-4 flex-row-center">
            <Link to={from}>
              <ArrowLeft />
            </Link>
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="space-x-3 flex-row-center">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <Separator marginBottom="4" marginTop="2" />
        <div className="space-y-6">
          <div>
            <Skeleton className="h-4 w-64 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-56 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-36 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex flex-row justify-between">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{data.name}</span>
        </div>
        <div className="space-x-3 flex-row-center ">
          <Button
            variant={form.watch('active') ? 'default' : 'secondary'}
            size="sm"
            disabled={toggleActive.isPending}
            onClick={() => {
              const currentActive = form.getValues('active')
              const newActiveState = !currentActive
              form.setValue('active', newActiveState) // Optimistic update
              toggleActive.mutate(newActiveState)
            }}
          >
            {toggleActive.isPending ? '...' : form.watch('active') ? t('forms.labels.active') : t('forms.labels.inactive')}
          </Button>
          <AlertDialogWrapper
            triggerTitle={t('categoryDetail.buttons.delete')}
            title={t('categoryDetail.dialogs.deleteTitle')}
            // description="Al eliminar el producto, no podrás recuperarlo."
            message={t('categoryDetail.dialogs.deleteMessage')}
            rightButtonLabel={t('categoryDetail.buttons.delete')}
            rightButtonVariant="default"
            onRightButtonClick={() => deleteCategory.mutate()}
          />
          <Button variant="outline">{t('categoryDetail.buttons.duplicate')}</Button>
          <LoadingButton
            disabled={!form.formState.isDirty || saveCategory.isPending}
            loading={saveCategory.isPending}
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
          >
            {saveCategory.isPending ? t('categoryDetail.buttons.saving') : t('categoryDetail.buttons.save')}
          </LoadingButton>
        </div>
      </div>
      <Separator marginBottom="4" marginTop="2" />
      <div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="avoqadoMenus"
              defaultValue={
                data.menus?.map(m => ({
                  label: m.menu.name,
                  value: m.menu.id,
                  disabled: false,
                })) || []
              }
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('forms.labels.menusForCategory')}</FormLabel>
                  <FormControl>
                    <MultipleSelector
                      {...field}
                      options={(menus ?? []).map(menu => ({
                        label: menu.name,
                        value: menu.id,
                        disabled: false,
                      }))}
                      hidePlaceholderWhenSelected
                      placeholder={t('forms.labels.selectMenus')}
                      emptyIndicator={t('forms.labels.noMoreMenus')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="avoqadoProducts"
              defaultValue={
                data.products?.map(product => ({
                  label: product.name,
                  value: product.id,
                  disabled: false,
                })) || []
              }
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('forms.labels.addProductsToCategory')}</FormLabel>
                  <FormControl>
                    <MultipleSelector
                      {...field}
                      options={(products ?? []).map(product => ({
                        label: product.name,
                        value: product.id,
                        disabled: false,
                      }))}
                      hidePlaceholderWhenSelected
                      placeholder={t('forms.labels.selectProducts')}
                      emptyIndicator={t('forms.labels.noMoreProducts')}
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
                defaultValue={data.availableFrom || ''}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forms.availableFrom')}</FormLabel>
                    <FormControl>
                      <TimePicker value={field.value} onChange={field.onChange} placeholder={t('categoryDetail.placeholders.selectStartTime')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="availableUntil"
                defaultValue={data.availableUntil || ''}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forms.availableUntil')}</FormLabel>
                    <FormControl>
                      <TimePicker value={field.value} onChange={field.onChange} placeholder={t('categoryDetail.placeholders.selectEndTime')} />
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
                      ⚠️ {t('forms.messages.invalidScheduleDesc')}
                    </div>
                  )
                }
              }
              return null
            })()}

            <FormField
              control={form.control}
              name="availableDays"
              defaultValue={
                data.availableDays?.map(day => ({
                  label: getDayLabel(day),
                  value: day,
                  disabled: false,
                })) || []
              }
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('categoryDetail.labels.availableDays')}</FormLabel>
                  <FormControl>
                    <MultipleSelector
                      {...field}
                      options={[
                        { label: t('forms.daysOfWeek.monday'), value: 'MON', disabled: false },
                        { label: t('forms.daysOfWeek.tuesday'), value: 'TUE', disabled: false },
                        { label: t('forms.daysOfWeek.wednesday'), value: 'WED', disabled: false },
                        { label: t('forms.daysOfWeek.thursday'), value: 'THU', disabled: false },
                        { label: t('forms.daysOfWeek.friday'), value: 'FRI', disabled: false },
                        { label: t('forms.daysOfWeek.saturday'), value: 'SAT', disabled: false },
                        { label: t('forms.daysOfWeek.sunday'), value: 'SUN', disabled: false },
                      ]}
                      hidePlaceholderWhenSelected
                      placeholder={t('categoryDetail.placeholders.selectDays')}
                      emptyIndicator={t('categoryDetail.placeholders.noMoreDays')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </div>
  )
}
