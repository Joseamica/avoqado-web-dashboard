/**
 * Modern Receipt Viewer
 * Uses the new ModernReceiptDesign component for a beautiful, responsive experience
 */

import api from '@/api'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { ReceiptUrls } from '@/constants/receipt'
import { ModernReceiptDesign } from '@/components/receipts/ModernReceiptDesign'

// Receipt data type (matching backend schema)
interface ReceiptDataSnapshot {
  payment: {
    id: string
    amount: number
    tipAmount: number
    totalAmount: number
    method: string
    status: string
    createdAt: string
    cardBrand?: string
    maskedPan?: string
    entryMode?: string
    authorizationNumber?: string
    referenceNumber?: string
  }
  venue: {
    id: string
    name: string
    address: string
    city: string
    state: string
    zipCode?: string
    phone: string
    email?: string
    logo?: string
    primaryColor?: string
    currency: string
  }
  order: {
    id: string
    number: string | number
    items: Array<{
      name: string
      quantity: number
      price: number
      totalPrice: number
      modifiers: Array<{
        name: string
        price: number
      }>
    }>
    subtotal: number
    taxAmount: number
    total: number
    createdAt: string
    table?: {
      number: string
      area?: string
    }
  }
  processedBy?: {
    name: string
  }
  customer?: {
    name: string
    email?: string
  }
}

export default function ReceiptViewer() {
  const { receiptId, accessKey } = useParams<{ receiptId?: string; accessKey?: string }>()
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const { toast } = useToast()

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
        throw new Error('Invalid response format from server')
      } else if (!isPublicView && receiptId) {
        // Dashboard route: GET /api/v1/dashboard/venues/{venueId}/receipts/{receiptId}
        // Note: This would need venueId - you might need to adjust based on your routing
        throw new Error('Dashboard receipt viewing not implemented yet')
      }
      throw new Error('Invalid receipt identifier')
    },
    enabled: !!identifier,
    retry: 2,
  })

  // Transform any query errors into a readable message
  const error = queryError ? 
    (queryError as any)?.response?.data?.message || 
    (queryError as any)?.message || 
    'Error al cargar el recibo' 
    : null

  // Copy public link to clipboard
  const copyPublicLink = async () => {
    if (!receipt?.accessKey) return
    
    const publicUrl = ReceiptUrls.public(receipt.accessKey)
    
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast({
        title: '¡Enlace copiado!',
        description: 'El enlace del recibo se ha copiado al portapapeles',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace',
        variant: 'destructive'
      })
    }
  }

  // Action handlers for the modern design
  const handleShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Recibo de ${receipt?.dataSnapshot?.venue?.name || 'Restaurant'}`,
          text: `Recibo digital de ${receipt?.dataSnapshot?.venue?.name || 'Restaurant'}`,
          url: url
        })
        toast({
          title: '¡Compartido!',
          description: 'El recibo ha sido compartido exitosamente',
        })
      } catch (error) {
        // User cancelled sharing or error occurred
        copyPublicLink() // Fallback to copying
      }
    } else {
      copyPublicLink() // Fallback for browsers without native sharing
    }
  }

  const handleCopy = (url: string) => {
    copyPublicLink()
  }

  const handlePrint = () => {
    window.print()
    toast({
      title: 'Imprimiendo...',
      description: 'Se ha enviado el recibo a la impresora',
    })
  }

  const handleEmail = (email: string) => {
    // This would integrate with your existing email functionality
    // For now, just show a message
    toast({
      title: 'Función en desarrollo',
      description: 'La funcionalidad de email estará disponible pronto',
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