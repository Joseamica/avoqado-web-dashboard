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
// Traducciones para métodos de pago
const paymentMethodTranslations = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  AMEX: 'Amex',
  other: 'Otro',
}

// Traducciones para categorías de productos
const categoryTranslations = {
  FOOD: 'Comida',
  BEVERAGE: 'Bebida',
  OTHER: 'Otros',
}

// Paleta de colores mejorada para los gráficos
const CHART_COLORS = ['#2563EB', '#60A8FB', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1']

// Simple icon components
const DollarIcon = () => <DollarSign className="h-5 w-5 text-blue-500" />
const StarIcon = () => <Star className="h-5 w-5 text-yellow-500" />
const TipIcon = () => <Gift className="h-5 w-5 text-green-500" />
const PercentIcon = () => <Percent className="h-5 w-5 text-purple-500" />

// Type for comparison period
type ComparisonPeriod = 'day' | 'week' | 'month' | 'custom' | ''

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

  const [activeFilter, setActiveFilter] = useState('7days') // Por defecto '7days'

  // Handlers modificados para establecer el filtro activo
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

  // Fetch current period data from API
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['general_stats', venueId, selectedRange?.from, selectedRange?.to],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/general-stats`, {})

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

  // Procesamiento de datos para ventas por método de pago por día
  const paymentsByDay = useMemo(() => {
    if (!filteredPayments || filteredPayments.length === 0) return []

    // Simplificamos y solo mostramos CASH y CARD para mantener la claridad visual,
    // similar al ejemplo que muestra desktop y mobile
    const paymentsByDate = {}

    // Agrupar pagos por fecha
    filteredPayments.forEach(payment => {
      const dateStr = format(new Date(payment.createdAt), 'dd MMM', { locale: es })

      if (!paymentsByDate[dateStr]) {
        paymentsByDate[dateStr] = {
          date: dateStr,
          CASH: 0,
          CARD: 0,
        }
      }

      // Simplificamos: CARD incluye CARD y AMEX, CASH incluye CASH y other
      if (payment.method === 'CARD' || payment.method === 'AMEX') {
        paymentsByDate[dateStr].CARD += Number(payment.amount) / 100 // Convertir a unidad monetaria
      } else {
        paymentsByDate[dateStr].CASH += Number(payment.amount) / 100 // Efectivo y otros
      }
    })

    // Convertir a array y ordenar por fecha
    return Object.values(paymentsByDate).sort((a, b) => {
      // Convertir "dd MMM" a objetos Date para ordenamiento correcto
      const monthsES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      const [dayA, monthA] = (a as { date: string }).date.split(' ')
      const [dayB, monthB] = (b as { date: string }).date.split(' ')

      const monthIndexA = monthsES.indexOf(monthA.toLowerCase())
      const monthIndexB = monthsES.indexOf(monthB.toLowerCase())

      if (monthIndexA !== monthIndexB) return monthIndexA - monthIndexB
      return parseInt(dayA) - parseInt(dayB)
    })
  }, [filteredPayments])

  // Para el resumen de métodos de pago (totales)
  const paymentMethodTotals = useMemo(() => {
    if (!filteredPayments || filteredPayments.length === 0) return {}

    const totals = {
      CASH: 0,
      CARD: 0,
      AMEX: 0,
      other: 0,
    }

    filteredPayments.forEach(payment => {
      const method = ['CASH', 'CARD', 'AMEX'].includes(payment.method) ? payment.method : 'other'

      totals[method] += Number(payment.amount) / 100
    })

    return totals
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
  console.log('LOG: bestSellingProducts', bestSellingProducts)
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
        csvContent += `${categoryTranslations.FOOD},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.beverage.forEach(item => {
        csvContent += `${categoryTranslations.BEVERAGE},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.other.forEach(item => {
        csvContent += `${categoryTranslations.OTHER},${item.name},${item.quantity}\n`
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

                // Calcular un rango de comparación para el DatePicker personalizado
                // (período anterior de igual duración)
                const selectedDuration = range.to.getTime() - range.from.getTime()
                const compareEnd = new Date(range.from.getTime() - 1) // Un milisegundo antes del inicio del rango seleccionado
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
      <div className="flex-1 p-2 md:p-4 space-y-4  mx-auto w-full">
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

              {/* ANCHOR - Best selling products */}
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

              {/* ANCHOR - Tips over time chart */}

              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Propinas por Fecha</CardTitle>
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
              {/* Sales by Payment Method Chart */}
              {/* ANCHOR - Sales by Payment Method Chart */}
              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Ventas por Método de Pago</CardTitle>
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
                        CASH: {
                          label: paymentMethodTranslations.CASH || 'Efectivo',
                          color: CHART_COLORS[0],
                        },
                        CARD: {
                          label: paymentMethodTranslations.CARD || 'Tarjeta',
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
                        <Bar dataKey="CARD" stackId="a" fill="var(--color-CARD)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="CASH" stackId="a" fill="var(--color-CASH)" radius={[0, 0, 4, 4]} />
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
              {/* 1. HORAS PICO - Análisis de ventas por hora del día */}
              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Horas Pico de Ventas</CardTitle>
                  <CardDescription>Identifica tus horas más productivas y optimiza tu personal</CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '360px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
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
                        data={null}
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
                          label={{ value: 'Hora del día', position: 'insideBottomRight', offset: -10 }}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent formatter={(value, name) => (name === 'sales' ? Currency(Number(value)) : value)} />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="sales" fill="var(--color-sales)" />
                        <Bar dataKey="transactions" fill="var(--color-transactions)" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="leading-none text-muted-foreground">
                    Tu hora más rentable es a las <span className="font-bold">14:00</span> con un promedio de{' '}
                    <span className="font-bold">$XXX</span> en ventas
                  </div>
                </CardFooter>
              </Card>

              {/* 2. ANÁLISIS DE MESAS - Ocupación y gasto promedio por mesa */}
              <Card className="lg:col-span-6">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Rendimiento por Mesa</CardTitle>
                  <CardDescription>Identifica tus mesas más rentables y las que necesitan atención</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* Ejemplo de tarjeta de mesa */}
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(tableNum => (
                      <div
                        key={tableNum}
                        className={`p-4 rounded-lg border ${
                          tableNum === 3 ? 'bg-green-50 border-green-200' : tableNum === 7 ? 'bg-red-50 border-red-200' : ''
                        }`}
                      >
                        <div className="text-lg font-bold mb-1">Mesa {tableNum}</div>
                        <div className="text-sm mb-2">Capacidad: 4</div>
                        <div className="text-sm font-medium">Ticket promedio:</div>
                        <div className="text-lg font-bold mb-2">{Currency(tableNum * 1000 + 500)}</div>
                        <div className="text-sm font-medium">Rotación diaria:</div>
                        <div className="text-lg font-bold">{(tableNum % 3) + 2}x</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="leading-none text-muted-foreground">
                    <span className="font-bold text-green-600">Mesa 3</span> tiene el ticket promedio más alto •
                    <span className="font-bold text-red-600">Mesa 7</span> tiene el ticket promedio más bajo
                  </div>
                </CardFooter>
              </Card>

              {/* 3. PRODUCTOS MÁS RENTABLES - No solo los más vendidos, sino los que generan más margen */}
              <Card className="lg:col-span-6">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Productos Más Rentables</CardTitle>
                  <CardDescription>Conoce qué platos generan mayor margen de beneficio</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
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
                        {/* Ejemplo de productos */}
                        <tr className="border-b bg-green-50">
                          <td className="p-4">Ensalada César</td>
                          <td className="p-4 text-right">46</td>
                          <td className="p-4 text-right">{Currency(12000)}</td>
                          <td className="p-4 text-right">{Currency(3500)}</td>
                          <td className="p-4 text-right font-bold">{Currency(8500)}</td>
                          <td className="p-4 text-right font-bold text-green-600">71%</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-4">Risotto de Hongos</td>
                          <td className="p-4 text-right">32</td>
                          <td className="p-4 text-right">{Currency(14500)}</td>
                          <td className="p-4 text-right">{Currency(5800)}</td>
                          <td className="p-4 text-right font-bold">{Currency(8700)}</td>
                          <td className="p-4 text-right font-bold">60%</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-4">Filete de Res</td>
                          <td className="p-4 text-right">28</td>
                          <td className="p-4 text-right">{Currency(22000)}</td>
                          <td className="p-4 text-right">{Currency(11000)}</td>
                          <td className="p-4 text-right font-bold">{Currency(11000)}</td>
                          <td className="p-4 text-right font-bold">50%</td>
                        </tr>
                        <tr className="border-b bg-red-50">
                          <td className="p-4">Pasta Carbonara</td>
                          <td className="p-4 text-right">38</td>
                          <td className="p-4 text-right">{Currency(13500)}</td>
                          <td className="p-4 text-right">{Currency(9500)}</td>
                          <td className="p-4 text-right font-bold">{Currency(4000)}</td>
                          <td className="p-4 text-right font-bold text-red-600">30%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="leading-none text-muted-foreground">
                    Recomendación: Promociona más la Ensalada César y considera ajustar el precio de la Pasta Carbonara
                  </div>
                </CardFooter>
              </Card>

              {/* 4. ANÁLISIS DE DÍAS Y TENDENCIAS */}
              <Card className="lg:col-span-7">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Tendencias Semanales</CardTitle>
                  <CardDescription>Compara el rendimiento por día de la semana</CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '360px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
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
                        data={[
                          { day: 'Lunes', currentWeek: 1200, previousWeek: 980 },
                          { day: 'Martes', currentWeek: 980, previousWeek: 1050 },
                          { day: 'Miércoles', currentWeek: 1100, previousWeek: 930 },
                          { day: 'Jueves', currentWeek: 1300, previousWeek: 1180 },
                          { day: 'Viernes', currentWeek: 1900, previousWeek: 1750 },
                          { day: 'Sábado', currentWeek: 2100, previousWeek: 2300 },
                          { day: 'Domingo', currentWeek: 1600, previousWeek: 1400 },
                        ]}
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
                        <ChartTooltip content={<ChartTooltipContent formatter={value => Currency(Number(value) * 100)} />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="currentWeek" fill="var(--color-currentWeek)" radius={4} maxBarSize={30} />
                        <Bar dataKey="previousWeek" fill="var(--color-previousWeek)" radius={4} maxBarSize={30} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Incremento de 8.3% respecto a la semana anterior</span>
                  </div>
                  <div className="leading-none text-muted-foreground">
                    El sábado es tu día más ocupado, pero has tenido una caída del 8.7% respecto a la semana anterior
                  </div>
                </CardFooter>
              </Card>

              {/* 5. EFICIENCIA DEL PERSONAL */}
              <Card className="lg:col-span-5">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Eficiencia del Personal</CardTitle>
                  <CardDescription>Analiza el rendimiento de tus meseros y cocineros</CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '360px' }}>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Ventas por Mesero</h3>
                        <div className="space-y-3">
                          {[
                            { name: 'Carlos Rodríguez', amount: 450000, tickets: 42, avgTime: '24 min' },
                            { name: 'Ana Martínez', amount: 380000, tickets: 36, avgTime: '22 min' },
                            { name: 'Miguel Sánchez', amount: 320000, tickets: 38, avgTime: '28 min' },
                            { name: 'Laura González', amount: 290000, tickets: 29, avgTime: '25 min' },
                          ].map((employee, i) => (
                            <div key={i} className="flex items-center">
                              <div className="w-32 flex-shrink-0 font-medium truncate">{employee.name}</div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center">
                                  <div
                                    className="h-2 rounded"
                                    style={{
                                      width: `${(employee.amount / 450000) * 100}%`,
                                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                    }}
                                  ></div>
                                  <span className="ml-2 text-sm">{Currency(employee.amount)}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {employee.tickets} órdenes • Tiempo promedio: {employee.avgTime}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-2">Tiempo Promedio de Preparación</h3>
                        <div className="space-y-3">
                          {[
                            { type: 'Entradas', time: 8, target: 10 },
                            { type: 'Platos Principales', time: 18, target: 15 },
                            { type: 'Postres', time: 6, target: 5 },
                            { type: 'Bebidas', time: 4, target: 3 },
                          ].map((category, i) => (
                            <div key={i} className="flex items-center">
                              <div className="w-32 flex-shrink-0 font-medium">{category.type}</div>
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-200 h-2 rounded overflow-hidden">
                                    <div
                                      className={`h-full rounded ${category.time <= category.target ? 'bg-green-500' : 'bg-amber-500'}`}
                                      style={{ width: `${(category.time / 20) * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="ml-2 text-sm">{category.time} min</span>
                                  <span className="ml-2 text-xs text-gray-500">Meta: {category.target} min</span>
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
                  <div className="leading-none text-muted-foreground">
                    Carlos genera las mayores ventas • Los platos principales están tomando 3 min más que el objetivo
                  </div>
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
