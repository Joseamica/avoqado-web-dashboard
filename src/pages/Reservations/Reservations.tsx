import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { CalendarDays, Clock, Search, Users, X, AlertTriangle, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { CheckboxFilterContent, FilterPill } from '@/components/filters'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { PermissionGate } from '@/components/PermissionGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useVenueDateTime } from '@/utils/datetime'
import reservationService from '@/services/reservation.service'
import type { Reservation } from '@/types/reservation'

import { CreateReservationForm } from './CreateReservation'
import { ReservationStatusBadge } from './components/ReservationStatusBadge'

type TabValue = 'all' | 'pending' | 'confirmed' | 'today' | 'noShow'

const TAB_TO_STATUS: Record<TabValue, string | undefined> = {
  all: undefined,
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  today: undefined,
  noShow: 'NO_SHOW',
}

export default function Reservations() {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { venueId, fullBasePath } = useCurrentVenue()
  const { formatDate, formatTime, formatDateISO } = useVenueDateTime()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // FullScreenModal state for creating reservations
  const [showCreateModal, setShowCreateModal] = useState(false)
  const createFormSubmitRef = useMemo<MutableRefObject<(() => void) | null>>(() => ({ current: null }), [])

  // Tab state from URL hash
  const validTabs: TabValue[] = ['all', 'pending', 'confirmed', 'today', 'noShow']
  const hashTab = location.hash.replace('#', '') as TabValue
  const [activeTab, setActiveTab] = useState<TabValue>(validTabs.includes(hashTab) ? hashTab : 'all')

  // Sync tab with URL hash
  useEffect(() => {
    const newHash = location.hash.replace('#', '') as TabValue
    if (validTabs.includes(newHash) && newHash !== activeTab) {
      setActiveTab(newHash)
    }
  }, [location.hash])

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = value as TabValue
      setActiveTab(tab)
      navigate(`${location.pathname}#${tab}`, { replace: true })
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
    },
    [navigate, location.pathname],
  )

  // Pagination
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })

  // Expandable search
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Filters
  const [channelFilter, setChannelFilter] = useState<string[]>([])
  const today = useMemo(() => formatDateISO(new Date()), [formatDateISO])

  // Reset pagination on filter change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [activeTab, debouncedSearchTerm, channelFilter])

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, any> = {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }

    const statusFromTab = TAB_TO_STATUS[activeTab]
    if (statusFromTab) params.status = statusFromTab
    if (activeTab === 'today') {
      params.dateFrom = today
      params.dateTo = today
    }
    if (channelFilter.length > 0) params.channel = channelFilter[0]
    if (debouncedSearchTerm) params.search = debouncedSearchTerm

    return params
  }, [pagination, activeTab, channelFilter, debouncedSearchTerm, today])

  // Fetch reservations
  const { data: reservationsData, isLoading } = useQuery({
    queryKey: ['reservations', venueId, queryParams],
    queryFn: () => reservationService.getReservations(venueId, queryParams),
    refetchOnWindowFocus: true,
  })

  // Fetch stats for today
  const { data: statsData } = useQuery({
    queryKey: ['reservation-stats', venueId, today],
    queryFn: () => reservationService.getStats(venueId, today, today),
  })

  const reservations = reservationsData?.data || []

  // Guest display name helper
  const getGuestName = useCallback(
    (r: Reservation) => {
      if (r.customer) return `${r.customer.firstName} ${r.customer.lastName}`
      if (r.guestName) return r.guestName
      return t('unnamedGuest')
    },
    [t],
  )

  // Column definitions
  const columns: ColumnDef<Reservation>[] = useMemo(
    () => [
      {
        accessorKey: 'confirmationCode',
        header: t('columns.code'),
        cell: ({ row }) => <span className="font-mono text-sm font-medium">{row.original.confirmationCode}</span>,
      },
      {
        id: 'guest',
        header: t('columns.guest'),
        cell: ({ row }) => {
          const r = row.original
          const name = getGuestName(r)
          const phone = r.customer?.phone || r.guestPhone
          return (
            <div>
              <div className="font-medium">{name}</div>
              {phone && <div className="text-sm text-muted-foreground">{phone}</div>}
            </div>
          )
        },
      },
      {
        accessorKey: 'startsAt',
        header: t('columns.dateTime'),
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="font-medium">{formatDate(row.original.startsAt)}</div>
            <div className="text-sm text-muted-foreground">
              {formatTime(row.original.startsAt)} – {formatTime(row.original.endsAt)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'duration',
        header: t('columns.duration'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.duration} {t('minutes')}
          </span>
        ),
      },
      {
        accessorKey: 'partySize',
        header: t('columns.partySize'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{row.original.partySize}</span>
          </div>
        ),
      },
      {
        id: 'table',
        header: t('columns.table'),
        cell: ({ row }) =>
          row.original.table ? (
            <Badge variant="outline">{row.original.table.number}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'status',
        header: t('columns.status'),
        cell: ({ row }) => <ReservationStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'channel',
        header: t('columns.channel'),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{t(`channel.${row.original.channel}`)}</span>,
      },
    ],
    [t, formatDate, formatTime, getGuestName],
  )

  // Channel filter options
  const channelOptions = useMemo(
    () => [
      { value: 'DASHBOARD', label: t('channel.DASHBOARD') },
      { value: 'WEB', label: t('channel.WEB') },
      { value: 'PHONE', label: t('channel.PHONE') },
      { value: 'WHATSAPP', label: t('channel.WHATSAPP') },
      { value: 'WALK_IN', label: t('channel.WALK_IN') },
      { value: 'THIRD_PARTY', label: t('channel.THIRD_PARTY') },
    ],
    [t],
  )

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageTitleWithInfo title={t('title')} className="text-2xl font-bold" />
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <PermissionGate permission="reservations:create">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('actions.newReservation')}
          </Button>
        </PermissionGate>
      </div>

      {/* Stats cards */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <CalendarDays className="h-4 w-4" />
              {t('stats.todayCount')}
            </div>
            <div className="text-2xl font-bold">{statsData.total}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              {t('stats.pending')}
            </div>
            <div className="text-2xl font-bold">{statsData.byStatus?.PENDING || 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              {t('stats.checkedIn')}
            </div>
            <div className="text-2xl font-bold">{statsData.byStatus?.CHECKED_IN || 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <AlertTriangle className="h-4 w-4" />
              {t('stats.noShowRate')}
            </div>
            <div className="text-2xl font-bold">{statsData.noShowRate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Pill tabs + filters row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
            {validTabs.map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background"
              >
                {t(`tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {/* Channel filter */}
          <FilterPill
            label={t('filters.channel')}
            isActive={channelFilter.length > 0}
            activeValue={channelFilter.length > 0 ? `${channelFilter.length}` : null}
            onClear={() => setChannelFilter([])}
          >
            <CheckboxFilterContent
              title={t('filters.channel')}
              options={channelOptions}
              selectedValues={channelFilter}
              onApply={values => setChannelFilter(values.slice(0, 1))}
            />
          </FilterPill>

          {/* Expandable search */}
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-9 w-64 rounded-full"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full cursor-pointer"
                onClick={() => {
                  setIsSearchOpen(false)
                  setSearchTerm('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full cursor-pointer" onClick={() => setIsSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
              {searchTerm && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />}
            </div>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={reservations}
        columns={columns}
        isLoading={isLoading}
        pagination={pagination}
        setPagination={setPagination}
        tableId="reservations:list"
        rowCount={reservationsData?.meta?.total || 0}
        showColumnCustomizer={false}
        clickableRow={row => ({ to: row.id })}
        stickyFirstColumn={true}
      />

      {/* Create Reservation Modal */}
      <FullScreenModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('form.createTitle')}
        actions={<Button onClick={() => createFormSubmitRef.current?.()}>{t('actions.save')}</Button>}
      >
        <div className="max-w-4xl mx-auto p-6">
          <CreateReservationForm
            submitRef={createFormSubmitRef}
            onSuccess={() => {
              setShowCreateModal(false)
              queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
              queryClient.invalidateQueries({ queryKey: ['reservation-stats', venueId] })
            }}
          />
        </div>
      </FullScreenModal>
    </div>
  )
}
