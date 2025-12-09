import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getOrganizationOverview,
  type TimeRange,
} from '@/services/organization.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign,
  ShoppingCart,
  CreditCard,
  Users,
  Store,
  TrendingUp,
  ArrowRight,
  Building2,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const OrganizationDashboard: React.FC = () => {
  const { t } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const { data: overview, isLoading } = useQuery({
    queryKey: ['organization', 'overview', orgId, timeRange],
    queryFn: () => getOrganizationOverview(orgId!, { timeRange }),
    enabled: !!orgId,
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const kpiCards = [
    {
      title: t('dashboard.totalRevenue'),
      value: formatCurrency(overview?.totalRevenue || 0),
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: t('dashboard.totalOrders'),
      value: (overview?.totalOrders || 0).toLocaleString(),
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t('dashboard.totalPayments'),
      value: (overview?.totalPayments || 0).toLocaleString(),
      icon: CreditCard,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: t('dashboard.totalStaff'),
      value: (overview?.totalStaff || 0).toLocaleString(),
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            {overview?.name || t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('dashboard.subtitle', { count: overview?.venueCount || 0 })}
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={cn('p-2 rounded-lg', card.bgColor)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Venues Grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {t('dashboard.venuePerformance')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.venuePerformanceDesc')}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/organizations/${orgId}/venues`)}
          >
            {t('dashboard.viewAll')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {overview?.venues && overview.venues.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {overview.venues.map((venue) => (
                <Card
                  key={venue.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/venues/${venue.slug}/home`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                        <AvatarFallback className="rounded-lg">
                          {venue.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{venue.name}</h3>
                          <Badge
                            variant={venue.status === 'ACTIVE' ? 'default' : 'secondary'}
                            className="shrink-0"
                          >
                            {venue.status}
                          </Badge>
                        </div>
                        {venue.city && (
                          <p className="text-sm text-muted-foreground truncate">
                            {venue.city}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.revenue')}
                        </p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(venue.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.orders')}
                        </p>
                        <p className="text-sm font-semibold">
                          {venue.orderCount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.payments')}
                        </p>
                        <p className="text-sm font-semibold">
                          {venue.paymentCount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.staff')}
                        </p>
                        <p className="text-sm font-semibold">
                          {venue.staffCount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('dashboard.noVenues')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default OrganizationDashboard
