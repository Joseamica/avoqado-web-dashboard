/**
 * Credit Assessment Dashboard (Superadmin)
 *
 * SOFOM Integration - Internal credit evaluation dashboard for assessing
 * which venues qualify for merchant cash advances.
 *
 * Based on Square Capital / Stripe Capital / Toast Capital models:
 * - 4-pillar scoring: Volume (30%), Growth (20%), Stability (25%), Risk (25%)
 * - Grade system: A (80-100), B (70-79), C (50-69), D (<50)
 * - Automatic offer recommendations for eligible venues
 *
 * This is the CONTROL PLANE view - merchants never see these scores.
 */

import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  Building2,
  FileText,
  Send,
  Eye,
  Loader2,
  Search,
  Filter,
  Star,
  Target,
  Activity,
  Percent,
  Calendar,
  CreditCard,
  Banknote,
} from 'lucide-react'
import {
  getCreditAssessments,
  getCreditAssessmentSummary,
  refreshVenueCreditAssessment,
  refreshAllCreditAssessments,
  createCreditOffer,
  type CreditAssessment as CreditAssessmentData,
  type CreditAssessmentSummary,
  type CreditGrade,
  type CreditEligibility,
} from '@/services/superadmin.service'
import { useVenueDateTime } from '@/utils/datetime'

// =============================================================================
// GLASS CARD COMPONENT (Following Modern Dashboard Design System)
// =============================================================================

const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
)

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getGradeColor(grade: CreditGrade): string {
  switch (grade) {
    case 'A':
      return 'bg-green-500'
    case 'B':
      return 'bg-blue-500'
    case 'C':
      return 'bg-yellow-500'
    case 'D':
      return 'bg-red-500'
    default:
      return 'bg-muted'
  }
}

function getGradeBadgeVariant(grade: CreditGrade): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (grade) {
    case 'A':
      return 'default'
    case 'B':
      return 'secondary'
    case 'C':
      return 'outline'
    case 'D':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getEligibilityBadge(status: CreditEligibility) {
  switch (status) {
    case 'ELIGIBLE':
      return { label: 'Elegible', variant: 'default' as const, icon: CheckCircle }
    case 'REVIEW_REQUIRED':
      return { label: 'Revision Manual', variant: 'outline' as const, icon: Eye }
    case 'INELIGIBLE':
      return { label: 'No Elegible', variant: 'destructive' as const, icon: XCircle }
    case 'OFFER_PENDING':
      return { label: 'Oferta Pendiente', variant: 'secondary' as const, icon: Clock }
    case 'ACTIVE_LOAN':
      return { label: 'Credito Activo', variant: 'default' as const, icon: CreditCard }
    default:
      return { label: status, variant: 'outline' as const, icon: Minus }
  }
}

function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value)
  if (isNaN(num)) return '$0'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatPercent(value: number | string | null | undefined, decimals: number = 1): string {
  const num = Number(value)
  if (isNaN(num)) return '0%'
  return `${num.toFixed(decimals)}%`
}

// =============================================================================
// SUMMARY CARDS COMPONENT
// =============================================================================

const SummaryCards: React.FC<{ summary: CreditAssessmentSummary | undefined; isLoading: boolean }> = ({
  summary,
  isLoading,
}) => {
  const { t } = useTranslation('superadmin')

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <GlassCard key={i} className="p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-8 bg-muted rounded w-2/3" />
            </div>
          </GlassCard>
        ))}
      </div>
    )
  }

  if (!summary) return null

  const cards = [
    {
      title: 'Total Evaluaciones',
      value: summary.totalAssessments,
      icon: Building2,
      color: 'from-blue-500/20 to-blue-500/5',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Elegibles',
      value: summary.eligibilityDistribution['ELIGIBLE'] || 0,
      icon: CheckCircle,
      color: 'from-green-500/20 to-green-500/5',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Credito Disponible',
      value: formatCurrency(summary.totalEligibleCredit),
      icon: DollarSign,
      color: 'from-purple-500/20 to-purple-500/5',
      iconColor: 'text-purple-600 dark:text-purple-400',
      isLarge: true,
    },
    {
      title: 'Ofertas Pendientes',
      value: summary.pendingOffers,
      icon: Send,
      color: 'from-orange-500/20 to-orange-500/5',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => (
        <GlassCard key={idx} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{card.title}</p>
              <p className={cn('font-bold tracking-tight mt-1', card.isLarge ? 'text-xl' : 'text-2xl')}>
                {card.value}
              </p>
            </div>
            <div className={cn('p-2 rounded-xl bg-gradient-to-br', card.color)}>
              <card.icon className={cn('w-4 h-4', card.iconColor)} />
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

// =============================================================================
// GRADE DISTRIBUTION COMPONENT
// =============================================================================

const GradeDistribution: React.FC<{ summary: CreditAssessmentSummary | undefined }> = ({ summary }) => {
  if (!summary) return null

  const grades: CreditGrade[] = ['A', 'B', 'C', 'D']
  const total = Object.values(summary.gradeDistribution).reduce((a, b) => a + b, 0)

  return (
    <GlassCard className="p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Distribucion por Grado</h3>
        <Badge variant="outline" className="text-xs">
          {total} venues
        </Badge>
      </div>
      <div className="flex gap-2">
        {grades.map(grade => {
          const count = summary.gradeDistribution[grade] || 0
          const percent = total > 0 ? (count / total) * 100 : 0
          return (
            <TooltipProvider key={grade}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex-1 h-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm cursor-default',
                      getGradeColor(grade)
                    )}
                    style={{ opacity: count > 0 ? 1 : 0.3 }}
                  >
                    {grade}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Grado {grade}: {count} venues ({formatPercent(percent, 0)})
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    </GlassCard>
  )
}

// =============================================================================
// ASSESSMENT ROW COMPONENT
// =============================================================================

const AssessmentRow: React.FC<{
  assessment: CreditAssessmentData
  onSelect: (assessment: CreditAssessmentData) => void
  onCreateOffer: (assessment: CreditAssessmentData) => void
}> = ({ assessment, onSelect, onCreateOffer }) => {
  const { formatDate } = useVenueDateTime()
  const eligibility = getEligibilityBadge(assessment.eligibilityStatus)
  const EligibilityIcon = eligibility.icon

  const TrendIcon =
    assessment.trendDirection === 'GROWING'
      ? TrendingUp
      : assessment.trendDirection === 'DECLINING'
        ? TrendingDown
        : Minus

  const trendColor =
    assessment.trendDirection === 'GROWING'
      ? 'text-green-600'
      : assessment.trendDirection === 'DECLINING'
        ? 'text-red-600'
        : 'text-muted-foreground'

  return (
    <GlassCard hover onClick={() => onSelect(assessment)} className="p-4 mb-3">
      <div className="flex items-center justify-between">
        {/* Left: Venue info and score */}
        <div className="flex items-center gap-4">
          {/* Score Circle */}
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-primary-foreground font-bold',
              getGradeColor(assessment.creditGrade)
            )}
          >
            {assessment.creditScore}
          </div>

          {/* Venue Details */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{assessment.venue.name}</span>
              <Badge variant={getGradeBadgeVariant(assessment.creditGrade)} className="text-xs">
                Grado {assessment.creditGrade}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>{assessment.venue.organization.name}</span>
              <span className="text-xs">•</span>
              <span className="flex items-center gap-1">
                <TrendIcon className={cn('w-3 h-3', trendColor)} />
                {formatPercent(assessment.yoyGrowthPercent)} YoY
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Metrics */}
        <div className="hidden md:flex items-center gap-8">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Vol. Anual</p>
            <p className="font-medium">{formatCurrency(Number(assessment.annualVolume))}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Credito Recomendado</p>
            <p className="font-medium text-purple-600 dark:text-purple-400">
              {formatCurrency(Number(assessment.recommendedCreditLimit))}
            </p>
          </div>
        </div>

        {/* Right: Status and Actions */}
        <div className="flex items-center gap-3">
          <Badge variant={eligibility.variant} className="gap-1">
            <EligibilityIcon className="w-3 h-3" />
            {eligibility.label}
          </Badge>

          {assessment.eligibilityStatus === 'ELIGIBLE' && (
            <Button
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation()
                onCreateOffer(assessment)
              }}
              className="gap-1"
            >
              <Send className="w-3 h-3" />
              Crear Oferta
            </Button>
          )}

          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Alerts Row */}
      {assessment.alerts && assessment.alerts.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <div className="flex flex-wrap gap-1">
            {assessment.alerts.map((alert, idx) => (
              <Badge key={idx} variant="outline" className="text-xs text-yellow-600">
                {alert.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

// =============================================================================
// DETAIL PANEL COMPONENT
// =============================================================================

const DetailPanel: React.FC<{
  assessment: CreditAssessmentData | null
  onClose: () => void
  onRefresh: () => void
  isRefreshing: boolean
}> = ({ assessment, onClose, onRefresh, isRefreshing }) => {
  const { formatDate } = useVenueDateTime()

  if (!assessment) return null

  const scoreSections = [
    {
      label: 'Volumen',
      score: Math.round(Number(assessment.annualVolume) > 5000000 ? 100 : (Number(assessment.annualVolume) / 5000000) * 100),
      weight: '30%',
      icon: DollarSign,
      color: 'from-blue-500/20 to-blue-500/5',
      iconColor: 'text-blue-600',
      details: [
        { label: 'Vol. Anual', value: formatCurrency(Number(assessment.annualVolume)) },
        { label: 'Promedio Mensual', value: formatCurrency(Number(assessment.monthlyAverage)) },
        { label: 'Transacciones (12m)', value: assessment.transactionCount12m.toLocaleString() },
      ],
    },
    {
      label: 'Crecimiento',
      score: Math.max(0, Math.min(100, 50 + Number(assessment.yoyGrowthPercent))),
      weight: '20%',
      icon: TrendingUp,
      color: 'from-green-500/20 to-green-500/5',
      iconColor: 'text-green-600',
      details: [
        { label: 'YoY', value: formatPercent(Number(assessment.yoyGrowthPercent)) },
        { label: 'MoM', value: formatPercent(Number(assessment.momGrowthPercent)) },
        { label: 'Tendencia', value: assessment.trendDirection },
      ],
    },
    {
      label: 'Estabilidad',
      score: Math.round(Number(assessment.consistencyScore)),
      weight: '25%',
      icon: Activity,
      color: 'from-purple-500/20 to-purple-500/5',
      iconColor: 'text-purple-600',
      details: [
        { label: 'Consistencia', value: formatPercent(Number(assessment.consistencyScore)) },
        { label: 'Varianza', value: Number(assessment.revenueVariance).toFixed(3) },
        { label: 'Dias Activo', value: formatPercent(Number(assessment.operatingDaysRatio) * 100) },
      ],
    },
    {
      label: 'Riesgo',
      score: Math.round(100 - Number(assessment.chargebackRate) * 10000 - Number(assessment.refundRate) * 1000),
      weight: '25%',
      icon: Shield,
      color: 'from-orange-500/20 to-orange-500/5',
      iconColor: 'text-orange-600',
      details: [
        { label: 'Contracargos', value: formatPercent(Number(assessment.chargebackRate) * 100, 2) },
        { label: 'Reembolsos', value: formatPercent(Number(assessment.refundRate) * 100, 2) },
        { label: 'Ticket Prom.', value: formatCurrency(Number(assessment.averageTicket)) },
      ],
    },
  ]

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border shadow-xl z-50 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{assessment.venue.name}</h2>
            <p className="text-sm text-muted-foreground">{assessment.venue.organization.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Score Overview */}
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-20 h-20 rounded-2xl flex flex-col items-center justify-center text-primary-foreground font-bold',
                getGradeColor(assessment.creditGrade)
              )}
            >
              <span className="text-3xl">{assessment.creditScore}</span>
              <span className="text-xs opacity-80">Grado {assessment.creditGrade}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">Credito Recomendado</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(Number(assessment.recommendedCreditLimit))}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>Factor: {Number(assessment.suggestedFactorRate).toFixed(2)}</span>
                <span>•</span>
                <span>Max {formatPercent(Number(assessment.maxRepaymentPercent) * 100, 0)} diario</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Score Breakdown */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium">Desglose del Score</h3>
          {scoreSections.map((section, idx) => (
            <Collapsible key={idx}>
              <CollapsibleTrigger asChild>
                <GlassCard hover className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-xl bg-gradient-to-br', section.color)}>
                      <section.icon className={cn('w-4 h-4', section.iconColor)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{section.label}</span>
                        <span className="text-xs text-muted-foreground">{section.weight}</span>
                      </div>
                      <Progress value={Math.max(0, Math.min(100, section.score))} className="h-1.5" />
                    </div>
                    <span className="text-sm font-bold w-8 text-right">{Math.max(0, Math.min(100, section.score))}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </GlassCard>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 ml-12 grid grid-cols-3 gap-2">
                  {section.details.map((detail, didx) => (
                    <div key={didx} className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{detail.label}</p>
                      <p className="text-sm font-medium">{detail.value}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {/* Alerts */}
        {assessment.alerts && assessment.alerts.length > 0 && (
          <GlassCard className="p-4 mb-6 border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Alertas</h3>
            </div>
            <ul className="space-y-1">
              {assessment.alerts.map((alert, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">
                  • {alert.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {/* Metadata */}
        <div className="text-xs text-muted-foreground">
          <p>Calculado: {formatDate(assessment.calculatedAt)}</p>
          <p>Datos hasta: {formatDate(assessment.dataAsOf)}</p>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// CREATE OFFER DIALOG
// =============================================================================

const CreateOfferDialog: React.FC<{
  assessment: CreditAssessmentData | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    offerAmount: number
    factorRate: number
    repaymentPercent: number
    expiresInDays: number
    notes?: string
  }) => void
  isSubmitting: boolean
}> = ({ assessment, isOpen, onClose, onSubmit, isSubmitting }) => {
  const [offerAmount, setOfferAmount] = useState('')
  const [factorRate, setFactorRate] = useState('1.15')
  const [repaymentPercent, setRepaymentPercent] = useState('15')
  const [expiresInDays, setExpiresInDays] = useState('30')
  const [notes, setNotes] = useState('')

  // Reset form when assessment changes
  React.useEffect(() => {
    if (assessment) {
      setOfferAmount(String(Math.round(Number(assessment.recommendedCreditLimit))))
      setFactorRate(String(Number(assessment.suggestedFactorRate).toFixed(2)))
      setRepaymentPercent(String(Math.round(Number(assessment.maxRepaymentPercent) * 100)))
    }
  }, [assessment])

  const totalRepayment = Number(offerAmount) * Number(factorRate)
  const fee = totalRepayment - Number(offerAmount)

  const handleSubmit = () => {
    onSubmit({
      offerAmount: Number(offerAmount),
      factorRate: Number(factorRate),
      repaymentPercent: Number(repaymentPercent) / 100,
      expiresInDays: Number(expiresInDays),
      notes: notes || undefined,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Oferta de Credito</DialogTitle>
          <DialogDescription>
            {assessment?.venue.name} - Grado {assessment?.creditGrade}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Offer Amount */}
          <div className="space-y-2">
            <Label>Monto de la Oferta (MXN)</Label>
            <Input
              type="number"
              value={offerAmount}
              onChange={e => setOfferAmount(e.target.value)}
              min={50000}
              max={2000000}
            />
            <p className="text-xs text-muted-foreground">
              Recomendado: {formatCurrency(Number(assessment?.recommendedCreditLimit || 0))}
            </p>
          </div>

          {/* Factor Rate */}
          <div className="space-y-2">
            <Label>Factor Rate</Label>
            <Select value={factorRate} onValueChange={setFactorRate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.10">1.10 (10% fee)</SelectItem>
                <SelectItem value="1.12">1.12 (12% fee)</SelectItem>
                <SelectItem value="1.15">1.15 (15% fee)</SelectItem>
                <SelectItem value="1.18">1.18 (18% fee)</SelectItem>
                <SelectItem value="1.20">1.20 (20% fee)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Repayment Percent */}
          <div className="space-y-2">
            <Label>Porcentaje de Retencion Diaria (%)</Label>
            <Input
              type="number"
              value={repaymentPercent}
              onChange={e => setRepaymentPercent(e.target.value)}
              min={5}
              max={20}
            />
            <p className="text-xs text-muted-foreground">
              Del volumen diario de ventas
            </p>
          </div>

          {/* Expires In Days */}
          <div className="space-y-2">
            <Label>Validez de la Oferta (dias)</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary Card */}
          <GlassCard className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Monto Principal</p>
                <p className="font-bold">{formatCurrency(Number(offerAmount))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Costo Total</p>
                <p className="font-bold text-orange-600">{formatCurrency(fee)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pago Total</p>
                <p className="font-bold text-purple-600">{formatCurrency(totalRepayment)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Retencion</p>
                <p className="font-bold">{repaymentPercent}% diario</p>
              </div>
            </div>
          </GlassCard>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas internas sobre la oferta..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Oferta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const CreditAssessment: React.FC = () => {
  const { t } = useTranslation('superadmin')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [selectedAssessment, setSelectedAssessment] = useState<CreditAssessmentData | null>(null)
  const [offerAssessment, setOfferAssessment] = useState<CreditAssessmentData | null>(null)
  const [gradeFilter, setGradeFilter] = useState<CreditGrade | 'ALL'>('ALL')
  const [eligibilityFilter, setEligibilityFilter] = useState<CreditEligibility | 'ALL'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Queries
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['credit-assessment-summary'],
    queryFn: getCreditAssessmentSummary,
  })

  const { data: assessmentsData, isLoading: assessmentsLoading } = useQuery({
    queryKey: ['credit-assessments', page, gradeFilter, eligibilityFilter],
    queryFn: () =>
      getCreditAssessments({
        page,
        pageSize: 20,
        grade: gradeFilter !== 'ALL' ? [gradeFilter] : undefined,
        eligibility: eligibilityFilter !== 'ALL' ? [eligibilityFilter] : undefined,
        sortBy: 'creditScore',
        sortOrder: 'desc',
      }),
  })

  // Mutations
  const refreshMutation = useMutation({
    mutationFn: (venueId: string) => refreshVenueCreditAssessment(venueId),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['credit-assessments'] })
      queryClient.invalidateQueries({ queryKey: ['credit-assessment-summary'] })
      setSelectedAssessment(data)
      toast({
        title: 'Evaluacion actualizada',
        description: `Score: ${data.creditScore} (Grado ${data.creditGrade})`,
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la evaluacion',
        variant: 'destructive',
      })
    },
  })

  const refreshAllMutation = useMutation({
    mutationFn: refreshAllCreditAssessments,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['credit-assessments'] })
      queryClient.invalidateQueries({ queryKey: ['credit-assessment-summary'] })
      toast({
        title: 'Evaluaciones actualizadas',
        description: `${data.processed} procesadas, ${data.errors} errores`,
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar las evaluaciones',
        variant: 'destructive',
      })
    },
  })

  const createOfferMutation = useMutation({
    mutationFn: (params: {
      venueId: string
      data: {
        offerAmount: number
        factorRate: number
        repaymentPercent: number
        expiresInDays: number
        notes?: string
      }
    }) => createCreditOffer(params.venueId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-assessments'] })
      queryClient.invalidateQueries({ queryKey: ['credit-assessment-summary'] })
      setOfferAssessment(null)
      toast({
        title: 'Oferta creada',
        description: 'La oferta de credito ha sido enviada',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la oferta',
        variant: 'destructive',
      })
    },
  })

  // Filter assessments by search term
  const filteredAssessments = useMemo(() => {
    if (!assessmentsData?.data) return []
    if (!searchTerm) return assessmentsData.data

    const term = searchTerm.toLowerCase()
    return assessmentsData.data.filter(
      a =>
        a.venue.name.toLowerCase().includes(term) ||
        a.venue.organization.name.toLowerCase().includes(term)
    )
  }, [assessmentsData?.data, searchTerm])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evaluacion de Credito</h1>
          <p className="text-muted-foreground">SOFOM - Analisis para otorgamiento de creditos</p>
        </div>
        <Button
          onClick={() => refreshAllMutation.mutate()}
          disabled={refreshAllMutation.isPending}
          variant="outline"
        >
          {refreshAllMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualizar Todo
        </Button>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} isLoading={summaryLoading} />

      {/* Grade Distribution */}
      <GradeDistribution summary={summary} />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar venue..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={gradeFilter} onValueChange={v => setGradeFilter(v as CreditGrade | 'ALL')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Grado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="A">Grado A</SelectItem>
            <SelectItem value="B">Grado B</SelectItem>
            <SelectItem value="C">Grado C</SelectItem>
            <SelectItem value="D">Grado D</SelectItem>
          </SelectContent>
        </Select>

        <Select value={eligibilityFilter} onValueChange={v => setEligibilityFilter(v as CreditEligibility | 'ALL')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Elegibilidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="ELIGIBLE">Elegible</SelectItem>
            <SelectItem value="REVIEW_REQUIRED">Revision Manual</SelectItem>
            <SelectItem value="OFFER_PENDING">Oferta Pendiente</SelectItem>
            <SelectItem value="INELIGIBLE">No Elegible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assessment List */}
      <div>
        {assessmentsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <GlassCard key={i} className="p-4">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : filteredAssessments.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron evaluaciones</p>
          </GlassCard>
        ) : (
          filteredAssessments.map(assessment => (
            <AssessmentRow
              key={assessment.id}
              assessment={assessment}
              onSelect={setSelectedAssessment}
              onCreateOffer={setOfferAssessment}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {assessmentsData && assessmentsData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} de {assessmentsData.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(assessmentsData.pagination.totalPages, p + 1))}
            disabled={page === assessmentsData.pagination.totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Detail Panel */}
      {selectedAssessment && (
        <>
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setSelectedAssessment(null)}
          />
          <DetailPanel
            assessment={selectedAssessment}
            onClose={() => setSelectedAssessment(null)}
            onRefresh={() => refreshMutation.mutate(selectedAssessment.venueId)}
            isRefreshing={refreshMutation.isPending}
          />
        </>
      )}

      {/* Create Offer Dialog */}
      <CreateOfferDialog
        assessment={offerAssessment}
        isOpen={!!offerAssessment}
        onClose={() => setOfferAssessment(null)}
        onSubmit={data => {
          if (offerAssessment) {
            createOfferMutation.mutate({
              venueId: offerAssessment.venueId,
              data,
            })
          }
        }}
        isSubmitting={createOfferMutation.isPending}
      />
    </div>
  )
}

export default CreditAssessment
