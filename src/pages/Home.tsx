import React from 'react'
import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { ChartTooltip, ChartLegend, ChartLegendContent, ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Pie, Cell, BarChart, Bar, XAxis, YAxis, PieChart } from 'recharts'

export default function Home() {
  const { venueId } = useParams()

  // Fetch data using react-query
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['all_info', venueId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/all-info`)
      if (!response) {
        throw new Error('Failed to fetch data')
      }
      return response.data
    },
    retry: false,
  })

  // Handle loading and error states
  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isError) {
    return <div>Error: {error.message}</div>
  }

  // Destructure the data for easier access
  const {
    payments_stats,
    total_google_reviews,
    total_instagram_access,
    total_earnings,
    dailyStats,
    weeklyStats,
    monthlyStats,
    comparison,
    bestFood,
    bestBeverages,
    bestOther,
    bills,
    payments,
    tips,
    tipPercentage_average,
  } = data

  return (
    <div className="flex flex-col">
      {/* Navigation Bar */}
      {/* Add your navigation bar here if needed */}

      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            {/* Add a date picker or other controls if needed */}
            <Button>Download</Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {/* Add other tabs if needed */}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Metric Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Earnings Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                  {/* Add an icon here if desired */}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${total_earnings || '0'}</div>
                  {/* Include comparison data if available */}
                  {/* <p className="text-xs text-muted-foreground">+20% from last month</p> */}
                </CardContent>
              </Card>

              {/* Google Reviews Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Google Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{total_google_reviews}</div>
                </CardContent>
              </Card>

              {/* Instagram Access Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Instagram Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{total_instagram_access}</div>
                </CardContent>
              </Card>

              {/* Average Tip Percentage Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Avg Tip %</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(parseFloat(tipPercentage_average || '0') * 100).toFixed(2)}%</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Other Components */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Payment Methods Chart */}
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <PaymentMethodsChart paymentsStats={payments_stats} />
                </CardContent>
              </Card>

              {/* Best-Selling Products */}
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Best-Selling Products</CardTitle>
                  <CardDescription>Your top-selling items.</CardDescription>
                </CardHeader>
                <CardContent>
                  <BestSellingProducts bestFood={bestFood} bestBeverages={bestBeverages} bestOther={bestOther} />
                </CardContent>
              </Card>

              {/* Tips Over Time Chart */}
              <Card className="col-span-7">
                <CardHeader>
                  <CardTitle>Tips Over Time</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <TipsOverTimeChart tips={tips} />
                </CardContent>
              </Card>

              {/* Add more cards/components as needed */}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function PaymentMethodsChart({ paymentsStats }) {
  const data = paymentsStats.map(item => ({
    name: item.method,
    value: item.total,
  }))

  const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0']

  const config = paymentsStats.reduce((acc, item, index) => {
    acc[item.method] = {
      label: item.method,
      color: COLORS[index % COLORS.length],
    }
    return acc
  }, {})

  if (!data.length) {
    return <p>No payment data available.</p>
  }

  return (
    <ChartContainer config={config}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={`var(--color-${entry.name})`} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  )
}

function TipsOverTimeChart({ tips }) {
  // Group tips by date
  const tipsByDate = tips.reduce((acc, tip) => {
    acc[tip.createdAt] = (acc[tip.createdAt] || 0) + parseFloat(tip.amount)
    return acc
  }, {})

  const data = Object.keys(tipsByDate).map(date => ({
    date,
    amount: tipsByDate[date] / 100, // Convert to dollars
  }))

  const config = {
    amount: { label: 'Tips', color: '#FF9800' },
  }

  if (!data.length) {
    return <p>No tip data available.</p>
  }

  return (
    <ChartContainer config={config}>
      <BarChart data={data}>
        <XAxis dataKey="date" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="amount" fill="var(--color-amount)" />
      </BarChart>
    </ChartContainer>
  )
}

function BestSellingProducts({ bestFood, bestBeverages, bestOther }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ProductList title="Food" products={bestFood} />
      <ProductList title="Beverages" products={bestBeverages} />
      <ProductList title="Other" products={bestOther} />
    </div>
  )
}

function ProductList({ title, products }) {
  return (
    <div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      {products && products.length > 0 ? (
        <ul className="space-y-1">
          {products.map(product => (
            <li key={product.name} className="flex justify-between">
              <span>{product.name}</span>
              <span>{product.quantity} sold</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No data available.</p>
      )}
    </div>
  )
}
