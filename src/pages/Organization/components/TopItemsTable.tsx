import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Package, TrendingUp } from 'lucide-react'
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
      <Card>
        <CardHeader>
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          <div className="h-4 w-60 bg-muted animate-pulse rounded mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded flex-1" />
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('dashboard.topItems')}
          </CardTitle>
          <CardDescription>{t('dashboard.topItemsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {t('dashboard.noItems')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t('dashboard.topItems')}
        </CardTitle>
        <CardDescription>{t('dashboard.topItemsDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t('dashboard.itemName')}</TableHead>
              <TableHead>{t('dashboard.category')}</TableHead>
              <TableHead className="text-right">{t('dashboard.quantitySold')}</TableHead>
              <TableHead className="text-right">{t('dashboard.totalRevenue')}</TableHead>
              <TableHead className="text-right">{t('dashboard.avgPrice')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.productId}>
                <TableCell className="font-medium">
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
                    <span className="text-muted-foreground">{item.rank}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{item.productName}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.categoryName}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {item.quantitySold.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.totalRevenue)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(item.averagePrice)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
