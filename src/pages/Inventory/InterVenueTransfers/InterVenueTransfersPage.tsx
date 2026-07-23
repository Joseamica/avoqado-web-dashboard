import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleAlert, Loader2, Plus, Search, Warehouse } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionGate } from '@/components/PermissionGate'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useVenueDateTime } from '@/utils/datetime'
import {
  interVenueTransferService,
  type InterVenueTransferListItem,
  type InterVenueTransferStatus,
} from '@/services/interVenueTransfer.service'
import { CreateTransferDialog } from './CreateTransferDialog'

const statuses: InterVenueTransferStatus[] = [
  'REQUESTED',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'COMPLETED_WITH_VARIANCE',
  'REJECTED',
  'CANCELLED',
]

function statusVariant(status: InterVenueTransferStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'REJECTED' || status === 'CANCELLED') return 'destructive'
  if (status === 'COMPLETED' || status === 'COMPLETED_WITH_VARIANCE') return 'default'
  if (status === 'REQUESTED' || status === 'APPROVED') return 'secondary'
  return 'outline'
}

export default function InterVenueTransfersPage() {
  const { t, i18n } = useTranslation('inventory')
  const navigate = useNavigate()
  const { venueId, fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const { formatDateTime } = useVenueDateTime()
  const [tab, setTab] = useState('transfers')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | InterVenueTransferStatus>('all')
  const [direction, setDirection] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [requiresAction, setRequiresAction] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const transfersQuery = useQuery({
    queryKey: ['inter-venue-transfers', venueId, status, direction, debouncedSearch],
    queryFn: () =>
      interVenueTransferService.list(venueId!, {
        status: status === 'all' ? undefined : status,
        direction: direction === 'all' ? undefined : direction,
        search: debouncedSearch || undefined,
        pageSize: 100,
      }),
    enabled: !!venueId && tab === 'transfers',
  })

  const consolidatedQuery = useQuery({
    queryKey: ['inter-venue-transfers', 'consolidated', venueId, debouncedSearch],
    queryFn: () => interVenueTransferService.consolidated(venueId!, debouncedSearch),
    enabled: !!venueId && tab === 'consolidated',
  })

  const transfers = useMemo(() => transfersQuery.data?.items ?? [], [transfersQuery.data?.items])
  const actionableTransfers = useMemo(() => {
    if (!requiresAction) return transfers
    return transfers.filter(transfer => {
      if (transfer.sourceVenueId === venueId) {
        if (transfer.status === 'REQUESTED') return can('inventory-transfers:approve')
        if (transfer.status === 'APPROVED') return can('inventory-transfers:dispatch')
      }
      return (
        transfer.destinationVenueId === venueId &&
        (transfer.status === 'IN_TRANSIT' || transfer.status === 'PARTIALLY_RECEIVED') &&
        can('inventory-transfers:receive')
      )
    })
  }, [can, requiresAction, transfers, venueId])

  const consolidatedRows = useMemo(() => {
    const venues = consolidatedQuery.data?.venues ?? []
    return venues
      .flatMap(venue =>
        venue.rawMaterials.map(material => ({
          venueId: venue.id,
          venueName: venue.name,
          ...material,
          availableStock: Number(material.currentStock) - Number(material.reservedStock),
        })),
      )
      .sort((left, right) =>
        left.venueName.localeCompare(right.venueName, i18n.language) || left.name.localeCompare(right.name, i18n.language),
      )
  }, [consolidatedQuery.data?.venues, i18n.language])

  const openDetail = useCallback(
    (transfer: InterVenueTransferListItem) => navigate(`${fullBasePath}/inventory/inter-venue-transfers/${transfer.id}`),
    [fullBasePath, navigate],
  )

  const number = useMemo(() => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }), [i18n.language])
  const loading = tab === 'transfers' ? transfersQuery.isLoading : consolidatedQuery.isLoading
  const error = tab === 'transfers' ? transfersQuery.isError : consolidatedQuery.isError

  return (
    <FeatureGate feature="INVENTORY_TRACKING">
      <div className="space-y-6" data-tour="inter-venue-transfers-page">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('interVenueTransfers.title')}</h1>
            <p className="text-muted-foreground">{t('interVenueTransfers.subtitle')}</p>
          </div>
          <PermissionGate permission="inventory-transfers:request">
            <Button onClick={() => setCreateOpen(true)} data-tour="inter-venue-transfer-create">
              <Plus className="mr-2 h-4 w-4" />
              {t('interVenueTransfers.create')}
            </Button>
          </PermissionGate>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-full" data-tour="inter-venue-transfer-tabs">
            <TabsTrigger value="transfers" className="rounded-full">{t('interVenueTransfers.tabs.transfers')}</TabsTrigger>
            <TabsTrigger value="consolidated" className="rounded-full">{t('interVenueTransfers.tabs.consolidated')}</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={t('interVenueTransfers.filters.search')}
                className="pl-9"
                data-tour="inter-venue-transfer-search"
              />
            </div>
            {tab === 'transfers' && (
              <>
                <Select value={status} onValueChange={value => setStatus(value as typeof status)}>
                  <SelectTrigger className="w-full lg:w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('interVenueTransfers.filters.allStatuses')}</SelectItem>
                    {statuses.map(value => <SelectItem key={value} value={value}>{t(`interVenueTransfers.statuses.${value}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={direction} onValueChange={value => setDirection(value as typeof direction)}>
                  <SelectTrigger className="w-full lg:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('interVenueTransfers.filters.allDirections')}</SelectItem>
                    <SelectItem value="incoming">{t('interVenueTransfers.filters.incoming')}</SelectItem>
                    <SelectItem value="outgoing">{t('interVenueTransfers.filters.outgoing')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={requiresAction ? 'default' : 'outline'}
                  onClick={() => setRequiresAction(current => !current)}
                  data-tour="inter-venue-transfer-action-filter"
                >
                  <CircleAlert className="mr-2 h-4 w-4" />
                  {t('interVenueTransfers.filters.requiresAction')}
                </Button>
              </>
            )}
          </div>

          {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{t('interVenueTransfers.messages.loadError')}</AlertDescription></Alert>}
          {loading && <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

          <TabsContent value="transfers" className="mt-4">
            {!loading && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('interVenueTransfers.columns.date')}</TableHead>
                        <TableHead>{t('interVenueTransfers.columns.number')}</TableHead>
                        <TableHead>{t('interVenueTransfers.columns.route')}</TableHead>
                        <TableHead>{t('interVenueTransfers.columns.mode')}</TableHead>
                        <TableHead>{t('interVenueTransfers.columns.items')}</TableHead>
                        <TableHead>{t('interVenueTransfers.columns.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actionableTransfers.map(transfer => (
                        <TableRow key={transfer.id} className="cursor-pointer" onClick={() => openDetail(transfer)} tabIndex={0}>
                          <TableCell>{formatDateTime(transfer.createdAt)}</TableCell>
                          <TableCell className="font-medium">{transfer.number}</TableCell>
                          <TableCell>
                            <div className="flex min-w-52 items-center gap-2">
                              <span>{transfer.sourceVenue.name}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{transfer.destinationVenue.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{t(`interVenueTransfers.modes.${transfer.mode}`)}</TableCell>
                          <TableCell>{transfer._count.items}</TableCell>
                          <TableCell><Badge variant={statusVariant(transfer.status)}>{t(`interVenueTransfers.statuses.${transfer.status}`)}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {actionableTransfers.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="h-40 text-center text-muted-foreground">{t('interVenueTransfers.empty')}</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="consolidated" className="mt-4">
            {!loading && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('interVenueTransfers.consolidated.venue')}</TableHead>
                        <TableHead>{t('interVenueTransfers.consolidated.material')}</TableHead>
                        <TableHead>{t('interVenueTransfers.consolidated.sku')}</TableHead>
                        <TableHead>{t('interVenueTransfers.consolidated.currentStock')}</TableHead>
                        <TableHead>{t('interVenueTransfers.consolidated.availableStock')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consolidatedRows.map(row => (
                        <TableRow key={`${row.venueId}:${row.id}`}>
                          <TableCell>{row.venueName}</TableCell>
                          <TableCell className="font-medium">{row.name}<span className="ml-2 text-xs text-muted-foreground">{row.unit}</span></TableCell>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell>{number.format(Number(row.currentStock))}</TableCell>
                          <TableCell className="font-semibold">{number.format(row.availableStock)}</TableCell>
                        </TableRow>
                      ))}
                      {consolidatedRows.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground"><Warehouse className="mx-auto mb-2 h-6 w-6" />{t('interVenueTransfers.consolidated.empty')}</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <CreateTransferDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={transfer => navigate(`${fullBasePath}/inventory/inter-venue-transfers/${transfer.id}`)}
        />
      </div>
    </FeatureGate>
  )
}
