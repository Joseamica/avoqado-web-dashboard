import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  AlertCircle,
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { superadminAPI } from '@/services/superadmin.service'

interface KYCDocument {
  type: string
  url: string | null
  label: string
  required: boolean
}

interface KYCDocuments {
  ineUrl: string | null
  rfcDocumentUrl: string | null
  comprobanteDomicilioUrl: string | null
  caratulaBancariaUrl: string | null
  actaConstitutivaUrl: string | null
  poderLegalUrl: string | null
}

interface KYCData {
  venue: {
    id: string
    name: string
    slug: string
    entityType: string
    kycStatus: string
    kycSubmittedAt: string | null
    kycCompletedAt: string | null
    kycRejectionReason: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    zipCode: string | null
    phone: string | null
    email: string | null
  }
  owner: {
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }
  documents: KYCDocuments
  bankInfo: {
    clabe: string | null
    bankName: string | null
    accountHolder: string | null
  }
}

const KYCReview: React.FC = () => {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [selectedRejectedDocs, setSelectedRejectedDocs] = useState<string[]>([])
  const [rejectionReasonError, setRejectionReasonError] = useState<string | null>(null)

  // Fetch KYC data
  const { data: kycData, isLoading } = useQuery<KYCData>({
    queryKey: ['kyc-review', venueId],
    queryFn: () => superadminAPI.getKYCReview(venueId!),
    enabled: !!venueId,
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => superadminAPI.approveKYC(venueId!),
    onSuccess: () => {
      toast({
        title: 'KYC Approved',
        description: `${kycData?.venue.name} has been approved and can now accept payments.`,
      })
      queryClient.invalidateQueries({ queryKey: ['kyc-review', venueId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsApproveDialogOpen(false)
      navigate('/superadmin/venues')
    },
    onError: (error: any) => {
      toast({
        title: 'Approval Failed',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (data: { reason: string; rejectedDocs?: string[] }) => {
      return superadminAPI.rejectKYC(venueId!, data.reason, data.rejectedDocs)
    },
    onSuccess: () => {
      toast({
        title: 'KYC Rejected',
        description: `${kycData?.venue.name} has been notified of the rejection.`,
      })
      queryClient.invalidateQueries({ queryKey: ['kyc-review', venueId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      setIsRejectDialogOpen(false)
      setRejectionReason('')
      setSelectedRejectedDocs([])
      setRejectionReasonError(null)
      navigate('/superadmin/venues')
    },
    onError: (error: any) => {
      toast({
        title: 'Rejection Failed',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200'
      case 'PENDING_REVIEW':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200'
      case 'IN_REVIEW':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
      case 'REJECTED':
        return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="w-4 h-4" />
      case 'PENDING_REVIEW':
      case 'IN_REVIEW':
        return <Clock className="w-4 h-4" />
      case 'REJECTED':
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING_REVIEW: 'Pending Review',
      IN_REVIEW: 'In Review',
      VERIFIED: 'Verified',
      REJECTED: 'Rejected',
    }
    return labels[status] || status
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading KYC data...</div>
      </div>
    )
  }

  if (!kycData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <div className="text-lg font-medium text-foreground">KYC Data Not Found</div>
        <Button onClick={() => navigate('/superadmin/venues')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Venues
        </Button>
      </div>
    )
  }

  const { venue, owner, documents: rawDocuments, bankInfo } = kycData
  const canApprove = venue.kycStatus === 'PENDING_REVIEW' || venue.kycStatus === 'IN_REVIEW'
  const canReject = venue.kycStatus === 'PENDING_REVIEW' || venue.kycStatus === 'IN_REVIEW'

  // Transform documents object to array format
  // IMPORTANT: Keys must match the form field names in Documents.tsx upload, NOT the API response keys!
  // Backend expects: ineUrl, actaDocumentUrl (not actaConstitutivaUrl)
  const documents = [
    { key: 'ineUrl', label: 'INE/IFE (Official ID)', url: rawDocuments?.ineUrl, required: true },
    { key: 'rfcDocumentUrl', label: 'RFC Document', url: rawDocuments?.rfcDocumentUrl, required: true },
    { key: 'comprobanteDomicilioUrl', label: 'Comprobante de Domicilio', url: rawDocuments?.comprobanteDomicilioUrl, required: true },
    { key: 'caratulaBancariaUrl', label: 'Carátula Bancaria', url: rawDocuments?.caratulaBancariaUrl, required: true },
    {
      key: 'actaDocumentUrl', // Form field name (not actaConstitutivaUrl!)
      label: 'Acta Constitutiva',
      url: rawDocuments?.actaConstitutivaUrl, // API response uses this name
      required: venue.entityType === 'PERSONA_MORAL',
    },
    {
      key: 'poderLegalUrl',
      label: 'Poder Legal',
      url: rawDocuments?.poderLegalUrl,
      required: venue.entityType === 'PERSONA_MORAL',
    },
  ]

  // Handle document selection toggle
  const handleDocumentToggle = (docKey: string) => {
    setSelectedRejectedDocs(prev => (prev.includes(docKey) ? prev.filter(k => k !== docKey) : [...prev, docKey]))
  }

  // Validate and submit rejection
  const handleRejectClick = () => {
    const minLength = 10
    const trimmedReason = rejectionReason.trim()

    // Validate
    if (trimmedReason.length === 0) {
      setRejectionReasonError('La razón de rechazo es requerida')
      return
    }

    if (trimmedReason.length < minLength) {
      const remaining = minLength - trimmedReason.length
      setRejectionReasonError(`Faltan ${remaining} caracteres (mínimo ${minLength})`)
      return
    }

    // Clear error and proceed with mutation
    setRejectionReasonError(null)
    rejectMutation.mutate({
      reason: trimmedReason,
      rejectedDocs: selectedRejectedDocs.length > 0 ? selectedRejectedDocs : undefined,
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin/venues')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">KYC Review</h1>
            <p className="text-muted-foreground">{venue.name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(venue.kycStatus)}
          <Badge className={getStatusColor(venue.kycStatus)}>{getStatusLabel(venue.kycStatus)}</Badge>
        </div>
      </div>

      {/* Rejection Notice (if rejected) */}
      {venue.kycStatus === 'REJECTED' && venue.kycRejectionReason && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200 flex items-center space-x-2">
              <XCircle className="w-5 h-5" />
              <span>Rejection Reason</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-300">{venue.kycRejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {(canApprove || canReject) && (
        <div className="flex items-center space-x-4">
          {canApprove && (
            <Button onClick={() => setIsApproveDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve KYC
            </Button>
          )}
          {canReject && (
            <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)}>
              <XCircle className="w-4 h-4 mr-2" />
              Reject KYC
            </Button>
          )}
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="venue">Venue Info</TabsTrigger>
          <TabsTrigger value="owner">Owner Info</TabsTrigger>
          <TabsTrigger value="banking">Banking Info</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>KYC Documents</CardTitle>
              <CardDescription>Review all submitted documents for verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {documents.map((doc, index) => (
                  <Card key={index} className={!doc.url ? 'opacity-50' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <CardTitle className="text-base">{doc.label}</CardTitle>
                        </div>
                        {doc.required && <Badge variant={doc.url ? 'default' : 'destructive'}>{doc.url ? 'Submitted' : 'Missing'}</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {doc.url ? (
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" asChild className="w-full">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View Document
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild className="w-full">
                            <a href={doc.url} download>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{doc.required ? 'Document not submitted' : 'Not applicable'}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Venue Info Tab */}
        <TabsContent value="venue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Venue Information</CardTitle>
              <CardDescription>Business details and location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Venue Name</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium">{venue.name}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Venue Slug</Label>
                  <p className="mt-1 font-mono text-sm">{venue.slug}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <p className="mt-1 font-medium">{venue.entityType || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">KYC Submitted</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <p>{venue.kycSubmittedAt ? new Date(venue.kycSubmittedAt).toLocaleDateString() : 'Not submitted'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Label className="text-muted-foreground">Address</Label>
                <div className="flex items-start space-x-2 mt-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                  <div className="text-sm">
                    {venue.address && <p>{venue.address}</p>}
                    {(venue.city || venue.state || venue.zipCode) && (
                      <p>
                        {venue.city}
                        {venue.state && `, ${venue.state}`} {venue.zipCode}
                      </p>
                    )}
                    {venue.country && <p>{venue.country}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <p>{venue.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p>{venue.email || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Owner Info Tab */}
        <TabsContent value="owner" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Owner Information</CardTitle>
              <CardDescription>Contact details for the venue owner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Full Name</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium">
                      {owner.firstName} {owner.lastName}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p>{owner.email}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <p>{owner.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banking Info Tab */}
        <TabsContent value="banking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Banking Information</CardTitle>
              <CardDescription>Payment account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">CLABE</Label>
                  <p className="mt-1 font-mono text-sm">{bankInfo.clabe || 'Not provided'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bank Name</Label>
                  <p className="mt-1">{bankInfo.bankName || 'Not provided'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Account Holder</Label>
                  <p className="mt-1">{bankInfo.accountHolder || 'Not provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve KYC Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve KYC for {venue.name}? This will allow them to accept payments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve KYC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reject KYC Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting {venue.name}'s KYC submission. They will receive this feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Document Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Select Rejected Documents (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Select specific documents that need to be resubmitted. If no documents are selected, all documents will be marked as
                rejected.
              </p>
              <div className="grid grid-cols-1 gap-2 border border-border rounded-md p-4 bg-muted/50">
                {documents.filter(doc => doc.url).length > 0 ? (
                  documents
                    .filter(doc => doc.url)
                    .map(doc => (
                      <div key={doc.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={doc.key}
                          checked={selectedRejectedDocs.includes(doc.key)}
                          onCheckedChange={() => handleDocumentToggle(doc.key)}
                        />
                        <label
                          htmlFor={doc.key}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {doc.label}
                          {doc.required && <span className="text-destructive ml-1">*</span>}
                        </label>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No documents have been uploaded yet. All documents will be marked as rejected.
                  </p>
                )}
              </div>
              {selectedRejectedDocs.length > 0 && (
                <p className="text-sm text-blue-600 dark:text-blue-400">{selectedRejectedDocs.length} document(s) selected for rejection</p>
              )}
            </div>

            {/* Rejection Reason */}
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why the KYC is being rejected..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                rows={4}
                className={`resize-none ${rejectionReasonError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {rejectionReasonError && (
                <p className="text-sm text-red-500 font-medium">{rejectionReasonError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false)
                setRejectionReason('')
                setSelectedRejectedDocs([])
                setRejectionReasonError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectClick}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject KYC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default KYCReview
