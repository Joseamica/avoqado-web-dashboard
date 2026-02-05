/**
 * Modern Receipt Design Component
 * Beautiful, responsive, mobile-first receipt design with full theme support
 */

import React, { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Share2,
  Download,
  Mail,
  Copy,
  Star,
  MapPin,
  Phone,
  Calendar,
  Clock,
  User,
  CreditCard,
  Receipt as ReceiptIcon,
  Sparkles,
  Check,
  AlertCircle,
  RotateCcw,
  Bitcoin,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { getIntlLocale } from '@/utils/i18n-locale'
import { ReceiptUrls } from '@/constants/receipt'
import type { UnifiedReceiptData, DigitalReceipt } from '@/types/receipt'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'

// Component Props
interface ModernReceiptDesignProps {
  receipt?: DigitalReceipt | null
  receiptData?: UnifiedReceiptData | null
  accessKey?: string
  isLoading?: boolean
  error?: string | null
  variant?: 'full' | 'embedded' | 'mobile'
  showActions?: boolean
  isRefund?: boolean // Indicates this is a refund receipt
  onShare?: (url: string) => void
  onCopy?: (url: string) => void
  onPrint?: () => void
  onEmail?: (email: string) => void
  className?: string
}

// Animated Loading Component
const ReceiptLoader = () => {
  const { t } = useTranslation('payment')
  return (
    <div className="min-h-screen bg-linear-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
              <ReceiptIcon className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded-full animate-pulse" />
            <div className="h-3 bg-muted/70 rounded-full w-3/4 mx-auto animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">{t('receipt.loading')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Error Component
const ReceiptError = ({ error }: { error: string }) => (
  <div className="min-h-screen bg-linear-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
    <Card className="w-full max-w-md">
      <CardContent className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  </div>
)

// Receipt Status Badge - Currently unused, kept for future use
 
const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation('payment')
  const { t: tCommon } = useTranslation('common')
  const configs = {
    VIEWED: {
      className:
        'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
      icon: Check,
      text: t('receipt.statuses.VIEWED'),
    },
    SENT: {
      className: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
      icon: Mail,
      text: t('receipt.statuses.SENT'),
    },
    PENDING: {
      className: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
      icon: Clock,
      text: t('receipt.statuses.PENDING'),
    },
    ERROR: {
      className: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-amber-800',
      icon: AlertCircle,
      text: t('receipt.statuses.ERROR'),
    },
  }

  const config = configs[status as keyof typeof configs] || {
    className: 'bg-muted text-muted-foreground border-border',
    icon: ReceiptIcon,
    text: status || tCommon('unknown'),
  }

  const IconComponent = config.icon

  return (
    <Badge variant="outline" className={`${config.className} font-medium px-3 py-1`}>
      <IconComponent className="w-3 h-3 mr-2" />
      {config.text}
    </Badge>
  )
}

// Main Component
export const ModernReceiptDesign: React.FC<ModernReceiptDesignProps> = ({
  receipt,
  receiptData,
  accessKey,
  isLoading = false,
  error,
  variant: _variant = 'full',
  showActions = true,
  isRefund = false,
  onShare,
  onCopy,
  onPrint,
  onEmail: _onEmail,
  className = '',
}) => {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { t, i18n } = useTranslation('payment')

  // Extract data
  const data = receipt?.dataSnapshot || receiptData
  const receiptAccessKey = receipt?.accessKey || accessKey
  const _receiptStatus = receipt?.status
  const publicUrl = receiptAccessKey ? ReceiptUrls.public(receiptAccessKey) : null

  // Loading state
  if (isLoading) return <ReceiptLoader />

  // Error state
  if (error || !data) return <ReceiptError error={error || t('receipt.errors.load')} />

  const { payment, venue, order, processedBy, customer } = data
  const venueTimezone = (venue as { timezone?: string })?.timezone || 'America/Mexico_City'

  // Format helpers
  const formatDate = (dateString: string) => {
    const locale = getIntlLocale(i18n.language)
    const dt = DateTime.fromISO(dateString, { zone: 'utc' }).setZone(venueTimezone).setLocale(locale)
    return {
      date: dt.toLocaleString({
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: dt.toLocaleString({
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    }
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(Number(value))) return 'N/A'
    try {
      const currency = venue?.currency || 'MXN'
      return new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency }).format(Number(value))
    } catch {
      return 'N/A'
    }
  }

  const formatPaymentMethod = (method: string, cardBrand?: string, maskedPan?: string, processorData?: any) => {
    const methods = {
      CASH: { text: t('receipt.methods.CASH'), icon: '💵' },
      CREDIT_CARD: { text: t('receipt.methods.CREDIT_CARD'), icon: '💳' },
      DEBIT_CARD: { text: t('receipt.methods.DEBIT_CARD'), icon: '💳' },
      DIGITAL_WALLET: { text: t('receipt.methods.DIGITAL_WALLET'), icon: '📱' },
      BANK_TRANSFER: { text: t('receipt.methods.BANK_TRANSFER'), icon: '🏦' },
      CRYPTOCURRENCY: { text: t('receipt.methods.CRYPTOCURRENCY'), icon: '₿' },
    }

    const methodInfo = methods[method as keyof typeof methods] || { text: method, icon: '💳' }

    if ((method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && maskedPan) {
      return `${methodInfo.icon} ${methodInfo.text} •••• ${maskedPan.slice(-4)}`
    }

    // For crypto payments, show the crypto currency and amount
    if (method === 'CRYPTOCURRENCY' && processorData) {
      const cryptoCurrency = processorData.cryptoCurrency || processorData.currency || ''
      const cryptoAmount = processorData.cryptoAmount
      if (cryptoCurrency && cryptoAmount) {
        return `${methodInfo.icon} ${cryptoAmount} ${cryptoCurrency.toUpperCase()}`
      }
      if (cryptoCurrency) {
        return `${methodInfo.icon} ${methodInfo.text} (${cryptoCurrency.toUpperCase()})`
      }
    }

    return `${methodInfo.icon} ${methodInfo.text}`
  }

  // Action handlers
  const handleCopy = async () => {
    if (!publicUrl) return

    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopy?.(publicUrl)
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

  const handleShare = async () => {
    if (!publicUrl) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('receipt.share.title', { venue: venue?.name || t('receipt.unknownVenue') }),
          text: t('receipt.share.text', { venue: venue?.name || t('receipt.unknownVenue') }),
          url: publicUrl,
        })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        onShare?.(publicUrl)
      } catch {
        // User cancelled or error occurred
      }
    } else {
      handleCopy()
    }
  }

  const handlePrint = () => {
    // Avoid double print dialogs when parent provides handler
    if (onPrint) {
      onPrint()
    } else {
      window.print()
    }
  }

  const datetime = payment?.createdAt ? formatDate(payment.createdAt) : null

  return (
    <div className={`min-h-screen bg-linear-to-br from-background via-muted/30 to-background ${className}`}>
      {/* Mobile-First Layout */}
      {/* Add receipt-container for print CSS to target only the receipt area */}
      <div className="receipt-container container mx-auto p-3 sm:p-6 max-w-2xl">
        <div ref={receiptRef} className="space-y-4">
          {/* Header Card */}
          <Card className={`overflow-hidden border-0 shadow-lg ${isRefund ? 'bg-linear-to-br from-red-50 dark:from-red-950/30 to-card/50 border-red-200 dark:border-red-800' : 'bg-linear-to-br from-card to-card/50'}`}>
            <div className="relative">
              {/* Decorative background pattern */}
              <div className={`absolute inset-0 ${isRefund ? 'opacity-10' : 'opacity-5'}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,currentColor_1px,transparent_1px)] bg-size-[16px_16px]" />
              </div>

              <CardContent className="p-6 sm:p-8 text-center relative">
                {/* Refund Badge - Top Left */}
                {isRefund && (
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 font-semibold">
                      <RotateCcw className="w-3 h-3 mr-1" />
                      {t('types.refund')}
                    </Badge>
                  </div>
                )}

                {/* Venue Logo */}
                <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden shadow-lg border-4 border-background">
                  {venue?.logo && !logoError ? (
                    <img
                      src={venue.logo}
                      alt={venue?.name || t('receipt.unknownVenue')}
                      className="w-full h-full object-cover"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-primary/10">
                      <span className="text-2xl font-bold text-primary">
                        {(venue?.name || '??').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Venue Info */}
                <h1 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-2">{venue?.name || t('receipt.unknownVenue')}</h1>

                <div className="space-y-1 text-muted-foreground text-sm">
                  <div className="flex items-center justify-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{venue?.address || ''}</span>
                  </div>
                  <p>
                    {venue?.city || ''}
                    {venue?.state ? `, ${venue.state}` : ''} {venue?.zipCode || ''}
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <Phone className="w-4 h-4" />
                    <span>{venue?.phone || ''}</span>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Receipt Details Card */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-6">
              {/* Receipt Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-xl">
                {/* Receipt # */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ReceiptIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('receipt.labels.receipt')}</p>
                    <p className="font-mono text-sm font-medium">#{receiptAccessKey?.slice(-4).toUpperCase() || 'N/A'}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start gap-3 sm:col-start-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Calendar className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('receipt.labels.date')}</p>
                    <p className="text-sm font-medium capitalize">{datetime?.date ?? 'N/A'}</p>
                  </div>
                </div>

                {/* Served By */}
                {processedBy && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('receipt.labels.servedBy')}</p>
                      <p className="text-sm font-medium">
                        {processedBy.name ||
                          ((processedBy as any).firstName && (processedBy as any).lastName
                            ? `${(processedBy as any).firstName} ${(processedBy as any).lastName}`
                            : (processedBy as any).firstName || (processedBy as any).lastName || 'N/A')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Time */}
                <div className="flex items-start gap-3 sm:col-start-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('receipt.labels.time')}</p>
                    <p className="text-sm font-medium">{datetime?.time ?? 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              {customer && (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <Star className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('receipt.labels.customer')}</p>
                    <p className="font-medium text-sm">
                      {customer.name ||
                        ((customer as any).firstName && (customer as any).lastName
                          ? `${(customer as any).firstName} ${(customer as any).lastName}`
                          : (customer as any).firstName || (customer as any).lastName || customer.email || 'N/A')}
                    </p>
                  </div>
                </div>
              )}

              {/* Order Items - Only show if there are items */}
              {(order?.items?.length ?? 0) > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    {t('receipt.labels.itemsTitle')}
                  </h2>

                  <div className="space-y-3">
                    {order!.items!.map((item, index) => (
                      <div key={index} className="bg-background border border-border/50 rounded-xl p-4 hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <h3 className="font-medium text-card-foreground leading-tight">{item.name}</h3>
                              <div className="text-right ml-4">
                                <div className="font-bold text-lg">{formatCurrency(item.totalPrice)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {t('receipt.labels.unitPrice', { count: item.quantity, price: formatCurrency(item.price) })}
                                </div>
                              </div>
                            </div>

                            {/* Quantity Badge */}
                            <Badge variant="secondary" className="w-fit text-xs">
                              {t('receipt.labels.quantity', { count: item.quantity })}
                            </Badge>

                            {/* Modifiers */}
                            {item.modifiers?.length > 0 && (
                              <div className="space-y-1 mt-2 pl-3 border-l-2 border-muted">
                                {item.modifiers.map((modifier, modIndex) => (
                                  <div key={modIndex} className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">+ {modifier.name}</span>
                                    <span className="font-medium">{formatCurrency(modifier.price)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="my-6" />

              {/* Totals */}
              <div className="space-y-3">
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">{t('receipt.labels.subtotal')}</span>
                  <span className="font-medium">{formatCurrency(order?.subtotal)}</span>
                </div>

                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">{t('receipt.labels.taxes')}</span>
                  <span className="font-medium">{formatCurrency(order?.taxAmount)}</span>
                </div>

                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">{t('receipt.labels.tips')}</span>
                  <span className="font-medium text-green-600">{formatCurrency(payment?.tipAmount)}</span>
                </div>

                {/* <Separator /> */}

                <div className={`flex justify-between items-center text-xl font-bold p-4 rounded-xl ${
                  isRefund
                    ? 'bg-linear-to-r from-red-100 dark:from-red-950/50 to-red-50 dark:to-red-950/30'
                    : 'bg-linear-to-r from-primary/10 to-primary/5'
                }`}>
                  <div className="flex flex-col items-start">
                    <span>{isRefund ? t('receipt.labels.totalRefunded', { defaultValue: t('receipt.labels.totalPaid') }) : t('receipt.labels.totalPaid')}</span>
                    {isRefund && (
                      <span className="text-xs font-normal text-red-500 dark:text-red-400 flex items-center gap-1 mt-0.5">
                        <RotateCcw className="w-3 h-3" />
                        {t('types.refund')}
                      </span>
                    )}
                  </div>
                  <span className={isRefund ? 'text-red-600 dark:text-red-400' : 'text-primary'}>
                    {isRefund ? '−' : ''}{Currency(Math.abs((payment?.amount ?? 0) + (payment?.tipAmount ?? 0)))}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className={`p-4 rounded-xl ${isRefund ? 'bg-linear-to-r from-red-50 dark:from-red-950/30 to-red-50/50 dark:to-red-950/20' : payment?.method === 'CRYPTOCURRENCY' ? 'bg-linear-to-r from-orange-50 dark:from-orange-950/30 to-orange-50/50 dark:to-orange-950/20' : 'bg-linear-to-r from-muted/50 to-muted/30'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full shadow-sm flex items-center justify-center ${isRefund ? 'bg-red-100 dark:bg-red-900/50' : payment?.method === 'CRYPTOCURRENCY' ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-background'}`}>
                    {isRefund ? (
                      <RotateCcw className="w-6 h-6 text-red-600 dark:text-red-400" />
                    ) : payment?.method === 'CRYPTOCURRENCY' ? (
                      <Bitcoin className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <CreditCard className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-lg">
                      {formatPaymentMethod(payment?.method || '', payment?.cardBrand, payment?.maskedPan, payment?.processorData)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${isRefund ? 'bg-red-500' : payment?.status === 'COMPLETED' ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span className={`text-sm ${isRefund ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {isRefund
                          ? t('receipt.paymentStatus.REFUND_COMPLETED', { defaultValue: 'Refund completed' })
                          : payment?.status === 'COMPLETED'
                          ? t('receipt.paymentStatus.COMPLETED')
                          : t(`payments.receipt.paymentStatus.${payment?.status}`, {
                              defaultValue: t('receipt.paymentStatus.UNKNOWN'),
                            })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {showActions && publicUrl && (
                <div className="space-y-3 pt-4 border-t">
                  <p className="text-center text-sm text-muted-foreground font-medium">{t('receipt.labels.shareThisReceipt')}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleCopy}
                      className="w-full h-12 bg-background hover:bg-muted"
                      disabled={copied}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-green-600" />
                          {t('receipt.actions.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          {t('receipt.actions.copyLink')}
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleShare}
                      className="w-full h-12 bg-background hover:bg-muted"
                      disabled={shared}
                    >
                      {shared ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-blue-600" />
                          {t('receipt.actions.shared')}
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 mr-2" />
                          {t('receipt.actions.share')}
                        </>
                      )}
                    </Button>

                    <Button variant="outline" size="lg" onClick={handlePrint} className="w-full h-12 bg-background hover:bg-muted">
                      <Download className="w-4 h-4 mr-2" />
                      {t('receipt.actions.print')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <Card className={`border-0 shadow-lg ${isRefund ? 'bg-linear-to-r from-red-50 dark:from-red-950/20 to-transparent' : 'bg-linear-to-r from-primary/5 to-transparent'}`}>
            <CardContent className="p-6 text-center">
              <div className="space-y-3">
                {isRefund ? (
                  <>
                    <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
                      <RotateCcw className="w-5 h-5" />
                      <span className="font-semibold text-lg">{t('receipt.footer.refundProcessed', { defaultValue: 'Refund Processed' })}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {t('receipt.footer.refundMessage', { defaultValue: 'Your refund has been processed successfully. The amount will be credited to your original payment method.' })}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Sparkles className="w-5 h-5" />
                      <span className="font-semibold text-lg">{t('receipt.footer.thanks')}</span>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="text-muted-foreground">{t('receipt.footer.seeYou', { venue: venue?.name || t('receipt.unknownVenue') })}</p>
                  </>
                )}

                <div className="pt-3 space-y-1 text-xs text-muted-foreground">
                  <p>{t('receipt.footer.generatedBy')}</p>
                  <p>{datetime ? `${datetime.date} • ${datetime.time}` : 'N/A'}</p>
                  {customer?.email && <p>{t('receipt.footer.sentTo', { email: customer.email })}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ModernReceiptDesign
