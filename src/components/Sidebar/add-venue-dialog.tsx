import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase'
import { Button } from '../ui/button'
import { DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { getCroppedImg } from '@/utils/cropImage'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import api from '@/api'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
interface AddVenueDialogProps {
  onClose: () => void
  navigate: (path: string) => void
}

export function AddVenueDialog({ onClose, navigate }: AddVenueDialogProps) {
  const { t } = useTranslation()
  const form = useForm({
    defaultValues: {
      name: '',
      type: '',
      logo: '',
      pos: 'SOFTRESTAURANT',
    },
  })
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileRef, setFileRef] = useState<any>(null)
  const { mutate, isPending } = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/api/v1/dashboard/venues`, data)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('venues.addDialog.toast.successTitle'),
        description: t('venues.addDialog.toast.successDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['status'] }) // Refetch product data
      form.reset()
      navigate(`/venues/${venueId}/edit`)
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: t('venues.addDialog.toast.errorTitle'),
        description: error.message || t('venues.addDialog.toast.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [imageForCrop, setImageForCrop] = useState<string | null>(null)

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleFileUpload = (file: File) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setImageForCrop(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async () => {
    if (!imageForCrop || !croppedAreaPixels) return

    const croppedImage = await getCroppedImg(imageForCrop, croppedAreaPixels)
    const blob = await fetch(croppedImage).then(res => res.blob())

    const fileName = `cropped_${Date.now()}.jpg`
    const storageRef = ref(storage, `venues/${venueId}/logos/${fileName}`)
    const uploadTask = uploadBytesResumable(storageRef, blob)

    setUploading(true)

    uploadTask.on(
      'state_changed',
      snapshot => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        console.log(`Upload is ${progress}% done`)
      },
      error => {
        console.error('Error uploading file:', error)
        setUploading(false)
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(downloadURL => {
          setImageUrl(downloadURL)
          setFileRef(storageRef)
          setUploading(false)
          setImageForCrop(null)
          form.setValue('logo', downloadURL, { shouldValidate: true }) // Agregar esta línea
        })
      },
    )
  }

  const handleFileRemove = () => {
    if (fileRef) {
      deleteObject(fileRef)
        .then(() => {
          setImageUrl(null)
          setFileRef(null)
        })
        .catch(error => {
          console.error('Error removing file:', error)
        })
    }
  }

  function onSubmit(formValues) {
    // FIXME: Add the logic to save the new venue
    mutate({ ...formValues, userId: user?.id })
  }

  return (
    <>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('venues.addDialog.title')}</DialogTitle>
          <DialogDescription>{t('venues.addDialog.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                rules={{ required: t('venues.addDialog.fields.requiredError') as string }}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('venues.addDialog.fields.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('venues.addDialog.fields.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                rules={{ required: t('venues.addDialog.fields.requiredError') as string }}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t('venues.addDialog.fields.type')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('venues.addDialog.fields.typePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RESTAURANT">{t('venues.addDialog.fields.typeOptions.RESTAURANT')}</SelectItem>
                        <SelectItem value="STUDIO">{t('venues.addDialog.fields.typeOptions.STUDIO')}</SelectItem>
                        <SelectItem value="HOTEL">{t('venues.addDialog.fields.typeOptions.HOTEL')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                rules={{ required: t('venues.addDialog.fields.requiredError') as string }}
                name="pos"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t('venues.addDialog.fields.pos')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('venues.addDialog.fields.posPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SOFTRESTAURANT" defaultChecked>
                          {t('venues.addDialog.fields.posOptions.SOFTRESTAURANT')}
                        </SelectItem>
                        <SelectItem value="NONE">{t('venues.addDialog.fields.posOptions.NONE')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                rules={{ required: t('venues.addDialog.fields.requiredError') as string }}
                name="logo"
                render={() => (
                  <FormItem>
                    <FormLabel>{t('venues.addDialog.fields.logo')}</FormLabel>
                    <FormControl>
                      <div className="pb-4">
                        {imageUrl ? (
                          <div className="flex flex-col items-center space-y-2">
                            <img src={imageUrl} alt={t('venueMgmt.basicInfo.logoAlt')} className="object-cover rounded-md" />
                            <Button type="button" variant="outline" onClick={handleFileRemove} disabled={uploading}>
                              {t('venues.addDialog.upload.remove')}
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
                                {t('venues.addDialog.upload.cancel')}
                              </Button>
                              <Button type="button" onClick={handleCropConfirm} disabled={uploading}>
                                {t('venues.addDialog.upload.confirm')}
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
                )}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose} disabled={uploading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={uploading || !imageUrl || isPending}>
                {isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </>
  )
}
