import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { User, Mail, Shield, Calendar, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'
import googleCalendarService from '@/services/googleCalendar.service'
import { GoogleCalendarConnectionCard } from '@/pages/GoogleCalendar/components/GoogleCalendarConnectionCard'

export default function ProfileSettings() {
  const { t } = useTranslation(['account', 'common'])
  const { t: tGcal } = useTranslation('googleCalendar')
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const { formatDate, formatDateTime } = useVenueDateTime()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const currentVenue = user?.venues?.find((v: any) => v.id === venueId)
  const currentPin = currentVenue?.pin || ''

  const { data: gcalConnectionsData, isLoading: gcalLoading } = useQuery({
    queryKey: ['google-calendar', 'connections'],
    queryFn: () => googleCalendarService.listConnections(),
  })
  const personalGoogleCalendarConnection =
    gcalConnectionsData?.connections.find(
      c => c.scope === 'STAFF_PERSONAL' && c.staffId === user?.id && c.status !== 'DISCONNECTED',
    ) ?? null

  const profileForm = useForm({
    defaultValues: {
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      pin: currentPin,
    },
  })

  const editProfile = useMutation({
    mutationFn: async (formValues: any) => {
      const payload: any = { id: user?.id }
      if (formValues.firstName) payload.firstName = formValues.firstName
      if (formValues.lastName) payload.lastName = formValues.lastName
      if (formValues.email) payload.email = formValues.email
      if (formValues.phone) payload.phone = formValues.phone
      if (formValues.pin !== undefined) payload.pin = formValues.pin || null
      const response = await api.patch(`/api/v1/dashboard/${venueId}/account`, payload)
      return response.data
    },
    onSuccess: () => {
      toast({ title: t('toast.success.title'), description: t('toast.success.description') })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('toast.error.description'),
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="p-6" data-tour="settings-profile-page">
      <div className="mb-6">
        <PageTitleWithInfo
          title={
            <>
              <User className="h-6 w-6" />
              <span>{t('title')}</span>
            </>
          }
          className="text-2xl font-semibold flex items-center gap-2"
          tooltip={t('info.page', {
            defaultValue: 'Administra tus datos de cuenta, perfil y credenciales.',
          })}
        />
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('accountInfo.title')}
              </CardTitle>
              <CardDescription>{t('accountInfo.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('accountInfo.email')}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('accountInfo.role')}</p>
                  <Badge variant="secondary">{user?.role}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('accountInfo.memberSince')}</p>
                  <p className="text-sm text-muted-foreground">{user?.createdAt ? formatDate(user.createdAt) : 'N/A'}</p>
                </div>
              </div>
              {user?.lastLogin && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('accountInfo.lastLogin')}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(user.lastLogin)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-input">
            <CardHeader>
              <CardTitle>{t('editProfile.title')}</CardTitle>
              <CardDescription>{t('editProfile.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(v => editProfile.mutate(v))} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('editProfile.firstName')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('editProfile.lastName')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('editProfile.email')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('editProfile.phone')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          {t('editProfile.pin', { defaultValue: 'PIN de acceso TPV' })}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            placeholder={t('editProfile.pinPlaceholder', { defaultValue: '4-10 dígitos' })}
                            disabled={editProfile.isPending}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {t('editProfile.pinHelp', {
                            defaultValue: 'Este PIN te permite iniciar sesión rápidamente en las terminales de cobro (TPV).',
                          })}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-4">
                    <Button type="submit" disabled={editProfile.isPending}>
                      {editProfile.isPending ? t('common:saving') : t('common:save')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => profileForm.reset()} disabled={editProfile.isPending}>
                      {t('common:cancel')}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{tGcal('personal.title')}</h2>
          <p className="text-sm text-muted-foreground">{tGcal('personal.description')}</p>
        </div>
        <GoogleCalendarConnectionCard
          variant="personal"
          connection={personalGoogleCalendarConnection}
          isLoading={gcalLoading}
          requiredPermission="calendar:connect_self"
        />
      </div>
    </div>
  )
}
