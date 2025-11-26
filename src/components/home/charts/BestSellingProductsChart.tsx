import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const BestSellingProductsChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  // Process products data for best sellers by category
  const bestSellingProducts = useMemo(() => {
    const productsData = data?.products || []
    if (!productsData) return { FOOD: [], BEVERAGE: [], OTHER: [] }

    const categories: Record<string, any[]> = { FOOD: [], BEVERAGE: [], OTHER: [] }

    productsData.forEach((product: any) => {
      const productType = product.type || 'OTHER'
      if (categories[productType]) {
        const existing = categories[productType].find((p: any) => p.name === product.name)
        if (existing) {
          existing.quantity = Number(existing.quantity) + Number(product.quantity)
        } else {
          categories[productType].push({ ...product })
        }
      } else {
        categories.OTHER.push({ ...product })
      }
    })

    // Sort by quantity and limit top 3
    Object.keys(categories).forEach(type => {
      categories[type].sort((a: any, b: any) => b.quantity - a.quantity)
      categories[type] = categories[type].slice(0, 3)
    })

    return categories
  }, [data?.products])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('sections.bestSellers')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-5">
          {Object.entries(bestSellingProducts).map(([category, products]) => (
            <div key={category} className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">{t(`categories.${String(category)}`)}</h3>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noData')}</p>
              ) : (
                <ul className="space-y-1">
                  {products.map((product: any, idx: number) => (
                    <li key={idx} className="flex justify-between items-center text-sm py-1">
                      <span>{product.name}</span>
                      <span className="font-medium">{product.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
