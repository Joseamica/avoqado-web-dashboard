import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertCircle, Upload, Check, Loader2, FileText, Building2, User } from 'lucide-react'
import { OnboardingStepProps } from '../OnboardingWizard'
import { useToast } from '@/hooks/use-toast'
import { NavigationButtons } from '../components/NavigationButtons'
import { useAuth } from '@/context/AuthContext'
import api from '@/api'

export type EntityType = 'PERSONA_FISICA' | 'PERSONA_MORAL'

export interface KYCDocumentsData {
  entityType: EntityType
  documents: {
    ineUrl?: string
    rfcDocumentUrl?: string
    comprobanteDomicilioUrl?: string
    caratulaBancariaUrl?: string
    actaDocumentUrl?: string
    poderLegalUrl?: string
  }
}

interface DocumentConfig {
  key: string
  label: string
  description: string
  required: boolean
}

interface KYCDocumentsStepProps extends OnboardingStepProps {
  onSave: (data: KYCDocumentsData) => void
  initialValue?: KYCDocumentsData
}

// Map document key to backend API document key
const DOC_KEY_TO_API_KEY: Record<string, string> = {
  ineUrl: 'ine',
  rfcDocumentUrl: 'rfcDocument',
  comprobanteDomicilioUrl: 'comprobanteDomicilio',
  caratulaBancariaUrl: 'caratulaBancaria',
  actaDocumentUrl: 'actaDocument',
  poderLegalUrl: 'poderLegal',
}

export function KYCDocumentsStep({ onNext, onPrevious, isFirstStep, onSave, initialValue }: KYCDocumentsStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const { user } = useAuth()

  const [entityType, setEntityType] = useState<EntityType | null>(initialValue?.entityType || null)
  const [documents, setDocuments] = useState<KYCDocumentsData['documents']>(initialValue?.documents || {})
  const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({})

  // Get required documents based on entity type
  const getRequiredDocuments = (type: EntityType | null): string[] => {
    const commonDocs = ['ineUrl', 'rfcDocumentUrl', 'comprobanteDomicilioUrl', 'caratulaBancariaUrl']

    if (type === 'PERSONA_MORAL') {
      return ['actaDocumentUrl', ...commonDocs]
    }

    return commonDocs
  }

  // Document configurations
  const allDocuments: DocumentConfig[] = useMemo(() => {
    const requiredKeys = getRequiredDocuments(entityType)

    return [
      {
        key: 'actaDocumentUrl',
        label: t('kycDocuments.documents.actaConstitutiva', { defaultValue: 'Acta Constitutiva' }),
        description: t('kycDocuments.documents.actaConstitutivaDesc', { defaultValue: 'Documento legal de constitución' }),
        required: requiredKeys.includes('actaDocumentUrl'),
      },
      {
        key: 'ineUrl',
        label: t('kycDocuments.documents.ine', { defaultValue: 'Identificación Oficial (INE/IFE)' }),
        description: t('kycDocuments.documents.ineDesc', { defaultValue: 'Identificación del representante legal' }),
        required: requiredKeys.includes('ineUrl'),
      },
      {
        key: 'rfcDocumentUrl',
        label: t('kycDocuments.documents.rfc', { defaultValue: 'Constancia de Situación Fiscal' }),
        description: t('kycDocuments.documents.rfcDesc', { defaultValue: 'Documento oficial del SAT que contiene el RFC (debe ser menor a 3 meses)' }),
        required: requiredKeys.includes('rfcDocumentUrl'),
      },
      {
        key: 'comprobanteDomicilioUrl',
        label: t('kycDocuments.documents.comprobante', { defaultValue: 'Comprobante de Domicilio' }),
        description: t('kycDocuments.documents.comprobanteDesc', { defaultValue: 'Recibo de luz, agua o teléfono' }),
        required: requiredKeys.includes('comprobanteDomicilioUrl'),
      },
      {
        key: 'caratulaBancariaUrl',
        label: t('kycDocuments.documents.caratula', { defaultValue: 'Carátula Bancaria' }),
        description: t('kycDocuments.documents.caratulaDesc', { defaultValue: 'Estado de cuenta con CLABE visible' }),
        required: requiredKeys.includes('caratulaBancariaUrl'),
      },
      {
        key: 'poderLegalUrl',
        label: t('kycDocuments.documents.poderLegal', { defaultValue: 'Poder Legal' }),
        description: t('kycDocuments.documents.poderLegalDesc', { defaultValue: 'Poder notarial del representante legal (opcional)' }),
        required: false, // Always optional
      },
    ]
  }, [entityType, t])

  // Filter documents to show based on entity type
  const visibleDocuments = useMemo(() => {
    if (!entityType) return []

    return allDocuments.filter(doc => {
      // Always show if document is uploaded
      if (documents[doc.key as keyof typeof documents]) return true

      // Show Acta only for PERSONA_MORAL
      if (doc.key === 'actaDocumentUrl' && entityType === 'PERSONA_FISICA') return false

      // Show Poder Legal only for PERSONA_MORAL (optional)
      if (doc.key === 'poderLegalUrl' && entityType === 'PERSONA_FISICA') return false

      return true
    })
  }, [entityType, allDocuments, documents])

  // Check if all required documents are uploaded
  const allRequiredDocsUploaded = useMemo(() => {
    if (!entityType) return false

    const requiredKeys = getRequiredDocuments(entityType)
    return requiredKeys.every(key => documents[key as keyof typeof documents])
  }, [entityType, documents])

  // Handle file upload via backend API
  const handleFileUpload = async (documentKey: string, file: File) => {
    if (!user?.organizationId) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: 'Organization ID is missing. Please log in again.',
      })
      return
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: t('kycDocuments.errors.invalidFileType', { defaultValue: 'Tipo de archivo inválido' }),
        description: t('kycDocuments.errors.invalidFileTypeDesc', { defaultValue: 'Solo se permiten archivos PDF, PNG, JPG' }),
      })
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: t('kycDocuments.errors.fileTooLarge', { defaultValue: 'Archivo muy grande' }),
        description: t('kycDocuments.errors.fileTooLargeDesc', { defaultValue: 'El archivo no debe superar los 10MB' }),
      })
      return
    }

    setUploadingDocs(prev => ({ ...prev, [documentKey]: true }))

    try {
      // Get the API document key (e.g., 'ineUrl' -> 'ine')
      const apiDocKey = DOC_KEY_TO_API_KEY[documentKey] || documentKey

      // Upload via backend API
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.put(
        `/api/v1/onboarding/organizations/${user.organizationId}/kyc/document/${apiDocKey}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      // Update local state with the URL returned from backend
      const downloadUrl = response.data.data.url
      setDocuments(prev => ({ ...prev, [documentKey]: downloadUrl }))

      toast({
        title: t('kycDocuments.success.uploaded', { defaultValue: 'Documento subido' }),
        description: t('kycDocuments.success.uploadedDesc', { defaultValue: 'El documento se guardó correctamente' }),
      })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        variant: 'destructive',
        title: t('kycDocuments.errors.uploadFailed', { defaultValue: 'Error al subir' }),
        description: error.response?.data?.message || t('kycDocuments.errors.uploadFailedDesc', { defaultValue: 'No se pudo subir el documento. Intenta nuevamente.' }),
      })
    } finally {
      setUploadingDocs(prev => ({ ...prev, [documentKey]: false }))
    }
  }

  const handleContinue = () => {
    if (!entityType) {
      toast({
        variant: 'destructive',
        title: t('kycDocuments.errors.entityTypeRequired', { defaultValue: 'Selecciona el tipo de persona' }),
        description: t('kycDocuments.errors.entityTypeRequiredDesc', { defaultValue: 'Debes seleccionar si eres Persona Física o Moral' }),
      })
      return
    }

    if (!allRequiredDocsUploaded) {
      toast({
        variant: 'destructive',
        title: t('kycDocuments.errors.missingDocs', { defaultValue: 'Documentos faltantes' }),
        description: t('kycDocuments.errors.missingDocsDesc', { defaultValue: 'Debes subir todos los documentos requeridos' }),
      })
      return
    }

    onSave({ entityType, documents })
    onNext()
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {t('kycDocuments.title', { defaultValue: 'Documentación Fiscal' })}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t('kycDocuments.subtitle', { defaultValue: 'Sube los documentos requeridos para verificar tu negocio' })}
        </p>
      </div>

      {/* Entity Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('kycDocuments.entityType.title', { defaultValue: 'Tipo de Persona' })}
          </CardTitle>
          <CardDescription>
            {t('kycDocuments.entityType.subtitle', { defaultValue: 'Selecciona el tipo de contribuyente' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={entityType || ''}
            onValueChange={value => setEntityType(value as EntityType)}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <RadioGroupItem value="PERSONA_FISICA" id="fisica" className="peer sr-only" />
              <Label
                htmlFor="fisica"
                className="flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <User className="mb-3 h-8 w-8" />
                <div className="text-center">
                  <p className="font-medium">
                    {t('kycDocuments.entityType.personaFisica', { defaultValue: 'Persona Física' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('kycDocuments.entityType.personaFisicaDesc', { defaultValue: 'Individuo con actividad empresarial' })}
                  </p>
                </div>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="PERSONA_MORAL" id="moral" className="peer sr-only" />
              <Label
                htmlFor="moral"
                className="flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Building2 className="mb-3 h-8 w-8" />
                <div className="text-center">
                  <p className="font-medium">
                    {t('kycDocuments.entityType.personaMoral', { defaultValue: 'Persona Moral' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('kycDocuments.entityType.personaMoralDesc', { defaultValue: 'Empresa o sociedad constituida' })}
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      {entityType && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            {t('kycDocuments.documentsTitle', { defaultValue: 'Documentos Requeridos' })}
          </h3>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleDocuments.map(doc => {
              const hasDoc = !!documents[doc.key as keyof typeof documents]
              const isUploading = uploadingDocs[doc.key]
              const isMissing = doc.required && !hasDoc

              return (
                <Card
                  key={doc.key}
                  className={`flex flex-col ${
                    isMissing
                      ? 'border-2 border-destructive/50 bg-destructive/5'
                      : hasDoc
                        ? 'border-2 border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                        : ''
                  }`}
                >
                  <CardHeader className="flex-1 pb-3">
                    <div className="flex items-start gap-2">
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                          isMissing
                            ? 'bg-destructive/20'
                            : hasDoc
                              ? 'bg-green-500/20'
                              : 'bg-primary/10'
                        }`}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : isMissing ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : hasDoc ? (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <FileText className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <CardTitle className={`text-sm ${isMissing ? 'text-destructive' : 'text-foreground'}`}>
                            {doc.label}
                          </CardTitle>
                          {doc.required && <span className="text-xs font-semibold text-destructive">*</span>}
                        </div>
                        <CardDescription className="mt-0.5 min-h-[2.5rem] text-xs">{doc.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      id={`file-input-${doc.key}`}
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(doc.key, file)
                        e.target.value = ''
                      }}
                      className="hidden"
                    />

                    {/* Upload button */}
                    <Button
                      variant={isMissing ? 'destructive' : hasDoc ? 'outline' : 'outline'}
                      size="sm"
                      className="w-full"
                      onClick={() => document.getElementById(`file-input-${doc.key}`)?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('kycDocuments.uploading', { defaultValue: 'Subiendo...' })}
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          {hasDoc
                            ? t('kycDocuments.changeDocument', { defaultValue: 'Cambiar documento' })
                            : t('kycDocuments.uploadDocument', { defaultValue: 'Subir Documentación' })}
                        </>
                      )}
                    </Button>

                    {/* Required message - fixed height to maintain alignment */}
                    <p className={`h-5 text-center text-sm font-medium ${isMissing ? 'text-destructive' : 'text-transparent'}`}>
                      {t('kycDocuments.required', { defaultValue: 'Esta documentación es requerida' })}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Info notice */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('kycDocuments.notice.title', { defaultValue: 'Verificación de documentos' })}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('kycDocuments.notice.description', {
                  defaultValue: 'Tus documentos serán revisados por nuestro equipo. Este proceso puede tomar hasta 48 horas hábiles.',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Notice */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{t('kycDocuments.requiredNotice')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fixed Navigation buttons - NO SKIP BUTTON */}
      <NavigationButtons
        onPrevious={onPrevious}
        onContinue={handleContinue}
        isFirstStep={isFirstStep}
        continueDisabled={!entityType || !allRequiredDocsUploaded}
      />
    </div>
  )
}
