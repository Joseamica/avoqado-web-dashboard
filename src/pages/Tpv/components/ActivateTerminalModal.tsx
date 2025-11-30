import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import api from '@/api'

interface ActivateTerminalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  terminalId: string | null
  onSuccess?: () => void
}

interface ActivationFormData {
  serialNumber: string
}

export function ActivateTerminalModal({ open, onOpenChange, terminalId, onSuccess }: ActivateTerminalModalProps) {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { venueId } = useCurrentVenue()

  const form = useForm<ActivationFormData>({
    defaultValues: {
      serialNumber: '',
    },
  })

  // Activate terminal mutation
  const activateMutation = useMutation({
    mutationFn: async (data: ActivationFormData) => {
      if (!terminalId) throw new Error('No terminal ID provided')

      const response = await api.patch(
        `/api/v1/dashboard/venues/${venueId}/tpvs/${terminalId}/activate`,
        { serialNumber: data.serialNumber }
      )
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('activation.success.title', { defaultValue: 'Terminal activado' }),
        description: t('activation.success.description', { defaultValue: 'El terminal ha sido activado exitosamente' }),
      })

      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      form.reset()
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message

      if (errorMessage.includes('serial number already exists') || errorMessage.includes('unique constraint')) {
        toast({
          title: tCommon('common.error'),
          description: t('activation.errors.duplicateSerial', { defaultValue: 'Este número de serie ya está registrado' }),
          variant: 'destructive',
        })
      } else {
        toast({
          title: tCommon('common.error'),
          description: t('activation.errors.activationFailed', { defaultValue: 'No se pudo activar el terminal' }),
          variant: 'destructive',
        })
      }
    },
  })

  const onSubmit = (data: ActivationFormData) => {
    activateMutation.mutate(data)
  }

  const handleClose = () => {
    if (!activateMutation.isPending) {
      form.reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            {t('activation.title', { defaultValue: 'Activar Terminal' })}
          </DialogTitle>
          <DialogDescription>
            {t('activation.description', { defaultValue: 'Ingresa el número de serie físico del dispositivo PAX para activar el terminal.' })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serialNumber"
              rules={{
                required: { value: true, message: t('activation.validation.serialRequired', { defaultValue: 'El número de serie es requerido' }) },
                minLength: { value: 8, message: t('activation.validation.serialMinLength', { defaultValue: 'El número de serie debe tener al menos 8 caracteres' }) },
                maxLength: { value: 50, message: t('activation.validation.serialMaxLength', { defaultValue: 'El número de serie no puede exceder 50 caracteres' }) },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('activation.serialNumber', { defaultValue: 'Número de Serie' })}</FormLabel>
                  <FormDescription>
                    {t('activation.serialNumberDesc', { defaultValue: 'Ingresa el número de serie impreso en la parte posterior del dispositivo PAX' })}
                  </FormDescription>
                  <FormControl>
                    <Input
                      placeholder={t('activation.serialNumberPlaceholder', { defaultValue: 'Ej: PAX-A910S-12345678' })}
                      {...field}
                      className="font-mono"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={activateMutation.isPending}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={activateMutation.isPending}>
                {activateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('activation.activate', { defaultValue: 'Activar' })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
