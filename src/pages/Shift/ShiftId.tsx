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
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import api from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { usePaymentSocketEvents } from '@/hooks/use-payment-socket-events'
import { useShiftSocketEvents } from '@/hooks/use-shift-socket-events'
import { useToast } from '@/hooks/use-toast'
import { StaffRole } from '@/types'
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
  Pencil,
  Receipt,
  Trash2,
  User,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

// ========== TYPES & INTERFACES ==========
interface SectionState {
  payments: boolean
  financial: boolean
  details: boolean
}

interface TimelineEvent {
  type: 'opened' | 'closed' | 'payment' | 'updated'
  timestamp: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
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

const calculateTipPercentage = (tip: number, subtotal: number): string => {
  if (subtotal === 0) return '0.0'
  return ((tip / subtotal) * 100).toFixed(1)
}

const copyToClipboard = (text: string, label: string, toast: any, t: any) => {
  navigator.clipboard.writeText(text)
  toast({
    title: t('common.copied'),
    description: t('detail.copiedToClipboard', { label }),
  })
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
      </div>
    </div>
  )
}

const ShiftTimeline = ({ shift, locale, timezone, t }: { shift: any; locale: string; timezone: string; t: any }) => {
  const events: TimelineEvent[] = []

  // Shift closed event
  if (shift?.status === 'CLOSED' && shift?.endTime) {
    events.push({
      type: 'closed',
      timestamp: formatDateShort(shift.endTime, locale, timezone),
      description: t('detail.timeline.shiftClosed'),
      icon: CheckCircle2,
      iconColor: 'text-muted-foreground border-border',
    })
  }

  // Payment events
  if (shift?.payments && shift.payments.length > 0) {
    shift.payments.slice(0, 5).forEach((payment: any) => {
      events.push({
        type: 'payment',
        timestamp: formatDateShort(payment.createdAt, locale, timezone),
        description: `${t('detail.timeline.paymentReceived')}: ${Currency(
          Number(payment.amount) + payment.tips.reduce((acc: number, tip: any) => acc + parseFloat(tip.amount), 0)
        )}`,
        icon: CreditCard,
        iconColor: 'text-success border-success/20',
      })
    })
  }

  // Shift opened event
  events.push({
    type: 'opened',
    timestamp: formatDateShort(shift?.startTime, locale, timezone),
    description: t('detail.timeline.shiftOpened'),
    icon: Clock,
    iconColor: 'text-primary border-primary/20',
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
              {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
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
    payments: true,
    financial: false,
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
    (event: any) => {
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
  const payments = shift?.payments || []
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
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            {/* Title + Actions */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold text-foreground">{Currency(totalAmount + totalTips)}</h1>
                  <Badge variant="outline" className={`${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
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
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(shift.id || '', 'Shift ID', toast, t)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('detail.actions.copyId')}</TooltipContent>
                </Tooltip>

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
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border text-sm">
              <div>
                <span className="text-muted-foreground">{t('detail.stats.subtotal')}: </span>
                <span className="font-medium">{Currency(totalAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.stats.tips')}: </span>
                <span className="font-medium">{Currency(totalTips)}</span>
                <span className="text-muted-foreground ml-1">({tipPercentage.toFixed(1)}%)</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.stats.payments')}: </span>
                <span className="font-medium">{payments.length}</span>
              </div>
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
                    {t('detail.timeline.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ShiftTimeline shift={shift} locale={i18n.language} timezone={venueTimezone} t={t} />
                </CardContent>
              </Card>

              {/* Payments - Collapsible */}
              <CollapsibleSection
                title={t('detail.sections.payments')}
                subtitle={t('detail.sections.paymentsDesc', { count: payments.length })}
                isOpen={sectionsOpen.payments}
                onToggle={() => toggleSection('payments')}
                icon={Receipt}
              >
                {payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.map((payment: any) => {
                      const paymentTip = payment.tips?.reduce((acc: number, tip: any) => acc + parseFloat(tip.amount), 0) || 0
                      return (
                        <div
                          key={payment.id}
                          className="flex justify-between items-start p-4 rounded-lg border border-border hover:border-foreground/20 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-9 h-7 rounded-lg bg-muted border border-border shadow-sm">
                              {payment.paymentType === 'CASH' ? (
                                <Banknote className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {payment.paymentType === 'CARD' ? t('methods.card') : t('methods.cash')}
                                </span>
                                <span className="text-xs text-muted-foreground">{formatDateShort(payment.createdAt, i18n.language, venueTimezone)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span>
                                  {t('detail.payments.base')}: {Currency(Number(payment.amount))}
                                </span>
                                <span className="ml-3">
                                  {t('detail.payments.tip')}: {Currency(paymentTip)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">{Currency(Number(payment.amount) + paymentTip)}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-auto p-0 text-xs"
                              onClick={() => navigate(`/venues/${slug}/payments/${payment.id}`)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {t('detail.payments.view')}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">{t('detail.payments.noPayments')}</p>
                )}
              </CollapsibleSection>

              {/* Financial Summary - Collapsible */}
              <CollapsibleSection
                title={t('detail.sections.financial')}
                subtitle={t('detail.sections.financialDesc')}
                isOpen={sectionsOpen.financial}
                onToggle={() => toggleSection('financial')}
                icon={Banknote}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-border">
                    <Label className="text-xs text-muted-foreground">{t('detail.overview.subtotal')}</Label>
                    <p className="text-xl font-semibold mt-1">{Currency(totalAmount)}</p>
                  </div>
                  <div className="p-4 rounded-lg border border-border">
                    <Label className="text-xs text-muted-foreground">{t('detail.overview.tips')}</Label>
                    <p className="text-xl font-semibold mt-1">{Currency(totalTips)}</p>
                    <p className="text-xs text-muted-foreground">{tipPercentage.toFixed(1)}% {t('detail.overview.ofSubtotal')}</p>
                  </div>
                  <div className="p-4 rounded-lg border border-border">
                    <Label className="text-xs text-muted-foreground">{t('detail.overview.total')}</Label>
                    <p className="text-xl font-semibold mt-1">{Currency(totalAmount + totalTips)}</p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Shift Details - Collapsible */}
              <CollapsibleSection
                title={t('detail.sections.shiftInfo')}
                subtitle={t('detail.sections.shiftInfoDesc')}
                isOpen={sectionsOpen.details}
                onToggle={() => toggleSection('details')}
                icon={FileText}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.turnId')}</Label>
                    <p className="text-sm font-mono mt-1">#{shift.turnId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.systemId')}</Label>
                    <p className="text-sm font-mono mt-1 truncate">{shift.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.startTime')}</Label>
                    <p className="text-sm mt-1">{formatDateLong(shift.startTime, i18n.language, venueTimezone)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('detail.fields.endTime')}</Label>
                    <p className="text-sm mt-1">{shift.endTime ? formatDateLong(shift.endTime, i18n.language, venueTimezone) : '-'}</p>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Sidebar (35% - sticky) */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-6">
              {/* Status */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">{t('detail.sidebar.status')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${statusConfig.bg}`}>
                      <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {shiftStatus === 'CLOSED' ? t('detail.statusClosed') : t('detail.statusOpen')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('detail.sidebar.lastUpdate')}: {formatDateShort(shift.updatedAt, i18n.language, venueTimezone)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card
                id="financial-summary-card"
                className={isEditing ? "border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/10 to-pink-500/10" : canEdit ? "border-2 border-amber-400/30" : "border-border"}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <div className="p-1.5 rounded-md bg-gradient-to-r from-amber-400 to-pink-500">
                          <Pencil className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <CardTitle className={canEdit ? "text-lg font-medium bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent" : "text-lg font-medium"}>
                        {t('detail.sidebar.financialSummary')}
                      </CardTitle>
                    </div>
                    {isEditing && (
                      <Badge className="bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground border-0">
                        {tCommon('superadmin.edit.editMode')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Subtotal (totalSales) */}
                  <div className="flex justify-between items-center text-sm">
                    <Label className="text-muted-foreground">{t('detail.overview.subtotal')}</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editedValues.totalSales}
                        onChange={e => setEditedValues(prev => ({ ...prev, totalSales: parseFloat(e.target.value) || 0 }))}
                        className="h-8 w-32 text-right border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                      />
                    ) : (
                      <span className="font-medium">{Currency(totalAmount)}</span>
                    )}
                  </div>

                  {/* Tips (totalTips) */}
                  <div className="flex justify-between items-center text-sm">
                    <Label className="text-muted-foreground">{t('detail.overview.tips')}</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editedValues.totalTips}
                        onChange={e => setEditedValues(prev => ({ ...prev, totalTips: parseFloat(e.target.value) || 0 }))}
                        className="h-8 w-32 text-right border-amber-400/50 focus:border-amber-400 focus:ring-amber-400/20"
                      />
                    ) : (
                      <span className="font-medium">{Currency(totalTips)}</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">{t('detail.overview.total')}</span>
                    <span className="font-bold text-lg text-foreground">
                      {isEditing ? Currency(editedValues.totalSales + editedValues.totalTips) : Currency(totalAmount + totalTips)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Shift Info */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    {t('detail.sidebar.shiftInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.turnId')}:</span>
                    <span className="font-mono">#{shift.turnId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.payments')}:</span>
                    <span>{payments.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.sidebar.duration')}:</span>
                    <span>
                      {shift.startTime && shift.endTime
                        ? `${Math.round((new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60))}h`
                        : '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Info */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    {t('detail.sidebar.additionalInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('detail.fields.venueId')}</p>
                    <p className="mt-1 font-mono text-xs truncate">{shift.venueId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('detail.fields.createdAt')}</p>
                    <p className="mt-1">{formatDateShort(shift.createdAt, i18n.language, venueTimezone)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('detail.fields.updatedAt')}</p>
                    <p className="mt-1">{formatDateShort(shift.updatedAt, i18n.language, venueTimezone)}</p>
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
              <span>{t('detail.footer.shiftId', { id: shift.id })}</span>
              <span>{t('detail.footer.generated', { date: DateTime.now().setZone(venueTimezone).setLocale(getIntlLocale(i18n.language)).toLocaleString(DateTime.DATETIME_MED) })}</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
