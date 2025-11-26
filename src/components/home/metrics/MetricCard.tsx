import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const MetricCard = ({
  title,
  value,
  isLoading,
  icon,
  percentage = null,
  comparisonLabel = '',
  isPercentageLoading = false,
}: {
  title: string
  value: string | number | null
  isLoading: boolean
  icon: React.ReactNode
  percentage?: number | null
  comparisonLabel?: string
  isPercentageLoading?: boolean
}) => {
  const { t } = useTranslation('home')
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-7 w-20 bg-muted rounded animate-pulse"></div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">{value || 0}</div>
            {isPercentageLoading ? (
              <div className="h-4 w-24 bg-muted rounded animate-pulse mt-1"></div>
            ) : (
              percentage !== null && (
                <div
                  className={`text-xs flex items-center ${
                    percentage > 0
                      ? 'text-green-600 dark:text-green-400'
                      : percentage < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {percentage > 0 ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span>
                        {percentage}% vs {comparisonLabel}
                      </span>
                    </>
                  ) : percentage < 0 ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>
                        {Math.abs(percentage)}% vs {comparisonLabel}
                      </span>
                    </>
                  ) : (
                    <span>
                      {t('noChange', { defaultValue: 'Sin cambios' })} vs {comparisonLabel}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
