import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getEnhancedOverview,
  getRevenueTrends,
  getTopItems,
  type TimeRange,
} from '@/services/organization.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPulse } from '@/components/ui/status-pulse'
import {
  ArrowRight,
  CreditCard,
  DollarSign,
  MapPin,
  Receipt,
  ShoppingCart,
  Store,
} from 'lucide-react'
import { EnhancedKPICard } from './components/EnhancedKPICard'
import { OrgRevenueTrendsChart } from './components/OrgRevenueTrendsChart'
import { TopVenuesRanking } from './components/TopVenuesRanking'
import { TopItemsTable } from './components/TopItemsTable'

const OrganizationDashboard: React.FC = () => {
  const { t, i18n } = useTranslation('organization')
  const localeCode = getIntlLocale(i18n.language)
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const { user, allVenues } = useAuth()

  const isSuperadmin = user?.role === StaffRole.SUPERADMIN
  const isOwnerInThisOrg = allVenues.some(
    venue => venue.organizationId === orgId && venue.role === StaffRole.OWNER,
  )
  const canViewOrgAnalytics = isSuperadmin || isOwnerInThisOrg

  const { data: overview, isLoading: isLoadingOverview } = useQuery({
    queryKey: ['organization', 'enhanced-overview', orgId, timeRange],
    queryFn: () => getEnhancedOverview(orgId!, { timeRange }),
    enabled: !!orgId && canViewOrgAnalytics,
  })

  const { data: trends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['organization', 'revenue-trends', orgId, timeRange],
    queryFn: () => getRevenueTrends(orgId!, { timeRange }),
    enabled: !!orgId && canViewOrgAnalytics,
  })

  const { data: topItems, isLoading: isLoadingTopItems } = useQuery({
    queryKey: ['organization', 'top-items', orgId, timeRange],
    queryFn: () => getTopItems(orgId!, { timeRange }, 10),
    enabled: !!orgId && canViewOrgAnalytics,
  })

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'MXN' }).format(amount)

  // ── Loading skeleton ──
  if (isLoadingOverview) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[380px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[380px] rounded-2xl" />
        </div>
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    )
  }

  const kpiCards = [
    {
      title: t('dashboard.totalRevenue'),
      value: formatCurrency(overview?.totalRevenue || 0),
      change: overview?.changes?.revenueChange || 0,
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'from-green-500/20 to-green-500/5',
    },
    {
      title: t('dashboard.totalOrders'),
      value: (overview?.totalOrders || 0).toLocaleString(localeCode),
      change: overview?.changes?.ordersChange || 0,
      icon: ShoppingCart,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'from-blue-500/20 to-blue-500/5',
    },
    {
      title: t('dashboard.averageTicketSize'),
      value: formatCurrency(overview?.averageTicketSize || 0),
      change: overview?.changes?.ticketSizeChange || 0,
      icon: Receipt,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'from-amber-500/20 to-amber-500/5',
    },
    {
      title: t('dashboard.totalPayments'),
      value: (overview?.totalPayments || 0).toLocaleString(localeCode),
      change: overview?.changes?.paymentsChange || 0,
      icon: CreditCard,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'from-purple-500/20 to-purple-500/5',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {overview?.name || t('dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('dashboard.subtitle', { count: overview?.venueCount || 0 })}
          </p>
        </div>
        <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('dashboard.selectPeriod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{t('dashboard.last7Days')}</SelectItem>
            <SelectItem value="30d">{t('dashboard.last30Days')}</SelectItem>
            <SelectItem value="90d">{t('dashboard.last90Days')}</SelectItem>
            <SelectItem value="ytd">{t('dashboard.yearToDate')}</SelectItem>
            <SelectItem value="all">{t('dashboard.allTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(card => (
          <EnhancedKPICard
            key={card.title}
            title={card.title}
            value={card.value}
            change={card.change}
            icon={card.icon}
            color={card.color}
            bgColor={card.bgColor}
          />
        ))}
      </div>

      {/* ── Charts + Ranking ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrgRevenueTrendsChart data={trends} isLoading={isLoadingTrends} formatCurrency={formatCurrency} />
        </div>
        <div className="lg:col-span-1">
          <TopVenuesRanking venues={overview?.topVenues} isLoading={isLoadingOverview} formatCurrency={formatCurrency} />
        </div>
      </div>

      {/* ── Top Items ── */}
      <TopItemsTable items={topItems} isLoading={isLoadingTopItems} formatCurrency={formatCurrency} />

      {/* ── Venues Performance Grid ── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Store className="h-4 w-4" />
              {t('dashboard.venuePerformance')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.venuePerformanceDesc')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => navigate(`/organizations/${orgId}/venues`)}
          >
            {t('dashboard.viewAll')}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>

        {overview?.venues && overview.venues.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.venues.map(venue => {
              const isActive = venue.status === 'ACTIVE'
              const location = [venue.city].filter(Boolean).join(', ')

              return (
                <div
                  key={venue.id}
                  className="rounded-xl border border-border/40 bg-muted/20 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate(`/venues/${venue.slug}/home`)}
                >
                  {/* Top row */}
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-9 w-9 rounded-lg shrink-0">
                      <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                      <AvatarFallback className="rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                        {venue.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{venue.name}</span>
                        <StatusPulse status={isActive ? 'success' : 'neutral'} size="sm" />
                      </div>
                      {location && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t('dashboard.revenue')}</span>
                      <span className="text-xs font-semibold">{formatCurrency(venue.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t('dashboard.orders')}</span>
                      <span className="text-xs font-semibold">{venue.orderCount.toLocaleString(localeCode)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t('dashboard.payments')}</span>
                      <span className="text-xs font-semibold">{venue.paymentCount.toLocaleString(localeCode)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t('dashboard.staff')}</span>
                      <span className="text-xs font-semibold">{venue.staffCount.toLocaleString(localeCode)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground text-sm">{t('dashboard.noVenues')}</div>
        )}
      </GlassCard>
    </div>
  )
}

export default OrganizationDashboard
