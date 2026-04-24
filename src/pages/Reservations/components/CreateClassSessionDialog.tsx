import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { Loader2, Plus, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { getProducts } from '@/services/menu.service'
import { teamService } from '@/services/team.service'
import classSessionService from '@/services/classSession.service'
import { ServiceFormDialog } from '@/pages/Menu/Services/ServiceFormDialog'
import { ProductType } from '@/types'

function buildFormSchema(venueTimezone: string) {
  return z
    .object({
      productId: z.string().min(1, 'Selecciona una clase'),
      date: z.string().min(1, 'La fecha es requerida'),
      startTime: z.string().min(1, 'La hora de inicio es requerida'),
      endTime: z.string().min(1, 'La hora de finalización es requerida'),
      capacity: z.coerce.number().int().min(1, 'El cupo mínimo es 1').optional(),
      assignedStaffId: z.string().optional(),
      internalNotes: z.string().max(2000).optional(),
      // Recurrence
      isRecurring: z.boolean().optional().default(false),
      weekdays: z.array(z.number().int().min(0).max(6)).optional().default([]),
      endMode: z.enum(['date', 'count']).optional().default('count'),
      endDate: z.string().optional(),
      occurrences: z.coerce.number().int().min(1).max(104).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.startTime && data.endTime && data.startTime >= data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La hora de finalización debe ser posterior a la de inicio',
          path: ['endTime'],
        })
      }
      if (data.date && data.startTime) {
        const startsAt = DateTime.fromISO(`${data.date}T${data.startTime}:00`, { zone: venueTimezone })
        if (startsAt.isValid) {
          const now = DateTime.now().setZone(venueTimezone)
          if (startsAt < now) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'No puedes agendar una clase en el pasado',
              path: ['startTime'],
            })
          }
        }
      }
      if (data.isRecurring) {
        if (!data.weekdays || data.weekdays.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecciona al menos un día de la semana',
            path: ['weekdays'],
          })
        }
        if (data.endMode === 'date') {
          if (!data.endDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha de fin es requerida', path: ['endDate'] })
          } else if (data.date && data.endDate < data.date) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha de fin debe ser posterior a la fecha inicial', path: ['endDate'] })
          }
        } else {
          if (!data.occurrences || data.occurrences < 1) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Indica el número de sesiones', path: ['occurrences'] })
          }
        }
      }
    })
}

type FormData = z.infer<ReturnType<typeof buildFormSchema>>

interface CreateClassSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fill date from calendar click (YYYY-MM-DD in venue timezone) */
  defaultDate?: string
  /** Pre-fill start time (HH:mm) */
  defaultStartTime?: string
}

export function CreateClassSessionDialog({ open, onOpenChange, defaultDate, defaultStartTime }: CreateClassSessionDialogProps) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { venueTimezone, formatDateISO } = useVenueDateTime()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [createClassOpen, setCreateClassOpen] = useState(false)

  const formSchema = useMemo(() => buildFormSchema(venueTimezone), [venueTimezone])

  const {
    control,
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
      isRecurring: false,
      weekdays: [],
      endMode: 'count',
      endDate: '',
      occurrences: 8,
    },
  })

  const selectedProductId = watch('productId')
  const startTime = watch('startTime')

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
        isRecurring: false,
        weekdays: [],
        endMode: 'count',
        endDate: '',
        occurrences: 8,
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

  const classProducts = useMemo(() => allProducts.filter(p => p.type === ProductType.CLASS && p.active), [allProducts])

  // Auto-fill capacity from selected product's layout or maxParticipants
  const selectedProduct = useMemo(() => classProducts.find(p => p.id === selectedProductId), [classProducts, selectedProductId])

  const hasLayout = !!(selectedProduct as any)?.layoutConfig
  const layoutSpotCount = useMemo(() => {
    const lc = (selectedProduct as any)?.layoutConfig
    if (!lc?.spots) return null
    return (lc.spots as Array<{ enabled: boolean }>).filter(s => s.enabled).length
  }, [selectedProduct])

  useEffect(() => {
    if (layoutSpotCount) {
      setValue('capacity', layoutSpotCount)
    } else if (selectedProduct && (selectedProduct as any).maxParticipants) {
      setValue('capacity', (selectedProduct as any).maxParticipants)
    }
  }, [selectedProduct, layoutSpotCount, setValue])

  // Auto-calculate endTime from startTime + product duration
  const productDuration = selectedProduct?.duration ?? null
  useEffect(() => {
    if (!productDuration || !startTime) return
    const [h, m] = startTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return
    const totalMinutes = h * 60 + m + productDuration
    const endH = Math.floor(totalMinutes / 60) % 24
    const endM = totalMinutes % 60
    const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
    setValue('endTime', endTimeStr, { shouldValidate: true })
  }, [startTime, productDuration, setValue])

  // Fetch staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['team', venueId, 'active'],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: open && !!venueId,
    staleTime: 60_000,
  })

  const staffMembers = staffData?.data ?? []

  // Create mutation — single OR bulk depending on isRecurring
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const tz = venueTimezone

      if (data.isRecurring) {
        const result = await classSessionService.createClassSessionsBulk(venueId!, {
          productId: data.productId,
          startDate: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          weekdays: data.weekdays ?? [],
          endDate: data.endMode === 'date' ? data.endDate || undefined : undefined,
          occurrences: data.endMode === 'count' ? data.occurrences : undefined,
          capacity: data.capacity ?? 1,
          assignedStaffId: data.assignedStaffId || null,
          internalNotes: data.internalNotes || null,
        })
        return { kind: 'bulk' as const, result }
      }

      const startsAtDt = DateTime.fromISO(`${data.date}T${data.startTime}:00`, { zone: tz })
      const endsAtDt = DateTime.fromISO(`${data.date}T${data.endTime}:00`, { zone: tz })

      if (!startsAtDt.isValid || !endsAtDt.isValid) {
        throw new Error('Fecha/hora inválida')
      }

      const session = await classSessionService.createClassSession(venueId!, {
        productId: data.productId,
        startsAt: startsAtDt.toUTC().toISO()!,
        endsAt: endsAtDt.toUTC().toISO()!,
        capacity: data.capacity ?? 1,
        assignedStaffId: data.assignedStaffId || null,
        internalNotes: data.internalNotes || null,
      })
      return { kind: 'single' as const, session }
    },
    onSuccess: result => {
      if (result.kind === 'bulk') {
        const { count, skipped } = result.result
        const skippedNote = skipped > 0 ? ` (${skipped} omitida${skipped === 1 ? '' : 's'} por conflicto)` : ''
        toast({
          title: t('classSession.bulkCreateSuccess', {
            defaultValue: '{{count}} clases agendadas',
            count,
          }) + skippedNote,
        })
      } else {
        toast({ title: t('classSession.createSuccess', { defaultValue: 'Clase agendada exitosamente' }) })
      }
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
            <Label htmlFor="productId">{t('classSession.fields.className', { defaultValue: 'Nombre de la clase' })}</Label>
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
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateClassOpen(true)}>
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
                  <SelectValue placeholder={t('classSession.fields.classPlaceholder', { defaultValue: 'Selecciona una clase' })} />
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
                            {p.duration && <span className="text-muted-foreground text-xs ml-1.5">{p.duration} min</span>}
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
            <Label htmlFor="date">{t('form.fields.date')}</Label>
            <Input
              id="date"
              type="date"
              min={formatDateISO(new Date())}
              {...register('date')}
              className={errors.date ? 'border-destructive' : ''}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          {/* Start / End time row */}
          <div className={productDuration ? '' : 'grid grid-cols-2 gap-3'}>
            <div className="space-y-1.5">
              <Label htmlFor="startTime">{t('form.fields.startTime')}</Label>
              <Controller
                control={control}
                name="startTime"
                render={({ field }) => (
                  <TimePicker
                    id="startTime"
                    value={field.value || undefined}
                    onChange={time => field.onChange(time)}
                    placeholder="--:--"
                    label=""
                    allowManualInput
                    error={!!errors.startTime}
                  />
                )}
              />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
              {productDuration && startTime && (
                <p className="text-[11px] text-muted-foreground">
                  {t('classSession.autoEndTime', {
                    defaultValue: 'Duración: {{duration}} min — Termina a las {{endTime}}',
                    duration: productDuration,
                    endTime: watch('endTime'),
                  })}
                </p>
              )}
            </div>
            {!productDuration && (
              <div className="space-y-1.5">
                <Label htmlFor="endTime">{t('form.fields.endTime')}</Label>
                <Controller
                  control={control}
                  name="endTime"
                  render={({ field }) => (
                    <TimePicker
                      id="endTime"
                      value={field.value || undefined}
                      onChange={time => field.onChange(time)}
                      placeholder="--:--"
                      label=""
                      allowManualInput
                      error={!!errors.endTime}
                    />
                  )}
                />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
              </div>
            )}
          </div>

          {/* Capacity + Staff row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="capacity">{t('classSession.fields.capacity', { defaultValue: 'Plazas disponibles' })}</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                placeholder="15"
                {...register('capacity')}
                className={errors.capacity ? 'border-destructive' : ''}
              />
              {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
              {hasLayout && layoutSpotCount && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t('classSession.capacityFromLayout', {
                    defaultValue: 'Auto-calculado: {{count}} lugares del mapa',
                    count: layoutSpotCount,
                  })}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assignedStaffId">{t('form.fields.staff')}</Label>
              {staffLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <Select value={watch('assignedStaffId') || 'none'} onValueChange={v => setValue('assignedStaffId', v === 'none' ? '' : v)}>
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

          {/* Recurrence */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isRecurring"
                render={({ field }) => (
                  <Checkbox
                    id="isRecurring"
                    checked={!!field.value}
                    onCheckedChange={v => field.onChange(v === true)}
                  />
                )}
              />
              <Label htmlFor="isRecurring" className="cursor-pointer text-sm font-medium">
                {t('classSession.recurrence.toggle', { defaultValue: 'Repetir esta clase' })}
              </Label>
            </div>

            {watch('isRecurring') && (
              <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('classSession.recurrence.weekdays', { defaultValue: 'Días de la semana' })}</Label>
                  <Controller
                    control={control}
                    name="weekdays"
                    render={({ field }) => (
                      <div className="flex gap-1 flex-wrap">
                        {[
                          { v: 1, l: 'L' },
                          { v: 2, l: 'M' },
                          { v: 3, l: 'X' },
                          { v: 4, l: 'J' },
                          { v: 5, l: 'V' },
                          { v: 6, l: 'S' },
                          { v: 0, l: 'D' },
                        ].map(({ v, l }) => {
                          const selected = (field.value as number[] | undefined)?.includes(v) ?? false
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                const current = (field.value as number[] | undefined) ?? []
                                field.onChange(selected ? current.filter(x => x !== v) : [...current, v].sort())
                              }}
                              className={
                                'h-8 w-8 rounded-md border text-xs font-medium transition ' +
                                (selected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-muted border-input')
                              }
                            >
                              {l}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  />
                  {errors.weekdays && <p className="text-xs text-destructive">{errors.weekdays.message as string}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('classSession.recurrence.endsOn', { defaultValue: 'Termina' })}</Label>
                    <Select value={watch('endMode')} onValueChange={v => setValue('endMode', v as 'date' | 'count')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent disablePortal>
                        <SelectItem value="count">
                          {t('classSession.recurrence.afterN', { defaultValue: 'Después de N sesiones' })}
                        </SelectItem>
                        <SelectItem value="date">
                          {t('classSession.recurrence.onDate', { defaultValue: 'En una fecha' })}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {watch('endMode') === 'date' ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="endDate" className="text-xs">{t('classSession.recurrence.endDate', { defaultValue: 'Fecha fin' })}</Label>
                      <Input id="endDate" type="date" min={watch('date') || formatDateISO(new Date())} {...register('endDate')} />
                      {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message as string}</p>}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="occurrences" className="text-xs">{t('classSession.recurrence.count', { defaultValue: '# de sesiones' })}</Label>
                      <Input id="occurrences" type="number" min={1} max={104} {...register('occurrences')} />
                      {errors.occurrences && <p className="text-xs text-destructive">{errors.occurrences.message as string}</p>}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t('classSession.recurrence.hint', {
                    defaultValue:
                      'Las sesiones se crearán todas a la misma hora. Si alguna fecha ya tiene una clase agendada, se omite automáticamente.',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Internal notes */}
          <div className="space-y-1.5">
            <Label htmlFor="internalNotes">
              {t('form.fields.internalNotes')}
              <span className="text-muted-foreground text-xs ml-1">({tCommon('optional', { defaultValue: 'opcional' })})</span>
            </Label>
            <Textarea id="internalNotes" rows={2} placeholder={t('form.placeholders.internalNotes')} {...register('internalNotes')} />
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
