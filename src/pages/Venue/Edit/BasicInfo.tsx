import api from '@/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { isDemoVenueStatus } from '@/types/superadmin'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertCircle, FileText, Loader2, Clock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import countryList from 'react-select-country-list'
import { z } from 'zod'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { useVenueEditActions } from '../VenueEditLayout'
import { BusinessType } from '@/types'

const basicInfoFormSchema = z.object({
  // Required fields
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
  address: z.string().min(1, { message: 'La dirección es requerida.' }),
  city: z.string().min(1, { message: 'La ciudad es requerida.' }),
  state: z.string().min(1, { message: 'El estado es requerido.' }),
  country: z.string().min(1, { message: 'El país es requerido.' }).default('MX'),
  zipCode: z.string().min(1, { message: 'El código postal es requerido.' }),

  // Optional fields
  type: z.nativeEnum(BusinessType).default(BusinessType.RESTAURANT),
  timezone: z.string().default('America/Mexico_City'),
  currency: z.string().default('MXN'),
  enableShifts: z.boolean().default(true).optional(),
  requireClockInPhoto: z.boolean().default(false).optional(),
  // Auto Clock-Out settings
  autoClockOutEnabled: z.boolean().default(false).optional(),
  autoClockOutTime: z.string().nullable().optional(),
  maxShiftDurationEnabled: z.boolean().default(false).optional(),
  maxShiftDurationHours: z.number().min(1).max(24).default(12).optional(),
})

type BasicInfoFormValues = z.infer<typeof basicInfoFormSchema>

function BasicInfoSkeleton() {
  return (
    <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 grow overflow-auto">
      <div className="max-w-2xl">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-0.5 w-full mb-6" />

        <div className="space-y-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function BasicInfo() {
  const { t } = useTranslation(['venue', 'common'])
  const { venueId, venueSlug: _venueSlug, fullBasePath } = useCurrentVenue()
  const { user } = useAuth()
  const canEdit = [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.SUPERADMIN].includes((user?.role as StaffRole) || ('' as any))
  const { setActions } = useVenueEditActions()

  const countries = useMemo(() => {
    const list = countryList().getData()
    return list.map((country: any) => ({
      value: country.value,
      label: `${country.label} (${country.value})`,
    }))
  }, [])

  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [showActiveShiftBlockedDialog, setShowActiveShiftBlockedDialog] = useState(false)
  const [activeShiftStaffName, setActiveShiftStaffName] = useState<string | null>(null)

  const { data: venue, isLoading } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  const form = useForm<BasicInfoFormValues>({
    resolver: zodResolver(basicInfoFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      country: 'MX',
      zipCode: '',
      type: BusinessType.RESTAURANT,
      timezone: 'America/Mexico_City',
      currency: 'MXN',
      enableShifts: true,
      requireClockInPhoto: false,
      autoClockOutEnabled: false,
      autoClockOutTime: null,
      maxShiftDurationEnabled: false,
      maxShiftDurationHours: 12,
    },
  })

  useEffect(() => {
    if (venue) {
      form.reset({
        name: venue.name || '',
        address: venue.address || '',
        city: venue.city || '',
        state: venue.state || '',
        country: venue.country || 'MX',
        zipCode: venue.zipCode || '',
        type: (venue.type as BusinessType) || BusinessType.RESTAURANT,
        timezone: venue.timezone || 'America/Mexico_City',
        currency: venue.currency || 'MXN',
        enableShifts: venue.settings?.enableShifts ?? true,
        requireClockInPhoto: venue.settings?.requireClockInPhoto ?? false,
        autoClockOutEnabled: venue.settings?.autoClockOutEnabled ?? false,
        autoClockOutTime: venue.settings?.autoClockOutTime ?? null,
        maxShiftDurationEnabled: venue.settings?.maxShiftDurationEnabled ?? false,
        maxShiftDurationHours: venue.settings?.maxShiftDurationHours ?? 12,
      })
    }
  }, [venue, form])

  const saveVenue = useMutation({
    mutationFn: async (data: BasicInfoFormValues) => {
      const venueData = {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        zipCode: data.zipCode,
        type: data.type,
        timezone: data.timezone,
        currency: data.currency,
      }

      // Save venue basic info only - enableShifts is handled by separate mutation
      await api.put(`/api/v1/dashboard/venues/${venueId}`, venueData)
    },
    onSuccess: () => {
      toast({
        title: t('edit.toast.updateSuccess'),
        description: t('edit.toast.updateSuccessDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || t('edit.toast.updateError')
      toast({
        title: t('edit.toast.updateErrorTitle'),
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Error updating venue:', error)
    },
  })

  // Check for active shift before allowing toggle to disable
  const checkActiveShift = async (): Promise<{ hasActiveShift: boolean; staffName?: string }> => {
    try {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/shifts`, {
        params: { page: 1, pageSize: 10 },
      })
      const shifts = response.data?.data || []
      const activeShift = shifts.find((shift: any) => shift.status === 'OPEN')
      if (activeShift) {
        const staffName = activeShift.staff
          ? `${activeShift.staff.firstName || ''} ${activeShift.staff.lastName || ''}`.trim()
          : 'Desconocido'
        return { hasActiveShift: true, staffName }
      }
      return { hasActiveShift: false }
    } catch (error) {
      console.error('Error checking active shift:', error)
      // On error, allow the toggle (fail open)
      return { hasActiveShift: false }
    }
  }

  // Separate mutation for enableShifts - makes immediate API call on toggle
  const toggleShifts = useMutation({
    mutationFn: async (enableShifts: boolean) => {
      // Option E: If trying to DISABLE, check for active shift first
      if (!enableShifts) {
        const { hasActiveShift, staffName } = await checkActiveShift()
        if (hasActiveShift) {
          setActiveShiftStaffName(staffName || null)
          setShowActiveShiftBlockedDialog(true)
          throw new Error('ACTIVE_SHIFT_BLOCKED')
        }
      }

      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, {
        enableShifts,
      })
      return enableShifts
    },
    onSuccess: (enableShifts) => {
      // Update form state to match saved value
      form.setValue('enableShifts', enableShifts, { shouldDirty: false })
      toast({
        title: enableShifts ? 'Sistema de turnos habilitado' : 'Sistema de turnos deshabilitado',
        description: 'La configuración se guardó correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      // Don't show error toast for blocked dialog (it has its own UI)
      if (error?.message === 'ACTIVE_SHIFT_BLOCKED') {
        return
      }
      const errorMessage = error?.response?.data?.message || 'Error al guardar la configuración'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      // Revert form state on error
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
      console.error('Error toggling shifts:', error)
    },
  })

  // Separate mutation for requireClockInPhoto - Anti-fraud: require photo on clock-in
  const toggleClockInPhoto = useMutation({
    mutationFn: async (requireClockInPhoto: boolean) => {
      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, {
        requireClockInPhoto,
      })
      return requireClockInPhoto
    },
    onSuccess: (requireClockInPhoto) => {
      form.setValue('requireClockInPhoto', requireClockInPhoto, { shouldDirty: false })
      toast({
        title: requireClockInPhoto ? 'Foto de entrada habilitada' : 'Foto de entrada deshabilitada',
        description: requireClockInPhoto
          ? 'Los empleados deberán tomar una foto al registrar su entrada.'
          : 'Ya no se requerirá foto al registrar entrada.',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Error al guardar la configuración'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
      console.error('Error toggling clock-in photo:', error)
    },
  })

  // Mutation for auto clock-out at fixed time
  const toggleAutoClockOut = useMutation({
    mutationFn: async (data: { autoClockOutEnabled: boolean; autoClockOutTime?: string | null }) => {
      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, data)
      return data
    },
    onSuccess: (data) => {
      form.setValue('autoClockOutEnabled', data.autoClockOutEnabled, { shouldDirty: false })
      if (data.autoClockOutTime !== undefined) {
        form.setValue('autoClockOutTime', data.autoClockOutTime, { shouldDirty: false })
      }
      toast({
        title: data.autoClockOutEnabled ? 'Salida automática habilitada' : 'Salida automática deshabilitada',
        description: data.autoClockOutEnabled
          ? `Los turnos se cerrarán automáticamente a las ${data.autoClockOutTime || '03:00'}.`
          : 'La salida automática por hora fija ha sido deshabilitada.',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Error al guardar la configuración'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
      console.error('Error toggling auto clock-out:', error)
    },
  })

  // Mutation for max shift duration
  const toggleMaxShiftDuration = useMutation({
    mutationFn: async (data: { maxShiftDurationEnabled: boolean; maxShiftDurationHours?: number }) => {
      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, data)
      return data
    },
    onSuccess: (data) => {
      form.setValue('maxShiftDurationEnabled', data.maxShiftDurationEnabled, { shouldDirty: false })
      if (data.maxShiftDurationHours !== undefined) {
        form.setValue('maxShiftDurationHours', data.maxShiftDurationHours, { shouldDirty: false })
      }
      toast({
        title: data.maxShiftDurationEnabled ? 'Duración máxima habilitada' : 'Duración máxima deshabilitada',
        description: data.maxShiftDurationEnabled
          ? `Los turnos se cerrarán automáticamente después de ${data.maxShiftDurationHours || 12} horas.`
          : 'El límite de duración de turno ha sido deshabilitado.',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Error al guardar la configuración'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
      console.error('Error toggling max shift duration:', error)
    },
  })

  const handleDialogChange = (open: boolean) => {
    setShowDeleteDialog(open)
    if (!open) {
      setDeleteConfirmation('')
    }
  }

  const deleteVenue = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/v1/dashboard/venues/${venueId}`)
    },
    onSuccess: () => {
      toast({
        title: t('edit.toast.deleteSuccess'),
        description: t('edit.toast.deleteSuccessDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data'] })
      navigate('/venues')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || t('edit.toast.deleteError')
      toast({
        title: t('edit.toast.deleteErrorTitle'),
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Error deleting venue:', error)
    },
  })

  const suspendVenue = useMutation({
    mutationFn: async (reason: string) => {
      await api.post(`/api/v1/dashboard/venues/${venueId}/suspend`, { reason })
    },
    onSuccess: () => {
      toast({
        title: t('edit.toast.suspendSuccess'),
        description: t('edit.toast.suspendSuccessDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data'] })
      navigate('/venues')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || t('edit.toast.suspendError')
      toast({
        title: t('edit.toast.suspendErrorTitle'),
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Error suspending venue:', error)
    },
  })

  const handleSuspendDialogChange = (open: boolean) => {
    setShowSuspendDialog(open)
    if (!open) {
      setSuspendReason('')
    }
  }

  // Use refs to avoid infinite loops
  const formRef = useRef(form)
  const saveVenueRef = useRef(saveVenue)
  formRef.current = form
  saveVenueRef.current = saveVenue

  const handleSave = useCallback(() => {
    const onSubmit = (formValues: BasicInfoFormValues) => {
      saveVenueRef.current.mutate(formValues)
    }
    formRef.current.handleSubmit(onSubmit)()
  }, [])

  const handleCancel = useCallback(() => {
    formRef.current.reset()
  }, [])

  useEffect(() => {
    setActions({
      onSave: handleSave,
      onCancel: handleCancel,
      isDirty: form.formState.isDirty,
      isLoading: saveVenue.isPending,
      canEdit: canEdit,
    })
  }, [form.formState.isDirty, saveVenue.isPending, canEdit, handleSave, handleCancel, setActions])

  if (isLoading) return <BasicInfoSkeleton />

  if (!venue) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">{t('edit.notFound')}</h2>
          <p className="text-muted-foreground mb-4">{t('edit.notFoundDesc')}</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common:goBack')}
          </Button>
        </div>
      </div>
    )
  }

  const expectedDeleteText = `delete ${venue.name}`
  const isDeleteConfirmed = deleteConfirmation.toLowerCase() === expectedDeleteText.toLowerCase()

  return (
    <>
      <AlertDialog open={showDeleteDialog} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('edit.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('edit.deleteDialog.description', { venueName: venue.name })}</AlertDialogDescription>
            <div className="mt-4">
              <Input
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                placeholder={`delete ${venue.name}`}
                className="mt-2"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVenue.mutate()}
              disabled={!isDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVenue.isPending ? t('common:deleting') : t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={handleSuspendDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('edit.suspendDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('edit.suspendDialog.description', { venueName: venue.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground">
              {t('edit.suspendDialog.reasonLabel')}
            </label>
            <Textarea
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder={t('edit.suspendDialog.reasonPlaceholder')}
              rows={3}
              className="mt-2"
            />
            {suspendReason.length > 0 && suspendReason.length < 10 && (
              <p className="text-xs text-muted-foreground mt-1">
                {10 - suspendReason.length} caracteres más requeridos
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendVenue.mutate(suspendReason)}
              disabled={suspendReason.length < 10}
              className="bg-amber-600 text-primary-foreground hover:bg-amber-700"
            >
              {suspendVenue.isPending ? t('common:suspending', { defaultValue: 'Suspendiendo...' }) : t('edit.dangerZone.suspend')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active Shift Blocked Dialog (Option E validation) */}
      <AlertDialog open={showActiveShiftBlockedDialog} onOpenChange={setShowActiveShiftBlockedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Turno Activo
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>No puedes desactivar el sistema de turnos mientras hay un turno abierto.</p>
              <p className="text-sm text-muted-foreground">
                Turno actual: <span className="font-medium">{activeShiftStaffName || 'Desconocido'}</span>
              </p>
              <p className="font-medium text-foreground">Primero cierra el turno desde la pantalla de Turnos.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowActiveShiftBlockedDialog(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link to={`${fullBasePath}/shifts`}>
                <Clock className="mr-2 h-4 w-4" />
                Ir a Turnos
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8 grow overflow-auto">
        {/* KYC Rejection Warning - Full width */}
        {venue.kycStatus === 'REJECTED' && (
          <Alert variant="destructive" className="mb-6 max-w-3xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold">{t('edit.kycRejected.title')}</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">{t('edit.kycRejected.description')}</p>
              {venue.kycRejectionReason && (
                <p className="mb-4 p-3 bg-destructive/10 rounded-md border border-destructive/20 text-sm">
                  <strong>{t('edit.kycRejected.reason')}</strong> {venue.kycRejectionReason}
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="border-destructive/50 hover:bg-destructive/10">
                <Link to={`${fullBasePath}/edit/documents`}>
                  <FileText className="mr-2 h-4 w-4" />
                  {t('edit.kycRejected.resubmitButton')}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Centered form container */}
        <div className="max-w-3xl mx-auto">
          <Form {...form}>
            {!canEdit && (
              <div className="mb-6 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm px-4 py-3">
                {t('edit.readOnly')}
              </div>
            )}
            <form
              onSubmit={form.handleSubmit(formValues => {
                saveVenueRef.current.mutate(formValues)
              })}
              className="space-y-8"
            >
              <fieldset disabled={!canEdit} className={!canEdit ? 'opacity-80' : undefined}>
                {/* Section Header */}
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-semibold">{t('edit.sections.basicInfo')}</h3>
                  <p className="text-sm text-muted-foreground">
                    Información general sobre tu establecimiento
                  </p>
                </div>
                <Separator className="mb-6" />

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('edit.placeholders.name')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.type')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('edit.placeholders.type')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(BusinessType).map(type => (
                            <SelectItem key={type} value={type}>
                              {t(`edit.types.${type}`, { defaultValue: type.replace(/_/g, ' ') })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.address')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('edit.placeholders.address')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.city')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.city')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.state')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.state')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.country')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('edit.placeholders.country')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countries.map((country: any) => (
                              <SelectItem key={country.value} value={country.value}>
                                {country.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.zipCode')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.zipCode')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.timezone', { defaultValue: 'Zona horaria' })}</FormLabel>
                      <FormControl>
                        <TimezoneCombobox value={field.value} onValueChange={field.onChange} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.currency', { defaultValue: 'Moneda' })}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'MXN'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('edit.placeholders.currency', { defaultValue: 'Selecciona una moneda' })} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MXN">{t('edit.currencies.mxn')}</SelectItem>
                          <SelectItem value="USD">{t('edit.currencies.usd')}</SelectItem>
                          <SelectItem value="EUR">{t('edit.currencies.eur')}</SelectItem>
                          <SelectItem value="CAD">{t('edit.currencies.cad')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4">
                  <h4 className="text-sm font-medium mb-3">Configuración Operativa</h4>
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="enableShifts"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base cursor-pointer">Sistema de Turnos</FormLabel>
                            <FormDescription>
                              Habilita el control de caja y turnos para el personal.
                            </FormDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {toggleShifts.isPending && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  // Immediate API call on toggle (not on form save)
                                  toggleShifts.mutate(checked)
                                }}
                                disabled={!canEdit || toggleShifts.isPending}
                              />
                            </FormControl>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requireClockInPhoto"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base cursor-pointer">Foto de Entrada (Anti-fraude)</FormLabel>
                            <FormDescription>
                              Requiere que los empleados tomen una foto al registrar su entrada.
                            </FormDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {toggleClockInPhoto.isPending && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  // Immediate API call on toggle (not on form save)
                                  toggleClockInPhoto.mutate(checked)
                                }}
                                disabled={!canEdit || toggleClockInPhoto.isPending}
                              />
                            </FormControl>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Auto Clock-Out Section - HR Automation (Square-style) */}
                <div className="pt-6">
                  <h4 className="text-sm font-medium mb-1">Salida Automática</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Cierra turnos automáticamente para prevenir olvidos de marcaje.
                  </p>
                  <div className="space-y-3">
                    {/* Fixed-time auto clock-out */}
                    <div className="rounded-lg border p-4 shadow-sm space-y-3">
                      <div className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base cursor-pointer">Cierre por Hora Fija</FormLabel>
                          <FormDescription>
                            Cierra todos los turnos abiertos a una hora específica.
                          </FormDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {toggleAutoClockOut.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={form.watch('autoClockOutEnabled') ?? false}
                            onCheckedChange={(checked) => {
                              const currentTime = form.getValues('autoClockOutTime') || '03:00'
                              toggleAutoClockOut.mutate({
                                autoClockOutEnabled: checked,
                                autoClockOutTime: checked ? currentTime : null,
                              })
                            }}
                            disabled={!canEdit || toggleAutoClockOut.isPending}
                          />
                        </div>
                      </div>
                      {form.watch('autoClockOutEnabled') && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Hora de cierre:</span>
                          <Input
                            type="time"
                            className="w-32"
                            value={form.watch('autoClockOutTime') || '03:00'}
                            onChange={(e) => {
                              const newTime = e.target.value
                              form.setValue('autoClockOutTime', newTime, { shouldDirty: false })
                              toggleAutoClockOut.mutate({
                                autoClockOutEnabled: true,
                                autoClockOutTime: newTime,
                              })
                            }}
                            disabled={!canEdit || toggleAutoClockOut.isPending}
                          />
                        </div>
                      )}
                    </div>

                    {/* Max shift duration */}
                    <div className="rounded-lg border p-4 shadow-sm space-y-3">
                      <div className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base cursor-pointer">Duración Máxima de Turno</FormLabel>
                          <FormDescription>
                            Cierra turnos que excedan una cantidad de horas.
                          </FormDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {toggleMaxShiftDuration.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={form.watch('maxShiftDurationEnabled') ?? false}
                            onCheckedChange={(checked) => {
                              const currentHours = form.getValues('maxShiftDurationHours') || 12
                              toggleMaxShiftDuration.mutate({
                                maxShiftDurationEnabled: checked,
                                maxShiftDurationHours: currentHours,
                              })
                            }}
                            disabled={!canEdit || toggleMaxShiftDuration.isPending}
                          />
                        </div>
                      </div>
                      {form.watch('maxShiftDurationEnabled') && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Máximo de horas:</span>
                          <Input
                            type="number"
                            className="w-20"
                            min={1}
                            max={24}
                            value={form.watch('maxShiftDurationHours') || 12}
                            onChange={(e) => {
                              const newHours = parseInt(e.target.value, 10)
                              if (newHours >= 1 && newHours <= 24) {
                                form.setValue('maxShiftDurationHours', newHours, { shouldDirty: false })
                                toggleMaxShiftDuration.mutate({
                                  maxShiftDurationEnabled: true,
                                  maxShiftDurationHours: newHours,
                                })
                              }
                            }}
                            disabled={!canEdit || toggleMaxShiftDuration.isPending}
                          />
                          <span className="text-sm text-muted-foreground">horas</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone Section */}
              <div className="pt-8 mt-8 border-t">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-destructive">
                      {t('edit.dangerZone.title')}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('edit.dangerZone.description')}
                    </p>
                  </div>

                  {/* Show Delete for demo venues (TRIAL, LIVE_DEMO), Suspend for production venues */}
                  {isDemoVenueStatus(venue?.status) ? (
                    // DELETE option for demo venues
                    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">
                            {t('edit.dangerZone.deleteButton')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('edit.dangerZone.deleteDescription')}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={!canEdit}
                        >
                          {t('edit.dangerZone.delete')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // SUSPEND option for production venues
                    <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">
                            {t('edit.dangerZone.suspendButton')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('edit.dangerZone.suspendDescription')}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                          onClick={() => setShowSuspendDialog(true)}
                          disabled={!canEdit}
                        >
                          {t('edit.dangerZone.suspend')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </fieldset>
          </form>
        </Form>
        </div>
      </div>
    </>
  )
}
