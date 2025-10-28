import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useForm } from 'react-hook-form'
import { useToast } from '@/hooks/use-toast'
import { PosType } from '@/types'
import api from '@/api'
import { z } from 'zod'
import { useVenueEditActions } from '../VenueEditLayout'

const posFormSchema = z.object({
  posType: z.nativeEnum(PosType).nullable().optional(),
})

type PosFormValues = z.infer<typeof posFormSchema>

interface VenueIntegrations {
  id: string
  name: string
  posType: PosType | null
  posStatus: string
}

export default function VenueIntegrations() {
  const { t } = useTranslation('venue')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { setActions } = useVenueEditActions()

  const { data: venue, isLoading } = useQuery<VenueIntegrations>({
    queryKey: ['venue-integrations', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  const form = useForm<PosFormValues>({
    defaultValues: {
      posType: null,
    },
  })

  useEffect(() => {
    if (venue) {
      form.reset({
        posType: (venue.posType as PosType) || null,
      })
    }
  }, [venue, form])

  const updateVenue = useMutation({
    mutationFn: async (data: PosFormValues) => {
      const venueData: any = {}
      if (data.posType) venueData.posType = data.posType
      return await api.put(`/api/v1/dashboard/venues/${venueId}`, venueData)
    },
    onSuccess: () => {
      toast({
        title: t('edit.integrations.toast.success'),
        description: t('edit.integrations.toast.successDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['venue-integrations', venueId] })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('edit.integrations.toast.error'),
        description: error.response?.data?.message || t('edit.integrations.toast.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: PosFormValues) => {
    updateVenue.mutate(data)
  }

  // Register actions with parent layout
  useEffect(() => {
    setActions({
      onSave: form.handleSubmit(onSubmit),
      onCancel: () => form.reset(),
      isDirty: form.formState.isDirty,
      isLoading: updateVenue.isPending,
      canEdit: true, // No permission check for integrations
    })
  }, [form.formState.isDirty, updateVenue.isPending, setActions, form])

  if (isLoading) {
    return (
      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{t('edit.integrations.errorLoading')}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('edit.integrations.title')}</h2>
        <p className="text-muted-foreground mt-2">{t('edit.integrations.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('edit.integrations.pos.title')}</CardTitle>
          <CardDescription>{t('edit.integrations.pos.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="posType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('edit.integrations.pos.system')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('edit.integrations.pos.selectPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PosType.SOFTRESTAURANT}>
                          {t('edit.integrations.pos.types.softRestaurant')}
                        </SelectItem>
                        <SelectItem value={PosType.SQUARE}>{t('edit.integrations.pos.types.square')}</SelectItem>
                        <SelectItem value={PosType.TOAST}>{t('edit.integrations.pos.types.toast')}</SelectItem>
                        <SelectItem value={PosType.CLOVER}>{t('edit.integrations.pos.types.clover')}</SelectItem>
                        <SelectItem value={PosType.ALOHA}>{t('edit.integrations.pos.types.aloha')}</SelectItem>
                        <SelectItem value={PosType.MICROS}>{t('edit.integrations.pos.types.micros')}</SelectItem>
                        <SelectItem value={PosType.NCR}>{t('edit.integrations.pos.types.ncr')}</SelectItem>
                        <SelectItem value={PosType.CUSTOM}>{t('edit.integrations.pos.types.custom')}</SelectItem>
                        <SelectItem value={PosType.NONE}>{t('edit.integrations.pos.types.none')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
