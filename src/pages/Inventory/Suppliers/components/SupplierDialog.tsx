import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supplierService, type Supplier, type CreateSupplierDto } from '@/services/supplier.service'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface SupplierDialogProps {
  open: boolean
  onClose: () => void
  supplier: Supplier | null
}

export function SupplierDialog({ open, onClose, supplier }: SupplierDialogProps) {
  const { venueId } = useCurrentVenue()
  const { t } = useTranslation('suppliers')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Zod schema - only name is required
  const schema = z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    contactName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    zipCode: z.string().optional(),
    notes: z.string().optional(),
  })

  type FormData = z.infer<typeof schema>

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          contactName: supplier.contactName || '',
          phone: supplier.phone || '',
          email: supplier.email || '',
          zipCode: supplier.zipCode || '',
          notes: supplier.notes || '',
        }
      : {
          name: '',
          contactName: '',
          phone: '',
          email: '',
          zipCode: '',
          notes: '',
        },
  })

  // Reset form when supplier changes or dialog closes
  useEffect(() => {
    if (open && supplier) {
      reset({
        name: supplier.name,
        contactName: supplier.contactName || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        zipCode: supplier.zipCode || '',
        notes: supplier.notes || '',
      })
    } else if (!open) {
      reset({
        name: '',
        contactName: '',
        phone: '',
        email: '',
        zipCode: '',
        notes: '',
      })
    }
  }, [open, supplier, reset])

  // Mutation
  const mutation = useMutation({
    mutationFn: (data: CreateSupplierDto) =>
      supplier
        ? supplierService.updateSupplier(venueId, supplier.id, data)
        : supplierService.createSupplier(venueId, data),
    onSuccess: () => {
      toast({
        title: supplier ? t('updateMessages.success') : t('createMessages.success'),
      })
      queryClient.invalidateQueries({ queryKey: ['suppliers', venueId] })
      onClose()
    },
    onError: (error: Error) => {
      toast({
        title: supplier ? t('updateMessages.error') : t('createMessages.error'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: FormData) => {
    // Transform form data to DTO, filtering out empty strings
    const dto: CreateSupplierDto = {
      name: data.name,
      ...(data.contactName && { contactName: data.contactName }),
      ...(data.phone && { phone: data.phone }),
      ...(data.email && { email: data.email }),
      ...(data.zipCode && { zipCode: data.zipCode }),
      ...(data.notes && { notes: data.notes }),
    }
    mutation.mutate(dto)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{supplier ? t('edit') : t('create')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Supplier Name - REQUIRED */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('fields.name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('fields.namePlaceholder')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Account Number - OPTIONAL */}
          <div className="space-y-2">
            <Label htmlFor="contactName">{t('fields.contactName')}</Label>
            <Input
              id="contactName"
              {...register('contactName')}
              placeholder={t('fields.contactNamePlaceholder')}
            />
          </div>

          {/* Notes - OPTIONAL */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('fields.notes')}</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder={t('fields.notesPlaceholder')}
              rows={3}
            />
          </div>

          {/* Phone and Email - OPTIONAL (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('fields.phone')}</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder={t('fields.phonePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('fields.email')}</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder={t('fields.emailPlaceholder')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* ZIP Code - OPTIONAL */}
          <div className="space-y-2">
            <Label htmlFor="zipCode">{t('fields.zipCode')}</Label>
            <Input
              id="zipCode"
              {...register('zipCode')}
              placeholder={t('fields.zipCodePlaceholder')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
