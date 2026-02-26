import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp } from 'lucide-react'
import type { TopItem } from '@/services/organization.service'

interface TopItemsTableProps {
  items: TopItem[] | undefined
  isLoading?: boolean
  formatCurrency: (amount: number) => string
}

export function TopItemsTable({ items, isLoading, formatCurrency }: TopItemsTableProps) {
  const { t } = useTranslation('organization')

  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <Skeleton className="h-5 w-44 mb-1" />
        <Skeleton className="h-4 w-64 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="p-5 pb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {t('dashboard.topItems')}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.topItemsDesc')}</p>
      </div>

      {!items || items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {t('dashboard.noItems')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-5">#</TableHead>
              <TableHead>{t('dashboard.itemName')}</TableHead>
              <TableHead>{t('dashboard.category')}</TableHead>
              <TableHead className="text-right">{t('dashboard.quantitySold')}</TableHead>
              <TableHead className="text-right">{t('dashboard.totalRevenue')}</TableHead>
              <TableHead className="text-right pr-5">{t('dashboard.avgPrice')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.productId}>
                <TableCell className="pl-5">
                  {item.rank <= 3 ? (
                    <Badge
                      variant={item.rank === 1 ? 'default' : 'secondary'}
                      className={
                        item.rank === 1
                          ? 'bg-yellow-500 text-yellow-950'
                          : item.rank === 2
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-amber-600 text-amber-50'
                      }
                    >
                      {item.rank}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">{item.rank}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {item.categoryName}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {item.quantitySold.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  {formatCurrency(item.totalRevenue)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground pr-5">
                  {formatCurrency(item.averagePrice)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </GlassCard>
  )
}
