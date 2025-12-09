import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getOrganizationVenues,
  type TimeRange,
} from '@/services/organization.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Store,
  Search,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  LayoutGrid,
  List,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

const OrganizationVenues: React.FC = () => {
  const { t } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { data: venues, isLoading } = useQuery({
    queryKey: ['organization', 'venues', orgId, timeRange],
    queryFn: () => getOrganizationVenues(orgId!, { timeRange }),
    enabled: !!orgId,
  })

  const filteredVenues = useMemo(() => {
    if (!venues) return []
    if (!debouncedSearch) return venues
    const search = debouncedSearch.toLowerCase()
    return venues.filter(
      (venue) =>
        venue.name.toLowerCase().includes(search) ||
        venue.city?.toLowerCase().includes(search) ||
        venue.slug.toLowerCase().includes(search)
    )
  }, [venues, debouncedSearch])

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Store className="h-8 w-8 text-primary" />
            {t('venues.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('venues.subtitle', { count: venues?.length || 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('venues.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {filteredVenues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchTerm
              ? t('venues.noResults')
              : t('venues.noVenues')}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVenues.map((venue) => (
            <Card
              key={venue.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/venues/${venue.slug}/home`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 rounded-lg">
                    <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                    <AvatarFallback className="rounded-lg text-lg">
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
                    <p className="text-sm text-muted-foreground truncate">
                      {[venue.city, venue.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {/* Revenue with Growth */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t('venues.revenue')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {formatCurrency(venue.metrics.revenue)}
                      </span>
                      {venue.metrics.growth !== 0 && (
                        <Badge
                          variant={venue.metrics.growth > 0 ? 'default' : 'destructive'}
                          className="flex items-center gap-1"
                        >
                          {venue.metrics.growth > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Math.abs(venue.metrics.growth).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">
                        {t('venues.orders')}
                      </p>
                      <p className="font-semibold">{venue.metrics.orderCount}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">
                        {t('venues.payments')}
                      </p>
                      <p className="font-semibold">{venue.metrics.paymentCount}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">
                        {t('venues.staff')}
                      </p>
                      <p className="font-semibold">{venue.metrics.staffCount}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('venues.venue')}</TableHead>
                <TableHead>{t('venues.location')}</TableHead>
                <TableHead>{t('venues.status')}</TableHead>
                <TableHead className="text-right">{t('venues.revenue')}</TableHead>
                <TableHead className="text-right">{t('venues.orders')}</TableHead>
                <TableHead className="text-right">{t('venues.growth')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVenues.map((venue) => (
                <TableRow
                  key={venue.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/venues/${venue.slug}/home`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded">
                        <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                        <AvatarFallback className="text-sm">
                          {venue.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{venue.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[venue.city, venue.state].filter(Boolean).join(', ') || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={venue.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {venue.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(venue.metrics.revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {venue.metrics.orderCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {venue.metrics.growth !== 0 ? (
                      <Badge
                        variant={venue.metrics.growth > 0 ? 'default' : 'destructive'}
                        className="flex items-center gap-1 w-fit ml-auto"
                      >
                        {venue.metrics.growth > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(venue.metrics.growth).toFixed(1)}%
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

export default OrganizationVenues
