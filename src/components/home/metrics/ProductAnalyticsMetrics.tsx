import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Currency } from '@/utils/currency'

export const ProductAnalyticsMetrics = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const productData = data?.productProfitability || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('sections.productAnalytics')}</CardTitle>
        <CardDescription>{t('sections.productAnalyticsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!productData || productData.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {productData.slice(0, 5).map((product: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.quantity || 0} {t('charts.sold')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{Currency(product.totalRevenue || 0, false)}</p>
                  <p className="text-xs text-muted-foreground">
                    {(product.marginPercentage || 0).toFixed(1)}% {t('charts.margin')}
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
