import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCcw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'


interface MetricData {
  labels: { field: string; value: string }[]
  values: { timestamp: string; value: number }[]
  unit: string
}

const UI_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

export default function ServerSettings() {

  const { data: cpuUsageData, isLoading: cpuUsageLoading } = useQuery({
    queryKey: ['cpu-usage'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/cpu-usage?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000,
  })

  const { data: cpuLimitData, isLoading: cpuLimitLoading } = useQuery({
    queryKey: ['cpu-limit'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/cpu-limit?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000,
  })

  const { data: memoryUsageData, isLoading: memoryUsageLoading } = useQuery({
    queryKey: ['memory-usage'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/memory-usage?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000,
  })

  const { data: memoryLimitData, isLoading: memoryLimitLoading } = useQuery({
    queryKey: ['memory-limit'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/memory-limit?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000,
  })

  const calculateCpuUsagePercentage = (): number => {
    if (!cpuUsageData?.[0]?.values?.length || !cpuLimitData?.[0]?.values?.length) return 0

    try {
      const latestValue = cpuUsageData[0].values[cpuUsageData[0].values.length - 1].value
      const latestLimit = cpuLimitData[0].values[cpuLimitData[0].values.length - 1].value
      return (latestValue / latestLimit) * 100
    } catch (error) {
      console.error('Error calculating CPU usage:', error)
      return 0
    }
  }

  const calculateAverageCpuUsage = (): number => {
    if (!cpuUsageData?.[0]?.values?.length) return 0

    try {
      const values = cpuUsageData[0].values
      const sum = values.reduce((acc, val) => acc + val.value, 0)
      return (sum / values.length) * 100
    } catch (error) {
      console.error('Error calculating average CPU usage:', error)
      return 0
    }
  }

  const calculateMemoryUsagePercentage = (): number => {
    if (!memoryUsageData?.[0]?.values?.length || !memoryLimitData?.[0]?.values?.length) return 0

    try {
      const latestUsage = memoryUsageData[0].values[memoryUsageData[0].values.length - 1].value
      const latestLimit = memoryLimitData[0].values[memoryLimitData[0].values.length - 1].value
      if (latestLimit === 0) return 0
      return (latestUsage / latestLimit) * 100
    } catch (error) {
      console.error('Error calculating memory usage:', error)
      return 0
    }
  }

  const CpuUsageChart = ({ cpuData }: { cpuData: MetricData }) => {
    const chartData = cpuData.values.map(item => ({
      timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: (item.value * 100).toFixed(2),
      rawValue: item.value * 100,
    }))

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="timestamp" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10 }}
            tickFormatter={value => `${value}%`}
            domain={[0, Math.max(...chartData.map(d => d.rawValue)) * 1.1 || 5]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={value => [`${value}%`, 'CPU']}
            labelFormatter={label => `Hora: ${label}`}
          />
          <Line type="monotone" dataKey="rawValue" stroke={UI_COLORS[0]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="CPU" />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-foreground">Configuración del Servidor</h3>

      <Card className="bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground">Estado del Sistema</CardTitle>
          <CardDescription className="text-muted-foreground">Estado actual del servidor y opciones de mantenimiento</CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-base font-medium text-foreground mb-2">Uso de CPU</h4>
              <div className="flex items-center mb-2">
                <div className="h-2 w-full bg-input rounded-full overflow-hidden">
                  {cpuUsageLoading || cpuLimitLoading ? (
                    <div className="h-full bg-muted animate-pulse" style={{ width: '100%' }}></div>
                  ) : (
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${calculateCpuUsagePercentage().toFixed(2)}%`,
                        backgroundColor: UI_COLORS[0],
                      }}
                    ></div>
                  )}
                </div>
                <span className="ml-2 text-xs text-foreground w-16 text-right">
                  {cpuUsageLoading || cpuLimitLoading ? 'Cargando...' : `${calculateCpuUsagePercentage().toFixed(2)}%`}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  Promedio: {cpuUsageLoading ? '...' : `${calculateAverageCpuUsage().toFixed(2)}%`}
                </p>
                <p className="text-xs text-muted-foreground">Límite: {cpuLimitLoading ? '...' : '100%'}</p>
              </div>
            </div>

            <div>
              <h4 className="text-base font-medium text-foreground mb-2">Memoria RAM</h4>
              <div className="flex items-center mb-2">
                <div className="h-2 w-full bg-input rounded-full overflow-hidden">
                  {memoryUsageLoading || memoryLimitLoading ? (
                    <div className="h-full bg-muted animate-pulse" style={{ width: '100%' }}></div>
                  ) : (
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${calculateMemoryUsagePercentage().toFixed(2)}%`,
                        backgroundColor: UI_COLORS[1],
                      }}
                    ></div>
                  )}
                </div>
                <span className="ml-2 text-xs text-foreground w-16 text-right">
                  {memoryUsageLoading || memoryLimitLoading ? 'Cargando...' : `${calculateMemoryUsagePercentage().toFixed(2)}%`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {memoryUsageLoading || memoryLimitLoading ? 'Cargando datos de memoria...' : 'Uso actual de memoria RAM'}
              </p>
            </div>
          </div>
        </CardContent>

        <CardContent className="px-6 pb-6 pt-0">
          <h4 className="text-base font-medium text-foreground mb-4">Historial de CPU (últimos 60 minutos)</h4>
          {cpuUsageLoading || cpuLimitLoading ? (
            <div className="h-24 bg-input rounded-md animate-pulse flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-40 w-full">
              {cpuUsageData && cpuUsageData[0]?.values.length > 0 ? (
                <CpuUsageChart cpuData={cpuUsageData[0]} />
              ) : (
                <div className="h-24 bg-input rounded-md flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <div className="border-t border-border p-4">
          <Button
            variant="outline"
            onClick={() => {
              // Invalidate queries here
            }}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualizar Datos
          </Button>
        </div>
      </Card>
    </div>
  )
}
