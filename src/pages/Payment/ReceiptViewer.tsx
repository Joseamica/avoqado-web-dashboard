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

// (Removed unused ReceiptDataSnapshot interface)

export default function ReceiptViewer() {
  const { receiptId, accessKey } = useParams<{ receiptId?: string; accessKey?: string }>()
  const { toast } = useToast()
  const { t } = useTranslation()

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
        throw new Error(t('payments.receipt.errors.invalidResponse'))
      } else if (!isPublicView && receiptId) {
        // Dashboard route: GET /api/v1/dashboard/venues/{venueId}/receipts/{receiptId}
        // Note: This would need venueId - you might need to adjust based on your routing
        throw new Error(t('payments.receipt.errors.notImplemented'))
      }
      throw new Error(t('payments.receipt.errors.invalidIdentifier'))
    },
    enabled: !!identifier,
    retry: 2,
  })

  // Transform any query errors into a readable message
  const error = queryError
    ? (queryError as any)?.response?.data?.message || (queryError as any)?.message || t('payments.receipt.errors.load')
    : null

  // Copy public link to clipboard
  const copyPublicLink = async () => {
    if (!receipt?.accessKey) return

    const publicUrl = ReceiptUrls.public(receipt.accessKey)

    try {
      await navigator.clipboard.writeText(publicUrl)
      toast({
        title: t('payments.receipt.toasts.linkCopied.title'),
        description: t('payments.receipt.toasts.linkCopied.desc'),
      })
    } catch {
      toast({
        title: t('payments.receipt.toasts.copyError.title'),
        description: t('payments.receipt.toasts.copyError.desc'),
        variant: 'destructive',
      })
    }
  }

  // Action handlers for the modern design
  const handleShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('payments.receipt.share.title', { venue: receipt?.dataSnapshot?.venue?.name || t('payments.receipt.unknownVenue') }),
          text: t('payments.receipt.share.text', { venue: receipt?.dataSnapshot?.venue?.name || t('payments.receipt.unknownVenue') }),
          url: url,
        })
        toast({
          title: t('payments.receipt.toasts.shared.title'),
          description: t('payments.receipt.toasts.shared.desc'),
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
      title: t('payments.receipt.printing.title'),
      description: t('payments.receipt.printing.desc'),
    })
  }

  const handleEmail = (_email: string) => {
    // This would integrate with your existing email functionality
    // For now, just show a message
    toast({
      title: t('payments.receipt.email.soon.title'),
      description: t('payments.receipt.email.soon.desc'),
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
