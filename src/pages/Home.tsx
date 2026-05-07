import { useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DateTime } from 'luxon'
import {
  ArrowUp,
  BarChart3,
  Boxes,
  CreditCard,
  Package,
  Plus,
  Smartphone,
  TriangleAlert,
  Users,
  UserRound,
  Vault,
} from 'lucide-react'

import { KYCStatusBanner } from '@/components/KYCStatusBanner'
import { HomeSetupChecklist } from '@/components/onboarding/HomeSetupChecklist'
import { HomeDatePicker } from '@/components/home/HomeDatePicker'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { PerformanceChart } from '@/components/home/PerformanceChart'
import { Currency } from '@/utils/currency'
import { buildCompareOptions, detectRangeKind, type CompareOption } from '@/utils/dashboard-comparison'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'

export default function Home() {
  const { t, i18n } = useTranslation('home')
  const dashboardData = useDashboardData()
  const {
    selectedRange,
    compareRange,
    setSelectedRange,
    setCompareRange,
    setCompareType,
    setComparisonLabel,
    setActiveFilter,
  } = dashboardData
  const localeCode = getIntlLocale(i18n.language)
  const { venueTimezone } = useVenueDateTime()
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()

  const quickActions = useMemo(
    () => [
      { key: 'addItem', icon: Package, path: '/menumaker/products' },
      { key: 'viewPayments', icon: CreditCard, path: '/payments' },
      { key: 'inventory', icon: Boxes, path: '/inventory' },
      { key: 'reports', icon: BarChart3, path: '/reports/sales-summary' },
    ],
    [],
  )

  const [activeTab, setActiveTab] = useState<'overview' | 'business'>('overview')
  const [compareOptionId, setCompareOptionId] = useState<string>('day')
  const [chatInput, setChatInput] = useState('')
  const [chatFocused, setChatFocused] = useState(false)

  const compareOptions = useMemo(
    () => buildCompareOptions(selectedRange, venueTimezone, localeCode),
    [selectedRange, venueTimezone, localeCode],
  )

  const formatCompareLabel = useCallback(
    (option: CompareOption) => {
      const weekdayLabel = (option as CompareOption & { weekdayLabel?: string }).weekdayLabel
      return t(`newHome.compareOptions.${option.labelKey}`, weekdayLabel ? { weekday: weekdayLabel } : {})
    },
    [t],
  )

  const applyComparison = useCallback(
    (option: CompareOption) => {
      setCompareOptionId(option.id)
      setCompareRange(option.range)
      setCompareType(option.compareType)
      setComparisonLabel(formatCompareLabel(option))
    },
    [setCompareRange, setCompareType, setComparisonLabel, formatCompareLabel],
  )

  const activeCompareOption = useMemo(
    () => compareOptions.find(opt => opt.id === compareOptionId) ?? compareOptions[0],
    [compareOptions, compareOptionId],
  )

  // When the selected range kind changes, the previously chosen option may no
  // longer exist (e.g. switching from "Hoy" → "Este mes" makes 'weeks52' invalid).
  // Re-apply the first available option so compareRange/compareType stay in sync.
  useEffect(() => {
    if (!activeCompareOption) return
    if (activeCompareOption.id === compareOptionId) {
      // Refresh range labels even when the option id matches, in case selectedRange shifted
      setCompareRange(activeCompareOption.range)
      setCompareType(activeCompareOption.compareType)
      setComparisonLabel(formatCompareLabel(activeCompareOption))
      return
    }
    applyComparison(activeCompareOption)
  }, [activeCompareOption, compareOptionId, applyComparison, setCompareRange, setCompareType, setComparisonLabel, formatCompareLabel])

  const compareLabel = useMemo(
    () => (activeCompareOption ? formatCompareLabel(activeCompareOption) : ''),
    [activeCompareOption, formatCompareLabel],
  )

  const compareAmount = useMemo(
    () => dashboardData.comparePayments.reduce((acc: number, payment: any) => acc + Number(payment.amount || 0), 0),
    [dashboardData.comparePayments],
  )
  const compareTransactions = dashboardData.comparePayments.length
  const compareTips = useMemo(
    () =>
      dashboardData.comparePayments.reduce(
        (sumTips: number, payment: any) =>
          sumTips + (payment.tips || []).reduce((s: number, tip: any) => s + Number(tip.amount || 0), 0),
        0,
      ),
    [dashboardData.comparePayments],
  )

  // Square-style labels for the chart legend.
  //  - Día único (rango = un solo día): "Hoy" / "Ayer" o "ccc, d LLL yyyy"
  //  - Rango multi-día: "d LLL – d LLL yyyy" (omite año en el `from` si
  //    coincide con el `to` para evitar redundancia visual)
  //
  // Aplicado tanto al periodo seleccionado como al de comparación. Todo en
  // venue timezone.
  const formatRangeLabel = useCallback(
    (range: { from: Date; to: Date }, friendly?: string): string => {
      const from = DateTime.fromJSDate(range.from).setZone(venueTimezone).setLocale(localeCode)
      const to = DateTime.fromJSDate(range.to).setZone(venueTimezone).setLocale(localeCode)
      if (from.hasSame(to, 'day')) {
        return friendly ?? to.toFormat('ccc, d LLL yyyy')
      }
      if (friendly) return friendly
      const fromFmt = from.hasSame(to, 'year') ? from.toFormat('d LLL') : from.toFormat('d LLL yyyy')
      return `${fromFmt} - ${to.toFormat('d LLL yyyy')}`
    },
    [venueTimezone, localeCode],
  )

  // Friendly current-period label — Square uses these when the range matches
  // a known preset:
  //   - "Hoy" / "Ayer" para day kind
  //   - resto: el rango formateado completo (4 may - 7 may 2026)
  const currentPeriodLabel = useMemo(() => {
    const kind = detectRangeKind(selectedRange, venueTimezone)
    const now = DateTime.now().setZone(venueTimezone)
    const from = DateTime.fromJSDate(selectedRange.from).setZone(venueTimezone)

    if (kind === 'day') {
      if (from.hasSame(now, 'day')) return formatRangeLabel(selectedRange, t('newHome.performance.today'))
      if (from.hasSame(now.minus({ days: 1 }), 'day'))
        return formatRangeLabel(selectedRange, t('newHome.datePicker.yesterday'))
    }
    return formatRangeLabel(selectedRange)
  }, [selectedRange, venueTimezone, formatRangeLabel, t])

  const compareDateLabel = useMemo(() => formatRangeLabel(compareRange), [compareRange, formatRangeLabel])
  const selectedDateLabel = useMemo(() => formatRangeLabel(selectedRange), [selectedRange, formatRangeLabel])

  const detailRows = useMemo(
    () => [
      {
        label: t('newHome.performance.details.grossSales'),
        value: Currency(dashboardData.totalAmount, false),
        change: dashboardData.amountChangePercentage,
        compareBase: compareAmount,
      },
      {
        label: t('newHome.performance.details.transactions'),
        value: dashboardData.totalTransactions.toString(),
        change: dashboardData.transactionsChangePercentage,
        compareBase: compareTransactions,
      },
      {
        label: t('newHome.performance.details.laborShare'),
        value: `${Number(dashboardData.laborStats?.totalLaborHours || 0).toFixed(2)} %`,
        change: 0,
        compareBase: 0,
      },
      {
        label: t('newHome.performance.details.avgSale'),
        value: Currency(dashboardData.avgTicket, false),
        change: dashboardData.avgTicketChangePercentage,
        compareBase: compareAmount,
      },
      {
        label: t('newHome.performance.details.discounts'),
        value: Currency(dashboardData.orderStats?.totalDiscounts || 0, false),
        change: 0,
        compareBase: 0,
      },
      {
        label: t('newHome.performance.details.tips'),
        value: Currency(Number(dashboardData.tipStats?.totalTips ?? 0), false),
        change: dashboardData.tipsChangePercentage,
        compareBase: compareTips,
      },
    ],
    [dashboardData, compareAmount, compareTransactions, compareTips, t],
  )

  const suggestions = useMemo(
    () => [
      t('newHome.chatbot.q1'),
      t('newHome.chatbot.q2'),
      t('newHome.chatbot.q3'),
      t('newHome.chatbot.q4'),
    ],
    [t],
  )

  const sendToChatbot = useCallback((message: string) => {
    const trimmed = message.trim()
    if (!trimmed) return
    window.dispatchEvent(
      new CustomEvent('chatbot:openWithMessage', { detail: { message: trimmed } }),
    )
    setChatInput('')
    setChatFocused(false)
  }, [])

  const handleChatSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      sendToChatbot(chatInput)
    },
    [chatInput, sendToChatbot],
  )

  const handleChatKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        sendToChatbot(chatInput)
      }
    },
    [chatInput, sendToChatbot],
  )

  const showSuggestions = chatFocused && chatInput.trim().length === 0

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background px-3 py-4 md:px-6 md:py-6">
        <KYCStatusBanner />

        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'overview' | 'business')} className="mt-4 space-y-5">
          <TabsList
            className="inline-flex h-10 items-center justify-start rounded-full border border-border bg-muted/60 px-1 py-1 text-muted-foreground"
            data-tour="home-tabs"
          >
            <TabsTrigger
              value="overview"
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              {t('newHome.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger
              value="business"
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              {t('newHome.tabs.configuration')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-9">
              <HomeSetupChecklist />

              <Card className="rounded-2xl border-input" data-tour="home-chatbot-overview">
                <CardContent className="relative p-0">
                  <form onSubmit={handleChatSubmit} className="flex items-center gap-3 px-5 py-5">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={event => setChatInput(event.target.value)}
                      onFocus={() => setChatFocused(true)}
                      onBlur={() => window.setTimeout(() => setChatFocused(false), 150)}
                      onKeyDown={handleChatKeyDown}
                      placeholder={t('newHome.chatbot.placeholder')}
                      aria-label={t('newHome.chatbot.placeholder')}
                      className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/80 outline-none"
                      data-tour="home-chatbot-input"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!chatInput.trim()}
                      aria-label={t('newHome.chatbot.send')}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-full"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </form>

                  {showSuggestions && (
                    <div className="border-t border-border">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => sendToChatbot(suggestion)}
                          className={`block w-full cursor-pointer px-5 py-4 text-left text-base font-semibold text-foreground transition-colors hover:bg-muted/60 ${
                            index < suggestions.length - 1 ? 'border-b border-border' : ''
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-input" data-tour="home-performance-section">
                <CardContent className="space-y-5 p-6">
                  <h2 className="text-2xl font-semibold tracking-tight">{t('newHome.performance.title')}</h2>

                  <div className="flex flex-wrap gap-2">
                    <HomeDatePicker
                      range={selectedRange}
                      venueTimezone={venueTimezone}
                      locale={localeCode}
                      onChange={range => {
                        setSelectedRange(range)
                        setActiveFilter('custom')
                      }}
                    />

                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-9 cursor-pointer gap-2 rounded-full border-input px-4 text-sm font-normal"
                          data-tour="home-performance-compare"
                        >
                          <span className="text-muted-foreground">{t('newHome.filters.compare.label')}</span>
                          <span className="font-semibold">{compareLabel}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[280px] rounded-xl p-1">
                        {compareOptions.map(option => {
                          const isActive = option.id === compareOptionId
                          return (
                            <DropdownMenuItem
                              key={option.id}
                              onClick={() => applyComparison(option)}
                              className={`flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 ${
                                isActive ? 'bg-muted font-semibold' : ''
                              }`}
                            >
                              <span className={isActive ? 'font-semibold' : 'font-medium'}>{formatCompareLabel(option)}</span>
                              <span className="text-sm text-muted-foreground">{option.sublabel}</span>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                  </div>

                  <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                    <div className="flex flex-col">
                      <p className="text-sm text-muted-foreground">{t('newHome.performance.netSales')}</p>
                      <p className="mt-1 text-4xl font-bold tracking-tight">{Currency(dashboardData.totalAmount, false)}</p>
                      <div className="mt-3">
                        <TrendBadge
                          value={dashboardData.amountChangePercentage}
                          compareBase={compareAmount}
                          tooltipLabel={t('newHome.trend.noCompare')}
                          ndLabel={t('newHome.performance.ndLabel')}
                        />
                      </div>
                      {/* Legend stacked vertically below the KPI — Square style */}
                      <div className="mt-auto space-y-2 pt-6 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm bg-primary" />
                          <span>{currentPeriodLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm bg-primary/30" />
                          <span className="text-muted-foreground">{compareDateLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <PerformanceChart
                        currentPayments={dashboardData.filteredPayments}
                        comparePayments={dashboardData.comparePayments}
                        venueTimezone={venueTimezone}
                        currentLabel={currentPeriodLabel}
                        compareLabel={compareDateLabel}
                        emptyLabel={t('newHome.performance.noData')}
                      />
                    </div>
                  </div>

                  <div className="grid gap-x-12 gap-y-5 border-t border-border pt-6 md:grid-cols-2">
                    {detailRows.map(row => (
                      <div key={row.label} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">{row.label}</p>
                          <p className="mt-1 text-2xl font-bold tracking-tight">{row.value}</p>
                        </div>
                        <TrendBadge
                          value={row.change}
                          compareBase={row.compareBase}
                          tooltipLabel={t('newHome.trend.noCompare')}
                          ndLabel={t('newHome.performance.ndLabel')}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 xl:col-span-3">
              <Card className="rounded-2xl border-input">
                <CardContent className="space-y-2 p-5">
                  <p className="text-sm text-muted-foreground">{t('newHome.side.bank')}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('newHome.side.balance')}</span>
                    <span className="text-base font-semibold">$0.00</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-input">
                <CardContent className="space-y-3 p-5">
                  <p className="text-sm text-muted-foreground">{t('newHome.side.quickActions')}</p>
                  <div className="space-y-1">
                    {quickActions.map(({ key, icon: Icon, path }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => navigate(`${fullBasePath}${path}`)}
                        className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="truncate">{t(`newHome.side.actions.${key}`)}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-input">
                <CardContent className="space-y-2 p-5">
                  <p className="text-sm text-muted-foreground">{t('newHome.side.context')}</p>
                  <p className="text-sm text-muted-foreground">{t('newHome.side.contextDescription', { date: selectedDateLabel })}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="business" className="space-y-4" data-tour="home-business-center">
            <h2 className="text-2xl font-semibold tracking-tight">{t('newHome.businessCenter.title')}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card className="min-h-56 rounded-2xl border-input bg-foreground text-background">
                <CardContent className="space-y-4 pt-6">
                  <Vault className="h-10 w-10" />
                  <Badge variant="secondary" className="rounded-full">
                    {t('newHome.businessCenter.pendingSteps')}
                  </Badge>
                  <div>
                    <p className="text-2xl font-semibold">{t('newHome.businessCenter.start')}</p>
                    <p className="mt-1 text-sm text-background/75">{t('newHome.businessCenter.nextStep')}</p>
                  </div>
                </CardContent>
              </Card>
              <BusinessCard
                icon={UserRound}
                title={t('newHome.businessCenter.profile')}
                subtitle={t('newHome.businessCenter.profileSub')}
              />
              <BusinessCard icon={Users} title={t('newHome.businessCenter.staff')} subtitle={t('newHome.businessCenter.staffSub')} />
              <BusinessCard
                icon={CreditCard}
                title={t('newHome.businessCenter.payments')}
                subtitle={t('newHome.businessCenter.paymentsSub')}
              />
              <BusinessCard icon={Boxes} title={t('newHome.businessCenter.items')} subtitle={t('newHome.businessCenter.itemsSub')} />
              <BusinessCard
                icon={Smartphone}
                title={t('newHome.businessCenter.devices')}
                subtitle={t('newHome.businessCenter.devicesSub')}
              />
              <Card className="min-h-56 rounded-2xl border-input">
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}

function TrendBadge({
  value,
  compareBase,
  tooltipLabel,
  ndLabel,
}: {
  value: number
  compareBase: number
  tooltipLabel: string
  ndLabel: string
}) {
  const hasComparison = compareBase > 0
  if (!hasComparison) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 cursor-help items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <TriangleAlert className="h-3 w-3" />
            {ndLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center">
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    )
  }

  const colorClass =
    value < 0 ? 'text-destructive' : value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
      <span className={colorClass}>{value > 0 ? `+${value}%` : `${value}%`}</span>
    </span>
  )
}

function BusinessCard({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  subtitle: string
}) {
  return (
    <Card className="min-h-56 rounded-2xl border-input">
      <CardContent className="space-y-3 pt-6">
        <Icon className="h-10 w-10 text-foreground" />
        <div>
          <p className="text-2xl font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  )
}
