import api from '@/api'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DollarSign, Download, Gift, Loader2, Percent, Star, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Label, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import { themeClasses } from '@/lib/theme-utils'
import { useSocketEvents } from '@/hooks/use-socket-events'

// Translations for payment methods
const PAYMENT_METHOD_TRANSLATIONS = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  AMEX: 'Amex',
  OTHER: 'Otro',
}

// Translations for product categories
const CATEGORY_TRANSLATIONS = {
  FOOD: 'Comida',
  BEVERAGE: 'Bebida',
  OTHER: 'Otros',
}

// Enhanced color palette for charts
const CHART_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

// Simple icon components
const DollarIcon = () => <DollarSign className="h-5 w-5 text-blue-500" />
const StarIcon = () => <Star className="h-5 w-5 text-yellow-500" />
const TipIcon = () => <Gift className="h-5 w-5 text-green-500" />
const PercentIcon = () => <Percent className="h-5 w-5 text-purple-500" />

// Type for comparison period
type ComparisonPeriod = 'day' | 'week' | 'month' | 'custom' | ''

// Type for table performance data
interface TablePerformance {
  tableId: string
  tableNumber: number
  capacity: number
  avgTicket: number
  rotationRate: number
  totalRevenue: number
}

// Type for staff performance data
interface StaffPerformance {
  staffId: string
  name: string
  role: string
  totalSales: number
  totalTips: number
  orderCount: number
  avgPrepTime: number
}

// Type for product profitability data
interface ProductProfitability {
  name: string
  type: string
  price: number
  cost: number
  margin: number
  marginPercentage: number
  quantity: number
  totalRevenue: number
}

// Type for peak hours data
interface PeakHoursData {
  hour: number
  sales: number
  transactions: number
}

// Type for weekly trends data
interface WeeklyTrendsData {
  day: string
  currentWeek: number
  previousWeek: number
  changePercentage: number
}

// Type for extra metrics
interface ExtraMetrics {
  tablePerformance: TablePerformance[]
  staffPerformanceMetrics: StaffPerformance[]
  productProfitability: ProductProfitability[]
  peakHoursData: PeakHoursData[]
  weeklyTrendsData: WeeklyTrendsData[]
  prepTimesByCategory: {
    entradas: { avg: number; target: number }
    principales: { avg: number; target: number }
    postres: { avg: number; target: number }
    bebidas: { avg: number; target: number }
  }
}

// Metric card component
const MetricCard = ({
  title,
  value,
  isLoading,
  icon,
  percentage = null,
  comparisonLabel = 'período anterior',
}: {
  title: string
  value: string | number | null
  isLoading: boolean
  icon: React.ReactNode
  percentage?: number | null
  comparisonLabel?: string
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className={`h-7 w-20 ${themeClasses.neutral.bg} rounded animate-pulse`}></div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold">{value || 0}</div>
            {percentage !== null && (
              <div
                className={`text-xs flex items-center ${
                  percentage > 0 ? 'text-green-600' : percentage < 0 ? 'text-red-600' : themeClasses.textMuted
                }`}
              >
                {percentage > 0 ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    <span>
                      {percentage}% vs {comparisonLabel}
                    </span>
                  </>
                ) : percentage < 0 ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span>
                      {Math.abs(percentage)}% vs {comparisonLabel}
                    </span>
                  </>
                ) : (
                  <span>Sin cambios vs {comparisonLabel}</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simple loading skeleton component
const LoadingSkeleton = () => (
  <div className="animate-pulse flex h-full w-full flex-col space-y-4">
    <div className={`h-6 ${themeClasses.neutral.bg} rounded w-1/2`}></div>
    <div className={`h-24 ${themeClasses.neutral.bg} rounded w-full`}></div>
  </div>
)

const Home = () => {
  const { venueId } = useParams()
  const { isDark } = useTheme()
  const [exportLoading, setExportLoading] = useState(false)
  const [compareType, setCompareType] = useState<ComparisonPeriod>('')
  const [comparisonLabel, setComparisonLabel] = useState('período anterior')

  // Define ranges as objects containing date objects
  const [selectedRange, setSelectedRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000), // last 7 days
    to: new Date(new Date().setHours(23, 59, 59, 999)), // today
  })

  const [compareRange, setCompareRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 14 * 24 * 60 * 60 * 1000), // previous 7 days
    to: new Date(new Date(new Date().setHours(0, 0, 0, 0) - 8 * 24 * 60 * 60 * 1000).getTime() - 1), // day before the selectedRange starts
  })

  const [activeFilter, setActiveFilter] = useState('7days') // default '7days'

  // Handler for "Today" filter
  const handleToday = () => {
    const today = new Date()
    const todayStart = new Date(today.setHours(0, 0, 0, 0))
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999))

    // Yesterday (comparison)
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const yesterdayEnd = new Date(yesterdayStart)
    yesterdayEnd.setHours(23, 59, 59, 999)

    setSelectedRange({ from: todayStart, to: todayEnd })
    setCompareRange({ from: yesterdayStart, to: yesterdayEnd })
    setCompareType('day')
    setComparisonLabel('ayer')
    setActiveFilter('today')
  }

  // Handler for "Last 7 days" filter
  const handleLast7Days = () => {
    const today = new Date()
    const end = new Date(today.setHours(23, 59, 59, 999))
    const start = new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000)

    // Previous 7 days (comparison)
    const compareEnd = new Date(start)
    compareEnd.setMilliseconds(compareEnd.getMilliseconds() - 1)
    const compareStart = new Date(compareEnd)
    compareStart.setDate(compareStart.getDate() - 7)
    compareStart.setHours(0, 0, 0, 0)

    setSelectedRange({ from: start, to: end })
    setCompareRange({ from: compareStart, to: compareEnd })
    setCompareType('week')
    setComparisonLabel('7 días anteriores')
    setActiveFilter('7days')
  }

  // Handler for "Last 30 days" filter
  const handleLast30Days = () => {
    const today = new Date()
    const end = new Date(today.setHours(23, 59, 59, 999))
    const start = new Date(new Date().setHours(0, 0, 0, 0) - 30 * 24 * 60 * 60 * 1000)

    // Previous 30 days (comparison)
    const compareEnd = new Date(start)
    compareEnd.setMilliseconds(compareEnd.getMilliseconds() - 1)
    const compareStart = new Date(compareEnd)
    compareStart.setDate(compareStart.getDate() - 30)
    compareStart.setHours(0, 0, 0, 0)

    setSelectedRange({ from: start, to: end })
    setCompareRange({ from: compareStart, to: compareEnd })
    setCompareType('month')
    setComparisonLabel('30 días anteriores')
    setActiveFilter('30days')
  }

  // Fetch main data with date range parameters
  const {
    data,
    isLoading,
    isError,
    error,
    refetch: refetchDashboardData,
  } = useQuery({
    queryKey: ['general_stats', venueId, selectedRange?.from?.toISOString(), selectedRange?.to?.toISOString()],
    queryFn: async () => {
      // Add date params to the API call
      const response = await api.get(`/v2/dashboard/${venueId}/general-stats`, {
        params: {
          fromDate: selectedRange.from.toISOString(),
          toDate: selectedRange.to.toISOString(),
        },
      })

      if (!response) {
        throw new Error('Failed to fetch data')
      }
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Register socket event handlers to update data in real-time
  useSocketEvents(
    venueId,
    data => {
      console.log('Received payment update:', data)
      refetchDashboardData()
    },
    data => {
      console.log('Received shift update:', data)
      refetchDashboardData()
    },
  )

  // Extract the data we need
  const filteredReviews = useMemo(() => data?.feedbacks || [], [data?.feedbacks])
  const filteredPayments = useMemo(() => data?.payments || [], [data?.payments])
  const extraMetrics = useMemo<ExtraMetrics>(
    () =>
      data?.extraMetrics || {
        tablePerformance: [],
        staffPerformanceMetrics: [],
        productProfitability: [],
        peakHoursData: [],
        weeklyTrendsData: [],
        prepTimesByCategory: {
          entradas: { avg: 0, target: 10 },
          principales: { avg: 0, target: 15 },
          postres: { avg: 0, target: 5 },
          bebidas: { avg: 0, target: 3 },
        },
      },
    [data?.extraMetrics],
  )

  const fiveStarReviews = useMemo(() => {
    return filteredReviews.filter(review => review.stars === 5).length
  }, [filteredReviews])

  // Calculate total amount from payments
  const amount = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }, [filteredPayments])

  const totalAmount = filteredPayments.length > 0 ? amount : 0

  // Calculate tip-related metrics
  const tipStats = useMemo(() => {
    if (!filteredPayments?.length) return { totalTips: 0, avgTipPercentage: 0 }

    // Filter payments that have at least one tip
    const paymentsWithTips = filteredPayments.filter(payment => payment.tips && payment.tips.length > 0)

    // Calculate total tips
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
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum, percentage) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: avgTipPercentage.toFixed(1),
    }
  }, [filteredPayments])

  // Process data for sales by payment method by day
  const paymentsByDay = useMemo(() => {
    if (!filteredPayments || filteredPayments.length === 0) return []

    const paymentsByDate = {}

    // Group payments by date
    filteredPayments.forEach(payment => {
      const dateStr = format(new Date(payment.createdAt), 'dd MMM', { locale: es })

      if (!paymentsByDate[dateStr]) {
        paymentsByDate[dateStr] = {
          date: dateStr,
          cash: 0,
          card: 0,
        }
      }

      // Simplify: card includes card and amex, cash includes cash and other
      if (payment.method === 'CARD' || payment.method === 'AMEX') {
        paymentsByDate[dateStr].card += Number(payment.amount) / 100 // Convert to monetary unit
      } else {
        paymentsByDate[dateStr].cash += Number(payment.amount) / 100 // Cash and others
      }
    })

    // Define type for payment day objects
    interface PaymentDay {
      date: string
      cash: number
      card: number
    }

    // Convert to array and sort by date
    return Object.values(paymentsByDate).sort((a: PaymentDay, b: PaymentDay) => {
      // Convert "dd MMM" to Date objects for correct sorting
      const monthsEs = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      const [dayA, monthA] = a.date.split(' ')
      const [dayB, monthB] = b.date.split(' ')

      const monthIndexA = monthsEs.indexOf(monthA.toLowerCase())
      const monthIndexB = monthsEs.indexOf(monthB.toLowerCase())

      if (monthIndexA !== monthIndexB) return monthIndexA - monthIndexB
      return parseInt(dayA) - parseInt(dayB)
    })
  }, [filteredPayments])

  // Payment methods data for pie chart
  const paymentMethodsData = useMemo(() => {
    const methodTotals = {}

    filteredPayments.forEach(payment => {
      const methodKey = payment.method || 'OTHER'
      const method = PAYMENT_METHOD_TRANSLATIONS[methodKey] || 'Otro'
      methodTotals[method] = (methodTotals[method] || 0) + Number(payment.amount)
    })

    return Object.entries(methodTotals).map(([method, total]) => ({ method, total }))
  }, [filteredPayments])

  // Best selling products
  const bestSellingProducts = useMemo(() => {
    if (!data?.products) return { FOOD: [], BEVERAGE: [], OTHER: [] }

    const filteredProducts = data.products
    const categories = { FOOD: [], BEVERAGE: [], OTHER: [] }

    filteredProducts.forEach(product => {
      const productType = product.type || 'OTHER'
      if (categories[productType]) {
        const existing = categories[productType].find(p => p.name === product.name)
        if (existing) {
          existing.quantity = Number(existing.quantity) + Number(product.quantity)
        } else {
          categories[productType].push({ ...product })
        }
      } else {
        categories.OTHER.push({ ...product })
      }
    })
    console.log(bestSellingProducts)
    // Sort by quantity and limit top 3
    Object.keys(categories).forEach(type => {
      categories[type].sort((a, b) => b.quantity - a.quantity)
      categories[type] = categories[type].slice(0, 3)
    })

    return categories
  }, [data?.products])

  // Tips over time chart data
  const tipsChartData = useMemo(() => {
    const tipsByDate = {}

    filteredPayments.forEach(payment => {
      payment.tips?.forEach(tip => {
        const dateStr = payment.createdAt.split('T')[0]
        tipsByDate[dateStr] = (tipsByDate[dateStr] || 0) + Number(tip.amount)
      })
    })

    return Object.entries(tipsByDate)
      .map(([date, amount]) => ({
        date,
        amount: Number((Number(amount) / 100).toFixed(2)),
        formattedDate: format(new Date(date), 'dd MMM', { locale: es }),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [filteredPayments])

  // Fetch comparison period data in a separate query
  const {
    data: compareData,
    isLoading: isCompareLoading,
    refetch: refetchCompareData,
  } = useQuery({
    queryKey: ['general_stats_compare', venueId, compareRange?.from?.toISOString(), compareRange?.to?.toISOString()],
    queryFn: async () => {
      if (!compareType) return null

      // Only fetch comparison data when a comparison type is selected
      const response = await api.get(`/v2/dashboard/${venueId}/general-stats`, {
        params: {
          fromDate: compareRange.from.toISOString(),
          toDate: compareRange.to.toISOString(),
        },
      })

      if (!response) {
        throw new Error('Failed to fetch comparison data')
      }
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!compareType, // Only run this query when compareType has a value
  })

  // Process comparison data
  const compareReviews = useMemo(() => compareData?.feedbacks || [], [compareData?.feedbacks])

  const compareFiveStarReviews = useMemo(() => {
    return compareReviews.filter(review => review.stars === 5).length
  }, [compareReviews])

  const comparePayments = useMemo(() => compareData?.payments || [], [compareData?.payments])

  const compareAmount = useMemo(() => {
    return comparePayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }, [comparePayments])

  const compareTipStats = useMemo(() => {
    if (!comparePayments?.length) return { totalTips: 0, avgTipPercentage: '0' }

    // Filter payments that have at least one tip
    const paymentsWithTips = comparePayments.filter(payment => payment.tips && payment.tips.length > 0)

    // Calculate total tips
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
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum, percentage) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: avgTipPercentage.toFixed(1),
    }
  }, [comparePayments])

  // Calculate comparison percentages
  const getComparisonPercentage = (currentValue: number, previousValue: number): number => {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0
    return Math.round(((currentValue - previousValue) / previousValue) * 100)
  }

  // Calculate percentage changes
  const amountChangePercentage = useMemo(() => {
    return getComparisonPercentage(totalAmount, compareAmount)
  }, [totalAmount, compareAmount])

  const reviewsChangePercentage = useMemo(() => {
    return getComparisonPercentage(fiveStarReviews, compareFiveStarReviews)
  }, [fiveStarReviews, compareFiveStarReviews])

  const tipsChangePercentage = useMemo(() => {
    return getComparisonPercentage(tipStats.totalTips, compareTipStats.totalTips)
  }, [tipStats.totalTips, compareTipStats.totalTips])

  const tipAvgChangePercentage = useMemo(() => {
    return getComparisonPercentage(parseFloat(String(tipStats.avgTipPercentage)), parseFloat(String(compareTipStats.avgTipPercentage)))
  }, [tipStats.avgTipPercentage, compareTipStats.avgTipPercentage])

  // Find the most and least profitable products
  const mostProfitableProduct = useMemo(() => {
    if (!extraMetrics.productProfitability.length) return null
    return extraMetrics.productProfitability.reduce((prev, current) => (prev.marginPercentage > current.marginPercentage ? prev : current))
  }, [extraMetrics.productProfitability])

  const leastProfitableProduct = useMemo(() => {
    if (!extraMetrics.productProfitability.length) return null
    return extraMetrics.productProfitability.reduce((prev, current) => (prev.marginPercentage < current.marginPercentage ? prev : current))
  }, [extraMetrics.productProfitability])

  // Find the best and worst performing tables
  const bestTable = useMemo(() => {
    if (!extraMetrics.tablePerformance.length) return null
    return extraMetrics.tablePerformance.reduce((prev, current) => (prev.avgTicket > current.avgTicket ? prev : current))
  }, [extraMetrics.tablePerformance])

  const worstTable = useMemo(() => {
    if (!extraMetrics.tablePerformance.length) return null
    return extraMetrics.tablePerformance.reduce((prev, current) => (prev.avgTicket < current.avgTicket ? prev : current))
  }, [extraMetrics.tablePerformance])

  // Find the peak hour
  const peakHour = useMemo(() => {
    if (!extraMetrics.peakHoursData.length) return null
    return extraMetrics.peakHoursData.reduce((prev, current) => (prev.sales > current.sales ? prev : current))
  }, [extraMetrics.peakHoursData])

  // Calculate weekly trends overall change percentage
  const weeklyTrendsChangePercentage = useMemo(() => {
    if (!extraMetrics.weeklyTrendsData.length) return 0

    const totalCurrentWeek = extraMetrics.weeklyTrendsData.reduce((sum, day) => sum + day.currentWeek, 0)
    const totalPreviousWeek = extraMetrics.weeklyTrendsData.reduce((sum, day) => sum + day.previousWeek, 0)

    return getComparisonPercentage(totalCurrentWeek, totalPreviousWeek)
  }, [extraMetrics.weeklyTrendsData])

  // Find the best and worst performing staff
  const bestStaff = useMemo(() => {
    if (!extraMetrics.staffPerformanceMetrics.length) return null
    return extraMetrics.staffPerformanceMetrics.reduce((prev, current) => (prev.totalSales > current.totalSales ? prev : current))
  }, [extraMetrics.staffPerformanceMetrics])

  // Calculate average prep time overrun
  const prepTimeOverrun = useMemo(() => {
    if (!extraMetrics.prepTimesByCategory) return null

    // Get the category with the biggest overrun compared to target
    const categories = Object.entries(extraMetrics.prepTimesByCategory)
    const categoryWithOverrun = categories.reduce((prev, [name, data]) => {
      const prevOverrun = prev ? prev[1].avg - prev[1].target : 0
      const currentOverrun = data.avg - data.target
      return currentOverrun > prevOverrun ? [name, data] : prev
    }, null as [string, { avg: number; target: number }] | null)

    return categoryWithOverrun
      ? {
          category: categoryWithOverrun[0],
          avg: categoryWithOverrun[1].avg,
          target: categoryWithOverrun[1].target,
          overrun: categoryWithOverrun[1].avg - categoryWithOverrun[1].target,
        }
      : null
  }, [extraMetrics.prepTimesByCategory])

  // Export to JSON
  const exportToCSV = async () => {
    try {
      setExportLoading(true)

      // Prepare data for export
      const exportData = {
        metricas: {
          totalVentas: totalAmount,
          fiveStarReviews,
          totalPropinas: tipStats.totalTips,
          promedioPropinas: tipStats.avgTipPercentage,
        },
        metodosPago: paymentMethodsData,
        mejoresProductos: bestSellingProducts,
        propinas: tipsChartData,
        horasPico: extraMetrics.peakHoursData,
        desempeñoMesas: extraMetrics.tablePerformance,
        productosRentables: extraMetrics.productProfitability,
        tendenciasSemanal: extraMetrics.weeklyTrendsData,
        desempeñoPersonal: extraMetrics.staffPerformanceMetrics,
      }

      // Convert to JSON and then to blob
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })

      // Create URL for download
      const url = URL.createObjectURL(blob)

      // Filename with current date
      const filename = `dashboard_${venueId}_${format(new Date(), 'yyyy-MM-dd')}.json`

      // Create link and force download
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Cleanup
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar datos:', error)
    } finally {
      setExportLoading(false)
    }
  }

  // Export to Excel (CSV)
  const exportToExcel = async () => {
    try {
      setExportLoading(true)

      // Prepare data for CSV
      let csvContent = 'data:text/csv;charset=utf-8,'

      // Sales
      csvContent += 'Métricas generales\n'
      csvContent += 'Total ventas,5 estrellas Google,Total propinas,Promedio propinas %\n'
      csvContent += `${Currency(totalAmount).replace('$', '')},${fiveStarReviews},${Currency(tipStats.totalTips).replace('$', '')},${
        tipStats.avgTipPercentage
      }%\n\n`

      // Payment methods
      csvContent += 'Métodos de pago\n'
      csvContent += 'Método,Total\n'
      paymentMethodsData.forEach(item => {
        csvContent += `${item.method},${Currency(Number(item.total)).replace('$', '')}\n`
      })
      csvContent += '\n'

      // Best selling products
      csvContent += 'Productos mejor vendidos\n'
      csvContent += 'Categoría,Producto,Cantidad\n'

      Object.entries(bestSellingProducts).forEach(([category, products]) => {
        const categoryName = CATEGORY_TRANSLATIONS[category] || category
        products.forEach(item => {
          csvContent += `${categoryName},${item.name},${item.quantity}\n`
        })
      })
      csvContent += '\n'

      // Tips by date
      csvContent += 'Propinas por fecha\n'
      csvContent += 'Fecha,Monto\n'
      tipsChartData.forEach(item => {
        csvContent += `${item.date},${item.amount}\n`
      })

      // Peak hours data
      csvContent += '\nHoras pico\n'
      csvContent += 'Hora,Ventas,Transacciones\n'
      extraMetrics.peakHoursData.forEach(item => {
        csvContent += `${item.hour}:00,${item.sales},${item.transactions}\n`
      })

      // Table performance data
      csvContent += '\nDesempeño de mesas\n'
      csvContent += 'Mesa,Capacidad,Ticket Promedio,Rotación,Ingresos Totales\n'
      extraMetrics.tablePerformance.forEach(table => {
        csvContent += `${table.tableNumber},${table.capacity},${Currency(table.avgTicket).replace('$', '')},${table.rotationRate.toFixed(
          1,
        )}x,${Currency(table.totalRevenue).replace('$', '')}\n`
      })

      // Product profitability
      csvContent += '\nRentabilidad de productos\n'
      csvContent += 'Producto,Tipo,Precio,Costo,Margen,% Margen,Cantidad,Ingresos\n'
      extraMetrics.productProfitability.forEach(product => {
        csvContent += `${product.name},${product.type},${Currency(product.price).replace('$', '')},${Currency(product.cost).replace(
          '$',
          '',
        )},${Currency(product.margin).replace('$', '')},${product.marginPercentage.toFixed(1)}%,${product.quantity},${Currency(
          product.totalRevenue,
        ).replace('$', '')}\n`
      })

      // Weekly trends
      csvContent += '\nTendencias semanales\n'
      csvContent += 'Día,Semana Actual,Semana Anterior,% Cambio\n'
      extraMetrics.weeklyTrendsData.forEach(day => {
        csvContent += `${day.day},${Currency(day.currentWeek).replace('$', '')},${Currency(day.previousWeek).replace(
          '$',
          '',
        )},${day.changePercentage.toFixed(1)}%\n`
      })

      // Staff performance
      csvContent += '\nDesempeño del personal\n'
      csvContent += 'Nombre,Rol,Ventas Totales,Cantidad de Órdenes,Tiempo Promedio\n'
      extraMetrics.staffPerformanceMetrics.forEach(staff => {
        csvContent += `${staff.name},${staff.role},${Currency(staff.totalSales).replace('$', '')},${
          staff.orderCount
        },${staff.avgPrepTime.toFixed(1)} min\n`
      })

      // Encode and create URL
      const encodedUri = encodeURI(csvContent)
      const filename = `dashboard_${venueId}_${format(new Date(), 'yyyy-MM-dd')}.csv`

      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error al exportar a Excel:', error)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className={`flex flex-col min-h-screen ${themeClasses.pageBg}`}>
      {/* Header with date range buttons */}
      <div className={`sticky top-0 z-10 ${themeClasses.cardBg} ${themeClasses.border} border-b shadow-sm p-4`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            {/* Quick filter buttons */}
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant={activeFilter === 'today' ? 'default' : 'outline'}
                onClick={handleToday}
                className="whitespace-nowrap"
              >
                Hoy
              </Button>
              <Button
                size="sm"
                variant={activeFilter === '7days' ? 'default' : 'outline'}
                onClick={handleLast7Days}
                className="whitespace-nowrap"
              >
                Últimos 7 días
              </Button>
              <Button
                size="sm"
                variant={activeFilter === '30days' ? 'default' : 'outline'}
                onClick={handleLast30Days}
                className="whitespace-nowrap"
              >
                Últimos 30 días
              </Button>
            </div>

            <DateRangePicker
              showCompare={false}
              onUpdate={({ range }) => {
                setSelectedRange(range)

                // Calculate comparison range for custom date picker
                const selectedDuration = range.to.getTime() - range.from.getTime()
                const compareEnd = new Date(range.from.getTime() - 1)
                const compareStart = new Date(compareEnd.getTime() - selectedDuration)

                setCompareRange({ from: compareStart, to: compareEnd })
                setCompareType('custom')
                setComparisonLabel('período anterior')
                setActiveFilter('custom')
              }}
              initialDateFrom={selectedRange.from}
              initialDateTo={selectedRange.to}
              align="start"
              locale="es-ES"
            />
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isLoading || exportLoading || isError} className="flex items-center gap-2">
                    {exportLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Exportando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>Exportar</span>
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={exportToCSV}>Exportar como JSON</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>Exportar como CSV (Excel)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-2 md:p-4 space-y-4 mx-auto w-full">
        {isError ? (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-red-600">Failed to load dashboard data</h2>
              <p className={themeClasses.textMuted}>{error?.message || 'An unknown error occurred'}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Key metrics cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total ventas"
                value={isLoading ? null : Currency(totalAmount)}
                isLoading={isLoading}
                icon={<DollarIcon />}
                percentage={compareType ? amountChangePercentage : null}
                comparisonLabel={comparisonLabel}
              />
              <MetricCard
                title="5 estrellas Google"
                value={isLoading ? null : fiveStarReviews}
                isLoading={isLoading}
                icon={<StarIcon />}
                percentage={compareType ? reviewsChangePercentage : null}
                comparisonLabel={comparisonLabel}
              />
              <MetricCard
                title="Total propinas"
                value={isLoading ? null : Currency(tipStats.totalTips)}
                isLoading={isLoading}
                icon={<TipIcon />}
                percentage={compareType ? tipsChangePercentage : null}
                comparisonLabel={comparisonLabel}
              />
              <MetricCard
                title="Promedio propinas %"
                value={isLoading ? null : `${tipStats.avgTipPercentage}%`}
                isLoading={isLoading}
                icon={<PercentIcon />}
                percentage={compareType ? tipAvgChangePercentage : null}
                comparisonLabel={comparisonLabel}
              />
            </div>

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              {/* Payment methods chart */}
              <Card className="lg:col-span-4 flex flex-col">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Métodos de pago</CardTitle>
                  <CardDescription>
                    {selectedRange.from && selectedRange.to
                      ? `${format(selectedRange.from, 'dd MMM yyyy', { locale: es })} - ${format(selectedRange.to, 'dd MMM yyyy', {
                          locale: es,
                        })}`
                      : 'Periodo actual'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pt-6 pb-0">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !paymentMethodsData || paymentMethodsData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="mx-auto aspect-square max-h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={value => `${Currency(Number(value))}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          />
                          <Pie
                            data={paymentMethodsData}
                            dataKey="total"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={60}
                            paddingAngle={2}
                            strokeWidth={5}
                          >
                            {paymentMethodsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                            <Label
                              content={({ viewBox }) => {
                                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                  return (
                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-lg font-bold">
                                        {Currency(totalAmount)}
                                      </tspan>
                                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-sm">
                                        Total
                                      </tspan>
                                    </text>
                                  )
                                }
                              }}
                            />
                          </Pie>
                          <Legend verticalAlign="bottom" align="center" layout="horizontal" iconSize={10} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
                {!isLoading && paymentMethodsData && paymentMethodsData.length > 0 && compareType && (
                  <CardFooter className="flex-col gap-2 text-sm pt-2">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      {amountChangePercentage > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">
                            Incremento de {amountChangePercentage}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : amountChangePercentage < 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                          <span className="text-red-600">
                            Disminución de {Math.abs(amountChangePercentage)}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : (
                        <span>Sin cambios vs {comparisonLabel}</span>
                      )}
                    </div>
                  </CardFooter>
                )}
              </Card>

              {/* Best selling products */}
              <Card className="lg:col-span-3">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Productos mejor vendidos</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(bestSellingProducts).map(([category, products]) => (
                        <div key={category} className="space-y-2">
                          <h3 className="font-medium text-sm uppercase text-muted-foreground">
                            {CATEGORY_TRANSLATIONS[category] || category}
                          </h3>
                          {products.length === 0 ? (
                            <p className="text-sm text-gray-500">No hay datos disponibles</p>
                          ) : (
                            <ul className="space-y-1">
                              {products.map((product, idx) => (
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
                  )}
                </CardContent>
              </Card>

              {/* Tips over time chart */}
              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Propinas por fecha</CardTitle>
                  <CardDescription>
                    {selectedRange.from && selectedRange.to
                      ? `${format(selectedRange.from, 'dd MMM yyyy', { locale: es })} - ${format(selectedRange.to, 'dd MMM yyyy', {
                          locale: es,
                        })}`
                      : 'Periodo actual'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '360px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !tipsChartData || tipsChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <ChartContainer
                      className="h-full"
                      config={{
                        amount: {
                          label: 'Propinas',
                          color: CHART_COLORS[0],
                        },
                      }}
                    >
                      <BarChart
                        accessibilityLayer
                        data={tipsChartData}
                        margin={{
                          top: 30,
                          right: 30,
                          left: 20,
                          bottom: 20,
                        }}
                        height={280}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="formattedDate" tickLine={false} tickMargin={10} axisLine={false} />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent formatter={value => `${Currency(Number(value))}`} hideLabel />}
                        />
                        <Bar dataKey="amount" fill="var(--chart-1)" radius={4} maxBarSize={60}>
                          <LabelList
                            position="top"
                            offset={8}
                            className="fill-foreground"
                            fontSize={10}
                            formatter={value => `${Currency(Number(value))}`}
                          />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
                {!isLoading && tipsChartData && tipsChartData.length > 0 && compareType && (
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      {tipsChangePercentage > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">
                            Incremento de {tipsChangePercentage}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : tipsChangePercentage < 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                          <span className="text-red-600">
                            Disminución de {Math.abs(tipsChangePercentage)}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : (
                        <span>Sin cambios vs {comparisonLabel}</span>
                      )}
                    </div>
                    <div className="leading-none text-muted-foreground">
                      Mostrando propinas totales para el{' '}
                      {activeFilter === 'today'
                        ? 'día de hoy'
                        : activeFilter === '7days'
                        ? 'los últimos 7 días'
                        : activeFilter === '30days'
                        ? 'los últimos 30 días'
                        : 'período seleccionado'}
                    </div>
                  </CardFooter>
                )}
              </Card>

              {/* Sales by payment method chart */}
              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Ventas por método de pago</CardTitle>
                  <CardDescription>
                    {selectedRange.from && selectedRange.to
                      ? `${format(selectedRange.from, 'dd MMM yyyy', { locale: es })} - ${format(selectedRange.to, 'dd MMM yyyy', {
                          locale: es,
                        })}`
                      : 'Periodo actual'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '400px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !filteredPayments || filteredPayments.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <ChartContainer
                      className="h-full"
                      config={{
                        cash: {
                          label: PAYMENT_METHOD_TRANSLATIONS.CASH || 'Efectivo',
                          color: CHART_COLORS[0],
                        },
                        card: {
                          label: PAYMENT_METHOD_TRANSLATIONS.CARD || 'Tarjeta',
                          color: CHART_COLORS[1],
                        },
                      }}
                    >
                      <BarChart
                        accessibilityLayer
                        data={paymentsByDay}
                        margin={{
                          top: 30,
                          right: 30,
                          left: 20,
                          bottom: 20,
                        }}
                        height={280}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                          tickFormatter={value => value.slice(0, 3)}
                        />
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="card" stackId="a" fill="var(--color-card)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cash" stackId="a" fill="var(--color-cash)" radius={[0, 0, 4, 4]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
                {!isLoading && filteredPayments && filteredPayments.length > 0 && compareType && (
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      {amountChangePercentage > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">
                            Incremento de {amountChangePercentage}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : amountChangePercentage < 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                          <span className="text-red-600">
                            Disminución de {Math.abs(amountChangePercentage)}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : (
                        <span>Sin cambios vs {comparisonLabel}</span>
                      )}
                    </div>
                    <div className="leading-none text-muted-foreground">
                      Mostrando ventas por método de pago para el{' '}
                      {activeFilter === 'today'
                        ? 'día de hoy'
                        : activeFilter === '7days'
                        ? 'los últimos 7 días'
                        : activeFilter === '30days'
                        ? 'los últimos 30 días'
                        : 'período seleccionado'}
                    </div>
                  </CardFooter>
                )}
              </Card>

              {/* Peak Sales Hours Chart - REAL DATA */}
              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Horas Pico de Ventas</CardTitle>
                  <CardDescription>Identifica tus horas más productivas y optimiza tu personal</CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '360px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !extraMetrics.peakHoursData || extraMetrics.peakHoursData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <ChartContainer
                      className="h-full"
                      config={{
                        sales: {
                          label: 'Ventas',
                          color: CHART_COLORS[0],
                        },
                        transactions: {
                          label: 'N° Transacciones',
                          color: CHART_COLORS[1],
                        },
                      }}
                    >
                      <BarChart
                        accessibilityLayer
                        data={extraMetrics.peakHoursData}
                        margin={{
                          top: 30,
                          right: 30,
                          left: 20,
                          bottom: 20,
                        }}
                        height={280}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                          tickFormatter={value => `${value}:00`}
                          label={{ value: 'Hora del día', position: 'insideBottomRight', offset: -10 }}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name) => (name === 'sales' ? Currency(Number(value)) : `${value} transacciones`)}
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="sales" fill="var(--color-sales)" radius={4} maxBarSize={30} />
                        <Bar dataKey="transactions" fill="var(--color-transactions)" radius={4} maxBarSize={30} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  {peakHour && (
                    <div className="leading-none text-muted-foreground">
                      Tu hora más rentable es a las <span className="font-bold">{peakHour.hour}:00</span> con un promedio de{' '}
                      <span className="font-bold">{Currency(peakHour.sales)}</span> en ventas
                    </div>
                  )}
                </CardFooter>
              </Card>

              {/* Table Performance Analysis - REAL DATA */}
              <Card className="lg:col-span-6">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Rendimiento por Mesa</CardTitle>
                  <CardDescription>Identifica tus mesas más rentables y las que necesitan atención</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !extraMetrics.tablePerformance || extraMetrics.tablePerformance.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {extraMetrics.tablePerformance.map(table => (
                        <div
                          key={table.tableId}
                          className={`p-4 rounded-lg border ${
                            bestTable && table.tableNumber === bestTable.tableNumber
                              ? isDark
                                ? 'bg-green-900/20 border-green-800'
                                : 'bg-green-50 border-green-200'
                              : worstTable && table.tableNumber === worstTable.tableNumber
                              ? isDark
                                ? 'bg-red-900/20 border-red-800'
                                : 'bg-red-50 border-red-200'
                              : isDark
                              ? 'border-[hsl(240_3.7%_15.9%)]'
                              : ''
                          }`}
                        >
                          <div className="text-lg font-bold mb-1">Mesa {table.tableNumber}</div>
                          <div className="text-sm mb-2">Capacidad: {table.capacity}</div>
                          <div className="text-sm font-medium">Ticket promedio:</div>
                          <div className="text-lg font-bold mb-2">{Currency(table.avgTicket)}</div>
                          <div className="text-sm font-medium">Rotación diaria:</div>
                          <div className="text-lg font-bold">{table.rotationRate.toFixed(1)}x</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  {bestTable && worstTable && (
                    <div className="leading-none text-muted-foreground">
                      <span className="font-bold text-green-600">Mesa {bestTable.tableNumber}</span> tiene el ticket promedio más alto •
                      <span className="font-bold text-red-600"> Mesa {worstTable.tableNumber}</span> tiene el ticket promedio más bajo
                    </div>
                  )}
                </CardFooter>
              </Card>

              {/* Product Profitability Analysis - REAL DATA */}
              <Card className="lg:col-span-6">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Productos Más Rentables</CardTitle>
                  <CardDescription>Conoce qué platos generan mayor margen de beneficio</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4">
                      <LoadingSkeleton />
                    </div>
                  ) : !extraMetrics.productProfitability || extraMetrics.productProfitability.length === 0 ? (
                    <div className="flex items-center justify-center h-32 p-4">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-4 font-medium">Producto</th>
                            <th className="text-right p-4 font-medium">Ventas</th>
                            <th className="text-right p-4 font-medium">Precio</th>
                            <th className="text-right p-4 font-medium">Costo</th>
                            <th className="text-right p-4 font-medium">Margen</th>
                            <th className="text-right p-4 font-medium">% Margen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extraMetrics.productProfitability.slice(0, 4).map((product, index) => (
                            <tr
                              key={index}
                              className={`border-b ${
                                mostProfitableProduct && product.name === mostProfitableProduct.name
                                  ? isDark
                                    ? 'bg-green-900/20'
                                    : 'bg-green-50'
                                  : leastProfitableProduct && product.name === leastProfitableProduct.name
                                  ? isDark
                                    ? 'bg-red-900/20'
                                    : 'bg-red-50'
                                  : ''
                              }`}
                            >
                              <td className="p-4">{product.name}</td>
                              <td className="p-4 text-right">{product.quantity}</td>
                              <td className="p-4 text-right">{Currency(product.price)}</td>
                              <td className="p-4 text-right">{Currency(product.cost)}</td>
                              <td className="p-4 text-right font-bold">{Currency(product.margin)}</td>
                              <td
                                className={`p-4 text-right font-bold ${
                                  product.marginPercentage > 60 ? 'text-green-600' : product.marginPercentage < 35 ? 'text-red-600' : ''
                                }`}
                              >
                                {product.marginPercentage.toFixed(0)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  {mostProfitableProduct && leastProfitableProduct && (
                    <div className="leading-none text-muted-foreground">
                      Recomendación: Promociona más {mostProfitableProduct.name} (margen {mostProfitableProduct.marginPercentage.toFixed(0)}
                      %) y considera ajustar el precio de {leastProfitableProduct.name} (margen{' '}
                      {leastProfitableProduct.marginPercentage.toFixed(0)}%)
                    </div>
                  )}
                </CardFooter>
              </Card>

              {/* Weekly Trends Analysis - REAL DATA */}
              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Tendencias Semanales</CardTitle>
                  <CardDescription>Compara el rendimiento por día de la semana</CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '360px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !extraMetrics.weeklyTrendsData || extraMetrics.weeklyTrendsData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <ChartContainer
                      className="h-full"
                      config={{
                        currentWeek: {
                          label: 'Semana Actual',
                          color: CHART_COLORS[0],
                        },
                        previousWeek: {
                          label: 'Semana Anterior',
                          color: CHART_COLORS[1],
                        },
                      }}
                    >
                      <BarChart
                        accessibilityLayer
                        data={extraMetrics.weeklyTrendsData}
                        margin={{
                          top: 30,
                          right: 30,
                          left: 20,
                          bottom: 20,
                        }}
                        height={280}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent formatter={value => Currency(Number(value))} />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="currentWeek" fill="var(--color-currentWeek)" radius={4} maxBarSize={30} />
                        <Bar dataKey="previousWeek" fill="var(--color-previousWeek)" radius={4} maxBarSize={30} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  {extraMetrics.weeklyTrendsData && extraMetrics.weeklyTrendsData.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 font-medium leading-none">
                        {weeklyTrendsChangePercentage > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-green-600">
                              Incremento de {weeklyTrendsChangePercentage.toFixed(1)}% respecto a la semana anterior
                            </span>
                          </>
                        ) : weeklyTrendsChangePercentage < 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                            <span className="text-red-600">
                              Disminución de {Math.abs(weeklyTrendsChangePercentage).toFixed(1)}% respecto a la semana anterior
                            </span>
                          </>
                        ) : (
                          <span>Sin cambios respecto a la semana anterior</span>
                        )}
                      </div>
                      {(() => {
                        // Find the day with the biggest drop
                        const biggestDrop = extraMetrics.weeklyTrendsData.reduce(
                          (prev, current) => (current.changePercentage < prev.changePercentage ? current : prev),
                          { changePercentage: 0, day: '' },
                        )

                        // Find the most profitable day
                        const bestDay = extraMetrics.weeklyTrendsData.reduce(
                          (prev, current) => (current.currentWeek > prev.currentWeek ? current : prev),
                          { currentWeek: 0, day: '' },
                        )

                        return (
                          <div className="leading-none text-muted-foreground">
                            {bestDay.day !== '' && (
                              <>
                                El {bestDay.day.toLowerCase()} es tu día más ocupado
                                {biggestDrop.changePercentage < -5 && biggestDrop.day === bestDay.day && (
                                  <>
                                    , pero has tenido una caída del {Math.abs(biggestDrop.changePercentage).toFixed(1)}% respecto a la
                                    semana anterior
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </CardFooter>
              </Card>

              {/* Staff Efficiency Analysis - REAL DATA */}
              <Card className="lg:col-span-5">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Eficiencia del Personal</CardTitle>
                  <CardDescription>Analiza el rendimiento de tus meseros y cocineros</CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '360px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !extraMetrics.staffPerformanceMetrics || extraMetrics.staffPerformanceMetrics.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Ventas por Mesero</h3>
                        <div className="space-y-3">
                          {extraMetrics.staffPerformanceMetrics
                            .filter(staff => staff.role.toLowerCase().includes('mesero') || staff.role.toLowerCase().includes('waiter'))
                            .slice(0, 4)
                            .map((employee, i) => {
                              const maxSales = extraMetrics.staffPerformanceMetrics.reduce((max, s) => Math.max(max, s.totalSales), 0)

                              return (
                                <div key={i} className="flex items-center">
                                  <div className="w-32 flex-shrink-0 font-medium truncate">{employee.name}</div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center">
                                      <div
                                        className="h-2 rounded"
                                        style={{
                                          width: `${(employee.totalSales / maxSales) * 100}%`,
                                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                        }}
                                      ></div>
                                      <span className="ml-2 text-sm">{Currency(employee.totalSales)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {employee.orderCount} órdenes • Tiempo promedio: {employee.avgPrepTime.toFixed(0)} min
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-2">Tiempo Promedio de Preparación</h3>
                        <div className="space-y-3">
                          {Object.entries(extraMetrics.prepTimesByCategory).map(([category, data], i) => (
                            <div key={i} className="flex items-center">
                              <div className="w-32 flex-shrink-0 font-medium">
                                {category === 'entradas'
                                  ? 'Entradas'
                                  : category === 'principales'
                                  ? 'Platos Principales'
                                  : category === 'postres'
                                  ? 'Postres'
                                  : category === 'bebidas'
                                  ? 'Bebidas'
                                  : category}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-200 h-2 rounded overflow-hidden">
                                    <div
                                      className={`h-full rounded ${data.avg <= data.target ? 'bg-green-500' : 'bg-amber-500'}`}
                                      style={{ width: `${(data.avg / 20) * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="ml-2 text-sm">{data.avg.toFixed(0)} min</span>
                                  <span className="ml-2 text-xs text-gray-500">Meta: {data.target} min</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  {bestStaff && prepTimeOverrun && (
                    <div className="leading-none text-muted-foreground">
                      {bestStaff.name} genera las mayores ventas •
                      {prepTimeOverrun.overrun > 0
                        ? ` Los ${
                            prepTimeOverrun.category === 'principales' ? 'platos principales' : prepTimeOverrun.category
                          } están tomando ${prepTimeOverrun.overrun.toFixed(0)} min más que el objetivo`
                        : ` Todos los tiempos de preparación están dentro de los objetivos`}
                    </div>
                  )}
                </CardFooter>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Home
