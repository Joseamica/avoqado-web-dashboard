import api from '@/api'
import { DateTime } from 'luxon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Mail,
  Pencil,
  Receipt,
  RefreshCw,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import getIcon from '@/utils/getIcon'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { ReceiptUrls } from '@/constants/receipt'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/context/AuthContext'
import { StaffRole, PaymentMethod, PaymentStatus } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ========== TYPES & INTERFACES ==========
interface SectionState {
  transaction: boolean
  merchant: boolean
  receipts: boolean
  posData: boolean
  processorData: boolean
}

interface TimelineEvent {
  type: 'created' | 'status_change' | 'receipt' | 'refund'
  timestamp: string
  description: string
  email?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}

// ========== HELPER FUNCTIONS ==========
const getPaymentStatusConfig = (status: string) => {
  const s = status?.toUpperCase()
  switch (s) {
    case 'PAID':
    case 'COMPLETED':
      return {
        icon: CheckCircle2,
        color: 'text-green-800 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        border: 'border-transparent',
      }
    case 'PENDING':
    case 'PROCESSING':
      return {
        icon: Clock,
        color: 'text-yellow-800 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-transparent',
      }
    case 'FAILED':
    case 'REFUNDED':
      return {
        icon: XCircle,
        color: 'text-red-800 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-transparent',
      }
    default:
      return {
        icon: Clock,
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        border: 'border-border',
      }
  }
}

const getOrderTypeConfig = (type: string) => {
  const t = type?.toUpperCase()
  switch (t) {
    case 'DINE_IN':
      return {
        label: 'Dine In',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        color: 'text-blue-800 dark:text-blue-400',
      }
    case 'TAKEOUT':
      return {
        label: 'Takeout',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        color: 'text-purple-800 dark:text-purple-400',
      }
    case 'DELIVERY':
      return {
        label: 'Delivery',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        color: 'text-orange-800 dark:text-orange-400',
      }
    case 'PICKUP':
      return {
        label: 'Pickup',
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
        color: 'text-cyan-800 dark:text-cyan-400',
      }
    default:
      return {
        label: type || 'Unknown',
        bg: 'bg-muted',
        color: 'text-muted-foreground',
      }
  }
}

const formatDateLong = (dateString: string | undefined, locale: string, timezone: string = 'America/Mexico_City') => {
  if (!dateString) return '-'
  const dt = DateTime.fromISO(dateString, { zone: 'utc' }).setZone(timezone).setLocale(locale)
  if (!dt.isValid) return '-'
  return dt.toLocaleString({
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDateShort = (dateString: string | undefined, locale: string, timezone: string = 'America/Mexico_City') => {
  if (!dateString) return '-'
  const dt = DateTime.fromISO(dateString, { zone: 'utc' }).setZone(timezone).setLocale(locale)
  if (!dt.isValid) return '-'
  return dt.toLocaleString({
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const calculateTipPercentage = (tip: number, amount: number): string => {
  if (amount === 0) return '0.0'
  return ((tip / amount) * 100).toFixed(1)
}

const copyToClipboard = (text: string, label: string, toast: any, t: any) => {
  navigator.clipboard.writeText(text)
  toast({
    title: t('common:copied'),
    description: t('detail.copiedToClipboard', { label }),
  })
}

const getPaymentIcon = (payment: any) => {
  const method = payment.method?.toUpperCase()
  const cardBrand = payment.cardBrand

  // Cash payments
  if (method === 'CASH') {
    return (
      <div className="flex items-center justify-center w-9 h-7 rounded-lg bg-muted border border-border shadow-sm">
        <Banknote className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  // Digital wallet payments
  if (method === 'DIGITAL_WALLET') {
    return (
      <div className="flex items-center justify-center w-9 h-7 rounded-lg bg-muted border border-border shadow-sm">
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  // Card payments - show brand icon if available
  if ((method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && cardBrand) {
    return getIcon(cardBrand)
  }

  // Fallback to generic card icon
  return (
    <div className="flex items-center justify-center w-9 h-7 rounded-lg bg-muted border border-border shadow-sm">
      <CreditCard className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

// ========== SUB-COMPONENTS ==========
const TimelineEventComponent = ({ event, isLast }: { event: TimelineEvent; isLast: boolean }) => {
  const Icon = event.icon
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${event.iconColor} bg-background`}>
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-2" />}
      </div>
      <div className="flex-1 pb-6">
        <p className="text-sm font-medium text-foreground">{event.description}</p>
        <p className="text-xs text-muted-foreground mt-1">{event.timestamp}</p>
        {event.email && <p className="text-xs text-muted-foreground">to {event.email}</p>}
      </div>
    </div>
  )
}

const PaymentTimeline = ({ payment, receipts, locale, timezone, t }: { payment: any; receipts: any[]; locale: string; timezone: string; t: any }) => {
  const events: TimelineEvent[] = []

  // Receipt events
  if (receipts && receipts.length > 0) {
    receipts.forEach(receipt => {
      // Receipt viewed
      if (receipt.viewedAt) {
        events.push({
          type: 'receipt',
          timestamp: formatDateShort(receipt.viewedAt, locale, timezone),
          description: t('detail.timeline.receiptViewed'),
          email: receipt.recipientEmail,
          icon: Eye,
          iconColor: 'text-success border-success/20',
        })
      }
      // Receipt sent
      if (receipt.sentAt) {
        events.push({
          type: 'receipt',
          timestamp: formatDateShort(receipt.sentAt, locale, timezone),
          description: t('detail.timeline.receiptSent'),
          email: receipt.recipientEmail,
          icon: Mail,
          iconColor: 'text-primary border-primary/20',
        })
      }
    })
  }

  // Status change
  if (payment.updatedAt && payment.updatedAt !== payment.createdAt) {
    events.push({
      type: 'status_change',
      timestamp: formatDateShort(payment.updatedAt, locale, timezone),
      description: `${t('detail.timeline.statusUpdated')}: ${payment.status}`,
      icon: CheckCircle2,
      iconColor: 'text-primary border-primary/20',
    })
  }

  // Payment created
  events.push({
    type: 'created',
    timestamp: formatDateShort(payment.createdAt, locale, timezone),
    description: t('detail.timeline.paymentProcessed'),
    icon: CreditCard,
    iconColor: 'text-muted-foreground border-border',
  })

  // Sort by timestamp (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-2">
      {events.slice(0, 5).map((event, index) => (
        <TimelineEventComponent key={index} event={event} isLast={index === events.length - 1} />
      ))}
    </div>
  )
}

const CollapsibleSection = ({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
  icon: Icon,
}: {
  title: string
  subtitle?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}) => {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <CardTitle className="text-lg font-medium">{title}</CardTitle>
                  {subtitle && <CardDescription className="mt-1">{subtitle}</CardDescription>}
                </div>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ========== MAIN COMPONENT ==========
export default function PaymentId() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [receiptDetailOpen, setReceiptDetailOpen] = useState(false)
  const [selectedReceiptForDetail, setSelectedReceiptForDetail] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedValues, setEditedValues] = useState<{
    amount: number
    tipAmount: number
    method: PaymentMethod
    status: PaymentStatus
  }>({ amount: 0, tipAmount: 0, method: PaymentMethod.CASH, status: PaymentStatus.PAID })
  const [sectionsOpen, setSectionsOpen] = useState<SectionState>({
    transaction: true,
    merchant: false,
    receipts: true,
    posData: false,
    processorData: false,
  })
  const { toast } = useToast()
  const { venueId, venue } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const { can } = usePermissions()
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()

  const canEdit = user?.role === StaffRole.SUPERADMIN

  const { t, i18n } = useTranslation(['payment', 'common'])
  const {
    data: payment,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}`)
      return response.data
    },
    enabled: !!paymentId,
  })

  const { data: receipts = [], isLoading: isLoadingReceipts } = useQuery({
    queryKey: ['receipts', paymentId],
    queryFn: async () => {
      try {
        const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/receipts`)
        return Array.isArray(response.data) ? response.data : []
      } catch (error: any) {
        // If receipts endpoint doesn't exist or returns 404, return empty array instead of failing
        if (error.response?.status === 404) {
          return []
        }
        throw error
      }
    },
    enabled: !!paymentId && !!venueId,
    retry: (failureCount, error: any) => {
      // Don't retry 404 errors
      if (error?.response?.status === 404) {
        return false
      }
      return failureCount < 2
    },
  })

  const from = (location.state as any)?.from || `/venues/${venueId}/payments`

  const sendReceiptMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/send-receipt`, {
        recipientEmail: email,
      })
      return response.data
    },
    onSuccess: _data => {
      toast({
        title: t('detail.toast.receiptSentTitle'),
        description: t('detail.toast.receiptSentDesc'),
      })
      setEmailDialogOpen(false)
      refetch()
    },
    onError: _error => {
      toast({
        title: t('common:error'),
        description: t('detail.toast.receiptErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}`)
    },
    onSuccess: () => {
      toast({
        title: t('common:superadmin.delete.success'),
        description: t('detail.toast.deletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['payments', venueId] })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: t('common:superadmin.delete.error'),
        description: error.response?.data?.message || t('detail.toast.deleteErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await api.put(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}`, data)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('common:superadmin.edit.success'),
        description: t('detail.toast.updatedDesc'),
      })
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
      queryClient.invalidateQueries({ queryKey: ['payments', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('common:superadmin.edit.error'),
        description: error.response?.data?.message || t('detail.toast.updateErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Initialize edit values when payment loads
  useEffect(() => {
    if (payment) {
      setEditedValues({
        amount: payment.amount || 0,
        tipAmount: payment.tipAmount || 0,
        method: payment.method || PaymentMethod.CASH,
        status: payment.status || PaymentStatus.PAID,
      })
    }
  }, [payment])

  // Edit mode handlers
  const startEditing = () => {
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    if (payment) {
      setEditedValues({
        amount: payment.amount || 0,
        tipAmount: payment.tipAmount || 0,
        method: payment.method || PaymentMethod.CASH,
        status: payment.status || PaymentStatus.PAID,
      })
    }
  }

  const saveChanges = () => {
    updatePaymentMutation.mutate(editedValues)
  }

  // Set breadcrumb with order number
  useEffect(() => {
    if (payment?.order?.orderNumber && paymentId) {
      setCustomSegment(paymentId, payment.order.orderNumber)
    }
    return () => {
      if (paymentId) {
        clearCustomSegment(paymentId)
      }
    }
  }, [payment?.order?.orderNumber, paymentId, setCustomSegment, clearCustomSegment])

  // Toggle section handler
  const toggleSection = (section: keyof SectionState) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Extract configurations early
  const paymentStatusConfig = payment ? getPaymentStatusConfig(payment.status) : null
  const orderTypeConfig = payment?.order?.type ? getOrderTypeConfig(payment.order.type) : null
  const locale = getIntlLocale(i18n.language)
  const StatusIcon = paymentStatusConfig?.icon || Clock

  const formatReceiptDate = (dateString: string) => {
    const dt = DateTime.fromISO(dateString, { zone: 'utc' }).setZone(venueTimezone).setLocale(locale)
    if (!dt.isValid) return '-'
    return dt.toLocaleString({
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const viewReceipt = (receipt: any) => {
    setSelectedReceiptForDetail(receipt)
    setReceiptDetailOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">{t('detail.loading')}</p>
      </div>
    )
  }

  // Helper function to get table info with extensive fallback
  const getTableInfo = (paymentData: any) => {
    // Primary path: payment.order.table.number (from updated backend)
    if (paymentData?.order?.table?.number) {
      return paymentData.order.table.number
    }

    // Fallback paths for backward compatibility
    return (
      paymentData?.order?.tableNumber ||
      paymentData?.table?.number ||
      paymentData?.table?.tableNumber ||
      paymentData?.tableNumber ||
      paymentData?.tableId ||
      (paymentData as any)?.bill?.table?.number ||
      (paymentData as any)?.bill?.tableNumber ||
      null
    )
  }

  // Helper function to get shift info
  const getShiftInfo = (paymentData: any) => {
    // Primary path: payment.shift.id (from updated backend)
    if (paymentData?.shift?.id) {
      return paymentData.shift.id
    }

    // Fallback paths for backward compatibility
    return paymentData?.shiftId || (paymentData as any)?.shift?.turnId || null
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header - Matching OrderId style */}
        <div className="border-b border-border bg-background">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            {/* Title + Actions */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold text-foreground">
                    {(() => {
                      const baseAmount = payment?.amount ? Number(payment.amount) : 0
                      const tipAmount = payment?.tipAmount ? Number(payment.tipAmount) : 0
                      const total = baseAmount + tipAmount
                      return total > 0 ? Currency(total) : 'N/A'
                    })()}
                  </h1>
                  {paymentStatusConfig && (
                    <Badge variant="outline" className={`${paymentStatusConfig.bg} ${paymentStatusConfig.color} ${paymentStatusConfig.border} border`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {t(`statuses.${payment?.status?.toLowerCase()}`)}
                    </Badge>
                  )}
                  {orderTypeConfig && (
                    <Badge variant="outline" className={`${orderTypeConfig.bg} ${orderTypeConfig.color} border-transparent`}>
                      {orderTypeConfig.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    {getPaymentIcon(payment)}
                    <span>
                      {payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD'
                        ? payment?.maskedPan || t('methods.card')
                        : payment?.method === 'CASH'
                        ? t('methods.cash')
                        : payment?.method === 'DIGITAL_WALLET'
                        ? t('methods.digitalWallet')
                        : payment?.method || 'N/A'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Actions - Icon-only with tooltips like OrderId */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(payment?.id || '', t('detail.actions.paymentIdLabel'), toast, t)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('detail.actions.copyId')}</TooltipContent>
                </Tooltip>

                {can('analytics:export') && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const data = JSON.stringify(payment, null, 2)
                          const blob = new Blob([data], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `payment-${payment?.id}.json`
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('detail.actions.export')}</TooltipContent>
                  </Tooltip>
                )}

                {canEdit && (
                  <>
                    {!isEditing ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
                            onClick={() => startEditing()}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('common:edit')}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
                          onClick={saveChanges}
                          disabled={updatePaymentMutation.isPending}
                        >
                          {updatePaymentMutation.isPending ? t('common:saving') : t('common:save')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditing}>
                          {t('common:cancel')}
                        </Button>
                      </div>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('common:areYouSure')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('detail.deleteWarning')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePaymentMutation.mutate()}>{t('common:delete')}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>

            {/* Quick stats bar - Matching OrderId style */}
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border text-sm">
              <div>
                <span className="text-muted-foreground">{t('detail.stats.base', { defaultValue: 'Base' })}: </span>
                <span className="font-medium">{Currency(payment?.amount || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.stats.tip', { defaultValue: 'Tip' })}: </span>
                <span className="font-medium">{Currency(payment?.tipAmount || 0)}</span>
                <span className="text-muted-foreground ml-1">({calculateTipPercentage(payment?.tipAmount || 0, payment?.amount || 0)}%)</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.stats.method', { defaultValue: 'Method' })}: </span>
                <span className="font-medium">
                  {payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD'
                    ? t('methods.card')
                    : payment?.method === 'CASH'
                    ? t('methods.cash')
                    : payment?.method === 'DIGITAL_WALLET'
                    ? t('methods.digitalWallet')
                    : payment?.method || 'N/A'}
                </span>
              </div>
              {getTableInfo(payment) && (
                <div>
                  <span className="text-muted-foreground">{t('detail.stats.table', { defaultValue: 'Table' })}: </span>
                  <span className="font-medium">{getTableInfo(payment)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column (65%) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Timeline */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    {t('detail.timeline.title', { defaultValue: 'Actividad reciente' })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentTimeline payment={payment} receipts={receipts} locale={locale} timezone={venueTimezone} t={t} />
                </CardContent>
              </Card>

              {/* Transaction Details - Collapsible */}
              <CollapsibleSection
                title={t('detail.sections.transactionInfo')}
                subtitle={t('detail.sections.transactionInfoDesc')}
                isOpen={sectionsOpen.transaction}
                onToggle={() => toggleSection('transaction')}
                icon={FileText}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.dateTime')}</Label>
                    <p className="text-sm mt-1">
                      {payment?.createdAt ? formatDateLong(payment.createdAt, locale, venueTimezone) : '-'}
                    </p>
                  </div>
                  {payment?.method !== 'CASH' && (
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('detail.fields.authNumber')}</Label>
                      <p className="text-sm font-mono mt-1">{payment?.authorizationNumber || t('detail.fields.notAvailable')}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.table')}</Label>
                    <p className="text-sm mt-1">{getTableInfo(payment) || t('detail.fields.noTable')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.referenceNumber')}</Label>
                    <p className="text-sm font-mono mt-1">{payment?.referenceNumber || t('detail.fields.notAvailable')}</p>
                  </div>
                  {(payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD') && payment?.entryMode && (
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('detail.fields.entryMode')}</Label>
                      <p className="text-sm mt-1">
                        {payment.entryMode === 'CONTACTLESS'
                          ? t('detail.entryModes.contactless')
                          : payment.entryMode === 'CHIP'
                          ? t('detail.entryModes.chip')
                          : payment.entryMode === 'SWIPE'
                          ? t('detail.entryModes.swipe')
                          : payment.entryMode === 'MANUAL'
                          ? t('detail.entryModes.manual')
                          : payment.entryMode === 'ONLINE'
                          ? t('detail.entryModes.online')
                          : payment.entryMode}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.orderId')}</Label>
                    <p className="text-sm font-mono mt-1">
                      {payment?.order?.orderNumber || payment?.orderId || (payment as any)?.billId || t('detail.fields.notAvailable')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.shiftId')}</Label>
                    <p className="text-sm font-mono mt-1">{getShiftInfo(payment) || t('detail.fields.notAvailable')}</p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Merchant Account - Collapsible */}
              {payment?.merchantAccount && (
                <CollapsibleSection
                  title={t('detail.sections.merchantAccountInfo')}
                  subtitle={t('detail.sections.merchantAccountDesc', { defaultValue: 'Información de la cuenta comercial' })}
                  isOpen={sectionsOpen.merchant}
                  onToggle={() => toggleSection('merchant')}
                  icon={Building2}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('detail.fields.merchantName')}</Label>
                      <p className="text-sm mt-1">{payment.merchantAccount.displayName || payment.merchantAccount.externalMerchantId}</p>
                    </div>
                    {payment.merchantAccount.bankName && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('detail.fields.bankName')}</Label>
                        <p className="text-sm mt-1">{payment.merchantAccount.bankName}</p>
                      </div>
                    )}
                    {payment.merchantAccount.clabeNumber && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('detail.fields.clabeNumber')}</Label>
                        <p className="text-sm font-mono mt-1">{payment.merchantAccount.clabeNumber}</p>
                      </div>
                    )}
                    {payment.merchantAccount.accountHolder && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('detail.fields.accountHolder')}</Label>
                        <p className="text-sm mt-1">{payment.merchantAccount.accountHolder}</p>
                      </div>
                    )}
                    {payment.merchantAccount.blumonSerialNumber && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('detail.fields.blumonSerial')}</Label>
                        <p className="text-sm font-mono mt-1">{payment.merchantAccount.blumonSerialNumber}</p>
                      </div>
                    )}
                    {payment.merchantAccount.provider && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('detail.fields.provider')}</Label>
                        <p className="text-sm mt-1">{payment.merchantAccount.provider.name}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Digital Receipts - Collapsible */}
              <CollapsibleSection
                title={t('detail.receipts.title', { defaultValue: 'Recibos Digitales' })}
                subtitle={t('detail.receipts.description', { defaultValue: 'Historial completo de recibos enviados para esta transacción' })}
                isOpen={sectionsOpen.receipts}
                onToggle={() => toggleSection('receipts')}
                icon={Receipt}
              >
                <div>
                  {isLoadingReceipts ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                      <span className="text-muted-foreground">{t('detail.receipts.loading', { defaultValue: 'Cargando recibos...' })}</span>
                    </div>
                  ) : Array.isArray(receipts) && receipts.length > 0 ? (
                    <div className="space-y-3">
                      {receipts.map((receipt: any) => (
                        <div
                          key={receipt.id}
                          className="flex justify-between items-center p-4 rounded-lg border border-border hover:shadow-md transition-shadow"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <Badge variant="secondary" className="font-medium">
                                {receipt.status}
                              </Badge>
                              <span className="font-medium text-foreground">
                                {receipt.recipientEmail || t('detail.receipts.noRecipient', { defaultValue: 'Sin destinatario' })}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatReceiptDate(receipt.createdAt)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span>ID: {receipt.id.slice(0, 8)}...</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewReceipt(receipt)}
                                  className="hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('detail.receipts.view', { defaultValue: 'Ver recibo' })}</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-green-50 dark:hover:bg-green-950/30"
                                  onClick={() => {
                                    const publicUrl = ReceiptUrls.public(receipt.accessKey)
                                    window.open(publicUrl, '_blank')
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('detail.receipts.openPublic', { defaultValue: 'Abrir enlace público' })}</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-muted"
                                  onClick={() => copyToClipboard(ReceiptUrls.public(receipt.accessKey), 'Enlace del recibo', toast, t)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('detail.receipts.copyLink', { defaultValue: 'Copiar enlace' })}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert className="border-border">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{t('detail.receipts.none', { defaultValue: 'No se han enviado recibos digitales para esta transacción.' })}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CollapsibleSection>

              {/* Send Receipt Dialog */}
              {can('payments:refund') && (
                <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Mail className="w-4 h-4 mr-2" />
                      {t('detail.actions.sendReceipt', { defaultValue: 'Enviar Recibo Digital' })}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <Mail className="h-5 w-5 text-primary" />
                        <span>{t('detail.actions.sendReceipt')}</span>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">{t('detail.email.recipientLabel', { defaultValue: 'Correo electrónico del destinatario' })}</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={t('detail.email.placeholder', { defaultValue: 'correo@ejemplo.com' })}
                          value={recipientEmail}
                          onChange={e => setRecipientEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)} className="flex-1">
                          {t('common:cancel')}
                        </Button>
                        <Button disabled={!recipientEmail || sendReceiptMutation.isPending} onClick={() => sendReceiptMutation.mutate({ email: recipientEmail })} className="flex-1">
                          {t('detail.email.send')}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Sidebar (35% - sticky) */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-6">
              {/* Status */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">{t('detail.sidebar.status', { defaultValue: 'Status' })}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${paymentStatusConfig?.bg}`}>
                      <StatusIcon className={`h-5 w-5 ${paymentStatusConfig?.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t(`statuses.${payment?.status?.toLowerCase()}`)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('detail.sidebar.lastUpdate')}: {formatDateShort(payment?.updatedAt, locale, venueTimezone)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card className={isEditing ? 'border-2 border-amber-400/50' : 'border-border'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium">{t('detail.sidebar.financialSummary')}</CardTitle>
                    {isEditing && (
                      <Badge className="bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground border-0 text-xs">
                        {t('common:superadmin.edit.editMode', { defaultValue: 'Edit' })}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('detail.overview.base')}</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28 h-7 text-right text-sm font-medium border-amber-400/50"
                        value={editedValues.amount}
                        onChange={(e) => setEditedValues(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      />
                    ) : (
                      <span className="font-medium">{Currency(payment?.amount || 0)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('detail.overview.tips')}</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28 h-7 text-right text-sm font-medium border-amber-400/50"
                        value={editedValues.tipAmount}
                        onChange={(e) => setEditedValues(prev => ({ ...prev, tipAmount: parseFloat(e.target.value) || 0 }))}
                      />
                    ) : (
                      <span className="font-medium">{Currency(payment?.tipAmount || 0)}</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between pt-3">
                    <span className="font-medium text-foreground">{t('detail.overview.total')}</span>
                    <span className="font-bold text-lg text-foreground">
                      {(() => {
                        const baseAmount = isEditing ? editedValues.amount : (payment?.amount ? Number(payment.amount) : 0)
                        const tipAmount = isEditing ? editedValues.tipAmount : (payment?.tipAmount ? Number(payment.tipAmount) : 0)
                        return Currency(baseAmount + tipAmount)
                      })()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    {t('detail.sidebar.info', { defaultValue: 'Info' })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {getTableInfo(payment) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.table')}:</span>
                      <span>{getTableInfo(payment)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.waiter')}:</span>
                    <span>{payment?.processedBy ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.receipts')}:</span>
                    <span>{receipts?.length || 0}</span>
                  </div>
                  {payment?.order?.orderNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.order')}:</span>
                      <span className="font-mono text-xs">{payment.order.orderNumber}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Edit Controls (when editing) */}
              {isEditing && (
                <Card className="border-amber-400/50 bg-gradient-to-r from-amber-500/5 to-pink-500/5">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">
                      {t('detail.sidebar.editMode', { defaultValue: 'Edit Mode' })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('detail.overview.method')}</Label>
                      <Select
                        value={editedValues.method}
                        onValueChange={(value: PaymentMethod) => setEditedValues((prev) => ({ ...prev, method: value }))}
                      >
                        <SelectTrigger className="h-9 border-amber-400/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PaymentMethod.CASH}>{t('methods.cash')}</SelectItem>
                          <SelectItem value={PaymentMethod.CREDIT_CARD}>{t('methods.creditCard')}</SelectItem>
                          <SelectItem value={PaymentMethod.DEBIT_CARD}>{t('methods.debitCard')}</SelectItem>
                          <SelectItem value={PaymentMethod.DIGITAL_WALLET}>{t('methods.digitalWallet')}</SelectItem>
                          <SelectItem value={PaymentMethod.BANK_TRANSFER}>{t('methods.bankTransfer')}</SelectItem>
                          <SelectItem value={PaymentMethod.OTHER}>{t('methods.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('columns.status')}</Label>
                      <Select
                        value={editedValues.status}
                        onValueChange={(value: PaymentStatus) => setEditedValues((prev) => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger className="h-9 border-amber-400/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PaymentStatus.PENDING}>{t('statuses.pending')}</SelectItem>
                          <SelectItem value={PaymentStatus.PARTIAL}>{t('statuses.partial')}</SelectItem>
                          <SelectItem value={PaymentStatus.PAID}>{t('statuses.paid')}</SelectItem>
                          <SelectItem value={PaymentStatus.REFUNDED}>{t('statuses.refunded')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border mt-12">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('detail.footer.paymentId', { id: payment?.id })}</span>
              <span>{t('detail.footer.generated', { date: DateTime.now().setZone(venueTimezone).setLocale(locale).toLocaleString(DateTime.DATETIME_MED) })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Details Dialog */}
      <Dialog open={receiptDetailOpen} onOpenChange={setReceiptDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-primary" />
              <span>{t('detail.receiptsDialog.title')}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedReceiptForDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('detail.receiptsDialog.receiptId')}</Label>
                  <p className="font-mono text-sm p-2 bg-muted rounded">{selectedReceiptForDetail.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('detail.receiptsDialog.status')}</Label>
                  <div className="p-2">
                    <Badge variant="secondary">
                      {selectedReceiptForDetail.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('detail.receiptsDialog.recipient')}</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {selectedReceiptForDetail.recipientEmail || t('detail.receipts.noRecipient')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('detail.receiptsDialog.createdDate')}</Label>
                  <p className="text-sm p-2 bg-muted rounded">{formatReceiptDate(selectedReceiptForDetail.createdAt)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-muted-foreground">{t('detail.receiptsDialog.publicLink')}</Label>
                <div className="flex space-x-2 mt-2">
                  <input
                    readOnly
                    value={ReceiptUrls.public(selectedReceiptForDetail.accessKey)}
                    className="flex-1 p-2 text-xs font-mono bg-muted rounded border"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(ReceiptUrls.public(selectedReceiptForDetail.accessKey), t('detail.receiptsDialog.receiptLink'), toast, t)
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button variant="outline" onClick={() => setReceiptDetailOpen(false)} className="flex-1">
                  {t('common:close')}
                </Button>
                <Button
                  onClick={() => {
                    const publicUrl = ReceiptUrls.public(selectedReceiptForDetail.accessKey)
                    window.open(publicUrl, '_blank')
                  }}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('detail.receiptsDialog.viewFull')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
