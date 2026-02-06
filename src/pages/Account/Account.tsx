import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { User, Mail, Shield, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'

export default function Account() {
  const { t } = useTranslation(['account', 'common'])
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const { formatDate, formatDateTime } = useVenueDateTime()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const profileForm = useForm({
    defaultValues: {
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  })

  const passwordForm = useForm({
    defaultValues: {
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
        title: t('toast.success.title'),
        description: t('toast.success.description'),
      })
      // Clear password fields after successful update
      passwordForm.reset()
      queryClient.invalidateQueries({ queryKey: ['user'] })
      setIsDialogOpen(false)
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('toast.error.description'),
        variant: 'destructive',
      })
    },
  })

  const onProfileSubmit = (formValues: any) => {
    editProfile.mutate(formValues)
  }

  const onPasswordSubmit = (formValues: any) => {
    editProfile.mutate(formValues)
  }

  return (
    <div className="p-6">
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
        {/* Account Information Card */}
        <div className="lg:col-span-1">
          <Card>
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
                  <p className="text-sm text-muted-foreground">
                    {user?.createdAt ? formatDate(user.createdAt) : 'N/A'}
                  </p>
                </div>
              </div>

              {user?.lastLogin && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('accountInfo.lastLogin')}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(user.lastLogin)}
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
              <CardTitle>{t('editProfile.title')}</CardTitle>
              <CardDescription>{t('editProfile.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* First Name */}
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

                    {/* Last Name */}
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

                  {/* Email */}
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

                  {/* Phone */}
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

                  <Separator />

                  {/* Password Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">{t('password.title')}</h3>
                        <p className="text-sm text-muted-foreground">{t('password.description')}</p>
                      </div>
                      <Button ref={triggerRef} type="button" variant="outline" onClick={() => setIsDialogOpen(true)}>
                        {t('password.changeButton')}
                      </Button>
                    </div>
                  </div>

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

      {/* Diálogo para cambiar contraseña */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={open => {
          setIsDialogOpen(open)
          if (!open) passwordForm.reset()
        }}
      >
        <DialogContent
          onOpenAutoFocus={e => {
            // Prevent default auto-focus to avoid focusing while aria-hidden toggles
            e.preventDefault()
            // Focus the first field after the dialog is fully mounted
            setTimeout(() => {
              passwordForm.setFocus('old_password')
            }, 0)
          }}
          onCloseAutoFocus={e => {
            // Prevent default to avoid focusing an element inside an aria-hidden subtree
            e.preventDefault()
            // Restore focus to the trigger button
            triggerRef.current?.focus()
          }}
        >
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              onKeyDown={e => {
                if (e.key === 'Enter') e.stopPropagation()
              }}
              className="space-y-6"
            >
              <DialogHeader>
                <DialogTitle>{t('password.dialog.title')}</DialogTitle>
              </DialogHeader>

              {/* Password fields */}
              <FormField
                control={passwordForm.control}
                name="old_password"
                rules={{ required: t('password.dialog.currentPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password.dialog.currentPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="password"
                rules={{ required: t('password.dialog.newPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password.dialog.newPassword')}</FormLabel>
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
