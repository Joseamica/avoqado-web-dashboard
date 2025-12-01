import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Currency } from '@/utils/currency'

export const TableEfficiencyMetrics = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const tableData = data?.tablePerformance || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('sections.tableEfficiency')}</CardTitle>
        <CardDescription>{t('sections.tableEfficiencyDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!tableData || tableData.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tableData.slice(0, 5).map((table: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">{table.tableNumber}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {t('table', { defaultValue: 'Mesa' })} {table.tableNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {table.orderCount || 0} {t('charts.orders')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{Currency(table.totalRevenue || 0, false)}</p>
                  <p className="text-xs text-muted-foreground">
                    {Currency(table.avgTicket || 0, false)} {t('charts.avg')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
