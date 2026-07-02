import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function SecuritySettings() {
  const { t } = useTranslation(['settings', 'account', 'common'])
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const { toast } = useToast()

  const passwordForm = useForm({
    defaultValues: { old_password: '', password: '' },
  })

  const changePassword = useMutation({
    mutationFn: async (formValues: { old_password: string; password: string }) => {
      const payload = { id: user?.id, old_password: formValues.old_password, password: formValues.password }
      const response = await api.patch(`/api/v1/dashboard/${venueId}/account`, payload)
      return response.data
    },
    onSuccess: () => {
      toast({ title: t('account:toast.success.title'), description: t('account:toast.success.description') })
      passwordForm.reset()
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('account:toast.error.description'),
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="p-6 max-w-2xl" data-tour="settings-security-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Lock className="h-6 w-6" />
          {t('settings:security.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('settings:security.subtitle')}</p>
      </div>

      <Card className="border-input">
        <CardHeader>
          <CardTitle>{t('account:password.title')}</CardTitle>
          <CardDescription>{t('account:password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(v => changePassword.mutate(v))} className="space-y-6">
              <FormField
                control={passwordForm.control}
                name="old_password"
                rules={{ required: t('account:password.dialog.currentPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings:security.currentPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="password"
                rules={{ required: t('account:password.dialog.newPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings:security.newPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? t('common:saving') : t('settings:security.submit')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
