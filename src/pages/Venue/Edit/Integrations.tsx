import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useForm } from 'react-hook-form'
import { useToast } from '@/hooks/use-toast'
import { CryptoConfigSection } from '@/pages/Settings/components/CryptoConfigSection'
import { PosType } from '@/types'
import api from '@/api'
import { z } from 'zod'
import { useVenueEditActions } from '../VenueEditLayout'

// eslint-disable-next-line unused-imports/no-unused-vars
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

  // Fetch Google Integration status
  const { data: googleStatus } = useQuery({
    queryKey: ['google-integration', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/integrations/google/status`)
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
          <AlertTitle>{t('edit.integrations.error', { defaultValue: 'Error' })}</AlertTitle>
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

      <Separator />

      {/* Google Business Profile Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('edit.integrations.google.title', { defaultValue: 'Google Business Profile' })}</CardTitle>
              <CardDescription>{t('edit.integrations.google.description')}</CardDescription>
            </div>
            {googleStatus?.connected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t('edit.integrations.google.connected')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                {t('edit.integrations.google.notConnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleStatus?.connected ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('edit.integrations.google.connectedTo')}: <span className="font-medium text-foreground">{googleStatus.email}</span>
                </p>
                {googleStatus.locationName && (
                  <p className="text-sm text-muted-foreground">
                    {t('edit.integrations.google.location')}: <span className="font-medium text-foreground">{googleStatus.locationName}</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('edit.integrations.google.notConnectedDesc')}</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  {t('edit.integrations.google.benefit1')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  {t('edit.integrations.google.benefit2')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  {t('edit.integrations.google.benefit3')}
                </li>
              </ul>
            </div>
          )}

          <Button asChild>
            <Link to="google">
              {googleStatus?.connected ? t('edit.integrations.google.manage') : t('edit.integrations.google.connect')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* B4Bit Crypto Payments */}
      <CryptoConfigSection />
    </div>
  )
}
