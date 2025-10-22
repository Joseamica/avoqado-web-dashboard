import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, Upload, FileText, CreditCard, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'
import api from '@/api'
import { storage } from '@/firebase'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

interface ConversionWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  venueSlug: string
  venueName: string
}

// Zod schemas for each step
const rfcSchema = z.object({
  rfc: z.string()
    .min(12, 'RFC debe tener al menos 12 caracteres')
    .max(13, 'RFC debe tener máximo 13 caracteres')
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, 'Formato de RFC inválido'),
  legalName: z.string().min(3, 'Razón social es requerida'),
  fiscalRegime: z.string().min(1, 'Régimen fiscal es requerido'),
})

const taxDocumentsSchema = z.object({
  constanciaFile: z.any().optional(),
})

const idDocumentsSchema = z.object({
  idFile: z.any().optional(),
})

type RFCFormData = z.infer<typeof rfcSchema>
type TaxDocumentsFormData = z.infer<typeof taxDocumentsSchema>
type IDDocumentsFormData = z.infer<typeof idDocumentsSchema>

export function ConversionWizard({ open, onOpenChange, venueId, venueSlug, venueName }: ConversionWizardProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({})
  const [taxDocumentFile, setTaxDocumentFile] = useState<File | null>(null)
  const [idDocumentFile, setIdDocumentFile] = useState<File | null>(null)
  const [taxDocumentUrl, setTaxDocumentUrl] = useState<string | null>(null)
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null)
  const [uploadingTaxDoc, setUploadingTaxDoc] = useState(false)
  const [uploadingIdDoc, setUploadingIdDoc] = useState(false)
  const [availableFeatures, setAvailableFeatures] = useState<any[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [loadingFeatures, setLoadingFeatures] = useState(false)

  const totalSteps = 5
  const progress = (currentStep / totalSteps) * 100

  // Reset all states when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1)
      setFormData({})
      setTaxDocumentFile(null)
      setIdDocumentFile(null)
      setTaxDocumentUrl(null)
      setIdDocumentUrl(null)
      setUploadingTaxDoc(false)
      setUploadingIdDoc(false)
      setSelectedFeatures([])
      rfcForm.reset()
      taxDocumentsForm.reset()
      idDocumentsForm.reset()
    }
  }, [open])

  // Fetch available features when wizard opens
  useEffect(() => {
    const fetchFeatures = async () => {
      if (!open) return

      setLoadingFeatures(true)
      try {
        const response = await api.get('/api/v1/dashboard/features')
        if (response.data.success) {
          setAvailableFeatures(response.data.data)
        }
      } catch (error) {
        console.error('Error fetching features:', error)
        toast({
          title: t('conversionWizard.error.title'),
          description: t('conversionWizard.error.fetchFeatures'),
          variant: 'destructive',
        })
      } finally {
        setLoadingFeatures(false)
      }
    }

    fetchFeatures()
  }, [open, t, toast])

  // Helper function to upload file to Firebase Storage
  // documentType: 'CSF' for tax documents, 'ID' for identification documents
  const uploadFile = async (file: File, documentType: 'CSF' | 'ID'): Promise<string | null> => {
    try {
      // Step 1: Send to backend for validation
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/upload-document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (!response.data.success) {
        throw new Error('Backend validation failed')
      }

      const { buffer, filename, mimeType } = response.data.data

      // Step 2: Convert base64 to Blob
      const base64Response = await fetch(`data:${mimeType};base64,${buffer}`)
      const blob = await base64Response.blob()

      // Step 3: Upload to Firebase Storage with renamed file
      const timestamp = Date.now()
      // Extract file extension from original filename or mimeType
      const fileExtension = filename.split('.').pop() || mimeType.split('/')[1]
      // Rename file: CSF.pdf or ID.jpg, etc.
      const renamedFilename = `${documentType}.${fileExtension}`
      const storagePath = `venues/${venueSlug}/documents/${timestamp}_${renamedFilename}`
      const storageRef = ref(storage, storagePath)

      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: mimeType,
      })

      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => reject(error),
          () => resolve(undefined),
        )
      })

      // Step 4: Get public URL
      const downloadURL = await getDownloadURL(storageRef)

      return downloadURL
    } catch (error: any) {
      console.error('Error uploading file to Firebase:', error)
      toast({
        title: t('conversionWizard.error.title'),
        description: error?.response?.data?.message || 'Error al subir el archivo',
        variant: 'destructive',
      })
      return null
    }
  }

  // Forms for each step
  const rfcForm = useForm<RFCFormData>({
    resolver: zodResolver(rfcSchema),
    defaultValues: {
      rfc: '',
      legalName: '',
      fiscalRegime: '',
    },
  })

  const taxDocumentsForm = useForm<TaxDocumentsFormData>({
    resolver: zodResolver(taxDocumentsSchema),
  })

  const idDocumentsForm = useForm<IDDocumentsFormData>({
    resolver: zodResolver(idDocumentsSchema),
  })

  const handleNext = async () => {
    let isValid = false

    if (currentStep === 1) {
      isValid = await rfcForm.trigger()
      if (isValid) {
        setFormData({ ...formData, ...rfcForm.getValues() })
      }
    } else if (currentStep === 2) {
      isValid = await taxDocumentsForm.trigger()
      if (isValid) {
        setFormData({ ...formData, ...taxDocumentsForm.getValues() })
      }
    } else if (currentStep === 3) {
      isValid = await idDocumentsForm.trigger()
      if (isValid) {
        setFormData({ ...formData, ...idDocumentsForm.getValues() })
      }
    } else if (currentStep === 4) {
      // Step 4: Save selected features
      setFormData({ ...formData, selectedFeatures })
      isValid = true
    } else {
      isValid = true
    }

    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      // Call API to convert venue from demo to real
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/convert-from-demo`, {
        rfc: formData.rfc,
        legalName: formData.legalName,
        fiscalRegime: formData.fiscalRegime,
        taxDocumentUrl: taxDocumentUrl,
        idDocumentUrl: idDocumentUrl,
      })

      if (response.data.success) {
        // Save selected features if any
        if (selectedFeatures.length > 0) {
          try {
            await api.post(`/api/v1/dashboard/venues/${venueId}/features`, {
              featureIds: selectedFeatures,
            })
          } catch (featureError) {
            console.error('Error saving features:', featureError)
            // Don't fail the entire conversion if features fail
          }
        }

        toast({
          title: t('conversionWizard.success.title'),
          description: t('conversionWizard.success.description'),
        })

        onOpenChange(false)

        // Reload page to update venue status
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        throw new Error('Conversion failed')
      }
    } catch (error: any) {
      console.error('Error converting venue:', error)
      toast({
        title: t('conversionWizard.error.title'),
        description: error?.response?.data?.message || t('conversionWizard.error.description'),
        variant: 'destructive',
      })
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold text-sm">{t('conversionWizard.step1.title')}</h4>
                <p className="text-xs text-muted-foreground">{t('conversionWizard.step1.description')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="rfc">{t('conversionWizard.step1.rfcLabel')}</Label>
                <Input
                  id="rfc"
                  placeholder="XAXX010101000"
                  className="uppercase"
                  {...rfcForm.register('rfc')}
                />
                {rfcForm.formState.errors.rfc && (
                  <p className="text-sm text-destructive mt-1">{rfcForm.formState.errors.rfc.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="legalName">{t('conversionWizard.step1.legalNameLabel')}</Label>
                <Input
                  id="legalName"
                  placeholder={t('conversionWizard.step1.legalNamePlaceholder')}
                  {...rfcForm.register('legalName')}
                />
                {rfcForm.formState.errors.legalName && (
                  <p className="text-sm text-destructive mt-1">{rfcForm.formState.errors.legalName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="fiscalRegime">{t('conversionWizard.step1.fiscalRegimeLabel')}</Label>
                <Input
                  id="fiscalRegime"
                  placeholder={t('conversionWizard.step1.fiscalRegimePlaceholder')}
                  {...rfcForm.register('fiscalRegime')}
                />
                {rfcForm.formState.errors.fiscalRegime && (
                  <p className="text-sm text-destructive mt-1">{rfcForm.formState.errors.fiscalRegime.message}</p>
                )}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold text-sm">{t('conversionWizard.step2.title')}</h4>
                <p className="text-xs text-muted-foreground">{t('conversionWizard.step2.description')}</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium mb-2">{t('conversionWizard.step2.uploadLabel')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t('conversionWizard.step2.uploadHint')}</p>
              <div className="flex flex-col items-center gap-3">
                <label
                  htmlFor="taxDocumentFile"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar archivo
                </label>
                <Input
                  id="taxDocumentFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setTaxDocumentFile(file)
                      setUploadingTaxDoc(true)

                      // Upload file to Firebase Storage (CSF = Constancia de Situación Fiscal)
                      const url = await uploadFile(file, 'CSF')
                      if (url) {
                        setTaxDocumentUrl(url)
                      }

                      setUploadingTaxDoc(false)

                      // Clear input value to allow re-selecting the same file
                      e.target.value = ''
                    }
                  }}
                />
                {uploadingTaxDoc && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Subiendo archivo...</span>
                  </div>
                )}
                {taxDocumentFile && !uploadingTaxDoc && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">{taxDocumentFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold text-sm">{t('conversionWizard.step3.title')}</h4>
                <p className="text-xs text-muted-foreground">{t('conversionWizard.step3.description')}</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium mb-2">{t('conversionWizard.step3.uploadLabel')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t('conversionWizard.step3.uploadHint')}</p>
              <div className="flex flex-col items-center gap-3">
                <label
                  htmlFor="idDocumentFile"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar archivo
                </label>
                <Input
                  id="idDocumentFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setIdDocumentFile(file)
                      setUploadingIdDoc(true)

                      // Upload file to Firebase Storage (ID = Identificación)
                      const url = await uploadFile(file, 'ID')
                      if (url) {
                        setIdDocumentUrl(url)
                      }

                      setUploadingIdDoc(false)

                      // Clear input value to allow re-selecting the same file
                      e.target.value = ''
                    }
                  }}
                />
                {uploadingIdDoc && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Subiendo archivo...</span>
                  </div>
                )}
                {idDocumentFile && !uploadingIdDoc && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">{idDocumentFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold text-sm">{t('conversionWizard.step4.title')}</h4>
                <p className="text-xs text-muted-foreground">{t('conversionWizard.step4.description')}</p>
              </div>
            </div>

            {loadingFeatures ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('conversionWizard.step4.loading')}</p>
              </div>
            ) : availableFeatures.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('conversionWizard.step4.noFeatures')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      id={`feature-${feature.id}`}
                      checked={selectedFeatures.includes(feature.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedFeatures([...selectedFeatures, feature.id])
                        } else {
                          setSelectedFeatures(selectedFeatures.filter((id) => id !== feature.id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`feature-${feature.id}`}
                        className="font-medium text-sm cursor-pointer"
                      >
                        {feature.name}
                      </Label>
                      {feature.description && (
                        <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                {t('conversionWizard.step4.helpText')}
              </p>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <h4 className="font-semibold text-sm">{t('conversionWizard.step5.title')}</h4>
                <p className="text-xs text-muted-foreground">{t('conversionWizard.step5.description')}</p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <h5 className="font-semibold text-sm">{t('conversionWizard.step5.summaryTitle')}</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('conversionWizard.step5.venueName')}:</span>
                  <span className="font-medium">{venueName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('conversionWizard.step5.rfc')}:</span>
                  <span className="font-medium">{formData.rfc || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('conversionWizard.step5.legalName')}:</span>
                  <span className="font-medium">{formData.legalName || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {t('conversionWizard.step5.confirmationMessage')}
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t('conversionWizard.title')}
          </DialogTitle>
          <DialogDescription>
            {t('conversionWizard.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t('conversionWizard.step')} {currentStep} {t('conversionWizard.of')} {totalSteps}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step content */}
        <div key={`step-${currentStep}`} className="min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('conversionWizard.back')}
          </Button>

          {currentStep < totalSteps ? (
            <Button onClick={handleNext}>
              {t('conversionWizard.next')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
              <Sparkles className="mr-2 h-4 w-4" />
              {t('conversionWizard.convert')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
