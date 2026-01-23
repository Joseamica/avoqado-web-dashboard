import { useState, useCallback } from 'react'
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase'
import { getCroppedImg } from '@/utils/cropImage'
import { useToast } from './use-toast'

/**
 * Custom hook to handle image upload, crop, and removal.
 *
 * @param {string} basePath - The Firebase Storage path where images will be uploaded.
 * @param {string} assignedFileName - A base name for the file you upload.
 * @param {object} config - Optional config for minimum/maximum dimensions, etc.
 */
export function useImageUploader(
  basePath: string,
  assignedFileName: string = 'producto',
  config?: {
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
  },
) {
  const { toast } = useToast()

  // Extraemos los valores, con defaults si no se pasan
  const minWidth = config?.minWidth ?? 150
  const minHeight = config?.minHeight ?? 150
  const maxWidth = config?.maxWidth ?? 2000
  const maxHeight = config?.maxHeight ?? 2000

  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileRef, setFileRef] = useState<any>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)

  // Para el recorte
  const [imageForCrop, setImageForCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  // Cuando se completa el recorte
  const onCropComplete = useCallback((_: any, croppedAreaPixelsValue: any) => {
    setCroppedAreaPixels(croppedAreaPixelsValue)
  }, [])

  // Al seleccionar el archivo, leemos y lo mostramos para recortar
  const handleFileUpload = (file: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageForCrop(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Confirma el recorte -> valida y sube la imagen a Firebase
  const handleCropConfirm = async () => {
    if (!imageForCrop || !croppedAreaPixels) return

    // Check if storage is available
    if (!storage) {
      toast({
        title: 'Error',
        description: 'Firebase Storage is not available. Please contact support.',
        variant: 'destructive',
      })
      console.error('Firebase Storage is not available')
      return
    }

    // Verificamos el tamaño mínimo
    if (croppedAreaPixels.width < minWidth || croppedAreaPixels.height < minHeight) {
      toast({
        title: 'Error',
        description: `El recorte es menor al mínimo permitido: ${minWidth}x${minHeight}`,
        variant: 'destructive',
      })
      console.error(`El recorte es menor al mínimo permitido: ${minWidth}x${minHeight}`)
      return
    }

    // Verificamos el tamaño máximo
    if (croppedAreaPixels.width > maxWidth || croppedAreaPixels.height > maxHeight) {
      toast({
        title: 'Error',
        description: `El recorte excede el máximo permitido: ${maxWidth}x${maxHeight}`,
        variant: 'destructive',
      })
      console.error(`El recorte excede el máximo permitido: ${maxWidth}x${maxHeight}`)
      return
    }

    try {
      const croppedImage = await getCroppedImg(imageForCrop, croppedAreaPixels)
      const blob = await fetch(croppedImage).then(res => res.blob())

      // Creamos un nombre de archivo único
      const fileName = `${assignedFileName}-${Date.now()}.jpg`
      const storageRef = ref(storage, `${basePath}/${fileName}`)

      setUploading(true)
      const uploadTask = uploadBytesResumable(storageRef, blob)

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
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setImageUrl(downloadURL)
          setFileRef(storageRef)
          setUploading(false)
          setImageForCrop(null)
        },
      )
    } catch (error) {
      console.error('Error processing crop:', error)
    }
  }

  // Initialize with existing image URL (for edit mode)
  const initializeWithExistingUrl = useCallback((url: string | null) => {
    setExistingImageUrl(url)
    setImageUrl(url)
  }, [])

  // Delete existing image from Firebase by URL
  const deleteExistingImage = useCallback(async (url: string) => {
    if (!url || !storage) return

    try {
      // Extract the path from the Firebase Storage URL
      // URL format: https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[encoded-path]?...
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/)
      if (pathMatch) {
        const encodedPath = pathMatch[1].split('?')[0]
        const path = decodeURIComponent(encodedPath)
        const imageRef = ref(storage, path)
        await deleteObject(imageRef)
        console.log('✅ Old image deleted from Firebase:', path)
      }
    } catch (error) {
      console.error('Error deleting existing image from Firebase:', error)
      // Don't throw - the old image might already be deleted or URL might be invalid
    }
  }, [])

  // Eliminar archivo de Firebase y limpiar estados
  const handleFileRemove = useCallback(async () => {
    // Delete newly uploaded image if exists
    if (fileRef) {
      try {
        await deleteObject(fileRef)
      } catch (error) {
        console.error('Error removing file:', error)
      }
    }

    // Delete existing image if it was initialized (edit mode)
    if (existingImageUrl && existingImageUrl !== imageUrl) {
      await deleteExistingImage(existingImageUrl)
    } else if (imageUrl && !fileRef) {
      // imageUrl exists but no fileRef means it's an existing URL
      await deleteExistingImage(imageUrl)
    }

    setImageUrl(null)
    setFileRef(null)
    setExistingImageUrl(null)
  }, [fileRef, existingImageUrl, imageUrl, deleteExistingImage])

  // Handle replacing an existing image - delete old one first
  const handleReplaceImage = useCallback(async (file: File) => {
    // If there's an existing image, mark it for deletion
    if (imageUrl) {
      // Store the old URL to delete after successful upload
      setExistingImageUrl(imageUrl)
    }
    // Proceed with new file upload
    handleFileUpload(file)
  }, [imageUrl, handleFileUpload])

  return {
    // States
    uploading,
    imageUrl,
    imageForCrop,
    crop,
    zoom,
    croppedAreaPixels,

    // Setters
    setImageForCrop,
    setCrop,
    setZoom,
    setImageUrl,

    // Handlers
    onCropComplete,
    handleFileUpload,
    handleCropConfirm,
    handleFileRemove,
    initializeWithExistingUrl,
    handleReplaceImage,
    deleteExistingImage,
  }
}
