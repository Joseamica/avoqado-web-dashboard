import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { MetricCard } from '@/components/ui/metric-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/context/AuthContext'
import { getOrganizationVenues, type OrganizationVenue, type TimeRange } from '@/services/organization.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { StaffRole } from '@/types'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  DollarSign,
  ExternalLink,
  LayoutGrid,
  List,
  MapPin,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

// ── Status Helpers ──

type VenueStatusInfo = {
  pulse: 'success' | 'warning' | 'error' | 'neutral'
  label: string
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
}

function getVenueStatus(status: string, t: (key: string) => string): VenueStatusInfo {
  switch (status) {
    case 'ACTIVE':
      return { pulse: 'success', label: t('venues.statusLabels.active'), badgeVariant: 'default' }
    case 'SUSPENDED':
      return { pulse: 'error', label: t('venues.statusLabels.suspended'), badgeVariant: 'destructive' }
    case 'PENDING':
      return { pulse: 'warning', label: t('venues.statusLabels.pending'), badgeVariant: 'outline' }
    default:
      return { pulse: 'neutral', label: status, badgeVariant: 'secondary' }
  }
}

// ── Component ──

const OrganizationVenues: React.FC = () => {
  const { t, i18n } = useTranslation('organization')
  const localeCode = getIntlLocale(i18n.language)
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const { staffInfo } = useAuth()
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const canViewOrgVenues =
    staffInfo?.role &&
    [StaffRole.SUPERADMIN, StaffRole.OWNER, StaffRole.ADMIN].includes(staffInfo.role as StaffRole)

  const { data: venues, isLoading } = useQuery({
    queryKey: ['organization', 'venues', orgId, timeRange],
    queryFn: () => getOrganizationVenues(orgId!, { timeRange }),
    enabled: !!orgId && canViewOrgVenues,
  })

  const filteredVenues = useMemo(() => {
    if (!venues) return []
    if (!debouncedSearch) return venues
    const search = debouncedSearch.toLowerCase()
    return venues.filter(
      venue =>
        venue.name.toLowerCase().includes(search) ||
        venue.city?.toLowerCase().includes(search) ||
        venue.slug.toLowerCase().includes(search),
    )
  }, [venues, debouncedSearch])

  // ── Aggregate metrics ──
  const metrics = useMemo(() => {
    if (!venues || venues.length === 0) return null
    const total = venues.reduce(
      (acc, v) => ({
        revenue: acc.revenue + v.metrics.revenue,
        orders: acc.orders + v.metrics.orderCount,
        payments: acc.payments + v.metrics.paymentCount,
        staff: acc.staff + v.metrics.staffCount,
      }),
      { revenue: 0, orders: 0, payments: 0, staff: 0 },
    )
    const activeCount = venues.filter(v => v.status === 'ACTIVE').length
    return { ...total, active: activeCount, total: venues.length }
  }, [venues])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount)

  const formatCompact = (amount: number) =>
    new Intl.NumberFormat(localeCode, { notation: 'compact', maximumFractionDigits: 1 }).format(amount)

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('venues.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('venues.subtitle', { count: venues?.length || 0 })}
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

        {/* ── Summary Metrics ── */}
        {metrics && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={t('venues.metrics.totalRevenue')}
              value={formatCompact(metrics.revenue)}
              icon={<DollarSign className="w-4 h-4" />}
              accent="green"
            />
            <MetricCard
              label={t('venues.metrics.totalOrders')}
              value={metrics.orders.toLocaleString(localeCode)}
              icon={<ShoppingCart className="w-4 h-4" />}
              accent="blue"
            />
            <MetricCard
              label={t('venues.metrics.activeVenues')}
              value={`${metrics.active} / ${metrics.total}`}
              icon={<Store className="w-4 h-4" />}
              accent="purple"
            />
            <MetricCard
              label={t('venues.metrics.totalStaff')}
              value={metrics.staff.toLocaleString(localeCode)}
              icon={<Users className="w-4 h-4" />}
              accent="orange"
            />
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('venues.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Content ── */}
        {filteredVenues.length === 0 ? (
          <GlassCard className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Store className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">
              {searchTerm ? t('venues.noResults') : t('venues.noVenues')}
            </p>
          </GlassCard>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredVenues.map(venue => (
              <VenueCard
                key={venue.id}
                venue={venue}
                formatCurrency={formatCurrency}
                onClick={() => navigate(`/venues/${venue.slug}/home`)}
              />
            ))}
          </div>
        ) : (
          <VenueTable
            venues={filteredVenues}
            formatCurrency={formatCurrency}
            onNavigate={slug => navigate(`/venues/${slug}/home`)}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

// ── Venue Card (Grid Mode) ──

function VenueCard({
  venue,
  formatCurrency,
  onClick,
}: {
  venue: OrganizationVenue
  formatCurrency: (n: number) => string
  onClick: () => void
}) {
  const { t } = useTranslation('organization')
  const statusInfo = getVenueStatus(venue.status, t)
  const growth = venue.metrics.growth
  const location = [venue.city, venue.state].filter(Boolean).join(', ')

  return (
    <GlassCard hover onClick={onClick} className="p-5 flex flex-col gap-4">
      {/* Top: Identity */}
      <div className="flex items-start gap-3">
        <Avatar className="h-11 w-11 rounded-xl ring-1 ring-border/50 shrink-0">
          <AvatarImage src={venue.logo || undefined} alt={venue.name} />
          <AvatarFallback className="rounded-xl text-base font-semibold bg-primary/10 text-primary">
            {venue.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate">{venue.name}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusPulse status={statusInfo.pulse} size="sm" />
              <span className="text-xs text-muted-foreground">{statusInfo.label}</span>
            </div>
          </div>
          {location && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
      </div>

      {/* Middle: Revenue hero */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t('venues.revenue')}</p>
          <p className="text-xl font-bold tracking-tight">{formatCurrency(venue.metrics.revenue)}</p>
        </div>
        {growth !== 0 && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              growth > 0
                ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
            }`}
          >
            {growth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(growth).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Bottom: Mini metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MiniMetric
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          label={t('venues.orders')}
          value={venue.metrics.orderCount.toLocaleString()}
        />
        <MiniMetric
          icon={<Receipt className="h-3.5 w-3.5" />}
          label={t('venues.payments')}
          value={venue.metrics.paymentCount.toLocaleString()}
        />
        <MiniMetric
          icon={<Users className="h-3.5 w-3.5" />}
          label={t('venues.staff')}
          value={venue.metrics.staffCount.toLocaleString()}
        />
      </div>
    </GlassCard>
  )
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 py-2.5 px-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold leading-none">{value}</span>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </div>
  )
}

// ── Venue Table (List Mode) ──

function VenueTable({
  venues,
  formatCurrency,
  onNavigate,
}: {
  venues: OrganizationVenue[]
  formatCurrency: (n: number) => string
  onNavigate: (slug: string) => void
}) {
  const { t } = useTranslation('organization')

  return (
    <GlassCard className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('venues.venue')}</TableHead>
            <TableHead>{t('venues.location')}</TableHead>
            <TableHead>{t('venues.status')}</TableHead>
            <TableHead className="text-right">{t('venues.revenue')}</TableHead>
            <TableHead className="text-right">{t('venues.orders')}</TableHead>
            <TableHead className="text-right">{t('venues.staff')}</TableHead>
            <TableHead className="text-right">{t('venues.growth')}</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {venues.map(venue => {
            const statusInfo = getVenueStatus(venue.status, t)
            const growth = venue.metrics.growth
            const location = [venue.city, venue.state].filter(Boolean).join(', ')

            return (
              <TableRow
                key={venue.id}
                className="cursor-pointer"
                onClick={() => onNavigate(venue.slug)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                      <AvatarFallback className="rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                        {venue.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{venue.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {location ? (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {location}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusPulse status={statusInfo.pulse} size="sm" />
                    <span className="text-xs">{statusInfo.label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  {formatCurrency(venue.metrics.revenue)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {venue.metrics.orderCount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {venue.metrics.staffCount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {growth !== 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        growth > 0
                          ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                          : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                      }`}
                    >
                      {growth > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(growth).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">{t('venues.goToVenue')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </GlassCard>
  )
}

export default OrganizationVenues
