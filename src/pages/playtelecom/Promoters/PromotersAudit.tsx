/**
 * PromotersAudit - Promoter Performance & Audit
 *
 * Displays:
 * - Selectable promoter list (left panel)
 * - Detailed promoter view (right panel):
 *   - Profile card with status
 *   - Entry evidence (selfie/GPS)
 *   - Daily scorecard
 *   - Attendance calendar
 *   - Deposit validation
 *
 * Access: MANAGER+ only
 */

import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  User,
  Package,
  DollarSign,
  Clock,
  TrendingUp,
  Store,
  Search,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PromoterDetailPanel } from './components'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getPromoters,
  getPromoterDetail,
  getPromoterDeposits,
  validateDeposit,
  type Promoter,
} from '@/services/promoters.service'

// Map API status to UI status
type UIStatus = 'active' | 'break' | 'inactive'
const mapStatus = (status: Promoter['status']): UIStatus => {
  switch (status) {
    case 'ACTIVE':
      return 'active'
    case 'ON_BREAK':
      return 'break'
    case 'INACTIVE':
    default:
      return 'inactive'
  }
}

const STATUS_CONFIG = {
  active: { label: 'Activo', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
  break: { label: 'Descanso', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' },
  inactive: { label: 'Inactivo', color: 'bg-gray-400', textColor: 'text-gray-600 dark:text-gray-400' },
}

export function PromotersAudit() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId, venue } = useCurrentVenue()
  const queryClient = useQueryClient()
  const [selectedPromoterId, setSelectedPromoterId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Fetch promoters list
  const { data: promotersData, isLoading, error } = useQuery({
    queryKey: ['promoters', venueId, debouncedSearch],
    queryFn: () => getPromoters(venueId!, { search: debouncedSearch || undefined }),
    enabled: !!venueId,
  })

  const promoters = promotersData?.promoters || []
  const summary = promotersData?.summary

  // Fetch selected promoter detail
  const { data: promoterDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['promoter', venueId, selectedPromoterId],
    queryFn: () => getPromoterDetail(venueId!, selectedPromoterId!),
    enabled: !!venueId && !!selectedPromoterId,
  })

  // Fetch selected promoter deposits
  const { data: depositsData } = useQuery({
    queryKey: ['promoter-deposits', venueId, selectedPromoterId],
    queryFn: () => getPromoterDeposits(venueId!, selectedPromoterId!),
    enabled: !!venueId && !!selectedPromoterId,
  })

  // Auto-select first promoter when list loads
  useMemo(() => {
    if (promoters.length > 0 && !selectedPromoterId) {
      setSelectedPromoterId(promoters[0].id)
    }
  }, [promoters, selectedPromoterId])

  // Deposit validation mutation
  const depositMutation = useMutation({
    mutationFn: ({
      promoterId,
      depositId,
      action,
      notes,
    }: {
      promoterId: string
      depositId: string
      action: 'approve' | 'reject'
      notes?: string
    }) => validateDeposit(venueId!, promoterId, depositId, { action, notes }),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['promoters', venueId] })
      queryClient.invalidateQueries({ queryKey: ['promoter', venueId, selectedPromoterId] })
    },
  })

  // Format currency
  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: venue?.currency || 'MXN',
          minimumFractionDigits: 0,
        }).format(value),
    [venue?.currency]
  )

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) return `${diffMins}m`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
    return `${Math.floor(diffMins / 1440)}d`
  }

  // Get selected promoter data from list (for basic info) and detail (for full info)
  const selectedPromoterData = useMemo(() => {
    if (!selectedPromoterId) return null
    const promoter = promoters.find(p => p.id === selectedPromoterId)
    if (!promoter) return null

    // Use detail data when available, fallback to list data
    const detail = promoterDetail

    return {
      id: detail?.promoter?.id ?? promoter.id,
      name: detail?.promoter?.name ?? promoter.name,
      store: promoter.store?.name ?? '',
      manager: '', // Not available in current API
      todaySales: detail?.todayMetrics?.sales ?? promoter.todaySales ?? 0,
      weekSales: 0, // Not available in current API
      assignedInventory: 0, // Not available in current API
      soldToday: detail?.todayMetrics?.units ?? promoter.todayUnits ?? 0,
      commission: detail?.todayMetrics?.commission ?? promoter.commission ?? 0,
      status: mapStatus(promoter.status),
      lastActivity: promoter.lastActivity ?? new Date().toISOString(),
      level: 'junior' as 'junior' | 'senior' | 'expert', // Not available in current API
      rating: 0, // Not available in current API
      phone: detail?.promoter?.phone ?? undefined,
      email: detail?.promoter?.email ?? '',
      // Additional data from detail API
      checkIn: detail?.checkIn ?? null,
      attendance: detail?.attendance?.days ?? [],
      todayMetrics: detail?.todayMetrics ?? null,
      photo: detail?.promoter?.photo ?? promoter.photo,
    }
  }, [selectedPromoterId, promoters, promoterDetail])

  // Map deposits from API to component format
  const selectedPromoterDeposits = useMemo(() => {
    if (!depositsData?.deposits) return []
    return depositsData.deposits.map(d => ({
      id: d.id,
      amount: d.amount,
      date: d.timestamp,
      status: d.status.toLowerCase() as 'pending' | 'approved' | 'rejected',
      voucherUrl: d.voucherImageUrl,
      notes: d.rejectionReason,
      method: d.method,
    }))
  }, [depositsData])

  // Summary stats - use values from backend summary when available
  const stats = useMemo(() => ({
    totalPromoters: summary?.total || 0,
    activePromoters: summary?.active || 0,
    totalTodaySales: summary?.todayTotalSales ?? promoters.reduce((acc, p) => acc + (p.todaySales ?? 0), 0),
    totalCommissions: summary?.todayTotalCommissions ?? promoters.reduce((acc, p) => acc + (p.commission ?? 0), 0),
  }), [summary, promoters])

  // Handlers
  const handleApproveDeposit = (depositId: string, notes?: string) => {
    if (!selectedPromoterId) return
    depositMutation.mutate({
      promoterId: selectedPromoterId,
      depositId,
      action: 'approve',
      notes,
    })
  }

  const handleRejectDeposit = (depositId: string, reason: string) => {
    if (!selectedPromoterId) return
    depositMutation.mutate({
      promoterId: selectedPromoterId,
      depositId,
      action: 'reject',
      notes: reason,
    })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-4 h-96 rounded-xl" />
          <Skeleton className="lg:col-span-8 h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {t('common:error.loadingFailed', { defaultValue: 'Error al cargar datos' })}
        </h3>
        <p className="text-muted-foreground text-center max-w-md">
          {t('playtelecom:promoters.errorDescription', {
            defaultValue: 'No se pudieron cargar los promotores. Por favor intenta de nuevo.',
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.total', { defaultValue: 'Total Promotores' })}
              </p>
              <p className="text-xl font-semibold">{stats.totalPromoters}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.active', { defaultValue: 'Activos Ahora' })}
              </p>
              <p className="text-xl font-semibold">{stats.activePromoters}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.todaySales', { defaultValue: 'Ventas Hoy' })}
              </p>
              <p className="text-xl font-semibold">{formatCurrency(stats.totalTodaySales)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.commissions', { defaultValue: 'Comisiones' })}
              </p>
              <p className="text-xl font-semibold">{formatCurrency(stats.totalCommissions)}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main Content - Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Promoter List */}
        <GlassCard className="lg:col-span-4 p-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('playtelecom:promoters.search', { defaultValue: 'Buscar promotor...' })}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Promoter List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {promoters.map(promoter => {
              const uiStatus = mapStatus(promoter.status)
              const statusConfig = STATUS_CONFIG[uiStatus]
              const isSelected = selectedPromoterId === promoter.id

              return (
                <div
                  key={promoter.id}
                  onClick={() => setSelectedPromoterId(promoter.id)}
                  className={cn(
                    'p-3 rounded-xl cursor-pointer transition-all',
                    'hover:bg-muted/50 border border-transparent',
                    isSelected && 'bg-primary/10 border-primary/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      {promoter.photo ? (
                        <img
                          src={promoter.photo}
                          alt={promoter.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <span className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background',
                        statusConfig.color
                      )} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{promoter.name}</p>
                        <ChevronRight className={cn(
                          'w-4 h-4 text-muted-foreground transition-transform',
                          isSelected && 'text-primary rotate-90'
                        )} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Store className="w-3 h-3" />
                        <span className="truncate">{promoter.store?.name ?? ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-1 text-xs">
                      <Package className="w-3 h-3 text-muted-foreground" />
                      <span>{promoter.todayUnits ?? 0}</span>
                    </div>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(promoter.todaySales ?? 0)}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{promoter.lastActivity ? formatTimeAgo(promoter.lastActivity) : '-'}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {promoters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {t('playtelecom:promoters.noResults', { defaultValue: 'No se encontraron promotores' })}
                </p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Right Panel - Detail View */}
        <div className="lg:col-span-8">
          {selectedPromoterData ? (
            <PromoterDetailPanel
              promoter={selectedPromoterData}
              deposits={selectedPromoterDeposits}
              isLoading={isLoadingDetail}
              currency={venue?.currency || 'MXN'}
              onApproveDeposit={handleApproveDeposit}
              onRejectDeposit={handleRejectDeposit}
            />
          ) : (
            <GlassCard className="p-8 text-center">
              <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {t('playtelecom:promoters.selectPromoter', { defaultValue: 'Selecciona un promotor para ver detalles' })}
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}

export default PromotersAudit
