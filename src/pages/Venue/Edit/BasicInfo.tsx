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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertCircle, FileText } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import countryList from 'react-select-country-list'
import { z } from 'zod'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { useVenueEditActions } from '../VenueEditLayout'

// Enums to match Prisma schema exactly
enum VenueType {
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  CAFE = 'CAFE',
  FAST_FOOD = 'FAST_FOOD',
  FOOD_TRUCK = 'FOOD_TRUCK',
  RETAIL_STORE = 'RETAIL_STORE',
  HOTEL_RESTAURANT = 'HOTEL_RESTAURANT',
  FITNESS_STUDIO = 'FITNESS_STUDIO',
  SPA = 'SPA',
  OTHER = 'OTHER',
}

const basicInfoFormSchema = z.object({
  // Required fields
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
  address: z.string().min(1, { message: 'La dirección es requerida.' }),
  city: z.string().min(1, { message: 'La ciudad es requerida.' }),
  state: z.string().min(1, { message: 'El estado es requerido.' }),
  country: z.string().min(1, { message: 'El país es requerido.' }).default('MX'),
  zipCode: z.string().min(1, { message: 'El código postal es requerido.' }),

  // Optional fields
  type: z.nativeEnum(VenueType).default(VenueType.RESTAURANT),
  timezone: z.string().default('America/Mexico_City'),
  currency: z.string().default('MXN'),
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
  const { venueId, venueSlug } = useCurrentVenue()
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

  const { data: venue, isLoading } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
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
      type: VenueType.RESTAURANT,
      timezone: 'America/Mexico_City',
      currency: 'MXN',
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
        type: (venue.type as VenueType) || VenueType.RESTAURANT,
        timezone: venue.timezone || 'America/Mexico_City',
        currency: venue.currency || 'MXN',
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
      return await api.put(`/api/v1/dashboard/venues/${venueId}`, venueData)
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
                <Link to={`/venues/${venueSlug}/edit/documents`}>
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
                          <SelectItem value={VenueType.RESTAURANT}>{t('edit.types.restaurant')}</SelectItem>
                          <SelectItem value={VenueType.BAR}>{t('edit.types.bar')}</SelectItem>
                          <SelectItem value={VenueType.CAFE}>{t('edit.types.cafe')}</SelectItem>
                          <SelectItem value={VenueType.FAST_FOOD}>{t('edit.types.fastFood')}</SelectItem>
                          <SelectItem value={VenueType.FOOD_TRUCK}>{t('edit.types.foodTruck')}</SelectItem>
                          <SelectItem value={VenueType.RETAIL_STORE}>{t('edit.types.retailStore')}</SelectItem>
                          <SelectItem value={VenueType.HOTEL_RESTAURANT}>{t('edit.types.hotelRestaurant')}</SelectItem>
                          <SelectItem value={VenueType.FITNESS_STUDIO}>{t('edit.types.fitnessStudio')}</SelectItem>
                          <SelectItem value={VenueType.SPA}>{t('edit.types.spa')}</SelectItem>
                          <SelectItem value={VenueType.OTHER}>{t('edit.types.other')}</SelectItem>
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
              </div>

              {/* Danger Zone Section */}
              <div className="pt-8 mt-8 border-t">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-destructive">
                      {t('edit.dangerZone.title', { defaultValue: 'Zona de Peligro' })}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('edit.dangerZone.description', { defaultValue: 'Las acciones en esta sección son irreversibles. Procede con precaución.' })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">
                          {t('edit.dangerZone.deleteButton', { defaultValue: 'Eliminar Local' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Esta acción eliminará permanentemente este local y todos sus datos asociados.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={!canEdit}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
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
