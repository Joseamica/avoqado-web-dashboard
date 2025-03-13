import api from '@/api'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart, Bar, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

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

// Paleta de colores mejorada para los gráficos
const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1']

const Home = () => {
  const { venueId } = useParams()
  const [exportLoading, setExportLoading] = useState(false)

  const [selectedRange, setSelectedRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    to: new Date(new Date().setHours(23, 59, 59, 999)), // Today
  })

  // Fetch all info from API with date range parameters
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

  // Use useMemo for filteredPayments
  const filteredPayments = useMemo(() => {
    if (!selectedRange || !data?.payments) return []

    return data.payments.filter(payment => {
      const paymentDate = new Date(payment.createdAt)
      return paymentDate >= selectedRange.from && paymentDate <= selectedRange.to
    })
  }, [selectedRange, data?.payments])

  // Use useMemo for amount calculation
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
      .map(([date, amount]) => ({
        date,
        amount: Number((amount / 100).toFixed(2)),
        formattedDate: format(new Date(date), 'dd MMM', { locale: es }),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [filteredPayments])

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
          comida: bestSellingProducts.FOOD,
          bebidas: bestSellingProducts.BEVERAGE,
          otros: bestSellingProducts.OTHER,
        },
        propinas: tipsChartData,
      }

      // Convertir a JSON y luego a Blob
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })

      // Crear URL para descargar
      const url = URL.createObjectURL(blob)

      // Nombre del archivo con fecha actual
      const fileName = `dashboard_${venueId}_${format(new Date(), 'yyyy-MM-dd')}.json`

      // Crear enlace y forzar descarga
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
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
      csvContent += 'MÉTRICAS GENERALES\n'
      csvContent += 'Total Ventas,5 Estrellas Google,Total Propinas,Promedio Propinas %\n'
      csvContent += `${Currency(totalAmount).replace('$', '')},${fiveStarReviews},${Currency(tipStats.totalTips).replace('$', '')},${
        tipStats.avgTipPercentage
      }%\n\n`

      // Métodos de pago
      csvContent += 'MÉTODOS DE PAGO\n'
      csvContent += 'Método,Total\n'
      paymentMethodsData.forEach(item => {
        csvContent += `${item.method},${Currency(item.total).replace('$', '')}\n`
      })
      csvContent += '\n'

      // Productos mejor vendidos
      csvContent += 'PRODUCTOS MEJOR VENDIDOS\n'
      csvContent += 'Categoría,Producto,Cantidad\n'

      bestSellingProducts.FOOD.forEach(item => {
        csvContent += `${categoryTranslations.FOOD},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.BEVERAGE.forEach(item => {
        csvContent += `${categoryTranslations.BEVERAGE},${item.name},${item.quantity}\n`
      })
      bestSellingProducts.OTHER.forEach(item => {
        csvContent += `${categoryTranslations.OTHER},${item.name},${item.quantity}\n`
      })
      csvContent += '\n'

      // Propinas por fecha
      csvContent += 'PROPINAS POR FECHA\n'
      csvContent += 'Fecha,Monto\n'
      tipsChartData.forEach(item => {
        csvContent += `${item.date},${item.amount}\n`
      })

      // Codificar y crear URL
      const encodedUri = encodeURI(csvContent)
      const fileName = `dashboard_${venueId}_${format(new Date(), 'yyyy-MM-dd')}.csv`

      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', fileName)
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
    <div className=" flex flex-col min-h-screen bg-gray-50">
      {/* Header with date range buttons */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            <DateRangePicker
              showCompare={false}
              onUpdate={({ range }) => {
                setSelectedRange(range)
              }}
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
              />
              <MetricCard title="5 Estrellas Google" value={isLoading ? null : fiveStarReviews} isLoading={isLoading} icon={<StarIcon />} />
              <MetricCard
                title="Total Propinas"
                value={isLoading ? null : Currency(tipStats.totalTips)}
                isLoading={isLoading}
                icon={<TipIcon />}
              />
              <MetricCard
                title="Promedio Propinas %"
                value={isLoading ? null : `${tipStats.avgTipPercentage}%`}
                isLoading={isLoading}
                icon={<PercentIcon />}
              />
            </div>

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              {/* Payment methods chart */}
              <Card className="lg:col-span-4">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Métodos de pago</CardTitle>
                </CardHeader>
                <CardContent className="h-80 pt-6">
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : !paymentMethodsData || paymentMethodsData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay datos disponibles</p>
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
                          outerRadius={120}
                          innerRadius={60}
                          paddingAngle={2}
                          label={({ method, percent }) => `${method}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {paymentMethodsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={value => `${Currency(value as number)}`}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend verticalAlign="bottom" align="center" layout="horizontal" iconSize={10} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Best selling products */}
              <Card className="lg:col-span-3">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Productos mejor vendidos</CardTitle>
                  <CardDescription>Artículos más vendidos por categoría</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
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
              <CardHeader className="border-b pb-3">
                <CardTitle>Propinas por fecha</CardTitle>
              </CardHeader>
              <CardContent className="h-80 pt-6">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : !tipsChartData || tipsChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No hay datos de propinas disponibles</p>
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
const MetricCard = ({ title, value, isLoading, icon }) => {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-br from-blue-50 to-white">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium text-gray-700">{title}</CardTitle>
          <div className="text-blue-500">{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
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
const BestSellingProducts = ({ bestFood, bestBeverages, bestOther, translations }) => {
  const limitedFood = bestFood.slice(0, 3)
  const limitedBeverages = bestBeverages.slice(0, 3)
  const limitedOther = bestOther.slice(0, 3)

  return (
    <div className="grid grid-cols-1 gap-6">
      <ProductList title={translations.FOOD} products={limitedFood} icon={<FoodIcon />} />
      <ProductList title={translations.BEVERAGE} products={limitedBeverages} icon={<BeverageIcon />} />
      <ProductList title={translations.OTHER} products={limitedOther} icon={<OtherIcon />} />
    </div>
  )
}

// Product List Component
const ProductList = ({ title, products, icon }) => {
  return (
    <div className="bg-white rounded-lg p-3 border">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-blue-500">{icon}</div>
        <h3 className="font-medium">{title}</h3>
      </div>
      {products.length > 0 ? (
        <ul className="space-y-2">
          {products.map((product, index) => (
            <li key={index} className="flex justify-between text-sm p-2 bg-gray-50 rounded-md">
              <span className="truncate mr-2">{product.name}</span>
              <span className="font-medium">{product.quantity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">No hay datos disponibles</p>
      )}
    </div>
  )
}

// Tips Chart Component
const TipsChart = ({ tips }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={tips} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={value => `$${value}`} width={60} />
        <Tooltip
          formatter={value => [`$${value}`, 'Propinas']}
          labelFormatter={label => `Fecha: ${label}`}
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
        <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={30}>
          {tips.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={`rgba(59, 130, 246, ${0.5 + (0.5 * index) / tips.length})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Iconos para las tarjetas y categorías
const DollarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
)

const StarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
)

const TipIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 11 12 14 22 4"></polyline>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
  </svg>
)

const PercentIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="5" x2="5" y2="19"></line>
    <circle cx="6.5" cy="6.5" r="2.5"></circle>
    <circle cx="17.5" cy="17.5" r="2.5"></circle>
  </svg>
)

const FoodIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
    <line x1="6" y1="1" x2="6" y2="4"></line>
    <line x1="10" y1="1" x2="10" y2="4"></line>
    <line x1="14" y1="1" x2="14" y2="4"></line>
  </svg>
)

const BeverageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 8h1a4 4 0 1 1 0 8h-1"></path>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"></path>
  </svg>
)

const OtherIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
)

export default Home
