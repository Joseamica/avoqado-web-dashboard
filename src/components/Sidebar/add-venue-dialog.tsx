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
import { useParams } from 'react-router-dom'

interface AddVenueDialogProps {
  onClose: () => void
}

export function AddVenueDialog({ onClose }: AddVenueDialogProps) {
  const form = useForm({})
  const { venueId } = useParams()
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileRef, setFileRef] = useState<any>(null)

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

  return (
    <>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar nueva sucursal</DialogTitle>
          <DialogDescription>Completa la información de la nueva sucursal para agregarla al sistema.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => console.log(data))}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                rules={{ required: 'Este campo es requerido' }}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la sucursal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                rules={{ required: 'Este campo es requerido' }}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de sucursal</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un tipo de negocio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="restaurant">Restaurante</SelectItem>
                        <SelectItem value="studio">Estudio</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                rules={{ required: 'Este campo es requerido' }}
                name="logo"
                render={() => (
                  <FormItem>
                    <FormLabel>Logo</FormLabel>
                    <FormControl>
                      <div className="pb-4">
                        {imageUrl ? (
                          <div className="flex flex-col items-center space-y-2">
                            <img src={imageUrl} alt="Logo" className="object-cover rounded-md" />
                            <Button type="button" variant="outline" onClick={handleFileRemove} disabled={uploading}>
                              Quitar
                            </Button>
                          </div>
                        ) : imageForCrop ? (
                          <div>
                            <div className="relative w-full h-64 bg-gray-100">
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
                                Cancelar
                              </Button>
                              <Button type="button" onClick={handleCropConfirm} disabled={uploading}>
                                Confirmar
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
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading || !imageUrl}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </>
  )
}
