import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getOrgTerminals,
  isTerminalOnline,
  type OrgTerminalsFilters,
  type OrgTerminalsResponse,
} from '@/services/organizationDashboard.service'
import { getOrganizationVenues } from '@/services/organization.service'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Search, Smartphone, Wifi, WifiOff } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

const OrganizationTerminals: React.FC = () => {
  const { t, i18n } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const dateFnsLocale = getDateFnsLocale(i18n.language)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [venueFilter, setVenueFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Data fetching
  const filters: OrgTerminalsFilters = {
    page,
    pageSize,
    ...(venueFilter !== 'all' && { venueId: venueFilter }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(debouncedSearch && { search: debouncedSearch }),
  }

  const { data, isLoading } = useQuery<OrgTerminalsResponse>({
    queryKey: ['org-terminals', orgId, filters],
    queryFn: () => getOrgTerminals(orgId!, filters),
    enabled: !!orgId,
  })

  const { data: venues } = useQuery({
    queryKey: ['organization', 'venues', orgId],
    queryFn: () => getOrganizationVenues(orgId!),
    enabled: !!orgId,
  })

  const summary = data?.summary
  const terminals = data?.terminals ?? []
  const pagination = data?.pagination

  // Reset page when filters change
  const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
    setter(val)
    setPage(1)
  }

  const getStatusBadge = (terminal: (typeof terminals)[0]) => {
    const online = isTerminalOnline(terminal.lastHeartbeat)

    if (terminal.status === 'RETIRED') {
      return <Badge variant="destructive">{t('terminals.status.retired')}</Badge>
    }
    if (terminal.status === 'PENDING_ACTIVATION') {
      return <Badge variant="secondary">{t('terminals.status.pending')}</Badge>
    }
    if (terminal.status === 'MAINTENANCE') {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          {t('terminals.status.maintenance')}
        </Badge>
      )
    }
    if (terminal.status === 'ACTIVE' && online) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600/80">
          {t('terminals.status.online')}
        </Badge>
      )
    }
    return <Badge variant="secondary">{t('terminals.status.offline')}</Badge>
  }

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      TPV_ANDROID: 'Android',
      TPV_IOS: 'iOS',
      PRINTER_RECEIPT: t('terminals.type.receipt'),
      PRINTER_KITCHEN: t('terminals.type.kitchen'),
      KDS: 'KDS',
    }
    return <Badge variant="outline">{labels[type] || type}</Badge>
  }

  const getHealthBadge = (score: number | null) => {
    if (score === null) return <span className="text-muted-foreground">—</span>
    if (score >= 80) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600/80">
          {score}%
        </Badge>
      )
    }
    if (score >= 50) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          {score}%
        </Badge>
      )
    }
    return <Badge variant="destructive">{score}%</Badge>
  }

  const formatLastSeen = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return '—'
    return formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true, locale: dateFnsLocale })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const lowHealthCount = terminals.filter(t => t.healthScore !== null && t.healthScore < 50).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Smartphone className="h-8 w-8 text-primary" />
          {t('terminals.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('terminals.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.total')}</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.online')}</p>
                  <p className="text-2xl font-bold text-green-600">{summary.online}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.offline')}</p>
                  <p className="text-2xl font-bold">{summary.offline}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.lowHealth')}</p>
                  <p className="text-2xl font-bold text-amber-600">{lowHealthCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('terminals.searchPlaceholder')}
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>
        <Select value={venueFilter} onValueChange={handleFilterChange(setVenueFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('terminals.filters.venue')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('terminals.filters.allVenues')}</SelectItem>
            {venues?.map(v => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t('terminals.filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('terminals.filters.allStatuses')}</SelectItem>
            <SelectItem value="ACTIVE">{t('terminals.status.active')}</SelectItem>
            <SelectItem value="INACTIVE">{t('terminals.status.inactive')}</SelectItem>
            <SelectItem value="PENDING_ACTIVATION">{t('terminals.status.pending')}</SelectItem>
            <SelectItem value="MAINTENANCE">{t('terminals.status.maintenance')}</SelectItem>
            <SelectItem value="RETIRED">{t('terminals.status.retired')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={t('terminals.filters.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('terminals.filters.allTypes')}</SelectItem>
            <SelectItem value="TPV_ANDROID">Android</SelectItem>
            <SelectItem value="TPV_IOS">iOS</SelectItem>
            <SelectItem value="PRINTER_RECEIPT">{t('terminals.type.receipt')}</SelectItem>
            <SelectItem value="PRINTER_KITCHEN">{t('terminals.type.kitchen')}</SelectItem>
            <SelectItem value="KDS">KDS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        {terminals.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            {debouncedSearch || venueFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all'
              ? t('terminals.noResults')
              : t('terminals.empty')}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('terminals.columns.terminal')}</TableHead>
                <TableHead>{t('terminals.columns.venue')}</TableHead>
                <TableHead>{t('terminals.columns.status')}</TableHead>
                <TableHead>{t('terminals.columns.type')}</TableHead>
                <TableHead>{t('terminals.columns.brandModel')}</TableHead>
                <TableHead>{t('terminals.columns.health')}</TableHead>
                <TableHead>{t('terminals.columns.version')}</TableHead>
                <TableHead>{t('terminals.columns.lastSeen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminals.map(terminal => (
                <TableRow key={terminal.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{terminal.name}</p>
                      {terminal.serialNumber && <p className="text-xs text-muted-foreground">{terminal.serialNumber}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{terminal.venue.name}</TableCell>
                  <TableCell>{getStatusBadge(terminal)}</TableCell>
                  <TableCell>{getTypeBadge(terminal.type)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[terminal.brand, terminal.model].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell>{getHealthBadge(terminal.healthScore)}</TableCell>
                  <TableCell className="text-muted-foreground">{terminal.version || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatLastSeen(terminal.lastHeartbeat)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('terminals.pagination.showing', {
              from: (pagination.page - 1) * pagination.pageSize + 1,
              to: Math.min(pagination.page * pagination.pageSize, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
            >
              {t('terminals.pagination.previous')}
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
            >
              {t('terminals.pagination.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrganizationTerminals
