/**
 * TiendasList - Organization Venue List Page
 *
 * Shows all venues in the organization with performance metrics.
 * Features:
 * - List/Grid view toggle
 * - Search and filter
 * - Performance metrics per venue
 * - Quick actions (navigate to venue)
 *
 * Part of the white-label organization routes: /wl/organizations/:orgSlug/venues
 */

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Store,
  Search,
  LayoutGrid,
  List,
  MapPin,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Users,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// GlassCard component
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

// View mode type
type ViewMode = 'grid' | 'list'

const TiendasList: React.FC = () => {
  const { t } = useTranslation(['organization', 'common'])
  const navigate = useNavigate()
  const { organization, basePath, venues, isLoading, error } = useCurrentOrganization()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Filter venues by search term
  const filteredVenues = useMemo(() => {
    if (!debouncedSearch) return venues

    const search = debouncedSearch.toLowerCase()
    return venues.filter(
      (venue) =>
        venue.name.toLowerCase().includes(search) ||
        venue.city?.toLowerCase().includes(search) ||
        venue.slug.toLowerCase().includes(search)
    )
  }, [venues, debouncedSearch])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Navigate to venue
  const handleVenueClick = (slug: string) => {
    navigate(`/wl/venues/${slug}`)
  }

  // Aggregate stats
  const stats = useMemo(() => ({
    total: venues.length,
    active: venues.filter(v => v.status === 'ACTIVE').length,
    totalSales: venues.reduce((sum, v) => sum + (v.metrics?.revenue || 0), 0),
    totalStaff: venues.reduce((sum, v) => sum + (v.metrics?.staffCount || 0), 0),
  }), [venues])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Store className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t('organization:error.loadFailed', { defaultValue: 'Error al cargar datos' })}
        </h2>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <Button onClick={() => window.location.reload()}>
          {t('common:retry', { defaultValue: 'Reintentar' })}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('organization:tiendas.title', { defaultValue: 'Tiendas' })}
          </h1>
          <p className="text-muted-foreground">
            {t('organization:tiendas.subtitle', {
              defaultValue: 'Gestiona todas las tiendas de tu organización',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Store className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">
                {t('organization:tiendas.totalStores', { defaultValue: 'Total tiendas' })}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">
                {t('organization:tiendas.activeStores', { defaultValue: 'Activas' })}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</p>
              <p className="text-xs text-muted-foreground">
                {t('organization:tiendas.totalSales', { defaultValue: 'Ventas hoy' })}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStaff}</p>
              <p className="text-xs text-muted-foreground">
                {t('organization:tiendas.totalStaff', { defaultValue: 'Personal' })}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('organization:tiendas.searchPlaceholder', { defaultValue: 'Buscar tiendas...' })}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[180px] rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredVenues.length === 0 && (
        <GlassCard className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Store className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm
                ? t('organization:tiendas.noResults', { defaultValue: 'Sin resultados' })
                : t('organization:tiendas.noStores', { defaultValue: 'No hay tiendas' })}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {searchTerm
                ? t('organization:tiendas.noResultsDesc', {
                    defaultValue: 'Intenta con otro término de búsqueda',
                  })
                : t('organization:tiendas.noStoresDesc', {
                    defaultValue: 'Las tiendas de tu organización aparecerán aquí',
                  })}
            </p>
          </div>
        </GlassCard>
      )}

      {/* Grid View */}
      {!isLoading && filteredVenues.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVenues.map((venue) => (
            <GlassCard
              key={venue.id}
              hover
              onClick={() => handleVenueClick(venue.slug)}
              className="p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                    <AvatarFallback className="rounded-lg bg-muted">
                      {venue.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{venue.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{venue.city || t('organization:tiendas.noLocation', { defaultValue: 'Sin ubicación' })}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={venue.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {venue.status === 'ACTIVE'
                    ? t('organization:tiendas.active', { defaultValue: 'Activa' })
                    : t('organization:tiendas.inactive', { defaultValue: 'Inactiva' })}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('organization:tiendas.sales', { defaultValue: 'Ventas hoy' })}
                  </p>
                  <p className="font-semibold">{formatCurrency(venue.metrics?.revenue || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('organization:tiendas.transactions', { defaultValue: 'Transacciones' })}
                  </p>
                  <p className="font-semibold">{venue.metrics?.orderCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('organization:tiendas.staff', { defaultValue: 'Personal' })}
                  </p>
                  <p className="font-semibold">{venue.metrics?.staffCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('organization:tiendas.performance', { defaultValue: 'Rendimiento' })}
                  </p>
                  <div className="flex items-center gap-1">
                    {(venue.metrics?.growth || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                    )}
                    <span className={cn(
                      'text-sm font-medium',
                      (venue.metrics?.growth || 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}>
                      {venue.metrics?.growth || 0}%
                    </span>
                  </div>
                </div>
              </div>

              <Button variant="ghost" size="sm" className="w-full mt-4">
                {t('organization:tiendas.viewDetails', { defaultValue: 'Ver detalles' })}
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            </GlassCard>
          ))}
        </div>
      )}

      {/* List View */}
      {!isLoading && filteredVenues.length > 0 && viewMode === 'list' && (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('organization:tiendas.table.name', { defaultValue: 'Tienda' })}</TableHead>
                <TableHead>{t('organization:tiendas.table.location', { defaultValue: 'Ubicación' })}</TableHead>
                <TableHead className="text-right">
                  {t('organization:tiendas.table.sales', { defaultValue: 'Ventas' })}
                </TableHead>
                <TableHead className="text-right">
                  {t('organization:tiendas.table.transactions', { defaultValue: 'Trans.' })}
                </TableHead>
                <TableHead className="text-right">
                  {t('organization:tiendas.table.staff', { defaultValue: 'Personal' })}
                </TableHead>
                <TableHead>{t('organization:tiendas.table.status', { defaultValue: 'Estado' })}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVenues.map((venue) => (
                <TableRow
                  key={venue.id}
                  className="cursor-pointer"
                  onClick={() => handleVenueClick(venue.slug)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                        <AvatarFallback className="rounded-lg bg-muted text-xs">
                          {venue.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{venue.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {venue.city || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(venue.metrics?.revenue || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {venue.metrics?.orderCount || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {venue.metrics?.staffCount || 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={venue.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {venue.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </div>
  )
}

export default TiendasList
