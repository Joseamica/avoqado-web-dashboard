import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Currency } from '@/utils/currency'

export const StaffEfficiencyMetrics = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const staffData = data?.staffPerformance || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('sections.staffEfficiency')}</CardTitle>
        <CardDescription>{t('sections.staffEfficiencyDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!staffData || staffData.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staffData.slice(0, 5).map((staff: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{staff.name}</p>
                    <p className="text-sm text-muted-foreground">{staff.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{Currency(staff.totalSales || 0, false)}</p>
                  <p className="text-xs text-muted-foreground">
                    {staff.orderCount || 0} {t('charts.orders')}
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
