import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Building2, DollarSign, Users, AlertTriangle, CheckCircle, Clock, Zap, BarChart3 } from 'lucide-react'
import { Currency } from '@/utils/currency'

// Mock data - replace with real API calls
const mockDashboardData = {
  kpis: {
    totalRevenue: 2450000,
    monthlyRecurringRevenue: 485000,
    totalVenues: 2847,
    activeVenues: 2654,
    totalUsers: 18943,
    averageRevenuePerUser: 129.45,
    churnRate: 2.3,
    growthRate: 12.8,
    systemUptime: 99.97,
  },
  revenueMetrics: {
    totalPlatformRevenue: 2450000,
    totalCommissionRevenue: 367500,
    subscriptionRevenue: 1950000,
    featureRevenue: 500000,
    transactionCount: 892456,
    newVenues: 47,
    churnedVenues: 8,
  },
  recentActivity: [
    { id: '1', type: 'venue_approved', description: 'New venue "La Taquería" approved', venueName: 'La Taquería', timestamp: '2 mins ago' },
    { id: '2', type: 'payment_received', description: 'Payment received from Premium Plan', amount: 299, timestamp: '5 mins ago' },
    {
      id: '3',
      type: 'feature_enabled',
      description: 'AI Chatbot enabled for "Bistro Central"',
      venueName: 'Bistro Central',
      timestamp: '12 mins ago',
    },
    { id: '4', type: 'venue_suspended', description: 'Venue suspended due to policy violation', timestamp: '1 hour ago' },
  ],
  alerts: [
    { id: '1', type: 'warning', title: 'High Churn Alert', message: '5 venues cancelled this week', isRead: false },
    { id: '2', type: 'error', title: 'Payment Failed', message: '3 venues have failed payments', isRead: false },
    { id: '3', type: 'info', title: 'System Maintenance', message: 'Scheduled maintenance tomorrow 2-4 AM', isRead: true },
  ],
  topVenues: [
    { name: 'Restaurante El Patrón', revenue: 45000, commission: 6750, growth: 12.5 },
    { name: 'Sushi Zen', revenue: 38500, commission: 5775, growth: 8.3 },
    { name: 'Pizza Corner', revenue: 32000, commission: 4800, growth: -2.1 },
    { name: 'Café Bistro', revenue: 28750, commission: 4312, growth: 15.2 },
  ],
}

const SuperadminDashboard: React.FC = () => {
  const { kpis, revenueMetrics, recentActivity, alerts, topVenues } = mockDashboardData

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Overview</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage the entire Avoqado ecosystem</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            All Systems Operational
          </Badge>
          <Button>Generate Report</Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(kpis.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1 text-green-500" />+{kpis.growthRate}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(kpis.monthlyRecurringRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1 text-green-500" />
              +8.2% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Venues</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.activeVenues.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{kpis.totalVenues.toLocaleString()} total venues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.churnRate}%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 inline mr-1 text-green-500" />
              -0.5% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
            <CardDescription>Platform revenue by source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Subscription Revenue</span>
                </div>
                <span className="font-medium">{Currency(revenueMetrics.subscriptionRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Feature Revenue</span>
                </div>
                <span className="font-medium">{Currency(revenueMetrics.featureRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm">Commission Revenue</span>
                </div>
                <span className="font-medium">{Currency(revenueMetrics.totalCommissionRevenue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Platform performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">System Uptime</span>
                  <span className="text-sm font-medium">{kpis.systemUptime}%</span>
                </div>
                <Progress value={kpis.systemUptime} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{revenueMetrics.transactionCount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{kpis.totalUsers.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Total Users</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      activity.type === 'venue_approved'
                        ? 'bg-green-500'
                        : activity.type === 'payment_received'
                        ? 'bg-blue-500'
                        : activity.type === 'feature_enabled'
                        ? 'bg-purple-500'
                        : 'bg-red-500'
                    }`}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                  {activity.amount && <span className="text-sm font-medium text-green-600">+{Currency(activity.amount)}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts & Notifications</CardTitle>
            <CardDescription>Important system alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg ${
                    alert.type === 'error'
                      ? 'bg-red-50 dark:bg-red-500/10'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-500/10'
                      : 'bg-blue-50 dark:bg-blue-500/10'
                  }`}
                >
                  {alert.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />}
                  {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                  {alert.type === 'info' && <Clock className="w-4 h-4 text-blue-500 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-gray-600">{alert.message}</p>
                  </div>
                  {!alert.isRead && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Venues */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Venues</CardTitle>
          <CardDescription>Highest revenue generating venues this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topVenues.map((venue, index) => (
              <div key={venue.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{venue.name}</p>
                    <p className="text-sm text-gray-500">Revenue: {Currency(venue.revenue)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">Commission: {Currency(venue.commission)}</p>
                  <p className={`text-sm ${venue.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {venue.growth >= 0 ? '+' : ''}
                    {venue.growth}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SuperadminDashboard
