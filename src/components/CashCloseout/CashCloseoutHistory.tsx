import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { History, ChevronLeft, ChevronRight, Building2, Vault, Banknote, ArrowRight } from 'lucide-react'
import { getCloseoutHistory, type CashCloseout, type DepositMethod } from '@/services/cashCloseout.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { cn } from '@/lib/utils'

interface CashCloseoutHistoryProps {
  venueId: string
}

const DEPOSIT_METHOD_ICONS: Record<DepositMethod, React.ReactNode> = {
  BANK_DEPOSIT: <Building2 className="w-3 h-3" />,
  SAFE: <Vault className="w-3 h-3" />,
  OWNER_WITHDRAWAL: <Banknote className="w-3 h-3" />,
  NEXT_SHIFT: <ArrowRight className="w-3 h-3" />,
}

export function CashCloseoutHistory({ venueId }: CashCloseoutHistoryProps) {
  const { t, i18n } = useTranslation('cashCloseout')
  const { formatDate } = useVenueDateTime()
  const localeCode = getIntlLocale(i18n.language)

  const [page, setPage] = useState(1)
  const pageSize = 5

  const { data, isLoading } = useQuery({
    queryKey: ['cash-closeout', 'history', venueId, page, pageSize],
    queryFn: () => getCloseoutHistory(venueId, page, pageSize),
    enabled: !!venueId,
  })

  const closeouts = data?.data || []
  const pagination = data?.pagination

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(localeCode, {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (closeouts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" />
            {t('history.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('history.empty')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5" />
          {t('history.title')}
        </CardTitle>
        <CardDescription>
          {pagination && t('history.showing', {
            count: closeouts.length,
            total: pagination.total,
            defaultValue: `Mostrando ${closeouts.length} de ${pagination.total} cortes`
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('history.columns.date')}</TableHead>
              <TableHead className="text-right">{t('history.columns.expected')}</TableHead>
              <TableHead className="text-right">{t('history.columns.actual')}</TableHead>
              <TableHead className="text-right">{t('history.columns.variance')}</TableHead>
              <TableHead>{t('history.columns.method')}</TableHead>
              <TableHead>{t('history.columns.closedBy')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closeouts.map((closeout) => {
              const variance = Number(closeout.variance)
              const isPositive = variance > 0
              const isNegative = variance < 0

              return (
                <TableRow key={closeout.id}>
                  <TableCell className="font-medium">
                    {formatDate(closeout.createdAt)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(closeout.expectedAmount))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(closeout.actualAmount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'font-mono font-medium',
                        isPositive && 'text-green-600 dark:text-green-400',
                        isNegative && 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrency(variance)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {DEPOSIT_METHOD_ICONS[closeout.depositMethod]}
                      <span className="text-xs">
                        {t(`dialog.depositMethods.${closeout.depositMethod}`)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {closeout.closedBy.firstName} {closeout.closedBy.lastName}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {t('history.page', {
                current: pagination.page,
                total: pagination.totalPages,
                defaultValue: `Página ${pagination.page} de ${pagination.totalPages}`
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
