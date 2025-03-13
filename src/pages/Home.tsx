import React, { useState, useMemo } from 'react'
import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const Home = () => {
  const { venueId } = useParams()
  const [dateRange, setDateRange] = useState('day') // day, week, month

  // Use React Query with caching for better performance
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['all_info', venueId, dateRange],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/all-info?range=${dateRange}`)
      if (!response) {
        throw new Error('Failed to fetch data')
      }
      return response.data
    },
    staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  })

  // Loading states for skeleton display
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
      {/* Header with date range controls */}
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
  // Take only top 3 of each category
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
  // Process tips data for the chart
  const chartData = useMemo(() => {
    // Group tips by date
    const groupedByDate = tips.reduce((acc, tip) => {
      const date = tip.createdAt
      if (!acc[date]) {
        acc[date] = 0
      }
      acc[date] += parseFloat(tip.amount) / 100 // Convert cents to dollars
      return acc
    }, {})

    // Convert to array format for chart
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
            const date = new Date(value)
            return date.getDate() + '/' + (date.getMonth() + 1)
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
