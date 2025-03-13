import api from '@/api'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart, Bar, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Traducciones para métodos de pago
const paymentMethodTranslations = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

// Traducciones para categorías de productos
const categoryTranslations = {
  FOOD: 'Comida',
  BEVERAGE: 'Bebida',
  OTHER: 'Otros',
}

const Home = () => {
  const { venueId } = useParams()

  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date } | null>({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  })

  // Fetch all info from API with date range parameters
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['general_stats', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/general-stats`)

      if (!response) {
        throw new Error('Failed to fetch data')
      }
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Simple loading skeleton component
  const LoadingSkeleton = () => (
    <div className="animate-pulse flex h-full w-full flex-col space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
      <div className="h-24 bg-gray-200 rounded w-full"></div>
    </div>
  )

  const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#673AB7']

  // Use useMemo for filteredPayments

  // Use useMemo for filteredReviews
  const filteredReviews = useMemo(() => {
    if (!selectedRange || !data?.feedbacks) return []

    return data.feedbacks.filter(review => {
      const reviewDate = new Date(review.createdAt)
      return reviewDate >= selectedRange.from && reviewDate <= selectedRange.to
    })
  }, [selectedRange, data?.feedbacks])

  const fiveStarReviews = useMemo(() => {
    return filteredReviews.filter(review => review.stars === 5).length
  }, [filteredReviews])
  // NOTE - use later
  // const review = filteredReviews?.length > 0 ? filteredReviews.reduce((sum, review) => sum + review.stars, 0) : 0
  // const totalReviews = filteredReviews?.length > 0 ? review : 'N/A'

  // Calculate tip-related metrics from filtered payments
  // Use useMemo for filteredPayments
  const filteredPayments = useMemo(() => {
    if (!selectedRange || !data?.payments) return []

    return data.payments.filter(payment => {
      const paymentDate = new Date(payment.createdAt)
      return paymentDate >= selectedRange.from && paymentDate <= selectedRange.to
    })
  }, [selectedRange, data?.payments])
  // Use useMemo for amount calculation (it's a good practice)
  const amount = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }, [filteredPayments])

  // This doesn't need useMemo as it's just a simple conditional
  const totalAmount = filteredPayments.length > 0 ? amount : 0

  // Use useMemo for fiveStarReviews calculation

  // Calculate tip-related metrics from filtered payments
  const tipStats = useMemo(() => {
    if (!filteredPayments?.length) return { totalTips: 0, avgTipPercentage: 0 }

    // Filter payments that have at least one tip
    const paymentsWithTips = filteredPayments.filter(payment => payment.tips && payment.tips.length > 0)

    // Calculate total tips by summing up all tips
    const totalTips = paymentsWithTips.reduce((sum, payment) => {
      const tipsSum = payment.tips.reduce((tipSum, tip) => tipSum + Number(tip.amount), 0)
      return sum + tipsSum
    }, 0)

    // Calculate average tip percentage
    let avgTipPercentage = 0
    if (paymentsWithTips.length > 0) {
      const tipPercentages = paymentsWithTips.map(payment => {
        const paymentAmount = Number(payment.amount)
        const tipsTotal = payment.tips.reduce((tipSum, tip) => tipSum + Number(tip.amount), 0)
        // Calculate percentage only if payment amount is greater than 0
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum, percentage) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: avgTipPercentage.toFixed(1),
    }
  }, [filteredPayments])

  // Payment Methods Chart (Filtered)
  const paymentMethodsData = useMemo(() => {
    const methodTotals: Record<string, number> = {}

    filteredPayments.forEach(payment => {
      const method = paymentMethodTranslations[payment.method] || 'Otro'
      methodTotals[method] = (methodTotals[method] || 0) + Number(payment.amount)
    })

    return Object.entries(methodTotals).map(([method, total]) => ({ method, total }))
  }, [filteredPayments])

  // Best Selling Products (Filtered)
  const bestSellingProducts = useMemo(() => {
    if (!selectedRange || !data?.products) return { FOOD: [], BEVERAGE: [], OTHER: [] }

    const filteredProducts = data.products.filter(product => {
      const productDate = new Date(product.createdAt)
      return productDate >= selectedRange.from && productDate <= selectedRange.to
    })

    const categories = { FOOD: [], BEVERAGE: [], OTHER: [] }

    filteredProducts.forEach(product => {
      if (categories[product.type]) {
        const existing = categories[product.type].find(p => p.name === product.name)
        if (existing) {
          existing.quantity += product.quantity
        } else {
          categories[product.type].push({ ...product })
        }
      }
    })

    // Sort by quantity and limit top 3
    Object.keys(categories).forEach(type => {
      categories[type].sort((a, b) => b.quantity - a.quantity)
      categories[type] = categories[type].slice(0, 3)
    })

    return categories
  }, [selectedRange, data?.products])

  // Tips Over Time Chart (Filtered)
  const tipsChartData = useMemo(() => {
    const tipsByDate: Record<string, number> = {}

    filteredPayments.forEach(payment => {
      payment.tips?.forEach(tip => {
        const dateStr = payment.createdAt.split('T')[0]
        tipsByDate[dateStr] = (tipsByDate[dateStr] || 0) + Number(tip.amount)
      })
    })

    return Object.entries(tipsByDate)
      .map(([date, amount]) => ({ date, amount: Number((amount / 100).toFixed(2)) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [filteredPayments])
  console.log('LOG: bestSellingProducts', bestSellingProducts)
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header with date range buttons */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
            <DateRangePicker
              showCompare={false}
              onUpdate={({ range }) => {
                setSelectedRange(range)
              }}
              align="start"
              locale="es-ES"
            />
            <Button size="sm" variant="outline">
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {isError ? (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-red-600">Failed to load dashboard data</h2>
              <p className="text-gray-500">{error?.message || 'An unknown error occurred'}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Key metrics cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Ventas" value={isLoading ? null : Currency(totalAmount)} isLoading={isLoading} />
              <MetricCard title="5 Estrellas Google" value={isLoading ? null : fiveStarReviews} isLoading={isLoading} />
              {/* <MetricCard title="Instagram Access" value={isLoading ? null : data?.total_instagram_access || '0'} isLoading={isLoading} /> */}
              <MetricCard title="Total Propinas" value={isLoading ? null : Currency(tipStats.totalTips)} isLoading={isLoading} />
              <MetricCard title="Promedio Propinas %" value={isLoading ? null : `${tipStats.avgTipPercentage}%`} isLoading={isLoading} />
            </div>

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              {/* Payment methods chart */}
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Metodos de pago</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !paymentMethodsData ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No payment data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethodsData}
                          dataKey="total"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={entry => entry.method}
                        >
                          {paymentMethodsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={value => `${Currency(value as number)}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Best selling products */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Productos mejores vendidos</CardTitle>
                  <CardDescription>Artículos más vendidos por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : (
                    <BestSellingProducts
                      bestFood={bestSellingProducts.FOOD}
                      bestBeverages={bestSellingProducts.BEVERAGE}
                      bestOther={bestSellingProducts.OTHER}
                      translations={categoryTranslations}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tips over time chart */}
            <Card>
              <CardHeader>
                <CardTitle>Tips Over Time</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : !tipsChartData ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No tip data available</p>
                  </div>
                ) : (
                  <TipsChart tips={tipsChartData} />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

// Metric Card Component
const MetricCard = ({ title, value, isLoading }) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 bg-gray-200 rounded-md w-20 animate-pulse"></div>
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

// Best Selling Products Component
// Best Selling Products Component
const BestSellingProducts = ({ bestFood, bestBeverages, bestOther, translations }) => {
  const limitedFood = bestFood.slice(0, 3)
  const limitedBeverages = bestBeverages.slice(0, 3)
  const limitedOther = bestOther.slice(0, 3)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ProductList title={translations.FOOD} products={limitedFood} />
      <ProductList title={translations.BEVERAGE} products={limitedBeverages} />
      <ProductList title={translations.OTHER} products={limitedOther} />
    </div>
  )
}
// Product List Component
const ProductList = ({ title, products }) => {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      {products.length > 0 ? (
        <ul className="space-y-2">
          {products.map((product, index) => (
            <li key={index} className="flex justify-between text-sm">
              <span className="truncate mr-2">{product.name}</span>
              <span className="font-medium">{product.quantity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No data available</p>
      )}
    </div>
  )
}

// Tips Chart Component
const TipsChart = ({ tips }) => {
  console.log(tips)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={tips}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
          tickFormatter={value => {
            const parts = value.split('-')
            return parts[2] + '/' + parts[1]
          }}
        />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={value => `$${value}`} />
        <Tooltip formatter={value => [`$${value}`, 'Tips']} labelFormatter={label => `Date: ${label}`} />
        <Bar dataKey="amount" fill="#FF9800" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default Home
