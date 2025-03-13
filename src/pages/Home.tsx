import api from '@/api'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DollarSign, Download, Gift, Loader2, Percent, Star, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Label, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Currency } from '@/utils/currency'

// Traducciones para métodos de pago
const paymentMethodTranslations = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  AMEX: 'Amex',
  other: 'Otro',
}

// Traducciones para categorías de productos
const categoryTranslations = {
  food: 'Comida',
  beverage: 'Bebida',
  other: 'Otros',
}

// Paleta de colores mejorada para los gráficos
const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1']

// Simple icon components
const DollarIcon = () => <DollarSign className="h-5 w-5 text-blue-500" />
const StarIcon = () => <Star className="h-5 w-5 text-yellow-500" />
const TipIcon = () => <Gift className="h-5 w-5 text-green-500" />
const PercentIcon = () => <Percent className="h-5 w-5 text-purple-500" />

// Type for comparison period
type ComparisonPeriod = 'day' | 'week' | 'month' | ''

// Metric Card Component
const MetricCard = ({ title, value, isLoading, icon, percentage = null, comparisonLabel = 'período anterior' }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-7 w-20 bg-gray-200 rounded animate-pulse"></div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold">{value || 0}</div>
            {percentage !== null && (
              <div
                className={`text-xs flex items-center ${
                  percentage > 0 ? 'text-green-600' : percentage < 0 ? 'text-red-600' : 'text-gray-500'
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

const Home = () => {
  const { venueId } = useParams()
  const [exportLoading, setExportLoading] = useState(false)
  const [compareType, setCompareType] = useState<ComparisonPeriod>('')
  const [comparisonLabel, setComparisonLabel] = useState('período anterior')

  // Define ranges as objects containing Date objects, not numbers
  const [selectedRange, setSelectedRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000), // last 7 days
    to: new Date(new Date().setHours(23, 59, 59, 999)), // today
  })

  const [compareRange, setCompareRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 14 * 24 * 60 * 60 * 1000), // previous 7 days
    to: new Date(new Date(new Date().setHours(0, 0, 0, 0) - 8 * 24 * 60 * 60 * 1000).getTime() - 1), // day before the selectedRange starts
  })

  // Date range quick filter handlers
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
  }

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
  }

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
  }

  // Fetch current period data from API
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['general_stats', venueId, selectedRange?.from, selectedRange?.to],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/general-stats`, {
        params: {
          from: selectedRange?.from?.toISOString(),
          to: selectedRange?.to?.toISOString(),
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

  // Simple loading skeleton component
  const LoadingSkeleton = () => (
    <div className="animate-pulse flex h-full w-full flex-col space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
      <div className="h-24 bg-gray-200 rounded w-full"></div>
    </div>
  )

  // Main period filtered data
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

  const filteredPayments = useMemo(() => {
    if (!selectedRange || !data?.payments) return []

    return data.payments.filter(payment => {
      const paymentDate = new Date(payment.createdAt)
      return paymentDate >= selectedRange.from && paymentDate <= selectedRange.to
    })
  }, [selectedRange, data?.payments])

  const amount = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }, [filteredPayments])

  const totalAmount = filteredPayments.length > 0 ? amount : 0

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

  // Payment methods chart (filtered)
  const paymentMethodsData = useMemo(() => {
    const methodTotals = {}

    filteredPayments.forEach(payment => {
      const method = paymentMethodTranslations[payment.method] || 'Otro'
      methodTotals[method] = (methodTotals[method] || 0) + Number(payment.amount)
    })

    return Object.entries(methodTotals).map(([method, total]) => ({ method, total }))
  }, [filteredPayments])
  console.log('LOG: paymentMethodsData', paymentMethodsData)
  // Best selling products (filtered)
  const bestSellingProducts = useMemo(() => {
    if (!selectedRange || !data?.products) return { food: [], beverage: [], other: [] }

    const filteredProducts = data.products.filter(product => {
      const productDate = new Date(product.createdAt)
      return productDate >= selectedRange.from && productDate <= selectedRange.to
    })

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
  }, [selectedRange, data?.products])

  // Tips over time chart (filtered)
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

  // Comparison period data (calculated from the same data source, not from a second API call)
  const compareFilteredReviews = useMemo(() => {
    if (!compareType || !data?.feedbacks) return []

    return data.feedbacks.filter(review => {
      const reviewDate = new Date(review.createdAt)
      return reviewDate >= compareRange.from && reviewDate <= new Date(compareRange.to)
    })
  }, [compareType, data?.feedbacks, compareRange])

  const compareFiveStarReviews = useMemo(() => {
    return compareFilteredReviews.filter(review => review.stars === 5).length
  }, [compareFilteredReviews])

  const compareFilteredPayments = useMemo(() => {
    if (!compareType || !data?.payments) return []

    return data.payments.filter(payment => {
      const paymentDate = new Date(payment.createdAt)
      return paymentDate >= compareRange.from && paymentDate <= new Date(compareRange.to)
    })
  }, [compareType, data?.payments, compareRange])

  const compareAmount = useMemo(() => {
    return compareFilteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }, [compareFilteredPayments])

  const compareTipStats = useMemo(() => {
    if (!compareFilteredPayments?.length) return { totalTips: 0, avgTipPercentage: '0' }

    // Filter payments that have at least one tip
    const paymentsWithTips = compareFilteredPayments.filter(payment => payment.tips && payment.tips.length > 0)

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
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum, percentage) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: avgTipPercentage.toFixed(1),
    }
  }, [compareFilteredPayments])

  // Calculate comparison percentages
  const getComparisonPercentage = (currentValue: number, previousValue: number): number => {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0
    return Math.round(((currentValue - previousValue) / previousValue) * 100)
  }

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

  // Función para exportar los datos a un archivo CSV
  const exportToCSV = async () => {
    try {
      setExportLoading(true)

      // Preparar los datos para exportar
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

      // Convertir a JSON y luego a Blob
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })

      // Crear URL para descargar
      const url = URL.createObjectURL(blob)

      // Nombre del archivo con fecha actual
      const filename = `dashboard_${venueId}_${format(new Date(), 'yyyy-MM-dd')}.json`

      // Crear enlace y forzar descarga
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Limpieza
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar datos:', error)
    } finally {
      setExportLoading(false)
    }
  }

  // Función para exportar a Excel (CSV)
  const exportToExcel = async () => {
    try {
      setExportLoading(true)

      // Preparar datos para CSV
      let csvContent = 'data:text/csv;charset=utf-8,'

      // Ventas
      csvContent += 'Métricas Generales\n'
      csvContent += 'Total Ventas,5 Estrellas Google,Total Propinas,Promedio Propinas %\n'
      csvContent += `${Currency(totalAmount).replace('$', '')},${fiveStarReviews},${Currency(tipStats.totalTips).replace('$', '')},${
        tipStats.avgTipPercentage
      }%\n\n`

      // Métodos de pago
      csvContent += 'Métodos de Pago\n'
      csvContent += 'Método,Total\n'
      paymentMethodsData.forEach(item => {
        csvContent += `${item.method},${Currency(Number(item.total)).replace('$', '')}\n`
      })
      csvContent += '\n'

      // Productos mejor vendidos
      csvContent += 'Productos Mejor Vendidos\n'
      csvContent += 'Categoría,Producto,Cantidad\n'

      bestSellingProducts.food.forEach(item => {
        csvContent += `${categoryTranslations.food},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.beverage.forEach(item => {
        csvContent += `${categoryTranslations.beverage},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.other.forEach(item => {
        csvContent += `${categoryTranslations.other},${item.name},${item.quantity}\n`
      })
      csvContent += '\n'

      // Propinas por fecha
      csvContent += 'Propinas por Fecha\n'
      csvContent += 'Fecha,Monto\n'
      tipsChartData.forEach(item => {
        csvContent += `${item.date},${item.amount}\n`
      })

      // Codificar y crear URL
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header with date range buttons */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            {/* Quick filter buttons */}
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" onClick={handleToday} className="whitespace-nowrap">
                Hoy
              </Button>
              <Button size="sm" variant="outline" onClick={handleLast7Days} className="whitespace-nowrap">
                Últimos 7 días
              </Button>
              <Button size="sm" variant="outline" onClick={handleLast30Days} className="whitespace-nowrap">
                Últimos 30 días
              </Button>
            </div>

            <DateRangePicker
              showCompare={false}
              onUpdate={({ range }) => {
                setSelectedRange(range)
                setCompareType('') // Clear comparison type when manual date selection is used
                setComparisonLabel('período anterior')
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
              <MetricCard
                title="Total Ventas"
                value={isLoading ? null : Currency(totalAmount)}
                isLoading={isLoading}
                icon={<DollarIcon />}
                percentage={compareType ? amountChangePercentage : null}
                comparisonLabel={comparisonLabel}
              />
              <MetricCard
                title="5 Estrellas Google"
                value={isLoading ? null : fiveStarReviews}
                isLoading={isLoading}
                icon={<StarIcon />}
                percentage={compareType ? reviewsChangePercentage : null}
                comparisonLabel={comparisonLabel}
              />
              <MetricCard
                title="Total Propinas"
                value={isLoading ? null : Currency(tipStats.totalTips)}
                isLoading={isLoading}
                icon={<TipIcon />}
                percentage={compareType ? tipsChangePercentage : null}
                comparisonLabel={comparisonLabel}
              />
              <MetricCard
                title="Promedio Propinas %"
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
                  <CardTitle>Métodos de Pago</CardTitle>
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
                                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
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
                  <CardTitle>Productos Mejor Vendidos</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(bestSellingProducts).map(([category, products]) => (
                        <div key={category} className="space-y-2">
                          <h3 className="font-medium text-sm uppercase text-muted-foreground">
                            {categoryTranslations[category] || category}
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
                  <CardTitle>Propinas por Fecha</CardTitle>
                </CardHeader>
                <CardContent className="h-80 pt-6">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !tipsChartData || tipsChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tipsChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="formattedDate" />
                        <YAxis />
                        <Tooltip
                          formatter={value => `${Currency(Number(value))}`}
                          labelFormatter={label => `Fecha: ${label}`}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="amount" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Home
