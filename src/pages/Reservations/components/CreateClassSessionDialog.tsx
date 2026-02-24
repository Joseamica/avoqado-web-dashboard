import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { Loader2, Plus, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { getProducts } from '@/services/menu.service'
import { teamService } from '@/services/team.service'
import classSessionService from '@/services/classSession.service'
import { ServiceFormDialog } from '@/pages/Menu/Services/ServiceFormDialog'
import { ProductType } from '@/types'

const formSchema = z
  .object({
    productId: z.string().min(1, 'Selecciona una clase'),
    date: z.string().min(1, 'La fecha es requerida'),
    startTime: z.string().min(1, 'La hora de inicio es requerida'),
    endTime: z.string().min(1, 'La hora de finalización es requerida'),
    capacity: z.coerce.number().int().min(1, 'El cupo mínimo es 1').optional(),
    assignedStaffId: z.string().optional(),
    internalNotes: z.string().max(2000).optional(),
  })
  .refine(
    data => {
      if (!data.startTime || !data.endTime) return true
      return data.startTime < data.endTime
    },
    { message: 'La hora de finalización debe ser posterior a la de inicio', path: ['endTime'] },
  )

type FormData = z.infer<typeof formSchema>

interface CreateClassSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fill date from calendar click (YYYY-MM-DD in venue timezone) */
  defaultDate?: string
  /** Pre-fill start time (HH:mm) */
  defaultStartTime?: string
}

export function CreateClassSessionDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultStartTime,
}: CreateClassSessionDialogProps) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { venueTimezone, formatDateISO } = useVenueDateTime()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [createClassOpen, setCreateClassOpen] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      date: defaultDate ?? formatDateISO(new Date()),
      startTime: defaultStartTime ?? '09:00',
      endTime: '',
      capacity: undefined,
      assignedStaffId: '',
      internalNotes: '',
    },
  })

  const selectedProductId = watch('productId')

  // When an inline class is created, auto-select it and refresh products list
  const handleClassCreated = useCallback(
    (productId: string) => {
      if (productId) {
        setValue('productId', productId, { shouldValidate: true })
      }
      // Force refetch products so the new class appears in the dropdown
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
    [setValue, queryClient, venueId],
  )

  // Reset form only when dialog transitions from closed → open
  // (not on every render — formatDateISO creates a new ref each render which
  // would otherwise cause a continuous reset loop, reverting user input)
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      reset({
        productId: '',
        date: defaultDate ?? formatDateISO(new Date()),
        startTime: defaultStartTime ?? '09:00',
        endTime: '',
        capacity: undefined,
        assignedStaffId: '',
        internalNotes: '',
      })
    }
    wasOpenRef.current = open
  }, [open, defaultDate, defaultStartTime, reset, formatDateISO])

  // Fetch CLASS products
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', venueId, 'all'],
    queryFn: () => getProducts(venueId!),
    enabled: open && !!venueId,
    staleTime: 60_000,
  })

  const classProducts = useMemo(
    () => allProducts.filter(p => p.type === ProductType.CLASS && p.active),
    [allProducts],
  )

  // Auto-fill capacity from selected product's maxParticipants
  const selectedProduct = useMemo(
    () => classProducts.find(p => p.id === selectedProductId),
    [classProducts, selectedProductId],
  )

  useEffect(() => {
    if (selectedProduct && (selectedProduct as any).maxParticipants) {
      setValue('capacity', (selectedProduct as any).maxParticipants)
    }
  }, [selectedProduct, setValue])

  // Fetch staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['team', venueId, 'active'],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: open && !!venueId,
    staleTime: 60_000,
  })

  const staffMembers = staffData?.data ?? []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      const date = data.date
      const tz = venueTimezone

      const startsAtDt = DateTime.fromISO(`${date}T${data.startTime}:00`, { zone: tz })
      const endsAtDt = DateTime.fromISO(`${date}T${data.endTime}:00`, { zone: tz })

      if (!startsAtDt.isValid || !endsAtDt.isValid) {
        throw new Error('Fecha/hora inválida')
      }

      const startsAt = startsAtDt.toUTC().toISO()!
      const endsAt = endsAtDt.toUTC().toISO()!

      return classSessionService.createClassSession(venueId!, {
        productId: data.productId,
        startsAt,
        endsAt,
        capacity: data.capacity ?? 1,
        assignedStaffId: data.assignedStaffId || null,
        internalNotes: data.internalNotes || null,
      })
    },
    onSuccess: () => {
      toast({ title: t('classSession.createSuccess', { defaultValue: 'Clase agendada exitosamente' }) })
      queryClient.invalidateQueries({ queryKey: ['class-sessions', venueId] })
      queryClient.invalidateQueries({ queryKey: ['reservation-calendar', venueId] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('toasts.error')
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const onSubmit = handleSubmit(data => createMutation.mutate(data))

  const isPending = createMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('classSession.createTitle', { defaultValue: 'Agendar clase' })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Class (product) — like Square's dropdown with "+ Añadir nueva clase" */}
          <div className="space-y-1.5">
            <Label htmlFor="productId">
              {t('classSession.fields.className', { defaultValue: 'Nombre de la clase' })}
            </Label>
            {productsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tCommon('loading')}
              </div>
            ) : classProducts.length === 0 && !selectedProductId ? (
              /* Prominent empty state with CTA — hidden if a class was just created (pending refetch) */
              <div className="rounded-lg border border-dashed border-input p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('classSession.noClassProducts', {
                    defaultValue: 'No hay clases creadas. Crea un producto tipo "Clase" primero.',
                  })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCreateClassOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('classSession.createClass', { defaultValue: 'Crear clase' })}
                </Button>
              </div>
            ) : (
              <Select
                value={watch('productId')}
                onValueChange={v => {
                  if (v === '__create__') {
                    setCreateClassOpen(true)
                    return
                  }
                  setValue('productId', v, { shouldValidate: true })
                }}
              >
                <SelectTrigger id="productId" className={errors.productId ? 'border-destructive' : ''}>
                  <SelectValue
                    placeholder={t('classSession.fields.classPlaceholder', { defaultValue: 'Selecciona una clase' })}
                  />
                </SelectTrigger>
                <SelectContent disablePortal>
                  {/* "+ Añadir nueva clase" at top like Square */}
                  <SelectItem value="__create__" className="gap-2 text-primary font-medium">
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      {t('classSession.addClass', { defaultValue: 'Añadir nueva clase' })}
                    </span>
                  </SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>{t('classSession.allClasses', { defaultValue: 'Todas las clases' })}</SelectLabel>
                    {classProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>
                            {p.name}
                            {p.duration && (
                              <span className="text-muted-foreground text-xs ml-1.5">
                                {p.duration} min
                              </span>
                            )}
                          </span>
                          {Number(p.price) > 0 ? (
                            <span className="text-muted-foreground text-xs">${Number(p.price).toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t('classSession.free', { defaultValue: 'Gratis' })}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            {errors.productId && <p className="text-xs text-destructive">{errors.productId.message}</p>}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="date">
              {t('form.fields.date')}
            </Label>
            <Input
              id="date"
              type="date"
              {...register('date')}
              className={errors.date ? 'border-destructive' : ''}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          {/* Start / End time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">
                {t('form.fields.startTime')}
              </Label>
              <Input
                id="startTime"
                type="time"
                {...register('startTime')}
                className={errors.startTime ? 'border-destructive' : ''}
              />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">
                {t('form.fields.endTime')}
              </Label>
              <Input
                id="endTime"
                type="time"
                {...register('endTime')}
                className={errors.endTime ? 'border-destructive' : ''}
              />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>

          {/* Capacity + Staff row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="capacity">
                {t('classSession.fields.capacity', { defaultValue: 'Plazas disponibles' })}
              </Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                placeholder="15"
                {...register('capacity')}
                className={errors.capacity ? 'border-destructive' : ''}
              />
              {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assignedStaffId">
                {t('form.fields.staff')}
              </Label>
              {staffLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <Select
                  value={watch('assignedStaffId') || 'none'}
                  onValueChange={v => setValue('assignedStaffId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="assignedStaffId">
                    <SelectValue placeholder={t('noStaff')} />
                  </SelectTrigger>
                  <SelectContent disablePortal>
                    <SelectItem value="none">{t('noStaff')}</SelectItem>
                    {staffMembers.map(s => (
                      <SelectItem key={s.staffId} value={s.staffId}>
                        {s.firstName} {s.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Internal notes */}
          <div className="space-y-1.5">
            <Label htmlFor="internalNotes">
              {t('form.fields.internalNotes')}
              <span className="text-muted-foreground text-xs ml-1">({tCommon('optional', { defaultValue: 'opcional' })})</span>
            </Label>
            <Textarea
              id="internalNotes"
              rows={2}
              placeholder={t('form.placeholders.internalNotes')}
              {...register('internalNotes')}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !watch('productId')}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('classSession.schedule', { defaultValue: 'Agendar' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Full-screen ServiceFormDialog for creating a CLASS product inline */}
      <ServiceFormDialog
        open={createClassOpen}
        onOpenChange={setCreateClassOpen}
        mode="create"
        serviceType="CLASS"
        onSuccess={handleClassCreated}
      />
    </Dialog>
  )
}
