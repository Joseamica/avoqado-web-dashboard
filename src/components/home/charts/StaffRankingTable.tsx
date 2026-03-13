import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Currency } from '@/utils/currency'

export const StaffRankingTable = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')

  const sortedStaff = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return []
    return [...data]
      .sort((a: any, b: any) => (b.totalSales || 0) - (a.totalSales || 0))
      .slice(0, 10)
  }, [data])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('staffRanking.title')}</CardTitle>
        <CardDescription>{t('staffRanking.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {sortedStaff.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-input">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground w-8">
                    {t('staffRankingCols.rank')}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                    {t('staffRankingCols.name')}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                    {t('staffRankingCols.role')}
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                    {t('staffRankingCols.sales')}
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                    {t('staffRankingCols.orders')}
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                    {t('staffRankingCols.tips')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStaff.map((staff: any, index: number) => (
                  <tr
                    key={index}
                    className="border-b border-input last:border-b-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">{index + 1}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 font-medium text-foreground">
                      {staff.staffName}
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant="secondary" className="text-xs">
                        {staff.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-foreground tabular-nums">
                      {Currency(staff.totalSales || 0, false)}
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground tabular-nums">
                      {staff.totalOrders || 0}
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground tabular-nums">
                      {Currency(staff.totalTips || 0, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
