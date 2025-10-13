import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { createModifier as createModifierService } from '@/services/menu.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

// Schema for the form validation
// Define form values type
type FormValues = {
  name: string
  extraPrice: number
  available: boolean
  active: boolean
}

// Schema will be created inside component to access t() function
const createFormSchema = (t: any) => z.object({
  name: z.string().min(1, { message: t('modifiers.create.nameRequired') }),
  extraPrice: z.number().min(0).default(0),
  available: z.boolean().default(true),
  active: z.boolean().default(true),
})

interface CreateModifierProps {
  venueId: string
  modifierGroupId: string
  onBack: () => void
  onSuccess: () => void
}

export default function CreateModifier({ venueId, modifierGroupId, onBack, onSuccess }: CreateModifierProps) {
  const { t } = useTranslation('menu')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Initialize the form with default values
  const form = useForm({
    resolver: zodResolver(createFormSchema(t)),
    defaultValues: {
      name: '',
      extraPrice: 0,
      available: true,
      active: true,
    },
  })

  // For creating the modifier
  const createModifierMutation = useMutation<unknown, Error, FormValues>({
    mutationFn: async formValues => {
      // Create the modifier with the modifierGroupId included
      const payload = {
        name: formValues.name,
        extraPrice: formValues.extraPrice,
        available: formValues.available,
        active: formValues.active,
      }
      return await createModifierService(venueId, modifierGroupId, payload)
    },
    onSuccess: _data => {
      toast({
        title: t('modifiers.create.toasts.created'),
        description: t('modifiers.create.toasts.createdDesc'),
      })

      // Invalidate and force refetch the relevant queries
      queryClient.invalidateQueries({
        queryKey: ['modifier-groups', venueId],
        refetchType: 'all',
      })

      queryClient.invalidateQueries({
        queryKey: ['modifier-group', modifierGroupId, venueId],
        refetchType: 'all',
      })

      queryClient.invalidateQueries({
        queryKey: ['modifiers', venueId],
        refetchType: 'all',
      })

      // Call the success callback (without arguments as defined in the interface)
      onSuccess()
    },
    onError: error => {
      toast({
        title: t('modifiers.create.toasts.createError'),
        description: error.message || t('modifiers.create.toasts.createErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Handle form submission
  function onSubmit(values: FormValues) {
    createModifierMutation.mutate(values)
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('modifiers.create.cardTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name field */}
              <FormField
                control={form.control}
                name="name"
                rules={{ required: { value: true, message: t('modifiers.create.nameRequired') } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forms.name')}</FormLabel>
                    <FormControl>
                      <div>
                        <Input placeholder={t('modifiers.create.namePlaceholder')} {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>{t('modifiers.create.nameDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price field */}
              <FormField
                control={form.control}
                name="extraPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.create.extraPrice')}</FormLabel>
                    <FormControl>
                      <div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value}
                          onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>{t('modifiers.create.extraPriceDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Available field */}
              <FormField
                control={form.control}
                name="available"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('modifiers.create.available')}</FormLabel>
                      <FormDescription>{t('modifiers.create.availableDescription')}</FormDescription>
                    </div>
                    <FormControl>
                      <div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Active field */}
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('modifiers.create.active')}</FormLabel>
                      <FormDescription>{t('modifiers.create.activeDescription')}</FormDescription>
                    </div>
                    <FormControl>
                      <div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onBack}>
              {t('forms.buttons.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? t('modifiers.create.creating') : t('modifiers.create.createButton')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
