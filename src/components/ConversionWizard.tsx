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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Upload, FileText, CreditCard, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'
import { StripePaymentMethod } from '@/components/StripePaymentMethod'
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
  rfc: z
    .string()
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

// Pricing in MXN (matches backend seed data and FeaturesStep)
const FEATURE_PRICING: Record<string, number> = {
  CHATBOT: 399,
  ADVANCED_ANALYTICS: 499,
  INVENTORY_TRACKING: 299,
  LOYALTY_PROGRAM: 599,
  ONLINE_ORDERING: 799,
  RESERVATIONS: 399,
}

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
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)

  const totalSteps = 6
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
      setPaymentMethodId(null)
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
          error => reject(error),
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

      // If no features selected, skip payment step (Step 5) and go directly to summary (Step 6)
      if (selectedFeatures.length === 0 && currentStep < totalSteps) {
        setCurrentStep(6) // Jump to summary
        return
      }
    } else {
      isValid = true
    }

    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      // If on step 6 and no features selected, skip step 5 (payment) and go to step 4
      if (currentStep === 6 && selectedFeatures.length === 0) {
        setCurrentStep(4)
      } else {
        setCurrentStep(currentStep - 1)
      }
    }
  }

  const handleSubmit = async () => {
    try {
      // Convert feature IDs to feature codes BEFORE API call
      const featureCodes = selectedFeatures
        .map(featureId => {
          const feature = availableFeatures.find(f => f.id === featureId)
          return feature?.code
        })
        .filter(Boolean) as string[]

      // Call API to convert venue from demo to real (SINGLE REQUEST with payment + features)
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/convert-from-demo`, {
        rfc: formData.rfc,
        legalName: formData.legalName,
        fiscalRegime: formData.fiscalRegime,
        taxDocumentUrl: taxDocumentUrl,
        idDocumentUrl: idDocumentUrl,
        paymentMethodId: paymentMethodId, // ✅ Fixed: Correct field name (was stripePaymentMethodId)
        selectedFeatures: featureCodes, // ✅ Added: Backend will create trial subscriptions
      })

      if (response.data.success) {
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

  // Helper function to get dynamic button text
  const getNextButtonText = () => {
    // Step 4: Features selection
    if (currentStep === 4) {
      return selectedFeatures.length > 0 ? 'Continuar al pago' : 'Continuar sin features premium'
    }
    // Default: "Siguiente"
    return t('conversionWizard.next')
  }

  const getNextButtonVariant = () => {
    // Step 4 without features: outline variant for less emphasis
    if (currentStep === 4 && selectedFeatures.length === 0) {
      return 'outline' as const
    }
    // Default: solid/default variant
    return 'default' as const
  }

  const getFinalButtonText = () => {
    return selectedFeatures.length > 0 ? 'Iniciar trial gratuito de 5 días' : 'Activar cuenta gratuita'
  }

  const renderStepContent = (step?: number) => {
    const stepToRender = step ?? currentStep
    switch (stepToRender) {
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
                <Input id="rfc" placeholder="XAXX010101000" className="uppercase" {...rfcForm.register('rfc')} />
                {rfcForm.formState.errors.rfc && <p className="text-sm text-destructive mt-1">{rfcForm.formState.errors.rfc.message}</p>}
              </div>

              <div>
                <Label htmlFor="legalName">{t('conversionWizard.step1.legalNameLabel')}</Label>
                <Input id="legalName" placeholder={t('conversionWizard.step1.legalNamePlaceholder')} {...rfcForm.register('legalName')} />
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
                  onChange={async e => {
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
                  onChange={async e => {
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

      case 4: {
        // Calculate total monthly cost
        const totalMonthlyCost = selectedFeatures.reduce((sum, featureId) => {
          const feature = availableFeatures.find(f => f.id === featureId)
          const featureCode = feature?.code
          return sum + (featureCode ? FEATURE_PRICING[featureCode] || 0 : 0)
        }, 0)

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
                {availableFeatures.map(feature => {
                  const price = FEATURE_PRICING[feature.code] || 0
                  return (
                    <div
                      key={feature.id}
                      className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                        selectedFeatures.includes(feature.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        id={`feature-${feature.id}`}
                        checked={selectedFeatures.includes(feature.id)}
                        onCheckedChange={checked => {
                          if (checked) {
                            setSelectedFeatures([...selectedFeatures, feature.id])
                          } else {
                            setSelectedFeatures(selectedFeatures.filter(id => id !== feature.id))
                          }
                        }}
                        className="mt-0.5"
                      />
                      <label htmlFor={`feature-${feature.id}`} className="flex-1 cursor-pointer space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{feature.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              5 días gratis
                            </Badge>
                          </div>
                          <span className="text-sm font-semibold text-foreground">${price.toLocaleString()} MXN/mes</span>
                        </div>
                        {feature.description && <p className="text-sm text-muted-foreground">{feature.description}</p>}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pricing Summary */}
            {selectedFeatures.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Total mensual después del trial</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''} seleccionado
                        {selectedFeatures.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">${totalMonthlyCost.toLocaleString()} MXN</p>
                      <p className="text-xs text-muted-foreground">por mes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedFeatures.length === 0 && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-1 mt-0.5">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Tu cuenta incluirá sin costo:</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Gestión completa de menú y productos
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Procesamiento de órdenes y pagos
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5" />1 usuario staff incluido
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Reportes básicos de ventas
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                      <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Tip:</strong> Puedes agregar features premium en cualquier momento desde Configuración
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )
      }

      case 5:
        // Step 5: Stripe Payment (only if features selected)
        if (selectedFeatures.length > 0) {
          return (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">Método de pago</h3>
                <p className="mt-1 text-sm text-muted-foreground">Ingresa tu tarjeta para comenzar el trial gratuito de 5 días</p>
              </div>
              <StripePaymentMethod
                onPaymentMethodCreated={pmId => {
                  setPaymentMethodId(pmId)
                  setCurrentStep(currentStep + 1)
                }}
                buttonText="Continuar al resumen"
              />
            </div>
          )
        } else {
          // No features selected, skip to summary
          return renderStepContent(6)
        }

      case 6: {
        // Calculate total monthly cost for summary
        const totalMonthlyCost = selectedFeatures.reduce((sum, featureId) => {
          const feature = availableFeatures.find(f => f.id === featureId)
          const featureCode = feature?.code
          return sum + (featureCode ? FEATURE_PRICING[featureCode] || 0 : 0)
        }, 0)

        return (
          <div className="space-y-4">
            {/* Success header */}
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">¡Todo listo!</h4>
                <p className="text-xs text-green-700 dark:text-green-300">Revisa tu información antes de confirmar</p>
              </div>
            </div>

            {/* Plan summary */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h5 className="font-semibold text-sm mb-3">Plan seleccionado</h5>
                  {selectedFeatures.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="font-medium text-primary">Trial Premium - 5 días gratis</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Después del trial: ${totalMonthlyCost.toLocaleString()} MXN/mes</p>
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-foreground mb-2">Features incluidos:</p>
                        <ul className="space-y-1">
                          {selectedFeatures.map(featureId => {
                            const feature = availableFeatures.find(f => f.id === featureId)
                            if (!feature) return null
                            const price = feature.code ? FEATURE_PRICING[feature.code] : 0
                            return (
                              <li key={featureId} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{feature.name}</span>
                                <span className="font-medium">${price.toLocaleString()} MXN</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-foreground">Plan Gratuito</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sin cargo mensual • Puedes agregar features premium en cualquier momento
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t">
                  <h5 className="font-semibold text-sm mb-3">Información del negocio</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nombre del venue:</span>
                      <span className="font-medium">{venueName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RFC:</span>
                      <span className="font-medium">{formData.rfc || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Razón social:</span>
                      <span className="font-medium">{formData.legalName || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Confirmation message */}
            {selectedFeatures.length > 0 ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💳 <strong>Importante:</strong> No se realizará ningún cargo durante los 5 días de prueba. Tu suscripción comenzará
                  automáticamente después del período de prueba.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  🎉 <strong>¡Perfecto!</strong> Tu cuenta gratuita estará lista en segundos. Podrás comenzar a gestionar tu negocio
                  inmediatamente.
                </p>
              </div>
            )}
          </div>
        )
      }

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
          <DialogDescription>{t('conversionWizard.subtitle')}</DialogDescription>
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
        <div
          key={`step-${currentStep}`}
          className="min-h-[300px] max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        >
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('conversionWizard.back')}
          </Button>

          {/* Hide forward navigation on Step 5 (Stripe payment) when features selected - StripePaymentMethod has its own button */}
          {currentStep === 5 && selectedFeatures.length > 0 ? (
            <div></div>
          ) : currentStep < totalSteps ? (
            <Button onClick={handleNext} variant={getNextButtonVariant()}>
              {getNextButtonText()}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600">
              <Sparkles className="mr-2 h-4 w-4" />
              {getFinalButtonText()}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
