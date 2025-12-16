import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react'
import { DateTime } from 'luxon'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getCommandHistory } from '@/services/tpv.service'
import {
  TpvCommand,
  TpvCommandStatus,
  TpvCommandResultStatus,
  TpvCommandType,
} from '@/types/tpv-commands'

interface CommandHistoryTableProps {
  terminalId: string
  venueId: string
}

export function CommandHistoryTable({ terminalId, venueId }: CommandHistoryTableProps) {
  const { t, i18n } = useTranslation(['tpv', 'common'])
  const { venueTimezone, formatDateTime } = useVenueDateTime()
  const localeCode = getIntlLocale(i18n.language)

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Fetch command history
  // Toast/Square pattern: Socket.IO invalidation + polling fallback every 10s
  const { data, isLoading, isError } = useQuery({
    queryKey: ['commandHistory', venueId, terminalId, page, pageSize, statusFilter],
    queryFn: () =>
      getCommandHistory(venueId, terminalId, {
        page,
        pageSize,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
    enabled: Boolean(terminalId) && Boolean(venueId),
    refetchInterval: 10000, // Poll every 10 seconds as fallback for Socket.IO
  })

  const commands = useMemo(() => data?.commands || [], [data?.commands])
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  // Get status badge
  const getStatusBadge = (status: TpvCommandStatus, resultStatus?: TpvCommandResultStatus) => {
    // If completed, show result status instead
    if (status === TpvCommandStatus.COMPLETED && resultStatus) {
      switch (resultStatus) {
        case TpvCommandResultStatus.SUCCESS:
          return (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('commands.status.success')}
            </Badge>
          )
        case TpvCommandResultStatus.PARTIAL:
          return (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('commands.status.partial')}
            </Badge>
          )
        case TpvCommandResultStatus.FAILED:
          return (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              {t('commands.status.failed')}
            </Badge>
          )
        case TpvCommandResultStatus.REJECTED:
          return (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              {t('commands.status.rejected')}
            </Badge>
          )
        case TpvCommandResultStatus.TIMEOUT:
          return (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              {t('commands.status.timeout')}
            </Badge>
          )
      }
    }

    // Show execution status
    switch (status) {
      case TpvCommandStatus.PENDING:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {t('commands.status.pending')}
          </Badge>
        )
      case TpvCommandStatus.QUEUED:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {t('commands.status.queued')}
          </Badge>
        )
      case TpvCommandStatus.SENT:
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Send className="h-3 w-3 mr-1" />
            {t('commands.status.sent')}
          </Badge>
        )
      case TpvCommandStatus.RECEIVED:
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('commands.status.received')}
          </Badge>
        )
      case TpvCommandStatus.EXECUTING:
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {t('commands.status.executing')}
          </Badge>
        )
      case TpvCommandStatus.COMPLETED:
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('commands.status.completed')}
          </Badge>
        )
      case TpvCommandStatus.FAILED:
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {t('commands.status.failed')}
          </Badge>
        )
      case TpvCommandStatus.EXPIRED:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {t('commands.status.expired')}
          </Badge>
        )
      case TpvCommandStatus.CANCELLED:
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            {t('commands.status.cancelled')}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Format time ago
  const formatTimeAgo = (date: string) => {
    try {
      return DateTime.fromISO(date, { zone: 'utc' })
        .setZone(venueTimezone)
        .setLocale(localeCode)
        .toRelative()
    } catch {
      return '-'
    }
  }

  // Render command row
  const renderCommandRow = (command: TpvCommand) => (
    <TableRow key={command.id}>
      <TableCell className="font-mono text-xs">
        {command.id.slice(-8)}
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline">
                {t(`commands.types.${command.commandType}`, command.commandType)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t(`commands.descriptions.${command.commandType}`, '')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        {getStatusBadge(command.status, command.resultStatus)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
        {command.resultMessage || '-'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {command.requestedByEmail || t('commands.system')}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              {formatTimeAgo(command.createdAt)}
            </TooltipTrigger>
            <TooltipContent>
              <p>{formatDateTime(command.createdAt)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  )

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">{t('commands.historyError')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {t('commands.history')}
            </CardTitle>
            <CardDescription>
              {t('commands.historyDesc', { total })}
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('commands.filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('commands.allStatuses')}</SelectItem>
              <SelectItem value={TpvCommandStatus.PENDING}>{t('commands.status.pending')}</SelectItem>
              <SelectItem value={TpvCommandStatus.COMPLETED}>{t('commands.status.completed')}</SelectItem>
              <SelectItem value={TpvCommandStatus.FAILED}>{t('commands.status.failed')}</SelectItem>
              <SelectItem value={TpvCommandStatus.EXPIRED}>{t('commands.status.expired')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {commands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-50" />
            <p>{t('commands.noHistory')}</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">{t('commands.table.id')}</TableHead>
                  <TableHead>{t('commands.table.command')}</TableHead>
                  <TableHead>{t('commands.table.status')}</TableHead>
                  <TableHead>{t('commands.table.message')}</TableHead>
                  <TableHead>{t('commands.table.requestedBy')}</TableHead>
                  <TableHead>{t('commands.table.time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.map(renderCommandRow)}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {t('commands.pagination', {
                    start: (page - 1) * pageSize + 1,
                    end: Math.min(page * pageSize, total),
                    total,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
