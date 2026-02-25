import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { AlertTriangle, Loader2, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { teamService } from '@/services/team.service'
import classSessionService from '@/services/classSession.service'

const editSchema = z
  .object({
    date: z.string().min(1, 'La fecha es requerida'),
    startTime: z.string().min(1, 'La hora de inicio es requerida'),
    endTime: z.string().min(1, 'La hora de finalización es requerida'),
    capacity: z.coerce.number().int().min(1, 'El cupo mínimo es 1'),
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

type EditFormData = z.infer<typeof editSchema>

interface EditClassSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | null
}

export function EditClassSessionDialog({ open, onOpenChange, sessionId }: EditClassSessionDialogProps) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { venueTimezone } = useVenueDateTime()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  })

  // Fetch session data
  const { data: session, isLoading } = useQuery({
    queryKey: ['class-session', venueId, sessionId],
    queryFn: () => classSessionService.getClassSession(venueId!, sessionId!),
    enabled: open && !!venueId && !!sessionId,
  })

  // Fetch staff
  const { data: staffData } = useQuery({
    queryKey: ['team', venueId, 'active'],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: open && !!venueId,
    staleTime: 60_000,
  })

  const staffMembers = staffData?.data ?? []

  // Reset form when session data loads
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && session && (!wasOpenRef.current || sessionId)) {
      const start = DateTime.fromISO(session.startsAt, { zone: 'utc' }).setZone(venueTimezone)
      const end = DateTime.fromISO(session.endsAt, { zone: 'utc' }).setZone(venueTimezone)

      reset({
        date: start.toFormat('yyyy-MM-dd'),
        startTime: start.toFormat('HH:mm'),
        endTime: end.toFormat('HH:mm'),
        capacity: session.capacity,
        assignedStaffId: session.assignedStaffId || '',
        internalNotes: session.internalNotes || '',
      })
    }
    wasOpenRef.current = open
  }, [open, session, sessionId, reset, venueTimezone])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: EditFormData) => {
      const tz = venueTimezone
      const startsAtDt = DateTime.fromISO(`${data.date}T${data.startTime}:00`, { zone: tz })
      const endsAtDt = DateTime.fromISO(`${data.date}T${data.endTime}:00`, { zone: tz })

      if (!startsAtDt.isValid || !endsAtDt.isValid) {
        throw new Error('Fecha/hora inválida')
      }

      return classSessionService.updateClassSession(venueId!, sessionId!, {
        startsAt: startsAtDt.toUTC().toISO()!,
        endsAt: endsAtDt.toUTC().toISO()!,
        capacity: data.capacity,
        assignedStaffId: data.assignedStaffId || null,
        internalNotes: data.internalNotes || null,
      })
    },
    onSuccess: () => {
      toast({ title: t('classSession.editSuccess', { defaultValue: 'Clase actualizada exitosamente' }) })
      queryClient.invalidateQueries({ queryKey: ['class-sessions', venueId] })
      queryClient.invalidateQueries({ queryKey: ['reservation-calendar', venueId] })
      queryClient.invalidateQueries({ queryKey: ['class-session', venueId, sessionId] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('toasts.error')
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => classSessionService.cancelClassSession(venueId!, sessionId!),
    onSuccess: () => {
      toast({ title: t('classSession.cancelSuccess', { defaultValue: 'Clase cancelada' }) })
      queryClient.invalidateQueries({ queryKey: ['class-sessions', venueId] })
      queryClient.invalidateQueries({ queryKey: ['reservation-calendar', venueId] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('toasts.error')
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Remove attendee mutation
  const removeAttendeeMutation = useMutation({
    mutationFn: (reservationId: string) =>
      classSessionService.removeAttendee(venueId!, sessionId!, reservationId),
    onSuccess: () => {
      toast({ title: t('classSession.attendeeRemoved', { defaultValue: 'Asistente eliminado' }) })
      queryClient.invalidateQueries({ queryKey: ['class-session', venueId, sessionId] })
      queryClient.invalidateQueries({ queryKey: ['class-sessions', venueId] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('toasts.error')
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const onSubmit = handleSubmit(data => updateMutation.mutate(data))
  const isPending = updateMutation.isPending
  const isCancelled = session?.status === 'CANCELLED'
  const isCompleted = session?.status === 'COMPLETED'
  const isReadOnly = isCancelled || isCompleted

  // Attendees are stored as reservations on the session
  const attendees = useMemo(() => (session as any)?.reservations ?? [], [session])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isLoading ? (
              tCommon('loading')
            ) : (
              <>
                {session?.product.name}
                {isCancelled && (
                  <Badge variant="destructive" className="ml-2">
                    {t('classSession.statusCancelled', { defaultValue: 'Cancelada' })}
                  </Badge>
                )}
                {isCompleted && (
                  <Badge variant="secondary" className="ml-2">
                    {t('classSession.statusCompleted', { defaultValue: 'Completada' })}
                  </Badge>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : session ? (
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Enrollment summary */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="font-medium">
                  {session.enrolled}/{session.capacity}
                </span>
                <span className="text-muted-foreground text-sm ml-1.5">
                  {t('classSession.fields.capacity', { defaultValue: 'Plazas disponibles' }).toLowerCase()}
                </span>
              </div>
              {session.enrolled >= session.capacity && (
                <Badge variant="outline" className="ml-auto border-violet-500/40 text-violet-700 dark:text-violet-300">
                  {t('classSession.full')}
                </Badge>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">{t('form.fields.date')}</Label>
              <Input
                id="edit-date"
                type="date"
                {...register('date')}
                disabled={isReadOnly}
                className={errors.date ? 'border-destructive' : ''}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>

            {/* Start / End time row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-startTime">{t('form.fields.startTime')}</Label>
                <Input
                  id="edit-startTime"
                  type="time"
                  {...register('startTime')}
                  disabled={isReadOnly}
                  className={errors.startTime ? 'border-destructive' : ''}
                />
                {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-endTime">{t('form.fields.endTime')}</Label>
                <Input
                  id="edit-endTime"
                  type="time"
                  {...register('endTime')}
                  disabled={isReadOnly}
                  className={errors.endTime ? 'border-destructive' : ''}
                />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
              </div>
            </div>

            {/* Capacity + Staff row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-capacity">
                  {t('classSession.fields.capacity', { defaultValue: 'Plazas disponibles' })}
                </Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  min={Math.max(1, session.enrolled)}
                  {...register('capacity')}
                  disabled={isReadOnly}
                  className={errors.capacity ? 'border-destructive' : ''}
                />
                {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-staff">{t('form.fields.staff')}</Label>
                <Select
                  value={watch('assignedStaffId') || 'none'}
                  onValueChange={v => setValue('assignedStaffId', v === 'none' ? '' : v, { shouldDirty: true })}
                  disabled={isReadOnly}
                >
                  <SelectTrigger id="edit-staff">
                    <SelectValue placeholder={t('noStaff')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noStaff')}</SelectItem>
                    {staffMembers.map(s => (
                      <SelectItem key={s.staffId} value={s.staffId}>
                        {s.firstName} {s.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Internal notes */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">
                {t('form.fields.internalNotes')}
                <span className="text-muted-foreground text-xs ml-1">
                  ({tCommon('optional', { defaultValue: 'opcional' })})
                </span>
              </Label>
              <Textarea
                id="edit-notes"
                rows={2}
                placeholder={t('form.placeholders.internalNotes')}
                {...register('internalNotes')}
                disabled={isReadOnly}
              />
            </div>

            {/* Attendees section */}
            {attendees.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t('classSession.attendees', { defaultValue: 'Asistentes' })} ({attendees.length})
                  </Label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {attendees.map((a: any) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-medium truncate block">
                            {a.customer
                              ? `${a.customer.firstName} ${a.customer.lastName}`
                              : a.guestName || t('unnamedGuest', { defaultValue: 'Sin nombre' })}
                          </span>
                          {(a.guestPhone || a.customer?.phone) && (
                            <span className="text-xs text-muted-foreground">{a.guestPhone || a.customer?.phone}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {a.partySize > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {a.partySize}
                            </Badge>
                          )}
                          {!isReadOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeAttendeeMutation.mutate(a.id)}
                              disabled={removeAttendeeMutation.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              {/* Cancel session button (destructive, with confirmation) */}
              {!isReadOnly && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="sm" className="mr-auto gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('classSession.cancelSession', { defaultValue: 'Cancelar clase' })}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        {t('classSession.cancelConfirmTitle', { defaultValue: '¿Cancelar esta clase?' })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {session.enrolled > 0
                          ? t('classSession.cancelConfirmWithAttendees', {
                              defaultValue: 'Hay {{count}} asistente(s) registrado(s). Se les notificará de la cancelación.',
                              count: session.enrolled,
                            })
                          : t('classSession.cancelConfirmEmpty', {
                              defaultValue: 'Esta acción no se puede deshacer.',
                            })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t('classSession.confirmCancel', { defaultValue: 'Sí, cancelar' })}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  {isReadOnly ? tCommon('close', { defaultValue: 'Cerrar' }) : tCommon('cancel')}
                </Button>
                {!isReadOnly && (
                  <Button type="submit" disabled={isPending || !isDirty}>
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t('actions.save')}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
