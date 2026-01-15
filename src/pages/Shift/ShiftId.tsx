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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import api from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { usePaymentSocketEvents } from '@/hooks/use-payment-socket-events'
import { useShiftSocketEvents } from '@/hooks/use-shift-socket-events'
import { useToast } from '@/hooks/use-toast'
import {
  CardBrandBreakdown,
  PaymentMethodBreakdown,
  ShiftOrder,
  ShiftPayment,
  StaffBreakdown,
  StaffRole,
  TopProduct,
} from '@/types'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileText,
  Package,
  Pencil,
  Receipt,
  ShoppingBag,
  Trash2,
  User,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

// ========== TYPES & INTERFACES ==========
interface SectionState {
  paymentMethods: boolean
  staff: boolean
  orders: boolean
  products: boolean
  payments: boolean
  details: boolean
}

// ========== HELPER FUNCTIONS ==========
const getShiftStatusConfig = (status: string) => {
  const s = status?.toUpperCase()
  switch (s) {
    case 'CLOSED':
      return {
        icon: CheckCircle2,
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        border: 'border-transparent',
      }
    case 'OPEN':
      return {
        icon: Clock,
        color: 'text-green-800 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
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

const copyToClipboard = (text: string, label: string, toast: any, t: any, tCommon: any) => {
  navigator.clipboard.writeText(text)
  toast({
    title: tCommon('copied'),
    description: t('detail.copiedToClipboard', { label }),
  })
}

// Card brand icons/colors
const getCardBrandColor = (brand: string): string => {
  switch (brand?.toUpperCase()) {
    case 'VISA':
      return 'bg-blue-500'
    case 'MASTERCARD':
      return 'bg-orange-500'
    case 'AMEX':
      return 'bg-blue-700'
    case 'DISCOVER':
      return 'bg-amber-500'
    case 'CARNET':
      return 'bg-green-600'
    default:
      return 'bg-muted-foreground'
  }
}

// ========== SUB-COMPONENTS ==========
const CollapsibleSection = ({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
  icon: Icon,
  badge,
}: {
  title: string
  subtitle?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
}) => {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    {badge}
                  </div>
                  {subtitle && <CardDescription className="text-xs mt-0.5">{subtitle}</CardDescription>}
                </div>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// Unified Payment Breakdown Component (Square/Toast style - integrated hierarchy)
const UnifiedPaymentSection = ({
  paymentMethods,
  cardBrands,
  t,
}: {
  paymentMethods: PaymentMethodBreakdown[]
  cardBrands: CardBrandBreakdown[]
  t: any
}) => {
  if (!paymentMethods || paymentMethods.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{t('detail.paymentBreakdown.noPayments')}</p>
  }

  const hasCardBrands = cardBrands && cardBrands.length > 0

  return (
    <div className="space-y-4">
      {paymentMethods.map(method => {
        const isCardMethod = method.method !== 'CASH'

        return (
          <div key={method.method} className="space-y-2">
            {/* Main payment method row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                    method.method === 'CASH' ? 'bg-green-500/10' : 'bg-blue-500/10'
                  }`}
                >
                  {method.method === 'CASH' ? (
                    <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{t(`methods.${method.method}`)}</p>
                  <p className="text-xs text-muted-foreground">
                    {method.count} {t('detail.paymentBreakdown.payments')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{Currency(method.total)}</p>
                <p className="text-xs text-muted-foreground">{method.percentage}%</p>
              </div>
            </div>
            <Progress value={method.percentage} className="h-1.5" />
            {method.tips > 0 && (
              <p className="text-[10px] text-muted-foreground pl-10">
                {t('detail.stats.tips')}: {Currency(method.tips)}
              </p>
            )}

            {/* Nested card brands (only for card payments) */}
            {isCardMethod && hasCardBrands && (
              <div className="ml-5 mt-1 pl-3 border-l-2 border-blue-200 dark:border-blue-800 space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide pb-0.5">
                  {t('detail.paymentBreakdown.byCardBrand')}
                </p>
                {cardBrands.map(brand => (
                  <div
                    key={brand.brand}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-5 rounded-full ${getCardBrandColor(brand.brand)}`} />
                      <span className="text-xs font-medium">{brand.brand}</span>
                      <span className="text-[10px] text-muted-foreground">({brand.count})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{Currency(brand.total)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {brand.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Staff Breakdown Component
const StaffSection = ({
  breakdown,
  t,
}: {
  breakdown: StaffBreakdown[]
  t: any
}) => {
  if (!breakdown || breakdown.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{t('detail.staffBreakdown.noStaff')}</p>
  }

  return (
    <div className="space-y-2">
      {breakdown.map((staff, index) => (
        <div
          key={staff.staffId}
          className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-foreground/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {index + 1}
            </div>
            <div>
              <p className="text-sm font-medium">{staff.name}</p>
              <p className="text-xs text-muted-foreground">
                {staff.ordersCount} {t('detail.staffBreakdown.orders')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{Currency(staff.sales)}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>
                {t('detail.staffBreakdown.tips')}: {Currency(staff.tips)}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {staff.tipPercentage}%
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Orders Section Component
const OrdersSection = ({
  orders,
  slug,
  locale,
  timezone,
  t,
  navigate,
}: {
  orders: ShiftOrder[]
  slug: string
  locale: string
  timezone: string
  t: any
  navigate: any
}) => {
  if (!orders || orders.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{t('detail.ordersList.noOrders')}</p>
  }

  return (
    <div className="space-y-2">
      {orders.slice(0, 20).map(order => (
        <div
          key={order.id}
          className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-foreground/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">#{order.orderNumber}</p>
                {order.tableName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {order.tableName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {order.itemsCount} {t('detail.ordersList.items')} • {formatDateShort(order.createdAt, locale, timezone)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold">{Currency(order.total)}</p>
              {order.paymentMethod && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {order.paymentMethod === 'CASH' ? (
                    <Banknote className="h-2.5 w-2.5" />
                  ) : (
                    <CreditCard className="h-2.5 w-2.5" />
                  )}
                  {order.cardBrand && <span>{order.cardBrand}</span>}
                  {order.cardLast4 && <span>•••• {order.cardLast4}</span>}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => navigate(`/venues/${slug}/orders/${order.id}`)}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Products Section Component
const ProductsSection = ({
  products,
  t,
}: {
  products: TopProduct[]
  t: any
}) => {
  if (!products || products.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{t('detail.productsList.noProducts')}</p>
  }

  const maxQuantity = Math.max(...products.map(p => p.quantity))

  return (
    <div className="space-y-2">
      {products.slice(0, 15).map((product, index) => (
        <div key={product.name} className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-5">{index + 1}.</span>
              <div>
                <p className="text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.quantity} {t('detail.productsList.sold')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{Currency(product.revenue)}</p>
            </div>
          </div>
          <Progress value={(product.quantity / maxQuantity) * 100} className="h-1" />
        </div>
      ))}
    </div>
  )
}

// Payments List Component
const PaymentsList = ({
  payments,
  slug,
  locale,
  timezone,
  t,
  navigate,
}: {
  payments: ShiftPayment[]
  slug: string
  locale: string
  timezone: string
  t: any
  navigate: any
}) => {
  if (!payments || payments.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{t('detail.payments.noPayments')}</p>
  }

  return (
    <div className="space-y-2">
      {payments.map(payment => (
        <div
          key={payment.id}
          className="flex justify-between items-start p-2.5 rounded-lg border border-border hover:border-foreground/20 transition-colors"
        >
          <div className="flex items-start gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted border border-border">
              {payment.method === 'CASH' ? (
                <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{t(`methods.${payment.method}`)}</span>
                {payment.cardBrand && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {payment.cardBrand}
                    {payment.cardLast4 && ` •••• ${payment.cardLast4}`}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{formatDateShort(payment.createdAt, locale, timezone)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{Currency(payment.total)}</p>
            <div className="text-[10px] text-muted-foreground">
              {payment.tipAmount > 0 && (
                <span>
                  {t('detail.payments.tip')}: {Currency(payment.tipAmount)}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => navigate(`/venues/${slug}/payments/${payment.id}`)}
            >
              <Eye className="h-2.5 w-2.5 mr-0.5" />
              {t('detail.payments.view')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ========== MAIN COMPONENT ==========
export default function ShiftId() {
  const { shiftId, slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { venueId, venue } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const { t, i18n } = useTranslation('shifts')
  const { t: tCommon } = useTranslation('common')
  const { user } = useAuth()
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()

  // State
  const [sectionsOpen, setSectionsOpen] = useState<SectionState>({
    paymentMethods: true,
    staff: true,
    orders: false,
    products: false,
    payments: false,
    details: false,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editedValues, setEditedValues] = useState<{ totalSales: number; totalTips: number }>({
    totalSales: 0,
    totalTips: 0,
  })

  const canEdit = user?.role === StaffRole.SUPERADMIN

  // Fetch the shift data
  const { data: shift, isLoading } = useQuery({
    queryKey: ['shift', venueId, shiftId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/shifts/${shiftId}`)
      return response.data
    },
  })

  // Memoized data
  const paymentMethodBreakdown: PaymentMethodBreakdown[] = useMemo(
    () => shift?.paymentMethodBreakdown || [],
    [shift?.paymentMethodBreakdown]
  )
  const cardBrandBreakdown: CardBrandBreakdown[] = useMemo(
    () => shift?.cardBrandBreakdown || [],
    [shift?.cardBrandBreakdown]
  )
  const staffBreakdown: StaffBreakdown[] = useMemo(() => shift?.staffBreakdown || [], [shift?.staffBreakdown])
  const orders: ShiftOrder[] = useMemo(() => shift?.orders || [], [shift?.orders])
  const payments: ShiftPayment[] = useMemo(() => shift?.payments || [], [shift?.payments])
  const topProducts: TopProduct[] = useMemo(() => shift?.topProducts || [], [shift?.topProducts])
  const stats = useMemo(() => shift?.stats || {}, [shift?.stats])

  // Set breadcrumb with shift turn ID
  useEffect(() => {
    if (shift?.turnId && shiftId) {
      setCustomSegment(shiftId, `#${shift.turnId}`)
    }
    return () => {
      if (shiftId) {
        clearCustomSegment(shiftId)
      }
    }
  }, [shift?.turnId, shiftId, setCustomSegment, clearCustomSegment])

  // Initialize edit values when shift loads
  useEffect(() => {
    if (shift) {
      setEditedValues({
        totalSales: Number(shift.totalSales) || 0,
        totalTips: Number(shift.totalTips) || 0,
      })
    }
  }, [shift])

  // Real-time shift updates via Socket.IO
  useShiftSocketEvents(venueId, {
    onShiftClosed: event => {
      if (event.shiftId === shiftId) {
        toast({
          title: t('notifications.shiftClosed'),
          description: t('notifications.shiftClosedDescription', {
            totalSales: Currency(event.totalSales || 0),
          }),
        })
        queryClient.invalidateQueries({ queryKey: ['shift', venueId, shiftId] })
        queryClient.invalidateQueries({
          predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
        })
      }
    },
    onShiftUpdated: event => {
      if (event.shiftId === shiftId) {
        queryClient.invalidateQueries({ queryKey: ['shift', venueId, shiftId] })
      }
    },
  })

  // Real-time payment updates to refresh shift totals
  const handlePaymentCompleted = useCallback(
    (_event: any) => {
      queryClient.invalidateQueries({ queryKey: ['shift', venueId, shiftId] })
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
      })
    },
    [venueId, shiftId, queryClient]
  )

  usePaymentSocketEvents(venueId, {
    onPaymentCompleted: handlePaymentCompleted,
  })

  const from = (location.state as any)?.from || `/venues/${slug}/shifts`

  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/v1/dashboard/venues/${venueId}/shifts/${shiftId}`)
    },
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.delete.success'),
        description: t('detail.toast.deletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['shifts', venueId] })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('superadmin.delete.error'),
        description: error.response?.data?.message || t('detail.toast.deleteErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Update shift mutation
  const updateShiftMutation = useMutation({
    mutationFn: async (data: { totalSales: number; totalTips: number }) => {
      const response = await api.put(`/api/v1/dashboard/venues/${venueId}/shifts/${shiftId}`, data)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: tCommon('superadmin.edit.success'),
        description: t('detail.toast.updatedDesc'),
      })
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['shift', venueId, shiftId] })
      queryClient.invalidateQueries({ queryKey: ['shifts', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('superadmin.edit.error'),
        description: error.response?.data?.message || t('detail.toast.updateErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Editing handlers
  const startEditing = () => {
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    if (shift) {
      setEditedValues({
        totalSales: Number(shift.totalSales) || 0,
        totalTips: Number(shift.totalTips) || 0,
      })
    }
  }

  const saveChanges = () => {
    updateShiftMutation.mutate(editedValues)
  }

  // Handlers
  const toggleSection = (section: keyof SectionState) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }))
  }

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
  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <XCircle className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t('detail.notFound')}</p>
        <Button asChild>
          <Link to={from}>{t('detail.backToShifts')}</Link>
        </Button>
      </div>
    )
  }

  // Calculate totals
  const totalAmount = Number(shift?.totalSales || 0)
  const totalTips = Number(shift?.totalTips || 0)
  const tipPercentage = totalAmount !== 0 ? (totalTips / totalAmount) * 100 : 0
  const shiftStatus = shift?.status || (shift?.endTime ? 'CLOSED' : 'OPEN')
  const statusConfig = getShiftStatusConfig(shiftStatus)
  const StatusIcon = statusConfig.icon

  // ========== RENDER ==========
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-background">
          <div className="max-w-[1400px] mx-auto px-4 py-3">
            {/* Title + Actions */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold text-foreground">{Currency(totalAmount + totalTips)}</h1>
                  <Badge
                    variant="outline"
                    className={`${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {shiftStatus === 'CLOSED' ? t('detail.statusClosed') : t('detail.statusOpen')}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>
                    {t('detail.turnId')}: <span className="font-mono text-xs">#{shift.turnId}</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const data = JSON.stringify(shift, null, 2)
                        const blob = new Blob([data], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `shift-${shift.turnId}.json`
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
                  <>
                    {!isEditing ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
                            onClick={() => {
                              startEditing()
                              document.getElementById('financial-summary-card')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            {tCommon('edit')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('detail.actions.editHint')}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0"
                          onClick={saveChanges}
                          disabled={updateShiftMutation.isPending}
                        >
                          {updateShiftMutation.isPending ? tCommon('saving') : tCommon('save')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEditing}
                          disabled={updateShiftMutation.isPending}
                        >
                          {tCommon('cancel')}
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
                          <AlertDialogTitle>{tCommon('superadmin.delete.title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {tCommon('superadmin.delete.description', { item: `Turno #${shift.turnId}` })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteShiftMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleteShiftMutation.isPending ? tCommon('deleting') : tCommon('delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>

            {/* Quick stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-3 border-t border-border">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{Currency(totalAmount)}</p>
                <p className="text-[10px] text-muted-foreground">{t('detail.stats.subtotal')}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{Currency(totalTips)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t('detail.stats.tips')} ({tipPercentage.toFixed(1)}%)
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{stats.totalPayments || payments.length}</p>
                <p className="text-[10px] text-muted-foreground">{t('detail.stats.payments')}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{stats.totalOrders || orders.length}</p>
                <p className="text-[10px] text-muted-foreground">{t('detail.stats.orders')}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{Currency(stats.avgOrderValue || 0)}</p>
                <p className="text-[10px] text-muted-foreground">{t('detail.stats.avgOrder')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-[1400px] mx-auto px-4 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Column (65%) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Section 1: Unified Payment Breakdown (Cash + Card + Brands) */}
              <CollapsibleSection
                title={t('detail.sections.paymentMethods')}
                subtitle={t('detail.sections.paymentMethodsDesc')}
                isOpen={sectionsOpen.paymentMethods}
                onToggle={() => toggleSection('paymentMethods')}
                icon={Wallet}
                badge={
                  paymentMethodBreakdown.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {paymentMethodBreakdown.length}
                    </Badge>
                  )
                }
              >
                <UnifiedPaymentSection paymentMethods={paymentMethodBreakdown} cardBrands={cardBrandBreakdown} t={t} />
              </CollapsibleSection>

              {/* Section 2: Staff Performance */}
              <CollapsibleSection
                title={t('detail.sections.staff')}
                subtitle={t('detail.sections.staffDesc')}
                isOpen={sectionsOpen.staff}
                onToggle={() => toggleSection('staff')}
                icon={Users}
                badge={
                  staffBreakdown.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {staffBreakdown.length}
                    </Badge>
                  )
                }
              >
                <StaffSection breakdown={staffBreakdown} t={t} />
              </CollapsibleSection>

              {/* Section 4: Orders */}
              <CollapsibleSection
                title={t('detail.sections.orders')}
                subtitle={t('detail.sections.ordersDesc', { count: orders.length })}
                isOpen={sectionsOpen.orders}
                onToggle={() => toggleSection('orders')}
                icon={ShoppingBag}
                badge={
                  orders.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {orders.length}
                    </Badge>
                  )
                }
              >
                <OrdersSection
                  orders={orders}
                  slug={slug || ''}
                  locale={i18n.language}
                  timezone={venueTimezone}
                  t={t}
                  navigate={navigate}
                />
              </CollapsibleSection>

              {/* Section 5: Top Products */}
              <CollapsibleSection
                title={t('detail.sections.products')}
                subtitle={t('detail.sections.productsDesc')}
                isOpen={sectionsOpen.products}
                onToggle={() => toggleSection('products')}
                icon={Package}
                badge={
                  topProducts.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {stats.totalProducts || topProducts.reduce((sum, p) => sum + p.quantity, 0)}
                    </Badge>
                  )
                }
              >
                <ProductsSection products={topProducts} t={t} />
              </CollapsibleSection>

              {/* Section 5: All Payments */}
              <CollapsibleSection
                title={t('detail.sections.payments')}
                subtitle={t('detail.sections.paymentsDesc', { count: payments.length })}
                isOpen={sectionsOpen.payments}
                onToggle={() => toggleSection('payments')}
                icon={Receipt}
                badge={
                  payments.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {payments.length}
                    </Badge>
                  )
                }
              >
                <PaymentsList
                  payments={payments}
                  slug={slug || ''}
                  locale={i18n.language}
                  timezone={venueTimezone}
                  t={t}
                  navigate={navigate}
                />
              </CollapsibleSection>
            </div>

            {/* Sidebar (35% - sticky) */}
            <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
              {/* Status */}
              <Card className="border-border">
                <CardHeader className="py-2.5 px-3">
                  <CardTitle className="text-sm font-medium">{t('detail.sidebar.status')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${statusConfig.bg}`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {shiftStatus === 'CLOSED' ? t('detail.statusClosed') : t('detail.statusOpen')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('detail.sidebar.lastUpdate')}: {formatDateShort(shift.updatedAt, i18n.language, venueTimezone)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card
                id="financial-summary-card"
                className={
                  isEditing
                    ? 'border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/10 to-pink-500/10'
                    : canEdit
                      ? 'border-2 border-amber-400/30'
                      : 'border-border'
                }
              >
                <CardHeader className="py-2.5 px-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <div className="p-1 rounded-md bg-gradient-to-r from-amber-400 to-pink-500">
                          <Pencil className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                      <CardTitle
                        className={
                          canEdit
                            ? 'text-sm font-medium bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent'
                            : 'text-sm font-medium'
                        }
                      >
                        {t('detail.sidebar.financialSummary')}
                      </CardTitle>
                    </div>
                    {isEditing && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground border-0">
                        {tCommon('superadmin.edit.editMode')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 space-y-2">
                  {/* Subtotal (totalSales) */}
                  <div className="flex justify-between items-center text-xs">
                    <Label className="text-muted-foreground text-xs">{t('detail.overview.subtotal')}</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editedValues.totalSales}
                        onChange={e => setEditedValues(prev => ({ ...prev, totalSales: parseFloat(e.target.value) || 0 }))}
                        className="h-7 w-28 text-xs text-right border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                      />
                    ) : (
                      <span className="text-sm font-medium">{Currency(totalAmount)}</span>
                    )}
                  </div>

                  {/* Tips (totalTips) */}
                  <div className="flex justify-between items-center text-xs">
                    <Label className="text-muted-foreground text-xs">{t('detail.overview.tips')}</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editedValues.totalTips}
                        onChange={e => setEditedValues(prev => ({ ...prev, totalTips: parseFloat(e.target.value) || 0 }))}
                        className="h-7 w-28 text-xs text-right border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                      />
                    ) : (
                      <span className="text-sm font-medium">{Currency(totalTips)}</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-foreground">{t('detail.overview.total')}</span>
                    <span className="font-bold text-sm text-foreground">
                      {isEditing ? Currency(editedValues.totalSales + editedValues.totalTips) : Currency(totalAmount + totalTips)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Shift Info */}
              <Card className="border-border">
                <CardHeader className="py-2.5 px-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('detail.sidebar.shiftInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.turnId')}:</span>
                    <span className="font-mono text-xs">#{shift.turnId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.payments')}:</span>
                    <span>{payments.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.duration')}:</span>
                    <span>
                      {shift.startTime && shift.endTime
                        ? (() => {
                            const hours = Math.floor(
                              (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60)
                            )
                            const minutes = Math.floor(
                              ((new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) % (1000 * 60 * 60)) /
                                (1000 * 60)
                            )
                            return t('detail.duration', { hours, minutes })
                          })()
                        : '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Shift Details - Collapsible */}
              <CollapsibleSection
                title={t('detail.sections.shiftInfo')}
                subtitle={t('detail.sections.shiftInfoDesc')}
                isOpen={sectionsOpen.details}
                onToggle={() => toggleSection('details')}
                icon={FileText}
              >
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.startTime')}</Label>
                    <p className="text-sm mt-1">{formatDateLong(shift.startTime, i18n.language, venueTimezone)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.endTime')}</Label>
                    <p className="text-sm mt-1">
                      {shift.endTime ? formatDateLong(shift.endTime, i18n.language, venueTimezone) : '-'}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="pt-2 border-t border-border">
                      <Label className="text-xs text-muted-foreground">{t('detail.fields.systemId')}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-mono truncate flex-1">{shift.id}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(shift.id || '', 'System ID', toast, t, tCommon)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border mt-12">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t('detail.turnId')}: #{shift.turnId}
              </span>
              <span>
                {t('detail.footer.generated', {
                  date: DateTime.now()
                    .setZone(venueTimezone)
                    .setLocale(getIntlLocale(i18n.language))
                    .toLocaleString(DateTime.DATETIME_MED),
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
