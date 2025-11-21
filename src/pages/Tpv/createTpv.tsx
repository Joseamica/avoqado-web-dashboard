import api from '@/api'
import { LoadingButton } from '@/components/loading-button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'

export default function CreateTpv() {
  const { t } = useTranslation(['tpv', 'common'])
  const { venueId } = useCurrentVenue()

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const from = (location.state as any)?.from || '/'

  const createTpv = useMutation({
    mutationFn: async (formValues: any) => {
      const payload = { name: formValues.name, serialNumber: formValues.serial }
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/tpvs`, payload)
      return response.data
    },
    onSuccess: (_, data: any) => {
      toast({
        title: t('create.successTitle', { name: data.name }),
        description: t('create.successDesc'),
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: t('create.errorTitle'),
        description: error?.response?.data?.message || error.message || t('create.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const form = useForm({
    defaultValues: {
      name: '',
      serial: '',
    },
  })

  function onSubmit(formValues) {
    createTpv.mutate({
      ...formValues,
    })
  }

  return (
    <div className="">
      {/* Barra superior */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <LoadingButton loading={createTpv.isPending} onClick={form.handleSubmit(onSubmit)} variant="default">
            {createTpv.isPending ? t('common:saving') : t('common:save')}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 ">
          <h1 className="text-xl font-semibold">{t('create.title')}</h1>

          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: t('create.validation.nameRequired') },
              minLength: { value: 3, message: t('create.validation.nameMin') },
              maxLength: { value: 30, message: t('create.validation.nameMax') },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{t('create.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('create.namePlaceholder')} className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          {/* Campo Serial Number */}
          <FormField
            control={form.control}
            name="serial"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('create.serialLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('create.serialPlaceholder')} className="max-w-96" {...field} />
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
