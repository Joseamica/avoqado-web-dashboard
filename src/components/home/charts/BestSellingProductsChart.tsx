import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardPack } from '@/hooks/use-dashboard-pack'
import { agregarMasVendidos } from './bestSellingAggregate'

export const BestSellingProductsChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const { category } = useDashboardPack()
  // Retail products don't carry FOOD/BEVERAGE type — render a flat top-N list
  // instead of empty Comida/Bebida buckets.
  const isFlat = category === 'RETAIL'

  // Por tipo (comida / bebida / otros) y, en retail, lista plana; las variantes de una familia se juntan en una sola barra
  const bestSellingProducts = useMemo(
    () => (isFlat ? null : agregarMasVendidos(data?.products, 'porTipo')),
    [data?.products, isFlat],
  )
  const flatBestSellers = useMemo(
    () => (isFlat ? agregarMasVendidos(data?.products, 'plano') : []),
    [data?.products, isFlat],
  )

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('sections.bestSellers')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isFlat ? (
          flatBestSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noData')}</p>
          ) : (
            <ul className="space-y-1">
              {flatBestSellers.map((product, idx) => (
                <li key={idx} className="flex justify-between items-center text-sm py-1">
                  <span>{product.name}</span>
                  <span className="font-medium">{Number(product.quantity).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-5">
            {Object.entries(bestSellingProducts ?? {}).map(([cat, products]) => (
              <div key={cat} className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">{t(`categories.${String(cat)}`)}</h3>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noData')}</p>
                ) : (
                  <ul className="space-y-1">
                    {products.map((product: any, idx: number) => (
                      <li key={idx} className="flex justify-between items-center text-sm py-1">
                        <span>{product.name}</span>
                        <span className="font-medium">{Number(product.quantity).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
