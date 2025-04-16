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

// Translations for payment methods
const PAYMENT_METHOD_TRANSLATIONS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  amex: 'Amex',
  other: 'Otro',
}

// Translations for product categories
const CATEGORY_TRANSLATIONS = {
  food: 'Comida',
  beverage: 'Bebida',
  other: 'Otros',
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

// Metric card component - optimized with proper naming and types
const MetricCard = ({ title, value, isLoading, icon, percentage = null, comparisonLabel = 'período anterior' }) => {
  const { isDark } = useTheme()

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

  // Fetch data with date range parameters
  const { data, isLoading, isError, error } = useQuery({
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

  // Since backend now filters by date, we don't need to filter again in the frontend
  const filteredReviews = useMemo(() => data?.feedbacks || [], [data?.feedbacks])

  const fiveStarReviews = useMemo(() => {
    return filteredReviews.filter(review => review.stars === 5).length
  }, [filteredReviews])

  const filteredPayments = useMemo(() => data?.payments || [], [data?.payments])

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
      if (payment.method === 'card' || payment.method === 'amex') {
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
      const method = PAYMENT_METHOD_TRANSLATIONS[payment.method] || 'Otro'
      methodTotals[method] = (methodTotals[method] || 0) + Number(payment.amount)
    })

    return Object.entries(methodTotals).map(([method, total]) => ({ method, total }))
  }, [filteredPayments])

  // Best selling products
  const bestSellingProducts = useMemo(() => {
    if (!data?.products) return { food: [], beverage: [], other: [] }

    const filteredProducts = data.products
    const categories = { food: [], beverage: [], other: [] }

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
  const { data: compareData, isLoading: isCompareLoading } = useQuery({
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
        mejoresProductos: {
          comida: bestSellingProducts.food,
          bebidas: bestSellingProducts.beverage,
          otros: bestSellingProducts.other,
        },
        propinas: tipsChartData,
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

      bestSellingProducts.food.forEach(item => {
        csvContent += `${CATEGORY_TRANSLATIONS.food},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.beverage.forEach(item => {
        csvContent += `${CATEGORY_TRANSLATIONS.beverage},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.other.forEach(item => {
        csvContent += `${CATEGORY_TRANSLATIONS.other},${item.name},${item.quantity}\n`
      })
      csvContent += '\n'

      // Tips by date
      csvContent += 'Propinas por fecha\n'
      csvContent += 'Fecha,Monto\n'
      tipsChartData.forEach(item => {
        csvContent += `${item.date},${item.amount}\n`
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
                          label: PAYMENT_METHOD_TRANSLATIONS.cash || 'Efectivo',
                          color: CHART_COLORS[0],
                        },
                        card: {
                          label: PAYMENT_METHOD_TRANSLATIONS.card || 'Tarjeta',
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Home
