import api from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Receipt,
  Mail,
  Eye,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  CreditCard,
  User,
  Calendar,
  RefreshCw,
  DollarSign,
  TrendingUp,
  FileText,
  Shield,
  Copy,
  Download,
} from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import getIcon from '@/utils/getIcon'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { ReceiptUrls } from '@/constants/receipt'

export default function PaymentId() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const location = useLocation()

  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [receiptDetailOpen, setReceiptDetailOpen] = useState(false)
  const [selectedReceiptForDetail, setSelectedReceiptForDetail] = useState<any>(null)
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()

  const { t, i18n } = useTranslation()
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
        title: t('payments.detail.toast.receiptSentTitle'),
        description: t('payments.detail.toast.receiptSentDesc'),
      })
      setEmailDialogOpen(false)
      refetch()
    },
    onError: _error => {
      toast({
        title: t('common.error'),
        description: t('payments.detail.toast.receiptErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Enhanced status badge styling for enterprise look
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'VIEWED':
        return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
      case 'DELIVERED':
        return 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
      case 'SENT':
        return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
      case 'ERROR':
        return 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
      case 'PENDING':
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  // Payment status styling - Updated for Prisma TransactionStatus enum
  const getPaymentStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return {
          badge:
            'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
          icon: CheckCircle2,
          color: 'text-emerald-500',
        }
      case 'PENDING':
      case 'PROCESSING':
        return {
          badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
          icon: Clock,
          color: 'text-amber-500',
        }
      case 'FAILED':
      case 'REFUNDED':
        return {
          badge: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800',
          icon: XCircle,
          color: 'text-red-500',
        }
      default:
        return {
          badge: 'bg-muted text-muted-foreground border border-border',
          icon: AlertCircle,
          color: 'text-muted-foreground',
        }
    }
  }

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: t('common.copied'),
      description: t('payments.detail.copiedToClipboard', { label }),
    })
  }

  const formatReceiptDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(getIntlLocale(i18n.language), {
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
        <p className="text-muted-foreground">{t('payments.detail.loading')}</p>
      </div>
    )
  }

  const paymentStatus = getPaymentStatusStyle(payment?.status)
  const StatusIcon = paymentStatus.icon

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
      <div className="min-h-screen bg-gradient-to-b from-muted to-background">
        {/* Enhanced Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={from}>
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('payments.detail.backToList', { defaultValue: 'Volver a pagos' })}</TooltipContent>
              </Tooltip>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {t('payments.detail.title', { defaultValue: 'Detalles del Pago' })}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('payments.detail.idLabel', { defaultValue: 'ID' })}:
                  <span className="font-mono text-xs break-all select-all max-w-[200px] inline-block">{payment?.id}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className={paymentStatus.badge}>
                <StatusIcon className={`h-3 w-3 mr-1 ${paymentStatus.color}`} />
                {payment?.status === 'COMPLETED'
                  ? t('payments.detail.status.completed', { defaultValue: 'Pago Completado' })
                  : payment?.status === 'PENDING'
                  ? t('payments.detail.status.pending', { defaultValue: 'Pendiente' })
                  : payment?.status === 'PROCESSING'
                  ? t('payments.detail.status.processing', { defaultValue: 'Procesando' })
                  : payment?.status === 'FAILED'
                  ? t('payments.detail.status.failed', { defaultValue: 'Fallido' })
                  : payment?.status === 'REFUNDED'
                  ? t('payments.detail.status.refunded', { defaultValue: 'Reembolsado' })
                  : payment?.status || t('common.unknown', { defaultValue: 'Desconocido' })}
              </Badge>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('payments.detail.totals.total', { defaultValue: 'Total' })}</p>
                <p className="text-lg font-bold text-foreground">
                  {(() => {
                    const baseAmount = payment?.amount ? Number(payment.amount) : 0
                    const tipAmount = payment?.tipAmount ? Number(payment.tipAmount) : 0
                    const total = baseAmount + tipAmount
                    return total > 0 ? Currency(total) : 'N/A'
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('payments.detail.overview.base', { defaultValue: 'Monto Base' })}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{payment?.amount ? Currency(Number(payment.amount)) : Currency(0)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('payments.detail.overview.tips', { defaultValue: 'Propinas' })}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {payment?.tipAmount ? Currency(Number(payment.tipAmount)) : Currency(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment?.amount && payment.amount > 0 ? (((payment?.tipAmount || 0) / payment.amount) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('payments.detail.overview.method', { defaultValue: 'Método' })}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      {(payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD') && payment?.cardBrand && (
                        <span className="text-lg">{getIcon(payment.cardBrand)}</span>
                      )}
                      <p className="font-semibold text-sm">
                        {payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD'
                          ? payment?.maskedPan
                            ? payment.maskedPan
                            : t('payments.methods.card', { defaultValue: 'Tarjeta' })
                          : payment?.method === 'CASH'
                          ? t('payments.methods.cash', { defaultValue: 'Efectivo' })
                          : payment?.method === 'DIGITAL_WALLET'
                          ? t('payments.methods.digitalWallet', { defaultValue: 'Monedero Digital' })
                          : payment?.method === 'BANK_TRANSFER'
                          ? t('payments.methods.bankTransfer', { defaultValue: 'Transferencia Bancaria' })
                          : payment?.method || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <CreditCard className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('payments.detail.overview.waiter', { defaultValue: 'Mesero' })}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {payment?.processedBy
                        ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}`.trim() ||
                          t('payments.detail.overview.waiterUnknown', { defaultValue: 'N/A' })
                        : t('payments.detail.overview.waiterUnknown', { defaultValue: 'N/A' })}
                    </p>
                  </div>
                  <User className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          {payment && (
            <Card className="bg-gradient-to-r from-muted to-blue-50 dark:to-blue-950/50 border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-foreground">
                      {t('payments.detail.actions.title', { defaultValue: 'Acciones del Pago' })}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50">
                          <Mail className="w-4 h-4 mr-2" />
                          {t('payments.detail.actions.sendReceipt', { defaultValue: 'Enviar Recibo Digital' })}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center space-x-2">
                            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <span>{t('payments.detail.actions.sendReceipt', { defaultValue: 'Enviar Recibo Digital' })}</span>
                          </DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-2">
                            <Label htmlFor="email">
                              {t('payments.detail.email.recipientLabel', { defaultValue: 'Correo electrónico del destinatario' })}
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder={t('payments.detail.email.placeholder', { defaultValue: 'correo@ejemplo.com' })}
                              value={recipientEmail}
                              onChange={e => setRecipientEmail(e.target.value)}
                              className="w-full"
                            />
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} className="flex-1">
                              {t('common.cancel', { defaultValue: 'Cancelar' })}
                            </Button>
                            <Button
                              disabled={!recipientEmail || sendReceiptMutation.isPending}
                              onClick={() => sendReceiptMutation.mutate({ email: recipientEmail })}
                              className="flex-1"
                            >
                              {sendReceiptMutation.isPending ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  {t('payments.detail.email.sending')}
                                </>
                              ) : (
                                <>{t('payments.detail.email.send')}</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => {
                        // Check if payment has receipt access key
                        if (receipts && receipts.length > 0) {
                          const latestReceipt = receipts[0]
                          window.open(ReceiptUrls.public(latestReceipt.accessKey), '_blank')
                        } else {
                          toast({
                            title: t('payments.detail.receipts.noReceipts', { defaultValue: 'Sin recibos' }),
                            description: t('payments.detail.receipts.noReceiptsDesc', {
                              defaultValue: 'No hay recibos disponibles para este pago.',
                            }),
                            variant: 'destructive',
                          })
                        }
                      }}
                    >
                      <Receipt className="w-4 h-4 mr-2" />
                      {t('payments.detail.actions.viewReceipt')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => copyToClipboard(payment?.id || '', t('payments.detail.actions.paymentIdLabel'))}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {t('payments.detail.actions.copyId')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => {
                        // Export payment details as JSON
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
                      <Download className="w-4 h-4 mr-2" />
                      {t('payments.detail.actions.export')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Payment Information Card */}
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-muted to-blue-50 dark:to-blue-950/50 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span>{t('payments.detail.sections.transactionInfo')}</span>
                  </CardTitle>
                  <CardDescription>{t('payments.detail.sections.transactionInfoDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{t('payments.detail.fields.dateTime')}</span>
                      </Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-sm">
                          {payment?.createdAt
                            ? new Date(payment.createdAt).toLocaleString(getIntlLocale(i18n.language), {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.fields.authNumber')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-sm">{payment?.authorizationNumber || t('payments.detail.fields.notAvailable')}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.fields.table')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="text-sm">{getTableInfo(payment) || t('payments.detail.fields.noTable')}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.fields.referenceNumber')}</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-xs break-all">{payment?.referenceNumber || t('payments.detail.fields.notAvailable')}</p>
                      </div>
                    </div>

                    {(payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD') && payment?.entryMode && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.fields.entryMode')}</Label>
                        <div className="p-3 bg-muted rounded-md border border-border">
                          <p className="text-sm">
                            {payment.entryMode === 'CONTACTLESS'
                              ? t('payments.detail.entryModes.contactless')
                              : payment.entryMode === 'CHIP'
                              ? t('payments.detail.entryModes.chip')
                              : payment.entryMode === 'SWIPE'
                              ? t('payments.detail.entryModes.swipe')
                              : payment.entryMode === 'MANUAL'
                              ? t('payments.detail.entryModes.manual')
                              : payment.entryMode === 'ONLINE'
                              ? t('payments.detail.entryModes.online')
                              : payment.entryMode}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bill Information */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 text-sm text-muted-foreground">{t('payments.detail.sections.billInfo')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.fields.orderId')}</Label>
                        <div className="p-3 bg-muted rounded-md border border-border">
                          <p className="font-mono text-sm">
                            {payment?.order?.orderNumber || payment?.orderId || (payment as any)?.billId || t('payments.detail.fields.notAvailable')}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.fields.shiftId')}</Label>
                        <div className="p-3 bg-muted rounded-md border border-border">
                          <p className="font-mono text-sm">{getShiftInfo(payment) || t('payments.detail.fields.notAvailable')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Digital Receipts Section */}
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-muted to-green-50 dark:to-green-950/50 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span>{t('payments.detail.receipts.title', { defaultValue: 'Recibos Digitales' })}</span>
                  </CardTitle>
                  <CardDescription>
                    {t('payments.detail.receipts.description', {
                      defaultValue: 'Historial completo de recibos enviados para esta transacción',
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {isLoadingReceipts ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                      <span className="text-muted-foreground">
                        {t('payments.detail.receipts.loading', { defaultValue: 'Cargando recibos...' })}
                      </span>
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
                              <Badge variant="secondary" className={`${getStatusBadgeColor(receipt.status)} font-medium`}>
                                {receipt.status}
                              </Badge>
                              <span className="font-medium text-foreground">
                                {receipt.recipientEmail || t('payments.detail.receipts.noRecipient', { defaultValue: 'Sin destinatario' })}
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
                              <TooltipContent>{t('payments.detail.receipts.view', { defaultValue: 'Ver recibo' })}</TooltipContent>
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
                              <TooltipContent>
                                {t('payments.detail.receipts.openPublic', { defaultValue: 'Abrir enlace público' })}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-muted"
                                  onClick={() =>
                                    copyToClipboard(ReceiptUrls.public(receipt.accessKey), 'Enlace del recibo')
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('payments.detail.receipts.copyLink', { defaultValue: 'Copiar enlace' })}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        {t('payments.detail.receipts.none', { defaultValue: 'No se han enviado recibos digitales para esta transacción.' })}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Payment Status Card */}
              <Card className="shadow-lg border-t-4 border-t-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>{t('payments.detail.status.title', { defaultValue: 'Estado del Pago' })}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-3">
                      <StatusIcon className={`h-8 w-8 ${paymentStatus.color}`} />
                    </div>
                    <Badge variant="outline" className={`${paymentStatus.badge} text-sm px-3 py-1`}>
                      {payment?.status === 'COMPLETED'
                        ? t('payments.detail.status.completed', { defaultValue: 'Pago Completado' })
                        : payment?.status === 'PENDING'
                        ? t('payments.detail.status.pending', { defaultValue: 'Pendiente' })
                        : payment?.status === 'PROCESSING'
                        ? t('payments.detail.status.processing', { defaultValue: 'Procesando' })
                        : payment?.status === 'FAILED'
                        ? t('payments.detail.status.failed', { defaultValue: 'Fallido' })
                        : payment?.status === 'REFUNDED'
                        ? t('payments.detail.status.refunded', { defaultValue: 'Reembolsado' })
                        : payment?.status || t('payments.detail.status.unknown', { defaultValue: 'Estado Desconocido' })}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('payments.detail.status.lastUpdatePrefix', { defaultValue: 'Última actualización:' })}{' '}
                      {payment?.updatedAt ? new Date(payment.updatedAt).toLocaleString(getIntlLocale(i18n.language)) : t('payments.detail.fields.notAvailable')}
                    </p>
                  </div>

                  {payment?.status === 'COMPLETED' && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">{t('payments.detail.status.successTitle')}</p>
                          <p className="text-xs text-green-600 dark:text-green-400">{t('payments.detail.status.successDesc')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span>{t('payments.detail.summary.title', { defaultValue: 'Resumen Financiero' })}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t('payments.detail.summary.subtotal', { defaultValue: 'Subtotal' })}
                      </span>
                      <span className="text-lg font-bold">{Currency(payment?.amount || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">
                          {t('payments.detail.overview.tips', { defaultValue: 'Propinas' })}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {payment?.amount && payment.amount > 0
                            ? t('payments.detail.summary.tipsOfSubtotal', {
                                defaultValue: '{{percent}}% del subtotal',
                                percent: (((payment?.tipAmount || 0) / payment.amount) * 100).toFixed(1),
                              })
                            : t('payments.detail.summary.tipsOfSubtotal', { defaultValue: '0.0% del subtotal', percent: '0.0' })}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{Currency(payment?.tipAmount || 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                      <span className="text-base font-bold text-green-800 dark:text-green-200">
                        {t('payments.detail.summary.total', { defaultValue: 'Total' })}
                      </span>
                      <span className="text-xl font-bold text-green-800 dark:text-green-200">
                        {(() => {
                          const baseAmount = payment?.amount ? Number(payment.amount) : 0
                          const tipAmount = payment?.tipAmount ? Number(payment.tipAmount) : 0
                          const total = baseAmount + tipAmount
                          return total > 0 ? Currency(total) : Currency(0)
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('payments.detail.summary.progressBase', { defaultValue: 'Base' })}</span>
                      <span>{t('payments.detail.overview.tips', { defaultValue: 'Propinas' })}</span>
                    </div>
                    <Progress
                      value={
                        payment?.amount && payment.amount + (payment?.tipAmount || 0) > 0
                          ? (payment.amount / (payment.amount + (payment?.tipAmount || 0))) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Info Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span>{t('payments.detail.sidebar.quickInfo')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('payments.detail.sidebar.table')}:</span>
                      <span className="font-medium">{getTableInfo(payment) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('payments.detail.sidebar.processedBy')}:</span>
                      <span className="font-medium">
                        {payment?.processedBy ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}`.trim() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('payments.detail.sidebar.shift')}:</span>
                      <span className="font-mono text-xs">{getShiftInfo(payment) || 'N/A'}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('payments.detail.overview.method', { defaultValue: 'Método' })}:</span>
                      <div className="flex items-center space-x-1">
                        {(payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD') && payment?.cardBrand && (
                          <span className="text-sm">{getIcon(payment.cardBrand)}</span>
                        )}
                        <span className="text-sm font-medium">
                          {payment?.method === 'CREDIT_CARD' || payment?.method === 'DEBIT_CARD'
                            ? payment?.maskedPan || '****0000'
                            : payment?.method === 'CASH'
                            ? t('payments.methods.cash', { defaultValue: 'Efectivo' })
                            : payment?.method === 'DIGITAL_WALLET'
                            ? t('payments.methods.digitalWallet', { defaultValue: 'Monedero Digital' })
                            : payment?.method === 'BANK_TRANSFER'
                            ? t('payments.methods.bankTransfer', { defaultValue: 'Transferencia Bancaria' })
                            : payment?.method || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tips Detail Section */}
          {payment?.tipAmount && payment.tipAmount > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-muted to-green-50 dark:to-green-950/50 border-b">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span>Detalles de {t('payments.detail.overview.tips', { defaultValue: 'Propinas' })}</span>
                </CardTitle>
                <CardDescription>
                  {t('payments.detail.tipsDetail.description', { defaultValue: 'Información de propina para esta transacción' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {t('payments.detail.tipsDetail.amount', { defaultValue: 'Monto de Propina' })}
                      </Label>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">{Currency(payment.tipAmount)}</p>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {t('payments.detail.tipsDetail.percentage', { defaultValue: 'Porcentaje' })}
                      </Label>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">
                        {payment?.amount && payment.amount > 0 ? (((payment?.tipAmount || 0) / payment.amount) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {t('payments.detail.tipsDetail.beneficiary', { defaultValue: 'Beneficiario' })}
                      </Label>
                      <p className="text-lg font-semibold text-foreground">
                        {payment?.processedBy
                          ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}`.trim()
                          : t('payments.detail.sidebar.noBeneficiary')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted mt-8">
          <div className="max-w-7xl mx-auto p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center space-x-4">
                <span>{t('payments.detail.footer.copyright')}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{t('payments.detail.footer.paymentId', { defaultValue: 'Pago ID: {{id}}', id: payment?.id })}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>{t('payments.detail.footer.generated', { date: new Date().toLocaleString(getIntlLocale(i18n.language)) })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Details Dialog */}
      <Dialog open={receiptDetailOpen} onOpenChange={setReceiptDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>{t('payments.detail.receiptsDialog.title')}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedReceiptForDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.receiptsDialog.receiptId')}</Label>
                  <p className="font-mono text-sm p-2 bg-muted rounded">{selectedReceiptForDetail.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.receiptsDialog.status')}</Label>
                  <div className="p-2">
                    <Badge variant="secondary" className={getStatusBadgeColor(selectedReceiptForDetail.status)}>
                      {selectedReceiptForDetail.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.receiptsDialog.recipient')}</Label>
                  <p className="text-sm p-2 bg-muted rounded">{selectedReceiptForDetail.recipientEmail || t('payments.detail.receipts.noRecipient')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.receiptsDialog.createdDate')}</Label>
                  <p className="text-sm p-2 bg-muted rounded">{formatReceiptDate(selectedReceiptForDetail.createdAt)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-muted-foreground">{t('payments.detail.receiptsDialog.publicLink')}</Label>
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
                      copyToClipboard(
                        ReceiptUrls.public(selectedReceiptForDetail.accessKey),
                        t('payments.detail.receiptsDialog.receiptLink'),
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button variant="outline" onClick={() => setReceiptDetailOpen(false)} className="flex-1">
                  {t('common.close')}
                </Button>
                <Button
                  onClick={() => {
                    const publicUrl = ReceiptUrls.public(selectedReceiptForDetail.accessKey)
                    window.open(publicUrl, '_blank')
                  }}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('payments.detail.receiptsDialog.viewFull')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
