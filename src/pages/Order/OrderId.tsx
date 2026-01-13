import { DateTime } from 'luxon'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import * as orderService from '@/services/order.service'
import { Order as OrderType, StaffRole } from '@/types'
import { Currency } from '@/utils/currency'
import getIcon from '@/utils/getIcon'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileText,
  MapPin,
  Receipt,
  Trash2,
  Utensils,
  User,
  Users,
  Wallet,
  XCircle,
  Star,
  ExternalLink,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

// ========== TYPES & INTERFACES ==========
interface SectionState {
  items: boolean
  payments: boolean
  verification: boolean
}

interface TimelineEvent {
  type: 'created' | 'status_change' | 'payment' | 'edit'
  timestamp: string
  description: string
  user?: { firstName: string; lastName: string }
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}

// ========== HELPER FUNCTIONS ==========
const getOrderStatusConfig = (status: string) => {
  const s = status?.toUpperCase()
  switch (s) {
    case 'COMPLETED':
    case 'PAID':
    case 'CLOSED':
      return {
        icon: CheckCircle2,
        color: 'text-green-800 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        border: 'border-transparent',
      }
    case 'PENDING':
    case 'OPEN':
    case 'CONFIRMED':
    case 'PREPARING':
    case 'READY':
      return {
        icon: Clock,
        color: 'text-yellow-800 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-transparent',
      }
    case 'CANCELLED':
    case 'CANCELED':
    case 'DELETED':
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
  const dt = DateTime.fromISO(dateString, { zone: 'utc' }).setZone(timezone).setLocale(getIntlLocale(locale))
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
  const dt = DateTime.fromISO(dateString, { zone: 'utc' }).setZone(timezone).setLocale(getIntlLocale(locale))
  if (!dt.isValid) return '-'
  return dt.toLocaleString({
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const calculateTipPercentage = (tip: number, subtotal: number): string => {
  if (subtotal === 0) return '0.0'
  return ((tip / subtotal) * 100).toFixed(1)
}

const formatOrderNumber = (orderNumber?: string | null): string => {
  if (!orderNumber) return '-'
  const match = orderNumber.match(/(?:ORD|FAST)-(.+)/)
  if (!match) return orderNumber
  const digits = match[1].replace(/\D/g, '')
  if (!digits) return orderNumber
  return digits.length > 6 ? digits.slice(-6) : digits
}

const copyToClipboard = (text: string, label: string, toast: any, t: any) => {
  navigator.clipboard.writeText(text)
  toast({
    title: t('common.copied'),
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
const HorizontalTimelineEvent = ({
  event,
  isLast,
  isFirst
}: {
  event: TimelineEvent
  isLast: boolean
  isFirst: boolean
}) => {
  const Icon = event.icon
  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      {/* Icon row with connecting lines */}
      <div className="flex items-center w-full">
        {/* Left line */}
        <div className={`flex-1 h-0.5 ${isFirst ? 'bg-transparent' : 'bg-border'}`} />

        {/* Icon */}
        <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${event.iconColor} bg-background shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Right line */}
        <div className={`flex-1 h-0.5 ${isLast ? 'bg-transparent' : 'bg-border'}`} />
      </div>

      {/* Text below */}
      <div className="mt-3 text-center px-1 max-w-[140px]">
        <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">{event.description}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{event.timestamp}</p>
        {event.user && (
          <p className="text-[10px] text-muted-foreground">
            {event.user.firstName} {event.user.lastName}
          </p>
        )}
      </div>
    </div>
  )
}

const OrderTimeline = ({ order, locale, timezone }: { order: OrderType; locale: string; timezone: string }) => {
  const { t } = useTranslation('orders')

  const events: TimelineEvent[] = []

  // Order created (first event chronologically)
  events.push({
    type: 'created',
    timestamp: formatDateShort(order.createdAt, locale, timezone),
    description: t('detail.timeline.orderCreated'),
    user: order.createdBy,
    icon: FileText,
    iconColor: 'text-muted-foreground border-border',
  })

  // Status change (simplified - just current status)
  if (order.status) {
    events.push({
      type: 'status_change',
      timestamp: formatDateShort(order.updatedAt, locale, timezone),
      description: `${t(`detail.statuses.${order.status}`)}`,
      icon: CheckCircle2,
      iconColor: 'text-primary border-primary/20',
    })
  }

  // Payment events
  if (order.payments && order.payments.length > 0) {
    order.payments.forEach(payment => {
      // Show card brand if available, otherwise translate the method
      const paymentLabel = payment.cardBrand
        ? payment.cardBrand
        : t(`payment:methods.${String(payment.method).toLowerCase()}`, { defaultValue: payment.method })

      events.push({
        type: 'payment',
        timestamp: formatDateShort(payment.createdAt, locale, timezone),
        description: `${Currency(Number(payment.amount) + Number(payment.tipAmount))} ${paymentLabel}`,
        icon: CreditCard,
        iconColor: 'text-success border-success/20',
      })
    })
  }

  // Sort chronologically (oldest first for horizontal display)
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Limit to 4 events for horizontal display
  const displayEvents = events.slice(0, 4)

  return (
    <div className="flex items-start justify-between gap-2 py-2">
      {displayEvents.map((event, index) => (
        <HorizontalTimelineEvent
          key={index}
          event={event}
          isFirst={index === 0}
          isLast={index === displayEvents.length - 1}
        />
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
export default function OrderId() {
  const { t, i18n } = useTranslation('orders')
  const { orderId } = useParams<{ orderId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { venueId, venueSlug, venue } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()

  // State
  const [sectionsOpen, setSectionsOpen] = useState<SectionState>({
    items: true,
    payments: false,
    verification: false,
  })

  // Fetch order
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', venueId, orderId],
    queryFn: () => orderService.getOrder(venueId, orderId),
    enabled: !!orderId,
  })

  const deleteOrderMutation = useMutation({
    mutationFn: () => orderService.deleteOrder(venueId, orderId),
    onSuccess: () => {
      toast({
        title: t('detail.toast.deletedTitle'),
        description: t('detail.toast.deletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['orders', venueId] })
      navigate(`/venues/${venueSlug}/orders`)
    },
    onError: (error: any) => {
      toast({
        title: t('detail.toast.deleteErrorTitle'),
        description: error.response?.data?.message || t('detail.toast.deleteErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Set breadcrumb with order number
  useEffect(() => {
    if (order?.orderNumber && orderId) {
      setCustomSegment(orderId, formatOrderNumber(order.orderNumber))
    }
    return () => {
      if (orderId) {
        clearCustomSegment(orderId)
      }
    }
  }, [order?.orderNumber, orderId, setCustomSegment, clearCustomSegment])

  // Handlers
  const toggleSection = (section: keyof SectionState) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const from = (location.state as any)?.from || `/venues/${venueSlug}/orders`

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('detail.loading')}</p>
      </div>
    )
  }

  // Not found state
  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <XCircle className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t('detail.notFound')}</p>
        <Button asChild>
          <Link to={from}>{t('detail.backToOrders')}</Link>
        </Button>
      </div>
    )
  }

  const orderStatus = getOrderStatusConfig(order.status)
  const orderType = getOrderTypeConfig(order.type)
  const StatusIcon = orderStatus.icon
  const itemsCount = order.items?.length || 0
  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
  const canEdit = user?.role === StaffRole.SUPERADMIN || user?.role === StaffRole.OWNER

  // ========== RENDER ==========
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-background">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            {/* Title + Actions */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {t('detail.orderNumber', { defaultValue: 'Orden' })} #{formatOrderNumber(order.orderNumber)}
                </p>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold text-foreground">{Currency(order.total || 0)}</h1>
                  <Badge variant="outline" className={`${orderStatus.bg} ${orderStatus.color} ${orderStatus.border} border`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {t(`detail.statuses.${order.status}`)}
                  </Badge>
                  <Badge variant="outline" className={`${orderType.bg} ${orderType.color} border-transparent`}>
                    {orderType.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{formatDateShort(order.createdAt, i18n.language, venueTimezone)}</span>
                  {order.customerName && (
                    <>
                      <span>•</span>
                      <span>{order.customerName}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(formatOrderNumber(order.orderNumber), t('detail.orderNumber', { defaultValue: 'Número de orden' }), toast, t)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('detail.actions.copyOrderNumber', { defaultValue: 'Copiar número de orden' })}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const data = JSON.stringify(order, null, 2)
                        const blob = new Blob([data], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `order-${formatOrderNumber(order.orderNumber)}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('detail.actions.export')}</TooltipContent>
                </Tooltip>

                {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('detail.deleteWarning')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteOrderMutation.mutate()}>{t('common.delete')}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Quick stats bar */}
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border text-sm">
              <div>
                <span className="text-muted-foreground">{t('detail.stats.subtotal', { defaultValue: 'Subtotal' })}: </span>
                <span className="font-medium">{Currency(order.subtotal || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.stats.tip', { defaultValue: 'Tip' })}: </span>
                <span className="font-medium">{Currency(order.tipAmount || 0)}</span>
                <span className="text-muted-foreground ml-1">({calculateTipPercentage(order.tipAmount || 0, order.subtotal || 0)}%)</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.stats.items', { defaultValue: 'Items' })}: </span>
                <span className="font-medium">{totalItems}</span>
              </div>
              {order.tableId && (
                <div>
                  <span className="text-muted-foreground">{t('detail.stats.table', { defaultValue: 'Table' })}: </span>
                  <span className="font-medium">{order.table?.number || 'N/A'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Column (65%) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Timeline */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    {t('detail.timeline.title', { defaultValue: 'Recent activity' })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderTimeline order={order} locale={i18n.language} timezone={venueTimezone} />
                </CardContent>
              </Card>

              {/* Order Items - Collapsible */}
              <CollapsibleSection
                title={t('detail.sections.items')}
                subtitle={t('detail.sections.itemsDesc', { defaultValue: `${itemsCount} products, ${totalItems} items` })}
                isOpen={sectionsOpen.items}
                onToggle={() => toggleSection('items')}
                icon={Utensils}
              >
                {order.items && order.items.length > 0 ? (
                  <div className="rounded-xl bg-muted/30 p-2">
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          className="flex justify-between items-start rounded-lg px-3 py-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-medium">
                                {item.quantity}x
                              </Badge>
                              <span className="font-medium text-foreground">
                                {item.productName || item.product?.name || t('detail.items.productNotAvailable')}
                              </span>
                            </div>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {item.modifiers.map((modifier, idx) => (
                                  <div key={idx} className="text-xs text-muted-foreground flex items-center gap-1 ml-6">
                                    <span>•</span>
                                    <span>{modifier.name || 'Unknown modifier'}</span>
                                    <span className="text-foreground font-medium">
                                      (+{Currency(modifier.price || 0)})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            {item.quantity > 1 && (
                              <span className="text-xs text-muted-foreground">
                                {Currency(item.unitPrice || 0)} {t('detail.items.each')}
                              </span>
                            )}
                            <p className="font-medium text-foreground">{Currency(item.total || 0)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">{t('detail.items.noItems')}</p>
                )}
              </CollapsibleSection>

              {/* Payments - Collapsible */}
              <CollapsibleSection
                title={t('detail.sections.payments')}
                subtitle={t('detail.sections.paymentsDesc', { defaultValue: `${order.payments?.length || 0} payment(s)` })}
                isOpen={sectionsOpen.payments}
                onToggle={() => toggleSection('payments')}
                icon={Receipt}
              >
                {order.payments && order.payments.length > 0 ? (
                  <div className="rounded-xl bg-muted/30 p-2">
                    <div className="space-y-2">
                      {order.payments.map(payment => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-start rounded-lg px-3 py-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start gap-3">
                            {getPaymentIcon(payment)}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{t(`payment:methods.${String(payment.method).toLowerCase()}`)}</span>
                                <span className="text-xs text-muted-foreground">{formatDateShort(payment.createdAt, i18n.language, venueTimezone)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span>
                                  {t('detail.payments.base')}: {Currency(payment.amount)}
                                </span>
                                <span className="ml-3">
                                  {t('detail.payments.tip')}: {Currency(payment.tipAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">{Currency(Number(payment.amount) + Number(payment.tipAmount))}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-auto p-0 text-xs"
                              onClick={() => navigate(`/venues/${venueSlug}/payments/${payment.id}`)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {t('detail.payments.view')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">{t('detail.payments.noPayments')}</p>
                )}
              </CollapsibleSection>

              {/* 📸 Verification Photos Section - Only show if any payment has verification */}
              {order.payments?.some(p => p.saleVerification?.photos && p.saleVerification.photos.length > 0) && (
                <CollapsibleSection
                  title={t('detail.sections.verification', { defaultValue: 'Verificación de Venta' })}
                  subtitle={t('detail.sections.verificationDesc', {
                    defaultValue: 'Fotos y evidencia capturada',
                    count: order.payments?.reduce((acc, p) => acc + (p.saleVerification?.photos?.length || 0), 0) || 0,
                  })}
                  isOpen={sectionsOpen.verification}
                  onToggle={() => toggleSection('verification')}
                  icon={Camera}
                >
                  <div className="space-y-4">
                    {order.payments
                      ?.filter(p => p.saleVerification?.photos && p.saleVerification.photos.length > 0)
                      .map(payment => (
                        <div key={payment.id} className="space-y-2">
                          {order.payments && order.payments.filter(p => p.saleVerification?.photos?.length).length > 1 && (
                            <p className="text-xs text-muted-foreground font-medium">
                              {t('detail.verification.paymentLabel', {
                                defaultValue: 'Pago {{method}}',
                                method: payment.method,
                              })}
                            </p>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {payment.saleVerification?.photos.map((photoUrl, index) => (
                              <a
                                key={index}
                                href={photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                              >
                                <img
                                  src={photoUrl}
                                  alt={t('detail.verification.photoAlt', {
                                    defaultValue: 'Foto de verificación {{number}}',
                                    number: index + 1,
                                  })}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                                  <ExternalLink className="w-5 h-5 text-background opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                              </a>
                            ))}
                          </div>
                          {/* Scanned products info if any */}
                          {payment.saleVerification?.scannedProducts &&
                            Array.isArray(payment.saleVerification.scannedProducts) &&
                            payment.saleVerification.scannedProducts.length > 0 && (
                              <div className="mt-3 p-3 rounded-lg bg-muted/50">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  {t('detail.verification.scannedProducts', {
                                    defaultValue: 'Productos escaneados',
                                  })}
                                </p>
                                <div className="space-y-1">
                                  {(payment.saleVerification.scannedProducts as Array<{ barcode: string; productName?: string }>).map(
                                    (product, idx) => (
                                      <p key={idx} className="text-xs font-mono text-foreground">
                                        {product.productName || product.barcode}
                                      </p>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      ))}
                  </div>
                </CollapsibleSection>
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
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${orderStatus.bg}`}>
                      <StatusIcon className={`h-5 w-5 ${orderStatus.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t(`detail.statuses.${order.status}`)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('detail.sidebar.lastUpdate')}: {formatDateShort(order.updatedAt, i18n.language, venueTimezone)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">{t('detail.sidebar.financialSummary')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('detail.overview.subtotal')}</span>
                    <span className="font-medium">{Currency(order.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('detail.overview.tips')}</span>
                    <span className="font-medium">{Currency(order.tipAmount || 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between pt-3">
                    <span className="font-medium text-foreground">{t('detail.overview.total')}</span>
                    <span className="font-bold text-lg text-foreground">{Currency(order.total || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Customers Info */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    {order.orderCustomers && order.orderCustomers.length > 1 ? (
                      <Users className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                    {order.orderCustomers && order.orderCustomers.length > 1
                      ? t('detail.sidebar.customers', { defaultValue: 'Customers' })
                      : t('detail.sidebar.customer', { defaultValue: 'Customer' })}
                    {order.orderCustomers && order.orderCustomers.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {order.orderCustomers.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {order.orderCustomers && order.orderCustomers.length > 0 ? (
                    <div className="space-y-4">
                      {order.orderCustomers.map((oc) => (
                        <div
                          key={oc.id}
                          className={`p-3 rounded-lg border ${oc.isPrimary ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {oc.customer.firstName} {oc.customer.lastName}
                                </span>
                                {oc.isPrimary && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {t('detail.customer.primary', { defaultValue: 'Primary customer' })}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {oc.customer.customerGroup && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                    style={{
                                      borderColor: oc.customer.customerGroup.color || undefined,
                                      color: oc.customer.customerGroup.color || undefined,
                                    }}
                                  >
                                    {oc.customer.customerGroup.name}
                                  </Badge>
                                )}
                              </div>
                              {oc.customer.email && (
                                <p className="text-xs text-muted-foreground mt-1">{oc.customer.email}</p>
                              )}
                              {oc.customer.phone && (
                                <p className="text-xs text-muted-foreground">{oc.customer.phone}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                            <span>
                              {t('detail.customer.visits', { defaultValue: 'Visits' })}: {oc.customer.visitCount}
                            </span>
                            <span>
                              {t('detail.customer.points', { defaultValue: 'Points' })}: {oc.customer.loyaltyPoints}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Fallback to legacy customer fields if no orderCustomers
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('detail.fields.name', { defaultValue: 'Name' })}</p>
                        <p className="mt-1">{order.customerName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('detail.fields.email', { defaultValue: 'Email' })}</p>
                        <p className="mt-1">{order.customerEmail || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('detail.fields.phone', { defaultValue: 'Phone' })}</p>
                        <p className="mt-1">{order.customerPhone || '-'}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Additional Info */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    {t('detail.sidebar.info', { defaultValue: 'Info' })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {order.tableId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.sidebar.table')}:</span>
                      <span>{order.table?.number || 'N/A'}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.waiter')}:</span>
                    <span>{order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.items')}:</span>
                    <span>{totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.payments')}:</span>
                    <span>{order.payments?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border mt-12">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('detail.footer.orderNumber', { number: formatOrderNumber(order.orderNumber), defaultValue: 'Orden #{{number}}' })}</span>
              <span>{formatDateLong(order.createdAt, i18n.language, venueTimezone)}</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
