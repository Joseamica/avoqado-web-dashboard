import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { User, Mail, Shield, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'

export default function Account() {
  const { t, i18n } = useTranslation(['translation', 'common'])
  const { venueId } = useCurrentVenue()
  const localeCode = getIntlLocale(i18n.language)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const form = useForm({
    defaultValues: {
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      old_password: '',
      password: '',
    },
  })

  const editProfile = useMutation({
    mutationFn: async (formValues: any) => {
      // Only send fields that have values
      const payload: any = {
        id: user?.id,
      }
      
      if (formValues.firstName) payload.firstName = formValues.firstName
      if (formValues.lastName) payload.lastName = formValues.lastName  
      if (formValues.email) payload.email = formValues.email
      if (formValues.phone) payload.phone = formValues.phone
      
      // Only send password fields if both are provided (for password change)
      if (formValues.old_password && formValues.password) {
        payload.old_password = formValues.old_password
        payload.password = formValues.password
      }

      const response = await api.patch(`/api/v1/dashboard/${venueId}/account`, payload)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('account.toast.success.title'),
        description: t('account.toast.success.description'),
      })
      // Clear password fields after successful update
      form.setValue('old_password', '')
      form.setValue('password', '')
      queryClient.invalidateQueries({ queryKey: ['user'] })
      setIsDialogOpen(false)
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('account.toast.error.description'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (formValues: any) => {
    editProfile.mutate(formValues)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <User className="h-6 w-6" />
          {t('account.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('account.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Information Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('account.accountInfo.title')}
              </CardTitle>
              <CardDescription>{t('account.accountInfo.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('account.accountInfo.email')}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('account.accountInfo.role')}</p>
                  <Badge variant="secondary">{user?.role}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('account.accountInfo.memberSince')}</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(localeCode, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>

              {user?.lastLogin && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('account.accountInfo.lastLogin')}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(user.lastLogin).toLocaleString(localeCode, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Profile Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('account.editProfile.title')}</CardTitle>
              <CardDescription>{t('account.editProfile.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* First Name */}
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('account.editProfile.firstName')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Last Name */}
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('account.editProfile.lastName')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('account.editProfile.email')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('account.editProfile.phone')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Password Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">{t('account.password.title')}</h3>
                        <p className="text-sm text-muted-foreground">{t('account.password.description')}</p>
                      </div>
                      <Button ref={triggerRef} type="button" variant="outline" onClick={() => setIsDialogOpen(true)}>
                        {t('account.password.changeButton')}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button type="submit" disabled={editProfile.isPending}>
                      {editProfile.isPending ? t('common:saving') : t('common:save')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => form.reset()} disabled={editProfile.isPending}>
                      {t('common:cancel')}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Diálogo para cambiar contraseña */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          onOpenAutoFocus={e => {
            // Prevent default auto-focus to avoid focusing while aria-hidden toggles
            e.preventDefault()
            // Focus the first field after the dialog is fully mounted
            setTimeout(() => {
              form.setFocus('old_password')
            }, 0)
          }}
          onCloseAutoFocus={e => {
            // Prevent default to avoid focusing an element inside an aria-hidden subtree
            e.preventDefault()
            // Restore focus to the trigger button
            triggerRef.current?.focus()
          }}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <DialogHeader>
                <DialogTitle>{t('account.password.dialog.title')}</DialogTitle>
              </DialogHeader>

              {/* Password fields */}
              <FormField
                control={form.control}
                name="old_password"
                rules={{ required: t('account.password.dialog.currentPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('account.password.dialog.currentPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                rules={{ required: t('account.password.dialog.newPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('account.password.dialog.newPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                {t('common:save')}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
