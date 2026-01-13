import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  CheckCircle2,
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Building2,
  User,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector'
import api from '@/api'
import { getVenueFeatures } from '@/services/features.service'
import { storage } from '@/firebase'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { Venue } from '@/types'

interface ConversionWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  venueSlug: string
  venueName: string
  venue?: Venue | null
}

type EntityType = 'PERSONA_FISICA' | 'PERSONA_MORAL'


// Document types for upload
type DocumentType = 'ID' | 'CSF' | 'DOMICILIO' | 'CARATULA' | 'ACTA' | 'PODER'

// Pricing in MXN (matches backend seed data and FeaturesStep)
const FEATURE_PRICING: Record<string, number> = {
  CHATBOT: 199,
  INVENTORY_TRACKING: 89,
  LOYALTY_PROGRAM: 599,
  ONLINE_ORDERING: 99,
  // TEMPORARILY DISABLED - Re-enable when ready for launch
  // ADVANCED_ANALYTICS: 499,
  // RESERVATIONS: 399,
}

export function ConversionWizard({ open, onOpenChange, venueId, venueSlug, venueName, venue }: ConversionWizardProps) {
  const { t } = useTranslation()
  const { t: tOnboarding } = useTranslation('onboarding')
  const { toast } = useToast()

  // Fetch full venue data when dialog opens (auth context venue doesn't include document URLs)
  const { data: fullVenue } = useQuery({
    queryKey: ['venue', 'full', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data.data || response.data
    },
    enabled: open && !!venueId,
    staleTime: 30_000,
  })

  // Entity type state
  const [entityType, setEntityType] = useState<EntityType | null>(null)

  // Current step
  const [currentStep, setCurrentStep] = useState(1)

  // Document files and URLs
  const [idDocumentFile, setIdDocumentFile] = useState<File | null>(null)
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null)
  const [uploadingIdDoc, setUploadingIdDoc] = useState(false)

  const [rfcDocumentFile, setRfcDocumentFile] = useState<File | null>(null)
  const [rfcDocumentUrl, setRfcDocumentUrl] = useState<string | null>(null)
  const [uploadingRfcDoc, setUploadingRfcDoc] = useState(false)

  const [comprobanteDomicilioFile, setComprobanteDomicilioFile] = useState<File | null>(null)
  const [comprobanteDomicilioUrl, setComprobanteDomicilioUrl] = useState<string | null>(null)
  const [uploadingComprobante, setUploadingComprobante] = useState(false)

  const [caratulaBancariaFile, setCaratulaBancariaFile] = useState<File | null>(null)
  const [caratulaBancariaUrl, setCaratulaBancariaUrl] = useState<string | null>(null)
  const [uploadingCaratula, setUploadingCaratula] = useState(false)

  // PERSONA_MORAL only documents
  const [actaDocumentFile, setActaDocumentFile] = useState<File | null>(null)
  const [actaDocumentUrl, setActaDocumentUrl] = useState<string | null>(null)
  const [uploadingActaDoc, setUploadingActaDoc] = useState(false)

  const [poderLegalFile, setPoderLegalFile] = useState<File | null>(null)
  const [poderLegalUrl, setPoderLegalUrl] = useState<string | null>(null)
  const [uploadingPoderLegal, setUploadingPoderLegal] = useState(false)

  // Features and payment
  const [availableFeatures, setAvailableFeatures] = useState<any[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [activeFeatureCodes, setActiveFeatureCodes] = useState<string[]>([])
  const [loadingFeatures, setLoadingFeatures] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dynamic total steps based on entity type
  // PERSONA_FISICA: 1-EntityType, 2-Docs1(INE+CSF), 3-Docs2(Domicilio+Caratula), 4-Features, 5-Payment, 6-Summary = 6 steps
  // PERSONA_MORAL: 1-EntityType, 2-Docs1(INE+CSF), 3-Docs2(Domicilio+Caratula), 4-Docs3(Acta+Poder), 5-Features, 6-Payment, 7-Summary = 7 steps
  const totalSteps = entityType === 'PERSONA_MORAL' ? 7 : 6
  const progress = (currentStep / totalSteps) * 100

  // Initialize states when dialog opens - reset basic states (not step)
  // This runs only once when dialog opens
  useEffect(() => {
    if (open) {
      // Reset file states (these are for new uploads only)
      setIdDocumentFile(null)
      setRfcDocumentFile(null)
      setComprobanteDomicilioFile(null)
      setCaratulaBancariaFile(null)
      setActaDocumentFile(null)
      setPoderLegalFile(null)

      // Reset uploading states
      setUploadingIdDoc(false)
      setUploadingRfcDoc(false)
      setUploadingComprobante(false)
      setUploadingCaratula(false)
      setUploadingActaDoc(false)
      setUploadingPoderLegal(false)

      // Reset features and payment
      setSelectedFeatures([])
      setPaymentMethodId(null)
      setIsSubmitting(false)
    }
  }, [open]) // Only depend on open

  // Pre-fill data from venue when fullVenue loads AND calculate starting step
  // This runs when fullVenue becomes available (separate from dialog open reset)
  useEffect(() => {
    if (open && fullVenue) {
      // Pre-fill entity type from venue if exists
      if (fullVenue.entityType) {
        setEntityType(fullVenue.entityType as EntityType)
      }

      // Pre-fill document URLs from fullVenue (which has all fields from API)
      setIdDocumentUrl(fullVenue.idDocumentUrl || null)
      setRfcDocumentUrl(fullVenue.rfcDocumentUrl || null)
      setComprobanteDomicilioUrl(fullVenue.comprobanteDomicilioUrl || null)
      setCaratulaBancariaUrl(fullVenue.caratulaBancariaUrl || null)
      setActaDocumentUrl(fullVenue.actaDocumentUrl || null)
      setPoderLegalUrl(fullVenue.poderLegalUrl || null)

      // Calculate starting step based on what's already filled
      // Skip entity type step if already set during onboarding
      let startingStep = 1

      // If entity type is set, skip step 1 and go directly to documents
      if (fullVenue.entityType) {
        startingStep = 2 // Documents step 1 (INE + CSF)
      }

      setCurrentStep(startingStep)
    } else if (open && !fullVenue) {
      // While loading, start at step 1
      setCurrentStep(1)
    }
  }, [open, fullVenue]) // Only run when fullVenue becomes available

  // Fetch available features AND active venue features when wizard opens
  useEffect(() => {
    const fetchFeatures = async () => {
      if (!open || !venueId) return

      setLoadingFeatures(true)
      try {
        // Fetch available features and venue's active features in parallel
        const [availableRes, venueFeatures] = await Promise.all([
          api.get('/api/v1/dashboard/features'),
          getVenueFeatures(venueId).catch(() => null), // Don't fail if this errors
        ])

        if (availableRes.data.success) {
          setAvailableFeatures(availableRes.data.data)

          // Extract codes of features that are already active on the venue
          if (venueFeatures?.activeFeatures) {
            const activeCodes = venueFeatures.activeFeatures
              .filter((f: { active: boolean }) => f.active)
              .map((f: { feature: { code: string } }) => f.feature.code)
            setActiveFeatureCodes(activeCodes)

            // Pre-select active features (so they appear checked)
            const activeIds = availableRes.data.data
              .filter((f: { code: string }) => activeCodes.includes(f.code))
              .map((f: { id: string }) => f.id)
            setSelectedFeatures(activeIds)
          }
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
  }, [open, venueId, t, toast])

  // Helper function to upload file to Firebase Storage
  const uploadFile = async (file: File, documentType: DocumentType): Promise<string | null> => {
    try {
      // Step 1: Send to backend for validation
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)

      const response = await api.post(
        `/api/v1/dashboard/venues/${venueId}/upload-document?type=${documentType.toLowerCase()}`,
        formDataUpload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      )

      if (!response.data.success) {
        throw new Error('Backend validation failed')
      }

      const { buffer, filename, mimeType } = response.data.data

      // Step 2: Convert base64 to Blob
      const base64Response = await fetch(`data:${mimeType};base64,${buffer}`)
      const blob = await base64Response.blob()

      // Step 3: Upload to Firebase Storage with renamed file
      const timestamp = Date.now()
      const fileExtension = filename.split('.').pop() || mimeType.split('/')[1]
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
        description: error?.response?.data?.message || t('conversionWizard.error.uploadFailed'),
        variant: 'destructive',
      })
      return null
    }
  }

  // Calculate step numbers based on entity type (without Business Info step)
  // PERSONA_FISICA: 1-EntityType, 2-Docs1, 3-Docs2, 4-Features, 5-Payment, 6-Summary
  // PERSONA_MORAL: 1-EntityType, 2-Docs1, 3-Docs2, 4-Docs3, 5-Features, 6-Payment, 7-Summary
  const getStepForFeatures = () => (entityType === 'PERSONA_MORAL' ? 5 : 4)
  const getStepForPayment = () => (entityType === 'PERSONA_MORAL' ? 6 : 5)
  const getStepForSummary = () => (entityType === 'PERSONA_MORAL' ? 7 : 6)

  // Check if all required documents are uploaded
  const areBaseDocumentsComplete = useMemo(() => {
    return !!idDocumentUrl && !!rfcDocumentUrl && !!comprobanteDomicilioUrl && !!caratulaBancariaUrl
  }, [idDocumentUrl, rfcDocumentUrl, comprobanteDomicilioUrl, caratulaBancariaUrl])

  const areMoralDocumentsComplete = useMemo(() => {
    if (entityType !== 'PERSONA_MORAL') return true
    return !!actaDocumentUrl // Poder legal is optional
  }, [entityType, actaDocumentUrl])

  const areAllDocumentsComplete = areBaseDocumentsComplete && areMoralDocumentsComplete

  // Calculate total monthly cost once (used in Features and Summary steps)
  const totalMonthlyCost = useMemo(() => {
    return selectedFeatures.reduce((sum, featureId) => {
      const feature = availableFeatures.find(f => f.id === featureId)
      return sum + (FEATURE_PRICING[feature?.code || ''] || 0)
    }, 0)
  }, [selectedFeatures, availableFeatures])

  const handleNext = async () => {
    let isValid = false

    if (currentStep === 1) {
      // Entity type selection
      isValid = !!entityType
      if (!isValid) {
        toast({
          title: t('conversionWizard.error.title'),
          description: t('conversionWizard.entityType.required'),
          variant: 'destructive',
        })
      }
    } else if (currentStep === 2) {
      // Documents step 1: INE + CSF
      isValid = !!idDocumentUrl && !!rfcDocumentUrl
      if (!isValid) {
        toast({
          title: t('conversionWizard.error.title'),
          description: t('conversionWizard.documents.step1Required'),
          variant: 'destructive',
        })
      }
    } else if (currentStep === 3) {
      // Documents step 2: Comprobante domicilio + Carátula bancaria
      isValid = !!comprobanteDomicilioUrl && !!caratulaBancariaUrl
      if (!isValid) {
        toast({
          title: t('conversionWizard.error.title'),
          description: t('conversionWizard.documents.step2Required'),
          variant: 'destructive',
        })
      }
    } else if (currentStep === 4 && entityType === 'PERSONA_MORAL') {
      // Documents step 3 (PERSONA_MORAL only): Acta + Poder Legal
      isValid = !!actaDocumentUrl
      if (!isValid) {
        toast({
          title: t('conversionWizard.error.title'),
          description: t('conversionWizard.documents.actaRequired'),
          variant: 'destructive',
        })
      }
    } else if (currentStep === getStepForFeatures()) {
      // Features selection
      isValid = true

      // If no features selected, skip payment step and go directly to summary
      if (selectedFeatures.length === 0) {
        setCurrentStep(getStepForSummary())
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
      // If on summary and no features selected, skip payment step
      if (currentStep === getStepForSummary() && selectedFeatures.length === 0) {
        setCurrentStep(getStepForFeatures())
      } else {
        setCurrentStep(currentStep - 1)
      }
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    // Defensive validation - ensure all required data is present
    if (!entityType) {
      toast({
        title: t('conversionWizard.error.title'),
        description: t('conversionWizard.entityType.required'),
        variant: 'destructive',
      })
      setCurrentStep(1)
      return
    }

    if (!idDocumentUrl || !rfcDocumentUrl) {
      toast({
        title: t('conversionWizard.error.title'),
        description: t('conversionWizard.documents.step1Required'),
        variant: 'destructive',
      })
      setCurrentStep(2)
      return
    }

    if (!comprobanteDomicilioUrl || !caratulaBancariaUrl) {
      toast({
        title: t('conversionWizard.error.title'),
        description: t('conversionWizard.documents.step2Required'),
        variant: 'destructive',
      })
      setCurrentStep(3)
      return
    }

    if (entityType === 'PERSONA_MORAL' && !actaDocumentUrl) {
      toast({
        title: t('conversionWizard.error.title'),
        description: t('conversionWizard.documents.actaRequired'),
        variant: 'destructive',
      })
      setCurrentStep(4)
      return
    }

    setIsSubmitting(true)

    try {
      // Convert feature IDs to feature codes, excluding already-active features
      const featureCodes = selectedFeatures
        .map(featureId => {
          const feature = availableFeatures.find(f => f.id === featureId)
          return feature?.code
        })
        .filter((code): code is string => !!code && !activeFeatureCodes.includes(code))

      // Build request payload - business info will be extracted from CSF document during KYC
      const payload: Record<string, unknown> = {
        entityType,
        // Required documents for all
        idDocumentUrl,
        rfcDocumentUrl,
        comprobanteDomicilioUrl,
        caratulaBancariaUrl,
      }

      // Add PERSONA_MORAL documents if applicable
      if (entityType === 'PERSONA_MORAL') {
        payload.actaDocumentUrl = actaDocumentUrl
        if (poderLegalUrl) {
          payload.poderLegalUrl = poderLegalUrl
        }
      }

      // Only include payment and features if they have values
      if (paymentMethodId) {
        payload.paymentMethodId = paymentMethodId
      }
      if (featureCodes.length > 0) {
        payload.selectedFeatures = featureCodes
      }

      // Call API to convert venue from demo to real
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/convert-from-demo`, payload)

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
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper to get dynamic button text
  const getNextButtonText = () => {
    if (currentStep === getStepForFeatures()) {
      return selectedFeatures.length > 0 ? tOnboarding('shared.continueToPayment') : tOnboarding('shared.continueWithoutPremium')
    }
    return t('conversionWizard.next')
  }

  const getNextButtonVariant = () => {
    if (currentStep === getStepForFeatures() && selectedFeatures.length === 0) {
      return 'outline' as const
    }
    return 'default' as const
  }

  const getFinalButtonText = () => {
    return selectedFeatures.length > 0 ? tOnboarding('shared.startFreeTrial') : tOnboarding('shared.activateFreeAccount')
  }

  // Render document upload box
  const renderDocumentUpload = (
    id: string,
    label: string,
    hint: string,
    file: File | null,
    setFile: (file: File | null) => void,
    url: string | null,
    setUrl: (url: string | null) => void,
    uploading: boolean,
    setUploading: (uploading: boolean) => void,
    docType: DocumentType,
    required: boolean = true,
  ) => (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors ${
        url ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
      }`}
    >
      <Upload className={`h-10 w-10 mx-auto mb-3 ${url ? 'text-green-600' : 'text-muted-foreground'}`} />
      <p className="text-sm font-medium mb-1">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </p>
      <p className="text-xs text-muted-foreground mb-3">{hint}</p>
      <div className="flex flex-col items-center gap-2">
        <label
          htmlFor={id}
          className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 py-2"
        >
          <Upload className="mr-2 h-4 w-4" />
          {url ? t('conversionWizard.shared.changeFile') : t('conversionWizard.shared.selectFile')}
        </label>
        <Input
          id={id}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={async e => {
            const selectedFile = e.target.files?.[0]
            if (selectedFile) {
              setFile(selectedFile)
              setUploading(true)

              const uploadedUrl = await uploadFile(selectedFile, docType)
              if (uploadedUrl) {
                setUrl(uploadedUrl)
              }

              setUploading(false)
              e.target.value = ''
            }
          }}
        />
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>{t('conversionWizard.shared.uploading')}</span>
          </div>
        )}
        {file && !uploading && url && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-green-600 truncate max-w-[200px]">{file.name}</span>
          </div>
        )}
        {!file && !uploading && url && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-green-600">{t('conversionWizard.documents.alreadyUploaded', { defaultValue: 'Documento ya cargado' })}</span>
          </div>
        )}
      </div>
    </div>
  )

  const renderStepContent = () => {
    // Step 1: Entity Type Selection
    if (currentStep === 1) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-semibold text-sm">{t('conversionWizard.entityType.title')}</h4>
              <p className="text-xs text-muted-foreground">{t('conversionWizard.entityType.description')}</p>
            </div>
          </div>

          <RadioGroup
            value={entityType || ''}
            onValueChange={value => setEntityType(value as EntityType)}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem value="PERSONA_FISICA" id="persona-fisica" className="peer sr-only" />
              <Label
                htmlFor="persona-fisica"
                className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <User className="h-10 w-10 mb-3 text-primary" />
                <span className="font-semibold">{t('conversionWizard.entityType.fisica')}</span>
                <span className="text-xs text-muted-foreground text-center mt-2">
                  {t('conversionWizard.entityType.fisicaDescription')}
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="PERSONA_MORAL" id="persona-moral" className="peer sr-only" />
              <Label
                htmlFor="persona-moral"
                className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Building2 className="h-10 w-10 mb-3 text-primary" />
                <span className="font-semibold">{t('conversionWizard.entityType.moral')}</span>
                <span className="text-xs text-muted-foreground text-center mt-2">
                  {t('conversionWizard.entityType.moralDescription')}
                </span>
              </Label>
            </div>
          </RadioGroup>

          {entityType && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {t('conversionWizard.entityType.documentsNeeded')}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
                    <li>• {t('conversionWizard.documents.ine')}</li>
                    <li>• {t('conversionWizard.documents.csf')}</li>
                    <li>• {t('conversionWizard.documents.comprobanteDomicilio')}</li>
                    <li>• {t('conversionWizard.documents.caratulaBancaria')}</li>
                    {entityType === 'PERSONA_MORAL' && (
                      <>
                        <li>• {t('conversionWizard.documents.actaConstitutiva')}</li>
                        <li>• {t('conversionWizard.documents.poderLegal')} ({t('conversionWizard.documents.optional')})</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }

    // Step 2: Documents Part 1 (INE + CSF)
    if (currentStep === 2) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-semibold text-sm">{t('conversionWizard.documents.step1Title')}</h4>
              <p className="text-xs text-muted-foreground">{t('conversionWizard.documents.step1Description')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDocumentUpload(
              'idDocument',
              t('conversionWizard.documents.ine'),
              t('conversionWizard.documents.ineHint'),
              idDocumentFile,
              setIdDocumentFile,
              idDocumentUrl,
              setIdDocumentUrl,
              uploadingIdDoc,
              setUploadingIdDoc,
              'ID',
              true,
            )}
            {renderDocumentUpload(
              'rfcDocument',
              t('conversionWizard.documents.csf'),
              t('conversionWizard.documents.csfHint'),
              rfcDocumentFile,
              setRfcDocumentFile,
              rfcDocumentUrl,
              setRfcDocumentUrl,
              uploadingRfcDoc,
              setUploadingRfcDoc,
              'CSF',
              true,
            )}
          </div>
        </div>
      )
    }

    // Step 3: Documents Part 2 (Comprobante Domicilio + Carátula Bancaria)
    if (currentStep === 3) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-semibold text-sm">{t('conversionWizard.documents.step2Title')}</h4>
              <p className="text-xs text-muted-foreground">{t('conversionWizard.documents.step2Description')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDocumentUpload(
              'comprobanteDomicilio',
              t('conversionWizard.documents.comprobanteDomicilio'),
              t('conversionWizard.documents.comprobanteDomicilioHint'),
              comprobanteDomicilioFile,
              setComprobanteDomicilioFile,
              comprobanteDomicilioUrl,
              setComprobanteDomicilioUrl,
              uploadingComprobante,
              setUploadingComprobante,
              'DOMICILIO',
              true,
            )}
            {renderDocumentUpload(
              'caratulaBancaria',
              t('conversionWizard.documents.caratulaBancaria'),
              t('conversionWizard.documents.caratulaBancariaHint'),
              caratulaBancariaFile,
              setCaratulaBancariaFile,
              caratulaBancariaUrl,
              setCaratulaBancariaUrl,
              uploadingCaratula,
              setUploadingCaratula,
              'CARATULA',
              true,
            )}
          </div>
        </div>
      )
    }

    // Step 4 (PERSONA_MORAL only): Documents Part 3 (Acta + Poder Legal)
    if (currentStep === 4 && entityType === 'PERSONA_MORAL') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-semibold text-sm">{t('conversionWizard.documents.step3Title')}</h4>
              <p className="text-xs text-muted-foreground">{t('conversionWizard.documents.step3Description')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDocumentUpload(
              'actaDocument',
              t('conversionWizard.documents.actaConstitutiva'),
              t('conversionWizard.documents.actaHint'),
              actaDocumentFile,
              setActaDocumentFile,
              actaDocumentUrl,
              setActaDocumentUrl,
              uploadingActaDoc,
              setUploadingActaDoc,
              'ACTA',
              true,
            )}
            {renderDocumentUpload(
              'poderLegal',
              t('conversionWizard.documents.poderLegal'),
              t('conversionWizard.documents.poderLegalHint'),
              poderLegalFile,
              setPoderLegalFile,
              poderLegalUrl,
              setPoderLegalUrl,
              uploadingPoderLegal,
              setUploadingPoderLegal,
              'PODER',
              false,
            )}
          </div>
        </div>
      )
    }

    // Features step
    if (currentStep === getStepForFeatures()) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-semibold text-sm">{t('conversionWizard.features.title')}</h4>
              <p className="text-xs text-muted-foreground">{t('conversionWizard.features.description')}</p>
            </div>
          </div>

          {loadingFeatures ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('conversionWizard.features.loading')}</p>
            </div>
          ) : availableFeatures.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('conversionWizard.features.noFeatures')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableFeatures.map(feature => {
                const price = FEATURE_PRICING[feature.code] || 0
                const isAlreadyActive = activeFeatureCodes.includes(feature.code)
                return (
                  <div
                    key={feature.id}
                    className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                      isAlreadyActive
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                        : selectedFeatures.includes(feature.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      id={`feature-${feature.id}`}
                      checked={selectedFeatures.includes(feature.id)}
                      disabled={isAlreadyActive}
                      onCheckedChange={checked => {
                        if (isAlreadyActive) return // Don't allow toggling active features
                        if (checked) {
                          setSelectedFeatures([...selectedFeatures, feature.id])
                        } else {
                          setSelectedFeatures(selectedFeatures.filter(id => id !== feature.id))
                        }
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor={`feature-${feature.id}`} className={`flex-1 space-y-1 ${isAlreadyActive ? '' : 'cursor-pointer'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{feature.name}</span>
                          {isAlreadyActive ? (
                            <Badge variant="outline" className="text-xs border-green-500 text-green-600 dark:text-green-400">
                              {t('conversionWizard.features.alreadyActive')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {tOnboarding('shared.twoDaysFree')}
                            </Badge>
                          )}
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

          {selectedFeatures.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{tOnboarding('shared.totalMonthlyAfterTrial')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tOnboarding('shared.featuresSelected', { count: selectedFeatures.length })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">${totalMonthlyCost.toLocaleString()} MXN</p>
                    <p className="text-xs text-muted-foreground">{tOnboarding('shared.perMonth')}</p>
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
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {tOnboarding('shared.freeAccountIncludes')}
                      </p>
                      <ul className="mt-2 space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {tOnboarding('shared.freeFeatures.menuManagement')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {tOnboarding('shared.freeFeatures.orderProcessing')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {tOnboarding('shared.freeFeatures.staffIncluded')}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {tOnboarding('shared.freeFeatures.basicReports')}
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>{tOnboarding('shared.tip')}</strong> {tOnboarding('shared.tipPremiumLater')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )
    }

    // Payment step
    if (currentStep === getStepForPayment()) {
      if (selectedFeatures.length > 0) {
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">{tOnboarding('shared.paymentMethod')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {paymentMethodId ? tOnboarding('shared.confirmPaymentMethod') : tOnboarding('shared.selectPaymentMethod')}
              </p>
            </div>
            <PaymentMethodSelector
              venueId={venueId}
              onPaymentMethodSelected={pmId => {
                setPaymentMethodId(pmId)
                setCurrentStep(currentStep + 1)
              }}
              buttonText={tOnboarding('shared.continueToSummary')}
            />
          </div>
        )
      } else {
        // Skip to summary if no features selected
        return renderStepContent()
      }
    }

    // Summary step
    if (currentStep === getStepForSummary()) {
      const allDocuments = [
        { label: t('conversionWizard.documents.ine'), completed: !!idDocumentUrl, required: true },
        { label: t('conversionWizard.documents.csf'), completed: !!rfcDocumentUrl, required: true },
        { label: t('conversionWizard.documents.comprobanteDomicilio'), completed: !!comprobanteDomicilioUrl, required: true },
        { label: t('conversionWizard.documents.caratulaBancaria'), completed: !!caratulaBancariaUrl, required: true },
        ...(entityType === 'PERSONA_MORAL'
          ? [
              { label: t('conversionWizard.documents.actaConstitutiva'), completed: !!actaDocumentUrl, required: true },
              { label: t('conversionWizard.documents.poderLegal'), completed: !!poderLegalUrl, required: false },
            ]
          : []),
      ]

      return (
        <div className="space-y-4">
          {/* Success header */}
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">{tOnboarding('shared.allReady')}</h4>
              <p className="text-xs text-green-700 dark:text-green-300">{tOnboarding('shared.reviewBeforeConfirm')}</p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Entity Type */}
              <div>
                <h5 className="font-semibold text-sm mb-2">{t('conversionWizard.entityType.title')}</h5>
                <div className="flex items-center gap-2">
                  {entityType === 'PERSONA_FISICA' ? (
                    <User className="h-4 w-4 text-primary" />
                  ) : (
                    <Building2 className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-medium">
                    {entityType === 'PERSONA_FISICA'
                      ? t('conversionWizard.entityType.fisica')
                      : t('conversionWizard.entityType.moral')}
                  </span>
                </div>
              </div>

              {/* Plan summary */}
              <div className="pt-3 border-t">
                <h5 className="font-semibold text-sm mb-3">{tOnboarding('shared.selectedPlan')}</h5>
                {selectedFeatures.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">{tOnboarding('shared.trialPremium')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tOnboarding('shared.afterTrialCost', { cost: totalMonthlyCost.toLocaleString() })}
                    </p>
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-foreground mb-2">{tOnboarding('shared.featuresIncluded')}</p>
                      <ul className="space-y-1">
                        {selectedFeatures.map(featureId => {
                          const feature = availableFeatures.find(f => f.id === featureId)
                          if (!feature) return null
                          const price = feature.code ? (FEATURE_PRICING[feature.code] ?? 0) : 0
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
                      <span className="font-medium text-foreground">{tOnboarding('shared.freePlan')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tOnboarding('shared.noMonthlyCharge')} • {tOnboarding('shared.addPremiumAnytime')}
                    </p>
                  </div>
                )}
              </div>

              {/* Business info */}
              <div className="pt-3 border-t">
                <h5 className="font-semibold text-sm mb-3">{tOnboarding('shared.businessInfo')}</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tOnboarding('shared.venueName')}</span>
                    <span className="font-medium">{venueName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('conversionWizard.summary.businessInfoNote', {
                      defaultValue: 'La información fiscal (RFC, razón social) se extraerá de tu Constancia de Situación Fiscal durante el proceso de verificación.'
                    })}
                  </p>
                </div>
              </div>

              {/* Documents */}
              <div className="pt-3 border-t">
                <h5 className="font-semibold text-sm mb-3">{t('conversionWizard.documents.title')}</h5>
                <div className="space-y-2 text-sm">
                  {allDocuments.map(doc => (
                    <div key={doc.label} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{doc.label}</span>
                      <div className="flex items-center gap-1">
                        {doc.completed ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-green-600">{t('conversionWizard.documents.completed')}</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {doc.required ? t('conversionWizard.documents.pending') : t('conversionWizard.documents.optional')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KYC Notice */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{t('conversionWizard.summary.kycNotice.title')}</strong>{' '}
              {t('conversionWizard.summary.kycNotice.description')}
            </p>
          </div>

          {/* Confirmation message */}
          {selectedFeatures.length > 0 ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{tOnboarding('shared.important')}</strong> {tOnboarding('shared.noChargeNotice')}
              </p>
            </div>
          ) : (
            <div className="p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>{tOnboarding('shared.perfect')}</strong> {tOnboarding('shared.freeAccountReady')}
              </p>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
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
          className="min-h-[300px] max-h-[55vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        >
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('conversionWizard.back')}
          </Button>

          {/* Hide forward navigation on Payment step when features selected - PaymentMethodSelector has its own button */}
          {currentStep === getStepForPayment() && selectedFeatures.length > 0 ? (
            <div></div>
          ) : currentStep < totalSteps ? (
            <Button onClick={handleNext} variant={getNextButtonVariant()}>
              {getNextButtonText()}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !areAllDocumentsComplete}
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {getFinalButtonText()}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
