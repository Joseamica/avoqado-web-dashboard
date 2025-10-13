/**
 * Modern Receipt Viewer
 * Uses the new ModernReceiptDesign component for a beautiful, responsive experience
 */

import api from '@/api'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { ReceiptUrls } from '@/constants/receipt'
import { ModernReceiptDesign } from '@/components/receipts/ModernReceiptDesign'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// (Removed unused ReceiptDataSnapshot interface)

export default function ReceiptViewer() {
  const { receiptId, accessKey } = useParams<{ receiptId?: string; accessKey?: string }>()
  const { toast } = useToast()
  const { t } = useTranslation('payment')
  const { venueId } = useCurrentVenue()

  // Determine if we're in public view or dashboard view
  const isPublicView = ReceiptUrls.isPublicView()
  const identifier = isPublicView ? accessKey : receiptId

  // Query to get receipt details
  const {
    data: receipt,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['receipt', identifier],
    queryFn: async () => {
      if (isPublicView && accessKey) {
        // Public route: GET /api/v1/public/receipt/{accessKey}
        const response = await api.get(`/api/v1/public/receipt/${accessKey}`)
        // Backend returns { success: true, data: { receipt data } }
        // We need to extract the actual receipt data
        if (response.data?.success && response.data?.data) {
          return response.data.data
        }
        throw new Error(t('receipt.errors.invalidResponse'))
      } else if (!isPublicView && receiptId) {
        // Dashboard route: GET /api/v1/dashboard/venues/{venueId}/receipts/{receiptId}
        if (!venueId) throw new Error(t('dashboardShell.loadingVenue'))
        const response = await api.get(`/api/v1/dashboard/venues/${venueId}/receipts/${receiptId}`)
        if (response.data?.success && response.data?.data) {
          return response.data.data
        }
        // Some backends return the resource directly without a success wrapper
        if (response.data && (response.data.id || response.data.accessKey || response.data.dataSnapshot)) {
          return response.data
        }
        throw new Error(t('receipt.errors.invalidResponse'))
      }
      throw new Error(t('receipt.errors.invalidIdentifier'))
    },
    enabled: !!identifier,
    retry: 2,
  })

  // Transform any query errors into a readable message
  const error = queryError
    ? (queryError as any)?.response?.data?.message || (queryError as any)?.message || t('receipt.errors.load')
    : null

  // Copy public link to clipboard
  const copyPublicLink = async () => {
    if (!receipt?.accessKey) return

    const publicUrl = ReceiptUrls.public(receipt.accessKey)

    try {
      await navigator.clipboard.writeText(publicUrl)
      toast({
        title: t('receipt.toasts.linkCopied.title'),
        description: t('receipt.toasts.linkCopied.desc'),
      })
    } catch {
      toast({
        title: t('receipt.toasts.copyError.title'),
        description: t('receipt.toasts.copyError.desc'),
        variant: 'destructive',
      })
    }
  }

  // Action handlers for the modern design
  const handleShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('receipt.share.title', { venue: receipt?.dataSnapshot?.venue?.name || t('receipt.unknownVenue') }),
          text: t('receipt.share.text', { venue: receipt?.dataSnapshot?.venue?.name || t('receipt.unknownVenue') }),
          url: url,
        })
        toast({
          title: t('receipt.toasts.shared.title'),
          description: t('receipt.toasts.shared.desc'),
        })
      } catch {
        // User cancelled sharing or error occurred
        copyPublicLink() // Fallback to copying
      }
    } else {
      copyPublicLink() // Fallback for browsers without native sharing
    }
  }

  const handleCopy = (_url: string) => {
    copyPublicLink()
  }

  const handlePrint = () => {
    window.print()
    toast({
      title: t('receipt.printing.title'),
      description: t('receipt.printing.desc'),
    })
  }

  const handleEmail = (_email: string) => {
    // This would integrate with your existing email functionality
    // For now, just show a message
    toast({
      title: t('receipt.email.soon.title'),
      description: t('receipt.email.soon.desc'),
    })
  }

  // Get the access key for the receipt
  const receiptAccessKey = isPublicView ? accessKey : receipt?.accessKey

  return (
    <ModernReceiptDesign
      receipt={receipt}
      isLoading={isLoading}
      error={error}
      accessKey={receiptAccessKey}
      variant={isPublicView ? 'full' : 'embedded'}
      showActions={true}
      onShare={handleShare}
      onCopy={handleCopy}
      onPrint={handlePrint}
      onEmail={handleEmail}
    />
  )
}
