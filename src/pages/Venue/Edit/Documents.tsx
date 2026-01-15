import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, ExternalLink, AlertCircle, Upload, Check, Loader2, Shield, CheckCircle, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import api from '@/api'
import { useVenueEditActions } from '../VenueEditLayout'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { superadminAPI } from '@/services/superadmin.service'

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
  const { venueId, venueSlug, fullBasePath } = useCurrentVenue()
  const { setActions } = useVenueEditActions()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Check if current user is superadmin
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  // Track which documents are currently uploading
  const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({})
  const [missingDocKeys, setMissingDocKeys] = useState<string[]>([])

  // Superadmin KYC approval/rejection state
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [selectedRejectedDocs, setSelectedRejectedDocs] = useState<string[]>([])

  const { data: venue, isLoading } = useQuery<VenueDocuments>({
    queryKey: ['venue-documents', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  // Mutation for uploading a single document
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ documentKey, file }: { documentKey: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.put(`/api/v1/dashboard/venues/${venueId}/kyc/document/${documentKey}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    },
    onMutate: ({ documentKey }) => {
      setUploadingDocs(prev => ({ ...prev, [documentKey]: true }))
    },
    onSuccess: (data, { documentKey }) => {
      toast({
        title: t('edit.documents.documentSaved', { defaultValue: 'Documento guardado' }),
        description: t('edit.documents.documentSavedDesc', { defaultValue: 'El documento se guardó automáticamente' }),
      })
      // Remove from missing docs if it was marked
      if (missingDocKeys.includes(documentKey)) {
        setMissingDocKeys(prev => prev.filter(key => key !== documentKey))
      }
      // Refresh venue data to get updated URLs
      queryClient.invalidateQueries({ queryKey: ['venue-documents', venueId] })
    },
    onError: (error: any, { documentKey }) => {
      toast({
        variant: 'destructive',
        title: t('edit.documents.uploadError', { defaultValue: 'Error al subir documento' }),
        description:
          error.response?.data?.message ||
          t('edit.documents.uploadErrorDesc', { defaultValue: 'No se pudo subir el documento. Intenta nuevamente.' }),
      })
    },
    onSettled: (_, __, { documentKey }) => {
      setUploadingDocs(prev => ({ ...prev, [documentKey]: false }))
    },
  })

  // Mutation for submitting KYC for review
  const submitKycMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/kyc/submit`)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('edit.documents.kycSubmitted', { defaultValue: 'Documentación enviada' }),
        description: t('edit.documents.kycSubmittedDesc', { defaultValue: 'Tu documentación ha sido enviada para revisión' }),
      })
      queryClient.invalidateQueries({ queryKey: ['venue-documents', venueId] })
      // Refresh auth status to update KYC banner immediately
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (error: any) => {
      // Check if error is about missing documents
      if (error.response?.data?.message?.includes('Missing required documents')) {
        const missingDocsMatch = error.response.data.message.match(/Missing required documents: (.+)/)
        if (missingDocsMatch) {
          const missingDocs = missingDocsMatch[1].split(', ')
          setMissingDocKeys(missingDocs)
        }
      }
      toast({
        variant: 'destructive',
        title: t('edit.documents.submitError', { defaultValue: 'Error al enviar' }),
        description:
          error.response?.data?.message ||
          t('edit.documents.submitErrorDesc', {
            defaultValue: 'No se pudo enviar la documentación. Verifica que todos los documentos requeridos estén subidos.',
          }),
      })
    },
  })

  // Superadmin: Approve KYC mutation
  const approveKycMutation = useMutation({
    mutationFn: () => superadminAPI.approveKYC(venueId!),
    onSuccess: () => {
      toast({
        title: t('edit.documents.superadmin.approveSuccess', { defaultValue: 'KYC Aprobado' }),
        description: t('edit.documents.superadmin.approveSuccessDesc', {
          defaultValue: 'La documentación KYC ha sido aprobada exitosamente.',
        }),
      })
      setIsApproveDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['venue-documents', venueId] })
      // Refresh auth status to update venue status immediately
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('edit.documents.superadmin.approveError', { defaultValue: 'Error al aprobar' }),
        description: error.response?.data?.message || t('edit.documents.superadmin.approveErrorDesc', { defaultValue: 'No se pudo aprobar el KYC.' }),
      })
    },
  })

  // Superadmin: Reject KYC mutation
  const rejectKycMutation = useMutation({
    mutationFn: (data: { reason: string; rejectedDocs?: string[] }) => {
      return superadminAPI.rejectKYC(venueId!, data.reason, data.rejectedDocs)
    },
    onSuccess: () => {
      toast({
        title: t('edit.documents.superadmin.rejectSuccess', { defaultValue: 'KYC Rechazado' }),
        description: t('edit.documents.superadmin.rejectSuccessDesc', {
          defaultValue: 'La documentación KYC ha sido rechazada.',
        }),
      })
      setIsRejectDialogOpen(false)
      setRejectionReason('')
      setSelectedRejectedDocs([])
      queryClient.invalidateQueries({ queryKey: ['venue-documents', venueId] })
      // Refresh auth status to update venue status immediately
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('edit.documents.superadmin.rejectError', { defaultValue: 'Error al rechazar' }),
        description: error.response?.data?.message || t('edit.documents.superadmin.rejectErrorDesc', { defaultValue: 'No se pudo rechazar el KYC.' }),
      })
    },
  })

  // Handle KYC approval
  const handleApproveKyc = useCallback(() => {
    approveKycMutation.mutate()
  }, [approveKycMutation])

  // Handle KYC rejection
  const handleRejectKyc = useCallback(() => {
    if (!rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: t('edit.documents.superadmin.reasonRequired', { defaultValue: 'Razón requerida' }),
        description: t('edit.documents.superadmin.reasonRequiredDesc', { defaultValue: 'Debes proporcionar una razón para el rechazo.' }),
      })
      return
    }
    rejectKycMutation.mutate({
      reason: rejectionReason,
      rejectedDocs: selectedRejectedDocs.length > 0 ? selectedRejectedDocs : undefined,
    })
  }, [rejectKycMutation, rejectionReason, selectedRejectedDocs, toast, t])

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

  // Handle file selection - uploads immediately (auto-save)
  const handleFileChange = (documentKey: string, file: File | null) => {
    if (!file) return

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

    // Upload immediately (auto-save)
    uploadDocumentMutation.mutate({ documentKey, file })
  }

  // Handle submit for review
  const handleSubmitForReview = useCallback(() => {
    submitKycMutation.mutate()
  }, [submitKycMutation])

  // Check if all required documents are uploaded
  const allRequiredDocsUploaded = useMemo(() => {
    if (!venue) return false

    const requiredDocKeys = getRequiredDocuments(venue.entityType)

    // Map document keys to venue fields
    const docKeyToField: Record<string, keyof VenueDocuments> = {
      ineUrl: 'idDocumentUrl',
      rfcDocumentUrl: 'rfcDocumentUrl',
      comprobanteDomicilioUrl: 'comprobanteDomicilioUrl',
      caratulaBancariaUrl: 'caratulaBancariaUrl',
      actaDocumentUrl: 'actaDocumentUrl',
      poderLegalUrl: 'poderLegalUrl',
    }

    return requiredDocKeys.every(key => {
      const field = docKeyToField[key]
      return field && venue[field]
    })
  }, [venue])

  // Show "Submit for Review" button when KYC is NOT_SUBMITTED or REJECTED
  // Disabled until all required documents are uploaded
  useEffect(() => {
    const isPendingReview = venue?.kycStatus === 'PENDING_REVIEW'
    const isVerified = venue?.kycStatus === 'VERIFIED'

    // Don't show buttons if pending review or verified
    if (isPendingReview || isVerified) {
      setActions({})
      return
    }

    setActions({
      primary: {
        label: t('edit.documents.submitForReview', { defaultValue: 'Enviar a Revisión' }),
        onClick: handleSubmitForReview,
        loading: submitKycMutation.isPending,
        disabled: !allRequiredDocsUploaded,
      },
    })
  }, [setActions, t, handleSubmitForReview, venue?.kycStatus, submitKycMutation.isPending, allRequiredDocsUploaded])

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
          <AlertTitle>{t('edit.documents.error', { defaultValue: 'Error' })}</AlertTitle>
          <AlertDescription>{t('edit.documents.loadError', { defaultValue: 'Could not load venue information' })}</AlertDescription>
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
        <h2 className="text-2xl font-bold text-foreground">{t('edit.documents.title', { defaultValue: 'Documentación Fiscal' })}</h2>
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
            <p className="mb-3">
              {t('edit.documents.kycRejectedDesc', {
                defaultValue: 'Tu documentación fue rechazada. Por favor revisa la razón y vuelve a enviarla.',
              })}
            </p>
            <p className="mb-4 p-3 bg-destructive/10 rounded-md border border-destructive/20 text-sm">
              <strong>{t('edit.documents.rejectionReason', { defaultValue: 'Razón del rechazo:' })}</strong> {venue.kycRejectionReason}
            </p>
            <Button asChild variant="outline" size="sm" className="border-destructive/50 hover:bg-destructive/10">
              <Link to={`${fullBasePath}/edit/documents`}>
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
            <p>
              {t('edit.documents.kycPendingReviewDesc', {
                defaultValue:
                  'Tu documentación está siendo revisada por nuestro equipo. No puedes realizar cambios mientras el proceso de revisión esté en curso.',
              })}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Superadmin KYC Actions - Only visible to superadmins when status is PENDING_REVIEW */}
      {isSuperadmin && venue.kycStatus === 'PENDING_REVIEW' && (
        <Card className="border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/10 to-pink-500/10 dark:from-amber-500/20 dark:to-pink-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-gradient-to-r from-amber-400 to-pink-500">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-base bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent font-semibold">
                {t('edit.documents.superadmin.title', { defaultValue: 'Acciones de Superadmin' })}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {t('edit.documents.superadmin.description', {
                defaultValue: 'Revisa la documentación y aprueba o rechaza el KYC de este venue.',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setIsApproveDialogOpen(true)}
                className="flex-1 bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
                disabled={approveKycMutation.isPending || rejectKycMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('edit.documents.superadmin.approve', { defaultValue: 'Aprobar KYC' })}
              </Button>
              <Button
                onClick={() => setIsRejectDialogOpen(true)}
                variant="outline"
                className="flex-1 border-pink-500/50 text-pink-600 dark:text-pink-400 hover:bg-pink-500/10"
                disabled={approveKycMutation.isPending || rejectKycMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {t('edit.documents.superadmin.reject', { defaultValue: 'Rechazar KYC' })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fiscal Information */}
      {venue.rfc && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('edit.documents.fiscalInfo', { defaultValue: 'Información Fiscal' })}</CardTitle>
            <CardDescription className="text-xs">
              {t('edit.documents.fiscalInfoDesc', { defaultValue: 'Datos fiscales registrados' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('edit.documents.rfc', { defaultValue: 'RFC' })}</p>
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
          const isMissing = !hasExistingDoc
          const isRequired = doc.required
          const isMarkedAsMissing = missingDocKeys.includes(doc.key)
          const isPendingReview = venue.kycStatus === 'PENDING_REVIEW'
          const isUploading = uploadingDocs[doc.key]

          // Check if this specific document was rejected (granular rejection)
          const isDocumentRejected = venue.kycStatus === 'REJECTED' && (venue.kycRejectedDocuments || []).includes(doc.key)
          // Check if document was approved (KYC rejected but this doc wasn't flagged)
          const isDocumentApproved =
            venue.kycStatus === 'REJECTED' &&
            venue.kycRejectedDocuments &&
            venue.kycRejectedDocuments.length > 0 &&
            !isDocumentRejected &&
            hasExistingDoc

          return (
            <Card
              key={index}
              id={`doc-card-${doc.key}`}
              className={
                isDocumentRejected || isMarkedAsMissing || (isMissing && isRequired)
                  ? 'border-2 border-destructive/50 bg-destructive/5 animate-pulse-slow'
                  : isDocumentApproved || hasExistingDoc
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
                          : isDocumentApproved || hasExistingDoc
                          ? 'bg-green-500/20'
                          : 'bg-primary/10'
                      }`}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : isDocumentRejected || isMarkedAsMissing || (isMissing && isRequired) ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : isDocumentApproved || hasExistingDoc ? (
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
                        {isRequired && <span className="text-xs text-destructive font-semibold">*</span>}
                      </div>
                      <CardDescription className="mt-0.5 text-xs">{doc.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {/* Show existing document actions */}
                {hasExistingDoc && (
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
                  onChange={e => {
                    handleFileChange(doc.key, e.target.files?.[0] || null)
                    // Reset input value to allow selecting same file again
                    e.target.value = ''
                  }}
                  className="hidden"
                />

                {/* Upload/Change button - ALWAYS in same position */}
                <Button
                  variant={
                    isDocumentRejected ? 'destructive' : hasExistingDoc ? 'ghost' : isRequired && isMissing ? 'destructive' : 'outline'
                  }
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById(`file-input-${doc.key}`)?.click()}
                  disabled={isUploading || isPendingReview || isDocumentApproved}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('edit.documents.uploading', { defaultValue: 'Subiendo...' })}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {isDocumentRejected
                        ? t('edit.documents.resubmitDocument', { defaultValue: 'Resubir Documento' })
                        : hasExistingDoc
                        ? t('edit.documents.changeDocument', { defaultValue: 'Cambiar documento' })
                        : t('edit.documents.uploadDocument', { defaultValue: 'Subir Documentación' })}
                    </>
                  )}
                </Button>

                {/* Show document-specific messages */}
                {isDocumentApproved && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 justify-center mt-2">
                    <Check className="h-4 w-4" />
                    <p className="text-sm font-medium">{t('edit.documents.documentApproved', { defaultValue: 'Documento aprobado' })}</p>
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

      {/* Superadmin Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {t('edit.documents.superadmin.approveDialogTitle', { defaultValue: 'Confirmar Aprobación' })}
            </DialogTitle>
            <DialogDescription>
              {t('edit.documents.superadmin.approveDialogDesc', {
                defaultValue: '¿Estás seguro de que deseas aprobar la documentación KYC de este venue? El venue podrá comenzar a procesar pagos reales.',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)} disabled={approveKycMutation.isPending}>
              {t('cancel', { defaultValue: 'Cancelar' })}
            </Button>
            <Button onClick={handleApproveKyc} disabled={approveKycMutation.isPending} className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground">
              {approveKycMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('edit.documents.superadmin.approving', { defaultValue: 'Aprobando...' })}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('edit.documents.superadmin.confirmApprove', { defaultValue: 'Sí, Aprobar KYC' })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Superadmin Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {t('edit.documents.superadmin.rejectDialogTitle', { defaultValue: 'Rechazar KYC' })}
            </DialogTitle>
            <DialogDescription>
              {t('edit.documents.superadmin.rejectDialogDesc', {
                defaultValue: 'Proporciona una razón para el rechazo y selecciona los documentos específicos que necesitan corrección.',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">
                {t('edit.documents.superadmin.rejectionReasonLabel', { defaultValue: 'Razón del rechazo' })} *
              </Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder={t('edit.documents.superadmin.rejectionReasonPlaceholder', {
                  defaultValue: 'Ej: El documento INE está borroso y no se puede leer claramente...',
                })}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('edit.documents.superadmin.selectRejectedDocs', { defaultValue: 'Documentos a rechazar (opcional)' })}</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {documents.filter(d => d.url).map(doc => (
                  <div key={doc.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`reject-${doc.key}`}
                      checked={selectedRejectedDocs.includes(doc.key)}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedRejectedDocs(prev => [...prev, doc.key])
                        } else {
                          setSelectedRejectedDocs(prev => prev.filter(k => k !== doc.key))
                        }
                      }}
                    />
                    <Label htmlFor={`reject-${doc.key}`} className="text-sm font-normal cursor-pointer">
                      {doc.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false)
                setRejectionReason('')
                setSelectedRejectedDocs([])
              }}
              disabled={rejectKycMutation.isPending}
            >
              {t('cancel', { defaultValue: 'Cancelar' })}
            </Button>
            <Button variant="destructive" onClick={handleRejectKyc} disabled={rejectKycMutation.isPending || !rejectionReason.trim()}>
              {rejectKycMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('edit.documents.superadmin.rejecting', { defaultValue: 'Rechazando...' })}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  {t('edit.documents.superadmin.confirmReject', { defaultValue: 'Rechazar KYC' })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
