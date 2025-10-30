import api from '@/api'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ColorPicker } from '@/components/ui/color-picker'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
import { useVenueEditActions } from '../VenueEditLayout'
import Cropper from 'react-easy-crop'
import { storage } from '@/firebase'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { getCroppedImg } from '@/utils/cropImage'

const contactImagesFormSchema = z.object({
  phone: z.string().min(1, { message: 'El teléfono es requerido.' }),
  email: z.string().email({ message: 'Debe ser un email válido.' }),
  website: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

type ContactImagesFormValues = z.infer<typeof contactImagesFormSchema>

function ContactImagesSkeleton() {
  return (
    <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 grow overflow-auto">
      <div className="max-w-2xl">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-0.5 w-full mb-6" />

        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
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

export default function ContactImages() {
  const { t } = useTranslation(['venue', 'common'])
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const canEdit = [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.SUPERADMIN].includes((user?.role as StaffRole) || ('' as any))
  const { setActions } = useVenueEditActions()

  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: venue, isLoading } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  const form = useForm<ContactImagesFormValues>({
    resolver: zodResolver(contactImagesFormSchema),
    defaultValues: {
      phone: '',
      email: '',
      website: '',
      logo: '',
      primaryColor: '',
      secondaryColor: '',
      latitude: null,
      longitude: null,
    },
  })

  useEffect(() => {
    if (venue) {
      form.reset({
        phone: venue.phone || '',
        email: venue.email || '',
        website: venue.website || '',
        logo: venue.logo || '',
        primaryColor: venue.primaryColor || '',
        secondaryColor: venue.secondaryColor || '',
        latitude: venue.latitude ? Number(venue.latitude) : null,
        longitude: venue.longitude ? Number(venue.longitude) : null,
      })
    }
  }, [venue, form])

  // Logo upload + crop
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [imageForCrop, setImageForCrop] = useState<string | null>(null)

  const onCropComplete = useCallback((_: any, area: any) => setCroppedAreaPixels(area), [])

  useEffect(() => {
    if (venue?.logo) setImageUrl(venue.logo)
  }, [venue])

  const handleFileUpload = (file: File | undefined | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageForCrop(reader.result as string)
    reader.readAsDataURL(file)
  }

  const saveVenue = useMutation({
    mutationFn: async (data: ContactImagesFormValues) => {
      const venueData: any = {
        phone: data.phone,
        email: data.email,
      }

      if (data.website !== undefined && data.website !== null) venueData.website = data.website
      if (data.logo !== undefined) venueData.logo = data.logo
      if (data.primaryColor !== undefined && data.primaryColor !== null) venueData.primaryColor = data.primaryColor
      if (data.secondaryColor !== undefined && data.secondaryColor !== null) venueData.secondaryColor = data.secondaryColor
      if (data.latitude !== null && data.latitude !== undefined) venueData.latitude = data.latitude
      if (data.longitude !== null && data.longitude !== undefined) venueData.longitude = data.longitude

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

  // Use refs to avoid infinite loops
  const formRef = useRef(form)
  const saveVenueRef = useRef(saveVenue)
  formRef.current = form
  saveVenueRef.current = saveVenue

  const handleCropConfirm = async () => {
    if (!imageForCrop || !croppedAreaPixels || !venueId) return
    const croppedImage = await getCroppedImg(imageForCrop, croppedAreaPixels)
    const blob = await fetch(croppedImage).then(r => r.blob())

    const fileName = `cropped_${Date.now()}.jpg`
    const storageRef = ref(storage, `venues/${venueId}/logos/${fileName}`)
    const uploadTask = uploadBytesResumable(storageRef, blob)
    setUploading(true)
    uploadTask.on(
      'state_changed',
      () => {},
      error => {
        console.error('Error uploading file:', error)
        setUploading(false)
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(downloadURL => {
          setImageUrl(downloadURL)
          setUploading(false)
          setImageForCrop(null)
          formRef.current.setValue('logo', downloadURL, { shouldDirty: true })

          saveVenueRef.current.mutate({ ...formRef.current.getValues(), logo: downloadURL })

          toast({
            title: t('edit.toast.logoUploadedTitle', { defaultValue: 'Logo actualizado' }),
            description: t('edit.toast.logoUploadedDesc', { defaultValue: 'El logo se ha actualizado correctamente.' }),
          })
        })
      },
    )
  }

  const handleFileRemove = () => {
    setImageUrl(null)
    formRef.current.setValue('logo', '', { shouldDirty: true })

    const currentValues = formRef.current.getValues()
    const payload = {
      ...currentValues,
      logo: '',
    }

    saveVenueRef.current.mutate(payload, {
      onSuccess: () => {
        toast({
          title: t('edit.toast.logoRemovedTitle', { defaultValue: 'Logo eliminado' }),
          description: t('edit.toast.logoRemovedDesc', { defaultValue: 'El logo se ha eliminado correctamente.' }),
        })
      },
      onError: error => {
        console.error('Error saving logo removal:', error)
        toast({
          title: t('edit.toast.logoErrorTitle', { defaultValue: 'Error con el logo' }),
          description: t('edit.toast.logoErrorDesc', { defaultValue: 'No se pudo procesar la imagen del logo.' }),
          variant: 'destructive',
        })
      },
    })
  }

  const handleSave = useCallback(() => {
    const onSubmit = (formValues: ContactImagesFormValues) => {
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

  if (isLoading) return <ContactImagesSkeleton />

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

  return (
    <div className="container mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8 grow overflow-auto">
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
              <div className="space-y-1 mb-6">
                <h3 className="text-lg font-semibold">{t('edit.sections.contact')}</h3>
                <p className="text-sm text-muted-foreground">
                  Contacto, imágenes y personalización visual de tu establecimiento
                </p>
              </div>
              <Separator className="mb-6" />

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.email', { defaultValue: 'Email' })}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('edit.placeholders.email', { defaultValue: 'email@ejemplo.com' })} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.phone', { defaultValue: 'Teléfono' })}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('edit.placeholders.phone', { defaultValue: '+52 123 456 7890' })} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.website', { defaultValue: 'Sitio web' })}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('edit.placeholders.website', { defaultValue: 'https://tusitio.com' })}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.primaryColor', { defaultValue: 'Color Primario' })}</FormLabel>
                      <FormControl>
                        <ColorPicker
                          placeholder={t('edit.placeholders.primaryColor', { defaultValue: '#FF5733' })}
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.labels.secondaryColor', { defaultValue: 'Color Secundario' })}</FormLabel>
                      <FormControl>
                        <ColorPicker
                          placeholder={t('edit.placeholders.secondaryColor', { defaultValue: '#33C4FF' })}
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.latitude', { defaultValue: 'Latitud' })}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder={t('edit.placeholders.latitude', { defaultValue: '19.432608' })}
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.longitude', { defaultValue: 'Longitud' })}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder={t('edit.placeholders.longitude', { defaultValue: '-99.133209' })}
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {canEdit ? (
                  <FormItem>
                    <FormLabel>{t('edit.labels.logo', { defaultValue: 'Logo' })}</FormLabel>
                    <FormControl>
                      <div className="pb-4">
                        {imageUrl ? (
                          <div className="flex flex-col items-center space-y-2">
                            <img src={imageUrl} alt={t('edit.logoAlt', { defaultValue: 'Logo' })} className="max-w-xs max-h-48 object-cover rounded-md" />
                            <Button type="button" variant="outline" onClick={handleFileRemove} disabled={uploading}>
                              {t('common.remove', { defaultValue: 'Quitar' })}
                            </Button>
                          </div>
                        ) : imageForCrop ? (
                          <div>
                            <div className="relative w-full h-64 bg-muted">
                              <Cropper
                                image={imageForCrop}
                                crop={crop}
                                zoom={zoom}
                                aspect={4 / 3}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                              />
                            </div>
                            <div className="flex justify-between mt-4">
                              <Button variant="outline" type="button" onClick={() => setImageForCrop(null)} disabled={uploading}>
                                {t('addDialog.upload.cancel', { defaultValue: 'Cancelar' })}
                              </Button>
                              <Button type="button" onClick={handleCropConfirm} disabled={uploading}>
                                {t('addDialog.upload.confirm', { defaultValue: 'Confirmar' })}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Input
                            type="file"
                            onChange={e => handleFileUpload(e.target.files?.[0])}
                            className="block w-full p-2 text-sm border rounded-md"
                            disabled={uploading}
                          />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                ) : (
                  <FormItem>
                    <FormLabel>{t('edit.labels.logo', { defaultValue: 'Logo' })}</FormLabel>
                    <div className="flex items-center gap-3">
                      {venue.logo ? (
                        <img src={venue.logo} alt={t('edit.logoAlt', { defaultValue: 'Logo' })} className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <span className="text-sm text-muted-foreground">{t('edit.noLogo')}</span>
                      )}
                    </div>
                  </FormItem>
                )}
              </div>
            </fieldset>
          </form>
        </Form>
      </div>
    </div>
  )
}
