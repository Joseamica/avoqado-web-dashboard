import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart, Bar, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const Home = () => {
  const { venueId } = useParams()
  const [dateRange, setDateRange] = useState('day') // 'day', 'week', or 'month'

  // Calculate date range as Date objects for easier comparison
  const dateRangeParams = useMemo(() => {
    const now = new Date()
    // End of the current day: today at 23:59:59.999
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    // Start of today at 00:00:00.000
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

    if (dateRange === 'week') {
      // For a 7-day period including today, subtract 6 days
      start.setDate(start.getDate() - 6)
    } else if (dateRange === 'month') {
      // Subtract one month (be cautious with day overflow)
      start.setMonth(start.getMonth() - 1)
    }

    return { startDate: start, endDate: end }
  }, [dateRange])

  // Fetch all info from API
  const {
    data: rawData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['all_info', venueId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/all-info`)
      if (!response) {
        throw new Error('Failed to fetch data')
      }
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Filter the rawData based on the selected date range
  const data = useMemo(() => {
    if (!rawData) return null

    // Copy raw data to result object
    const result = { ...rawData }

    if (rawData.tips) {
      result.tips = rawData.tips.filter(tip => {
        const tipDate = new Date(tip.createdAt)
        return tipDate.getTime() >= dateRangeParams.startDate.getTime() && tipDate.getTime() <= dateRangeParams.endDate.getTime()
      })
    }

    if (rawData.bills) {
      result.bills = rawData.bills.filter(bill => {
        const billDate = new Date(bill.createdAt)
        return billDate.getTime() >= dateRangeParams.startDate.getTime() && billDate.getTime() <= dateRangeParams.endDate.getTime()
      })
    }

    if (rawData.payments) {
      result.payments = rawData.payments.filter(payment => {
        const paymentDate = new Date(payment.createdAt)
        return paymentDate.getTime() >= dateRangeParams.startDate.getTime() && paymentDate.getTime() <= dateRangeParams.endDate.getTime()
      })

      // Recalculate payment stats based on filtered data
      const methodTotals: Record<
        string,
        {
          method: string
          total: number
          count: number
          sum: number
          max_amount: number
        }
      > = {}

      result.payments.forEach(payment => {
        if (!methodTotals[payment.method]) {
          methodTotals[payment.method] = {
            method: payment.method,
            total: 0,
            count: 0,
            sum: 0,
            max_amount: 0,
          }
        }
        const amount = payment.amount / 100
        methodTotals[payment.method].total += amount
        methodTotals[payment.method].count++
        methodTotals[payment.method].sum += amount
        methodTotals[payment.method].max_amount = Math.max(methodTotals[payment.method].max_amount, amount)
      })

      result.payments_stats = Object.values(methodTotals).map(stat => ({
        ...stat,
        average_amount: stat.count > 0 ? stat.sum / stat.count : 0,
      }))
    }

    return result
  }, [rawData, dateRangeParams])

  // Simple loading skeleton component
  const LoadingSkeleton = () => (
    <div className="animate-pulse flex h-full w-full flex-col space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
      <div className="h-24 bg-gray-200 rounded w-full"></div>
    </div>
  )

  // Colors for charts
  const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#673AB7']

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header with date range buttons */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
            <Button size="sm" variant={dateRange === 'day' ? 'default' : 'outline'} onClick={() => setDateRange('day')}>
              Today
            </Button>
            <Button size="sm" variant={dateRange === 'week' ? 'default' : 'outline'} onClick={() => setDateRange('week')}>
              This Week
            </Button>
            <Button size="sm" variant={dateRange === 'month' ? 'default' : 'outline'} onClick={() => setDateRange('month')}>
              This Month
            </Button>
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
              <MetricCard title="Total Earnings" value={isLoading ? null : `$${data?.total_earnings || '0'}`} isLoading={isLoading} />
              <MetricCard title="Google Reviews" value={isLoading ? null : data?.total_google_reviews || '0'} isLoading={isLoading} />
              <MetricCard title="Instagram Access" value={isLoading ? null : data?.total_instagram_access || '0'} isLoading={isLoading} />
              <MetricCard
                title="Avg Tip %"
                value={isLoading ? null : `${(parseFloat(data?.tipPercentage_average || '0') * 100).toFixed(1)}%`}
                isLoading={isLoading}
              />
            </div>

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              {/* Payment methods chart */}
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !data?.payments_stats?.length ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No payment data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.payments_stats}
                          dataKey="total"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={entry => entry.method}
                        >
                          {data.payments_stats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={value => `$${value}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Best selling products */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Best-Selling Products</CardTitle>
                  <CardDescription>Top items by category</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : (
                    <BestSellingProducts
                      bestFood={data?.bestFood || []}
                      bestBeverages={data?.bestBeverages || []}
                      bestOther={data?.bestOther || []}
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
                ) : !data?.tips?.length ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No tip data available</p>
                  </div>
                ) : (
                  <TipsChart tips={data.tips} />
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
const BestSellingProducts = ({ bestFood, bestBeverages, bestOther }) => {
  const limitedFood = bestFood.slice(0, 3)
  const limitedBeverages = bestBeverages.slice(0, 3)
  const limitedOther = bestOther.slice(0, 3)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ProductList title="Food" products={limitedFood} />
      <ProductList title="Beverages" products={limitedBeverages} />
      <ProductList title="Other" products={limitedOther} />
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
  const chartData = useMemo(() => {
    // Group tips by day (using only the date part)
    const groupedByDate = tips.reduce((acc, tip) => {
      const dateObj = new Date(tip.createdAt)
      const dateStr = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`
      if (!acc[dateStr]) {
        acc[dateStr] = 0
      }
      acc[dateStr] += parseFloat(tip.amount) / 100
      return acc
    }, {})

    return Object.entries(groupedByDate)
      .map(([date, amount]) => ({
        date,
        amount: parseFloat((amount as number).toFixed(2)),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [tips])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
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
