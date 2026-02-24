import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, CalendarDays, User, MapPin, MessageSquare } from 'lucide-react'
import { DateTime } from 'luxon'
import { useMemo, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import reservationService from '@/services/reservation.service'
import type { AvailableSlot } from '@/types/reservation'

const createSchema = z
  .object({
    date: z.string().min(1, 'Required'),
    startTime: z.string().min(1, 'Required'),
    endTime: z.string().min(1, 'Required'),
    duration: z.coerce.number().min(15),
    partySize: z.coerce.number().min(1),
    // Guest
    guestMode: z.enum(['existing', 'new']),
    customerId: z.string().optional(),
    guestName: z.string().optional(),
    guestPhone: z.string().optional(),
    guestEmail: z.string().email().optional().or(z.literal('')),
    // Assignment
    tableId: z.string().optional(),
    assignedStaffId: z.string().optional(),
    // Additional
    specialRequests: z.string().optional(),
    internalNotes: z.string().optional(),
  })
  .refine(
    data => {
      if (data.guestMode === 'new' && !data.guestName) return false
      return true
    },
    { message: 'Guest name is required', path: ['guestName'] },
  )

type CreateFormData = z.infer<typeof createSchema>

// --- Reusable form (used in both standalone page and modal) ---

interface CreateReservationFormProps {
  defaultDate?: string
  defaultStartTime?: string
  onSuccess?: (reservation: any) => void
  onCancel?: () => void
  /** Assign submitRef.current = handleSubmit callback so parent can trigger submit */
  submitRef?: MutableRefObject<(() => void) | null>
}

export function CreateReservationForm({ defaultDate, defaultStartTime, onSuccess, onCancel, submitRef }: CreateReservationFormProps) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { venueId, fullBasePath } = useCurrentVenue()
  const { formatDateISO, venueTimezone } = useVenueDateTime()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('new')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      date: defaultDate || formatDateISO(new Date()),
      startTime: defaultStartTime || '',
      endTime: '',
      duration: 60,
      partySize: 2,
      guestMode: 'new',
      guestName: '',
      guestPhone: '',
      guestEmail: '',
      tableId: '',
      assignedStaffId: '',
      specialRequests: '',
      internalNotes: '',
    },
  })

  const watchDate = watch('date')
  const watchPartySize = watch('partySize')
  const watchDuration = watch('duration')

  // Fetch availability for selected date
  const { data: availabilityData } = useQuery({
    queryKey: ['reservation-availability', venueId, watchDate, watchPartySize, watchDuration],
    queryFn: () =>
      reservationService.getAvailability(venueId, {
        date: watchDate,
        partySize: watchPartySize || undefined,
        duration: watchDuration || undefined,
      }),
    enabled: !!watchDate,
  })

  const availableSlots = availabilityData?.slots || []

  // When a slot is selected, update start/end time and available tables
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot)
    // Extract time from ISO string
    const start = DateTime.fromISO(slot.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(slot.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    setValue('startTime', `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`)
    setValue('endTime', `${String(end.hour).padStart(2, '0')}:${String(end.minute).padStart(2, '0')}`)
    // Auto-select first available table
    if (slot.availableTables.length > 0) {
      setValue('tableId', slot.availableTables[0].id)
    }
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => {
      const startsAtDt = DateTime.fromISO(`${data.date}T${data.startTime}:00`, { zone: venueTimezone })
      const endsAtDt = DateTime.fromISO(`${data.date}T${data.endTime}:00`, { zone: venueTimezone })

      if (!startsAtDt.isValid || !endsAtDt.isValid) {
        throw new Error('Invalid reservation datetime')
      }

      const startsAt = startsAtDt.toUTC().toISO()
      const endsAt = endsAtDt.toUTC().toISO()

      if (!startsAt || !endsAt) {
        throw new Error('Invalid reservation datetime')
      }

      return reservationService.createReservation(venueId, {
        startsAt,
        endsAt,
        duration: data.duration,
        partySize: data.partySize,
        channel: 'DASHBOARD',
        customerId: data.guestMode === 'existing' && data.customerId ? data.customerId : undefined,
        guestName: data.guestMode === 'new' ? data.guestName : undefined,
        guestPhone: data.guestPhone || undefined,
        guestEmail: data.guestEmail || undefined,
        tableId: data.tableId || undefined,
        assignedStaffId: data.assignedStaffId || undefined,
        specialRequests: data.specialRequests || undefined,
        internalNotes: data.internalNotes || undefined,
      })
    },
    onSuccess: reservation => {
      toast({ title: t('toasts.createSuccess') })
      queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
      if (onSuccess) {
        onSuccess(reservation)
      } else {
        navigate(`${fullBasePath}/reservations/${reservation.id}`)
      }
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Expose submit to parent via ref
  const onSubmit = handleSubmit(data => createMutation.mutate(data))
  if (submitRef) {
    submitRef.current = onSubmit
  }

  // Group slots by hour for display
  const slotsByHour = useMemo(() => {
    const grouped: Record<string, AvailableSlot[]> = {}
    for (const slot of availableSlots) {
      const hour = DateTime.fromISO(slot.startsAt, { zone: 'utc' }).setZone(venueTimezone).hour
      const key = `${String(hour).padStart(2, '0')}:00`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(slot)
    }
    return grouped
  }, [availableSlots, venueTimezone])

  return (
    <div className="space-y-6">
      {/* Date & Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {t('form.sections.dateTime')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('form.fields.date')}</Label>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('form.fields.duration')}</Label>
              <Select value={String(watch('duration'))} onValueChange={v => setValue('duration', Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 45, 60, 90, 120, 150, 180].map(min => (
                    <SelectItem key={min} value={String(min)}>
                      {t('form.fields.durationMin', { min })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('form.fields.partySize')}</Label>
              <Input type="number" min={1} {...register('partySize')} />
              {errors.partySize && <p className="text-sm text-destructive">{errors.partySize.message}</p>}
            </div>
          </div>

          {/* Time Slot Picker */}
          {availableSlots.length > 0 ? (
            <div className="space-y-3">
              <Label>{t('form.fields.startTime')}</Label>
              <div className="space-y-2">
                {Object.entries(slotsByHour).map(([hour, slots]) => (
                  <div key={hour} className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-12 pt-1.5 flex-shrink-0">{hour}</span>
                    <div className="flex flex-wrap gap-2">
                      {slots.map(slot => {
                        const start = DateTime.fromISO(slot.startsAt, { zone: 'utc' }).setZone(venueTimezone)
                        const timeStr = `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`
                        const isSelected = selectedSlot?.startsAt === slot.startsAt
                        return (
                          <Button
                            key={slot.startsAt}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-full"
                            onClick={() => handleSlotSelect(slot)}
                          >
                            {timeStr}
                            <Badge variant="secondary" className="ml-1.5 text-xs">
                              {slot.availableTables.length}
                            </Badge>
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : watchDate ? (
            <p className="text-sm text-muted-foreground">{t('form.noTablesAvailable')}</p>
          ) : null}

          {/* Manual time override */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('form.fields.startTime')}</Label>
              <Input type="time" {...register('startTime')} />
              {errors.startTime && <p className="text-sm text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('form.fields.endTime')}</Label>
              <Input type="time" {...register('endTime')} />
              {errors.endTime && <p className="text-sm text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guest Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('form.sections.guest')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={guestMode}
            onValueChange={v => {
              setGuestMode(v as any)
              setValue('guestMode', v as any)
            }}
          >
            <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
              <TabsTrigger value="new" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
                {t('form.guestMode.new')}
              </TabsTrigger>
              <TabsTrigger value="existing" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
                {t('form.guestMode.existing')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {guestMode === 'new' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.fields.guestName')}</Label>
                <Input {...register('guestName')} placeholder={t('form.placeholders.guestName')} />
                {errors.guestName && <p className="text-sm text-destructive">{t('form.validation.guestNameRequired')}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('form.fields.guestPhone')}</Label>
                <Input {...register('guestPhone')} placeholder={t('form.placeholders.guestPhone')} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>{t('form.fields.guestEmail')}</Label>
                <Input type="email" {...register('guestEmail')} placeholder={t('form.placeholders.guestEmail')} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('form.fields.customer')}</Label>
              <Input {...register('customerId')} placeholder={t('form.placeholders.searchCustomer')} />
              <p className="text-xs text-muted-foreground">{t('form.placeholders.searchCustomer')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('form.sections.assignment')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table selection from available slot */}
          <div className="space-y-2">
            <Label>{t('form.fields.table')}</Label>
            {selectedSlot && selectedSlot.availableTables.length > 0 ? (
              <Select value={watch('tableId') || ''} onValueChange={v => setValue('tableId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectTable')} />
                </SelectTrigger>
                <SelectContent>
                  {selectedSlot.availableTables.map(table => (
                    <SelectItem key={table.id} value={table.id}>
                      {t('form.tableCapacity', { number: table.number, capacity: table.capacity })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">{t('form.noTablesAvailable')}</p>
            )}
          </div>

          {/* Staff from available slot */}
          {selectedSlot && selectedSlot.availableStaff.length > 0 && (
            <div className="space-y-2">
              <Label>{t('form.fields.staff')}</Label>
              <Select value={watch('assignedStaffId') || ''} onValueChange={v => setValue('assignedStaffId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectStaff')} />
                </SelectTrigger>
                <SelectContent>
                  {selectedSlot.availableStaff.map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('form.sections.additional')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('form.fields.specialRequests')}</Label>
            <Textarea {...register('specialRequests')} placeholder={t('form.placeholders.specialRequests')} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{t('form.fields.internalNotes')}</Label>
            <Textarea {...register('internalNotes')} placeholder={t('form.placeholders.internalNotes')} rows={3} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Standalone page wrapper (existing route) ---

export default function CreateReservation() {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const submitRef = useMemo<MutableRefObject<(() => void) | null>>(() => ({ current: null }), [])

  return (
    <div className="p-4 bg-background text-foreground max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${fullBasePath}/reservations`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t('form.createTitle')}</h1>
        </div>
        <Button onClick={() => submitRef.current?.()}>{t('actions.save')}</Button>
      </div>

      <CreateReservationForm submitRef={submitRef} />
    </div>
  )
}
