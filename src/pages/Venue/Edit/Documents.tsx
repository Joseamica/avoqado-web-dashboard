import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, ExternalLink, AlertCircle, Upload, Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Link } from 'react-router-dom'
import api from '@/api'
import { useVenueEditActions } from '../VenueEditLayout'
import { useToast } from '@/hooks/use-toast'

interface VenueDocuments {
  id: string
  name: string
  // Tax documents
  taxDocumentUrl: string | null
  actaDocumentUrl: string | null
  idDocumentUrl: string | null
  // KYC documents
  rfcDocumentUrl: string | null
  comprobanteDomicilioUrl: string | null
  caratulaBancariaUrl: string | null
  poderLegalUrl: string | null
  // Fiscal info
  rfc: string | null
  legalName: string | null
  fiscalRegime: string | null
  entityType: 'PERSONA_FISICA' | 'PERSONA_MORAL' | null
  // KYC status
  kycStatus: string
  kycRejectionReason: string | null
  kycRejectedDocuments: string[] // Array of rejected document keys
}

interface DocumentConfig {
  key: string
  label: string
  description: string
  url: string | null
  required: boolean
}

export default function VenueDocuments() {
  const { t } = useTranslation('venue')
  const { venueId, venueSlug } = useCurrentVenue()
  const { setActions } = useVenueEditActions()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Track selected files (stored in memory, not uploaded yet)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [missingDocKeys, setMissingDocKeys] = useState<string[]>([])

  const { data: venue, isLoading } = useQuery<VenueDocuments>({
    queryKey: ['venue-documents', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  // Determine required documents based on entityType
  const getRequiredDocuments = (entityType: 'PERSONA_FISICA' | 'PERSONA_MORAL' | null): string[] => {
    const commonDocs = ['ineUrl', 'rfcDocumentUrl', 'comprobanteDomicilioUrl', 'caratulaBancariaUrl']

    if (entityType === 'PERSONA_MORAL') {
      // Persona Moral: Acta + Poder + Common docs
      return ['actaDocumentUrl', 'poderLegalUrl', ...commonDocs]
    }

    // Persona Física: Only common docs
    return commonDocs
  }

  // Submit all documents together (batch upload)
  const handleSubmitDocuments = useCallback(async () => {
    if (!venue) return

    try {
      setIsSubmitting(true)

      // Check if there are any files to upload
      if (Object.keys(selectedFiles).length === 0) {
        toast({
          title: t('edit.documents.noChanges', { defaultValue: 'Sin cambios' }),
          description: t('edit.documents.noChangesDesc', { defaultValue: 'No hay archivos nuevos para subir' }),
        })
        setIsSubmitting(false)
        return
      }

      // Get required documents based on entityType
      const requiredDocs = getRequiredDocuments(venue.entityType)

      // Check which required documents are missing (not uploaded AND not in selectedFiles)
      const missingDocs = requiredDocs.filter(docKey => {
        // Check if document already exists in venue
        const fieldName = docKey === 'ineUrl' ? 'idDocumentUrl' : docKey
        const existingDoc = venue[fieldName as keyof VenueDocuments]

        // Document is missing if it doesn't exist AND user didn't select it
        return !existingDoc && !selectedFiles[docKey]
      })

      if (missingDocs.length > 0) {
        // Mark missing documents in UI
        setMissingDocKeys(missingDocs)

        // Map document keys to labels
        const docLabels: Record<string, string> = {
          ineUrl: t('edit.documents.idDocument', { defaultValue: 'INE del Representante Legal' }),
          rfcDocumentUrl: t('edit.documents.taxDocument', { defaultValue: 'Constancia de Situación Fiscal' }),
          comprobanteDomicilioUrl: t('edit.documents.comprobanteDomicilio', { defaultValue: 'Comprobante de Domicilio' }),
          caratulaBancariaUrl: t('edit.documents.caratulaBancaria', { defaultValue: 'Carátula Bancaria' }),
          actaDocumentUrl: t('edit.documents.actaDocument', { defaultValue: 'Acta Constitutiva' }),
          poderLegalUrl: t('edit.documents.poderLegal', { defaultValue: 'Poder del Representante Legal' }),
        }

        const missingLabels = missingDocs.map(key => docLabels[key] || key)

        toast({
          variant: 'destructive',
          title: t('edit.documents.missingDocuments', { defaultValue: 'Documentos faltantes' }),
          description: t('edit.documents.missingDocumentsDesc', {
            defaultValue: `Por favor sube los siguientes documentos: ${missingLabels.join(', ')}`,
          }),
        })

        // Scroll to first missing document
        setTimeout(() => {
          const firstMissingElement = document.getElementById(`doc-card-${missingDocs[0]}`)
          if (firstMissingElement) {
            firstMissingElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)

        return
      }

      // Clear missing docs markers if validation passes
      setMissingDocKeys([])

      // Create FormData with all selected files
      const formData = new FormData()
      Object.entries(selectedFiles).forEach(([key, file]) => {
        formData.append(key, file)
      })

      // Upload all documents together
      await api.post(`/api/v1/dashboard/venues/${venueId}/kyc/resubmit`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast({
        title: t('edit.documents.uploadSuccess', { defaultValue: 'Documentos subidos exitosamente' }),
        description: t('edit.documents.uploadSuccessDesc', { defaultValue: 'Los documentos han sido enviados para revisión' }),
      })

      // Clear selected files and refresh venue data
      setSelectedFiles({})
      queryClient.invalidateQueries({ queryKey: ['venue-documents', venueId] })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        variant: 'destructive',
        title: t('edit.documents.uploadError', { defaultValue: 'Error al subir documentos' }),
        description: error.response?.data?.message || t('edit.documents.uploadErrorDesc', { defaultValue: 'No se pudieron subir los documentos. Intenta nuevamente.' }),
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [venue, selectedFiles, venueId, queryClient, toast, t])

  // Handle file selection (store in memory)
  const handleFileChange = (documentKey: string, file: File | null) => {
    if (!file) {
      // Remove file from selected
      setSelectedFiles(prev => {
        const newFiles = { ...prev }
        delete newFiles[documentKey]
        return newFiles
      })
      return
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: t('edit.documents.invalidFileType', { defaultValue: 'Tipo de archivo inválido' }),
        description: t('edit.documents.invalidFileTypeDesc', { defaultValue: 'Solo se permiten archivos PDF, PNG, JPG' }),
      })
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: t('edit.documents.fileTooLarge', { defaultValue: 'Archivo muy grande' }),
        description: t('edit.documents.fileTooLargeDesc', { defaultValue: 'El archivo no debe superar los 10MB' }),
      })
      return
    }

    // Add file to selected files
    setSelectedFiles(prev => ({ ...prev, [documentKey]: file }))

    // Remove from missing docs if it was marked as missing
    if (missingDocKeys.includes(documentKey)) {
      setMissingDocKeys(prev => prev.filter(key => key !== documentKey))
    }
  }

  // Show save button ALWAYS (not only when files are selected)
  // BUT hide if KYC is in PENDING_REVIEW (cannot modify during review)
  useEffect(() => {
    const fileCount = Object.keys(selectedFiles).length
    const isPendingReview = venue?.kycStatus === 'PENDING_REVIEW'

    // Don't show buttons if pending review
    if (isPendingReview) {
      setActions({})
      return
    }

    const buttonLabel = fileCount > 0
      ? t('edit.documents.saveChanges', { defaultValue: `Guardar Cambios (${fileCount})` })
      : t('edit.documents.saveChanges', { defaultValue: 'Guardar Cambios' })

    setActions({
      primary: {
        label: buttonLabel,
        onClick: handleSubmitDocuments,
        loading: isSubmitting,
      },
      secondary: fileCount > 0 ? {
        label: t('edit.documents.cancel', { defaultValue: 'Cancelar' }),
        onClick: () => {
          setSelectedFiles({})
          setMissingDocKeys([])
        },
      } : undefined,
    })
  }, [selectedFiles, isSubmitting, setActions, t, handleSubmitDocuments, venue?.kycStatus])

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="max-w-3xl mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>No se pudo cargar la información del local</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Get required documents based on entityType
  const requiredDocKeys = getRequiredDocuments(venue.entityType)

  const allDocuments: DocumentConfig[] = [
    // Acta Constitutiva (required for PERSONA_MORAL only)
    {
      key: 'actaDocumentUrl',
      label: t('edit.documents.actaDocument', { defaultValue: 'Acta Constitutiva' }),
      url: venue.actaDocumentUrl,
      description: t('edit.documents.actaDocumentDesc', { defaultValue: 'Documento legal de constitución' }),
      required: requiredDocKeys.includes('actaDocumentUrl'),
    },
    // Poder Legal (required for PERSONA_MORAL only)
    {
      key: 'poderLegalUrl',
      label: t('edit.documents.poderLegal', { defaultValue: 'Poder del Representante Legal' }),
      url: venue.poderLegalUrl,
      description: t('edit.documents.poderLegalDesc', { defaultValue: 'Poder notarial del representante legal' }),
      required: requiredDocKeys.includes('poderLegalUrl'),
    },
    // INE (required for all)
    {
      key: 'ineUrl',
      label: t('edit.documents.idDocument', { defaultValue: 'INE del Representante Legal' }),
      url: venue.idDocumentUrl,
      description: t('edit.documents.idDocumentDesc', { defaultValue: 'Identificación oficial vigente' }),
      required: requiredDocKeys.includes('ineUrl'),
    },
    // Constancia de Situación Fiscal (RFC) - required for all
    {
      key: 'rfcDocumentUrl',
      label: t('edit.documents.taxDocument', { defaultValue: 'Constancia de Situación Fiscal' }),
      url: venue.rfcDocumentUrl,
      description: t('edit.documents.taxDocumentDesc', { defaultValue: 'Documento oficial del SAT que contiene el RFC' }),
      required: requiredDocKeys.includes('rfcDocumentUrl'),
    },
    // Comprobante Domicilio (required for all)
    {
      key: 'comprobanteDomicilioUrl',
      label: t('edit.documents.comprobanteDomicilio', { defaultValue: 'Comprobante de Domicilio' }),
      url: venue.comprobanteDomicilioUrl,
      description: t('edit.documents.comprobanteDomicilioDesc', { defaultValue: 'Recibo de luz, agua o teléfono' }),
      required: requiredDocKeys.includes('comprobanteDomicilioUrl'),
    },
    // Carátula Bancaria (required for all)
    {
      key: 'caratulaBancariaUrl',
      label: t('edit.documents.caratulaBancaria', { defaultValue: 'Carátula Bancaria/CLABE' }),
      url: venue.caratulaBancariaUrl,
      description: t('edit.documents.caratulaBancariaDesc', { defaultValue: 'Estado de cuenta con CLABE visible' }),
      required: requiredDocKeys.includes('caratulaBancariaUrl'),
    },
  ]

  // Filter documents: always show uploaded docs and required docs, hide non-required based on entityType
  const documents = allDocuments.filter(doc => {
    // Always show if document is uploaded
    if (doc.url) return true

    // Always show if document is required
    if (doc.required) return true

    // Hide Acta and Poder if Persona Física (they are not required)
    if (venue.entityType === 'PERSONA_FISICA' && (doc.key === 'actaDocumentUrl' || doc.key === 'poderLegalUrl')) {
      return false
    }

    // Show everything else
    return true
  })

  return (
    <div className="max-w-3xl mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {t('edit.documents.title', { defaultValue: 'Documentación Fiscal' })}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('edit.documents.subtitle', { defaultValue: 'Documentos oficiales y fiscales del local' })}
        </p>
      </div>

      {/* KYC Status Alerts */}
      {/* REJECTED Status */}
      {venue.kycStatus === 'REJECTED' && venue.kycRejectionReason && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">
            {t('edit.documents.kycRejected', { defaultValue: 'Documentación KYC Rechazada' })}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">{t('edit.documents.kycRejectedDesc', { defaultValue: 'Tu documentación fue rechazada. Por favor revisa la razón y vuelve a enviarla.' })}</p>
            <p className="mb-4 p-3 bg-destructive/10 rounded-md border border-destructive/20 text-sm">
              <strong>{t('edit.documents.rejectionReason', { defaultValue: 'Razón del rechazo:' })}</strong> {venue.kycRejectionReason}
            </p>
            <Button asChild variant="outline" size="sm" className="border-destructive/50 hover:bg-destructive/10">
              <Link to={`/venues/${venueSlug}/edit/documents`}>
                <FileText className="mr-2 h-4 w-4" />
                {t('edit.documents.resubmit', { defaultValue: 'Reenviar Documentos' })}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* PENDING_REVIEW Status */}
      {venue.kycStatus === 'PENDING_REVIEW' && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="font-semibold text-blue-800 dark:text-blue-200">
            {t('edit.documents.kycPendingReview', { defaultValue: 'Documentación en Revisión' })}
          </AlertTitle>
          <AlertDescription className="mt-2 text-blue-700 dark:text-blue-300">
            <p>{t('edit.documents.kycPendingReviewDesc', { defaultValue: 'Tu documentación está siendo revisada por nuestro equipo. No puedes realizar cambios mientras el proceso de revisión esté en curso.' })}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Fiscal Information */}
      {venue.rfc && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('edit.documents.fiscalInfo', { defaultValue: 'Información Fiscal' })}</CardTitle>
            <CardDescription className="text-xs">{t('edit.documents.fiscalInfoDesc', { defaultValue: 'Datos fiscales registrados' })}</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">RFC</p>
                <p className="text-sm text-foreground font-mono">{venue.rfc}</p>
              </div>
              {venue.legalName && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t('edit.documents.legalName', { defaultValue: 'Razón Social' })}
                  </p>
                  <p className="text-sm text-foreground">{venue.legalName}</p>
                </div>
              )}
              {venue.fiscalRegime && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t('edit.documents.fiscalRegime', { defaultValue: 'Régimen Fiscal' })}
                  </p>
                  <p className="text-sm text-foreground">{venue.fiscalRegime}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Grid - Show all documents with required indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {documents.map((doc, index) => {
          const hasExistingDoc = !!doc.url
          const hasSelectedFile = !!selectedFiles[doc.key]
          const isMissing = !hasExistingDoc && !hasSelectedFile
          const isRequired = doc.required
          const isMarkedAsMissing = missingDocKeys.includes(doc.key)
          const isPendingReview = venue.kycStatus === 'PENDING_REVIEW'

          // Check if this specific document was rejected (granular rejection)
          const isDocumentRejected = venue.kycStatus === 'REJECTED' && (venue.kycRejectedDocuments || []).includes(doc.key)
          // Check if document was approved (KYC rejected but this doc wasn't flagged)
          const isDocumentApproved = venue.kycStatus === 'REJECTED' && venue.kycRejectedDocuments && venue.kycRejectedDocuments.length > 0 && !isDocumentRejected && hasExistingDoc

          return (
            <Card
              key={index}
              id={`doc-card-${doc.key}`}
              className={
                isDocumentRejected || isMarkedAsMissing || (isMissing && isRequired)
                  ? 'border-2 border-destructive/50 bg-destructive/5 animate-pulse-slow'
                  : isDocumentApproved
                    ? 'border-2 border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                    : hasSelectedFile
                      ? 'border-2 border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                      : ''
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isDocumentRejected || isMarkedAsMissing || (isMissing && isRequired)
                          ? 'bg-destructive/20'
                          : isDocumentApproved || hasSelectedFile
                            ? 'bg-green-500/20'
                            : 'bg-primary/10'
                      }`}
                    >
                      {isDocumentRejected || isMarkedAsMissing || (isMissing && isRequired) ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : isDocumentApproved || hasSelectedFile ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <CardTitle
                          className={`text-sm ${isMarkedAsMissing || (isMissing && isRequired) ? 'text-destructive' : 'text-foreground'}`}
                        >
                          {doc.label}
                        </CardTitle>
                        {isRequired && (
                          <span className="text-xs text-destructive font-semibold">*</span>
                        )}
                      </div>
                      <CardDescription className="mt-0.5 text-xs">{doc.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {/* Show existing document actions */}
                {hasExistingDoc && !hasSelectedFile && (
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <a href={doc.url!} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {t('edit.documents.view', { defaultValue: 'Ver Documento' })}
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <a href={doc.url!} download>
                        <Download className="w-4 h-4 mr-2" />
                        {t('edit.documents.download', { defaultValue: 'Descargar' })}
                      </a>
                    </Button>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  type="file"
                  id={`file-input-${doc.key}`}
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={e => handleFileChange(doc.key, e.target.files?.[0] || null)}
                  className="hidden"
                />

                {/* Upload/Change button - ALWAYS in same position */}
                <Button
                  variant={
                    isDocumentRejected
                      ? 'destructive'
                      : hasSelectedFile
                        ? 'outline'
                        : hasExistingDoc
                          ? 'ghost'
                          : isRequired && isMissing
                            ? 'destructive'
                            : 'outline'
                  }
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById(`file-input-${doc.key}`)?.click()}
                  disabled={isSubmitting || isPendingReview || isDocumentApproved}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isDocumentRejected
                    ? t('edit.documents.resubmitDocument', { defaultValue: 'Resubir Documento' })
                    : hasExistingDoc
                      ? t('edit.documents.changeDocument', { defaultValue: 'Cambiar documento' })
                      : hasSelectedFile
                        ? t('edit.documents.changeFile', { defaultValue: 'Cambiar archivo' })
                        : t('edit.documents.uploadDocument', { defaultValue: 'Subir Documentación' })}
                </Button>

                {/* Show selected file with green checkmark */}
                {hasSelectedFile && (
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center font-medium">
                      <Check className="w-4 h-4 mr-1" />
                      {selectedFiles[doc.key].name}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleFileChange(doc.key, null)}
                    >
                      ✕
                    </Button>
                  </div>
                )}

                {/* Show document-specific messages */}
                {isDocumentApproved && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 justify-center mt-2">
                    <Check className="h-4 w-4" />
                    <p className="text-sm font-medium">
                      {t('edit.documents.documentApproved', { defaultValue: 'Documento aprobado' })}
                    </p>
                  </div>
                )}

                {isDocumentRejected && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {t('edit.documents.documentRejected', { defaultValue: 'Este documento fue rechazado. Por favor vuelve a subirlo.' })}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Show required message BELOW button if missing */}
                {!isDocumentRejected && !isDocumentApproved && (isMarkedAsMissing || (isMissing && isRequired)) && (
                  <p className="text-sm font-medium text-destructive text-center mt-2">
                    {t('edit.documents.required', { defaultValue: 'Esta documentación es requerida' })}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
