import api from '@/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useToast } from '@/hooks/use-toast'
import { themeClasses } from '@/lib/theme-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Code,
  Database,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  Server,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Enhanced color palette for charts and UI elements
const UI_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

// Types for CPU and Memory metrics
interface MetricLabel {
  field: string
  value: string
}

interface MetricValue {
  timestamp: string
  value: number
}

interface MetricData {
  labels: MetricLabel[]
  values: MetricValue[]
  unit: string
}

export default function SystemSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { isDark } = useTheme()
  const queryClient = useQueryClient()
  const isSuperAdmin = user?.role === 'SUPERADMIN'
  const [logType, setLogType] = useState('application')
  const [linesCount, setLinesCount] = useState('100')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formattedLogs, setFormattedLogs] = useState('')
  const [useFormatting, setUseFormatting] = useState(true)
  const [isJsonContent, setIsJsonContent] = useState(false)
  const [activeTab, setActiveTab] = useState('database')
  const [showNewestFirst, setShowNewestFirst] = useState(true)

  // Refs for scrolling
  const logsTextAreaRef = useRef(null)
  const syntaxHighlighterRef = useRef(null)

  // Get the syntax highlighting theme based on app theme
  const syntaxTheme = isDark ? oneDark : oneLight

  // Custom syntax highlighter styling to match the app theme
  const syntaxStyles = useMemo(
    () => ({
      backgroundColor: isDark ? 'hsl(240 5.9% 10%)' : '#f8f9fa',
      fontSize: '0.75rem',
      borderRadius: '0.375rem',
      padding: '1rem',
    }),
    [isDark],
  )

  // CPU metrics queries
  const { data: cpuUsageData, isLoading: cpuUsageLoading } = useQuery({
    queryKey: ['cpu-usage'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/cpu-usage?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: activeTab === 'system' && isSuperAdmin,
  })

  const { data: cpuLimitData, isLoading: cpuLimitLoading } = useQuery({
    queryKey: ['cpu-limit'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/cpu-limit?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: activeTab === 'system' && isSuperAdmin,
  })

  const { data: memoryUsageData, isLoading: memoryUsageLoading } = useQuery({
    queryKey: ['memory-usage'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/memory-usage?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: activeTab === 'system' && isSuperAdmin,
  })

  const { data: memoryLimitData, isLoading: memoryLimitLoading } = useQuery({
    queryKey: ['memory-limit'],
    queryFn: async () => {
      const response = await api.get('/v1/render/metrics/memory-limit?resource=srv-cnajargl6cac73a39fa0')
      return response.data as MetricData[]
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: activeTab === 'system' && isSuperAdmin,
  })

  // Query to fetch logs
  const {
    data: logs,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['system-logs', logType, linesCount],
    queryFn: async () => {
      const response = await api.get(`/v1/admin/logs?type=${logType}&lines=${linesCount}`)
      return response.data
    },
    enabled: isSuperAdmin,
  })

  // Helper function to calculate the current CPU usage percentage
  const calculateCpuUsagePercentage = (): number => {
    if (!cpuUsageData || !cpuUsageData[0]?.values.length) return 0

    // Get the most recent value
    const latestValue = cpuUsageData[0].values[cpuUsageData[0].values.length - 1].value
    const latestLimit = cpuLimitData[0].values[cpuLimitData[0].values.length - 1].value

    // CPU usage is returned as a decimal (0-1), convert to percentage
    return (latestValue / latestLimit) * 100
  }

  // Helper function to calculate average CPU usage over the last hour
  const calculateAverageCpuUsage = (): number => {
    if (!cpuUsageData || !cpuUsageData[0]?.values.length) return 0

    const values = cpuUsageData[0].values
    const sum = values.reduce((acc, val) => acc + val.value, 0)

    return (sum / values.length) * 100
  }

  // Helper function to calculate the current memory usage percentage
  const calculateMemoryUsagePercentage = (): number => {
    if (!memoryUsageData || !memoryUsageData[0]?.values.length || !memoryLimitData || !memoryLimitData[0]?.values.length) return 45 // Fallback to 45% if data not available

    // Get the most recent values
    const latestUsage = memoryUsageData[0].values[memoryUsageData[0].values.length - 1].value
    const latestLimit = memoryLimitData[0].values[memoryLimitData[0].values.length - 1].value

    if (latestLimit === 0) return 0

    return (latestUsage / latestLimit) * 100
  }

  // Format logs when they change
  useEffect(() => {
    if (logs?.content) {
      formatLogs(logs.content)
    } else {
      setFormattedLogs('No hay logs disponibles.')
      setIsJsonContent(false)
    }
  }, [logs, useFormatting, showNewestFirst])

  // Scroll to bottom when logs change or show newest first option changes
  useEffect(() => {
    if (showNewestFirst) {
      scrollLogsToBottom()
    } else {
      scrollLogsToTop()
    }
  }, [formattedLogs, showNewestFirst])

  // Function to scroll logs to the bottom
  const scrollLogsToBottom = () => {
    setTimeout(() => {
      if (logsTextAreaRef.current) {
        logsTextAreaRef.current.scrollTop = logsTextAreaRef.current.scrollHeight
      }
      if (syntaxHighlighterRef.current) {
        const container = syntaxHighlighterRef.current.querySelector('pre')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }
    }, 100)
  }

  // Function to scroll logs to the top
  const scrollLogsToTop = () => {
    setTimeout(() => {
      if (logsTextAreaRef.current) {
        logsTextAreaRef.current.scrollTop = 0
      }
      if (syntaxHighlighterRef.current) {
        const container = syntaxHighlighterRef.current.querySelector('pre')
        if (container) {
          container.scrollTop = 0
        }
      }
    }, 100)
  }

  // Format logs to make them more readable
  const formatLogs = content => {
    if (!content) {
      setFormattedLogs('No hay logs disponibles.')
      setIsJsonContent(false)
      return
    }

    if (!useFormatting) {
      // If showing newest first, reverse the lines
      if (showNewestFirst) {
        setFormattedLogs(content.split('\n').reverse().join('\n'))
      } else {
        setFormattedLogs(content)
      }
      setIsJsonContent(false)
      return
    }

    try {
      // Split content into lines
      let lines = content.split('\n')

      // If showing newest first, reverse the lines
      if (showNewestFirst) {
        lines = lines.reverse()
      }

      const formattedLines = []
      let hasJsonContent = false

      // Process each line
      for (let line of lines) {
        // Try to detect JSON content inside the line
        try {
          // Look for JSON objects in the line
          const jsonRegex = /{.*}|\[.*\]/
          const match = line.match(jsonRegex)

          if (match) {
            const jsonString = match[0]
            const jsonObj = JSON.parse(jsonString)
            const formattedJson = JSON.stringify(jsonObj, null, 2)

            // Replace the JSON part with formatted JSON
            const before = line.substring(0, match.index)
            const after = line.substring(match.index + jsonString.length)
            line = before + '\n' + formattedJson + '\n' + after
            hasJsonContent = true
          }
        } catch (e) {
          // Not valid JSON or other error, keep line as is
        }

        formattedLines.push(line)
      }

      setIsJsonContent(hasJsonContent)
      setFormattedLogs(formattedLines.join('\n'))
    } catch (error) {
      console.error('Error formatting logs:', error)
      // If showing newest first, reverse the lines
      if (showNewestFirst) {
        setFormattedLogs(content.split('\n').reverse().join('\n'))
      } else {
        setFormattedLogs(content)
      }
      setIsJsonContent(false)
    }
  }

  // Mutation to clear logs
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/v1/admin/logs/clear`, { type: logType })
    },
    onSuccess: () => {
      toast({
        title: 'Logs borrados',
        description: `Los logs de ${getLogTypeName(logType)} han sido borrados correctamente.`,
      })
      queryClient.invalidateQueries({ queryKey: ['system-logs'] })
      setIsDialogOpen(false)
    },
    onError: error => {
      console.error('Error clearing logs:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron borrar los logs. Contacte al administrador del sistema.',
        variant: 'destructive',
      })
      setIsDialogOpen(false)
    },
  })

  if (!isSuperAdmin) {
    return (
      <div className="py-4">
        <p className="text-red-500">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  const handleDownloadLogs = async () => {
    try {
      const response = await api.get(`/v1/admin/logs/download?type=${logType}`, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${logType}-logs.txt`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading logs:', error)
    }
  }

  const getLogTypeName = type => {
    const types = {
      application: 'Aplicación',
      error: 'Errores',
      access: 'Acceso',
      system: 'Sistema',
    }
    return types[type] || type
  }

  // Style for tab buttons
  const tabStyle = isActive => {
    return `flex items-center space-x-2 py-4 px-6 flex-1 justify-center transition-colors ${
      isActive ? `bg-gray-800 text-white` : `bg-black hover:bg-gray-900 text-white`
    } ${!isActive ? 'border-r border-gray-700' : ''}`
  }

  // CPU usage chart component
  const CpuUsageChart = ({ cpuData }: { cpuData: MetricData }) => {
    // Transform the data for the chart
    const chartData = cpuData.values.map(item => ({
      timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: (item.value * 100).toFixed(2),
      rawValue: item.value * 100,
    }))

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#444' : '#eee'} />
          <XAxis dataKey="timestamp" stroke={isDark ? '#aaa' : '#666'} tick={{ fontSize: 10 }} />
          <YAxis
            stroke={isDark ? '#aaa' : '#666'}
            tick={{ fontSize: 10 }}
            tickFormatter={value => `${value}%`}
            domain={[0, Math.max(...chartData.map(d => d.rawValue)) * 1.1 || 5]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: isDark ? '#374151' : '#e5e7eb' }}
            labelStyle={{ color: isDark ? '#e5e7eb' : '#111827' }}
            formatter={value => [`${value}%`, 'CPU']}
            labelFormatter={label => `Hora: ${label}`}
          />
          <Line type="monotone" dataKey="rawValue" stroke={UI_COLORS[0]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="CPU" />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className={`flex flex-col space-y-6 ${themeClasses.pageBg}`}>
      {/* Warning banner */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className={`text-sm ${themeClasses.text}`}>
              Esta sección contiene configuraciones avanzadas del sistema. Manipular estos valores incorrectamente puede afectar el
              funcionamiento de la plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className={`${isDark ? 'bg-black' : themeClasses.cardBg} rounded-md overflow-hidden shadow-sm`}>
        <div className="flex">
          <button className={tabStyle(activeTab === 'database')} onClick={() => setActiveTab('database')}>
            <Database className="h-5 w-5 mr-2" />
            <span>Base de Datos</span>
          </button>

          <button className={tabStyle(activeTab === 'system')} onClick={() => setActiveTab('system')}>
            <Server className="h-5 w-5 mr-2" />
            <span>Servidor</span>
          </button>

          <button className={tabStyle(activeTab === 'logs')} onClick={() => setActiveTab('logs')}>
            <FileText className="h-5 w-5 mr-2" />
            <span>Logs</span>
          </button>

          <button className={tabStyle(activeTab === 'security')} onClick={() => setActiveTab('security')}>
            <ShieldAlert className="h-5 w-5 mr-2" />
            <span>Seguridad</span>
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-2">
        {/* Database tab */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Configuración de Base de Datos</h3>

            <div className={`${themeClasses.cardBg} rounded-md overflow-hidden shadow-sm`}>
              <div className={`border-b ${themeClasses.border} p-4`}>
                <h2 className={`text-lg font-medium ${themeClasses.text}`}>Mantenimiento</h2>
                <p className={`text-sm ${themeClasses.textMuted}`}>Opciones de mantenimiento de la base de datos</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className={`text-base font-medium ${themeClasses.text} mb-2`}>Cache</h4>
                    <p className={`text-sm ${themeClasses.textMuted} mb-4`}>
                      Limpiar la cache de la base de datos para mejorar el rendimiento.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : ''} ${themeClasses.border}`}
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Limpiar Cache
                    </Button>
                  </div>

                  <div>
                    <h4 className={`text-base font-medium ${themeClasses.text} mb-2`}>Respaldo</h4>
                    <p className={`text-sm ${themeClasses.textMuted} mb-4`}>Crear un respaldo manual de la base de datos actual.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : ''} ${themeClasses.border}`}
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Crear Respaldo
                    </Button>
                  </div>
                </div>
              </div>

              <div className={`border-t ${themeClasses.border} p-4 flex justify-between items-center`}>
                <p className={`text-xs ${themeClasses.textMuted}`}>Último mantenimiento: Hace 5 días</p>
                <Button variant="default" size="sm">
                  Ejecutar Mantenimiento Completo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* System tab */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Configuración del Servidor</h3>

            <div className={`${themeClasses.cardBg} rounded-md overflow-hidden shadow-sm`}>
              <div className={`border-b ${themeClasses.border} p-4`}>
                <h2 className={`text-lg font-medium ${themeClasses.text}`}>Estado del Sistema</h2>
                <p className={`text-sm ${themeClasses.textMuted}`}>Estado actual del servidor y opciones de mantenimiento</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className={`text-base font-medium ${themeClasses.text} mb-2`}>Uso de CPU</h4>
                    <div className="flex items-center mb-2">
                      <div className={`h-2 w-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                        {cpuUsageLoading ? (
                          <div className="h-full bg-gray-500 animate-pulse" style={{ width: '100%' }}></div>
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
                      <span className={`ml-2 text-xs ${themeClasses.text} w-16 text-right`}>
                        {cpuUsageLoading ? 'Cargando...' : `${calculateCpuUsagePercentage().toFixed(2)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className={`text-xs ${themeClasses.textMuted}`}>
                        Promedio: {cpuUsageLoading ? '...' : `${calculateAverageCpuUsage().toFixed(2)}%`}
                      </p>
                      <p className={`text-xs ${themeClasses.textMuted}`}>Límite: {cpuLimitLoading ? '...' : '100%'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-base font-medium ${themeClasses.text} mb-2`}>Memoria RAM</h4>
                    <div className="flex items-center mb-2">
                      <div className={`h-2 w-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                        {memoryUsageLoading ? (
                          <div className="h-full bg-gray-500 animate-pulse" style={{ width: '100%' }}></div>
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
                      <span className={`ml-2 text-xs ${themeClasses.text} w-16 text-right`}>
                        {memoryUsageLoading ? 'Cargando...' : `${calculateMemoryUsagePercentage().toFixed(2)}%`}
                      </span>
                    </div>
                    <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
                      {memoryUsageLoading ? 'Cargando datos de memoria...' : 'Uso actual de memoria RAM'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <h4 className={`text-base font-medium ${themeClasses.text} mb-4`}>Historial de CPU (últimos 60 minutos)</h4>
                {cpuUsageLoading ? (
                  <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="h-40 w-full">
                    {cpuUsageData && cpuUsageData[0]?.values.length > 0 ? (
                      <CpuUsageChart cpuData={cpuUsageData[0]} />
                    ) : (
                      <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                        <p className={`text-sm ${themeClasses.textMuted}`}>No hay datos disponibles</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`border-t ${themeClasses.border} p-4`}>
                <Button
                  variant="outline"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['cpu-usage'] })
                    queryClient.invalidateQueries({ queryKey: ['cpu-limit'] })
                    queryClient.invalidateQueries({ queryKey: ['memory-usage'] })
                    queryClient.invalidateQueries({ queryKey: ['memory-limit'] })
                  }}
                  className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : ''} ${themeClasses.border}`}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Actualizar Datos
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Logs tab */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Visualizador de Logs</h3>

            <div className={`${themeClasses.cardBg} rounded-md overflow-hidden shadow-sm`}>
              <div className={`border-b ${themeClasses.border} p-4`}>
                <h2 className={`text-lg font-medium ${themeClasses.text}`}>Logs del Sistema</h2>
                <p className={`text-sm ${themeClasses.textMuted}`}>
                  Visualiza los logs del backend para diagnóstico y solución de problemas
                </p>
              </div>

              <div className="p-6">
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="w-full sm:w-auto">
                    <label className={`text-sm font-medium ${themeClasses.text} mb-2 block`}>Tipo de Log</label>
                    <Select value={logType} onValueChange={setLogType}>
                      <SelectTrigger className={`w-full sm:w-[200px] ${themeClasses.inputBg} ${themeClasses.border}`}>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent className={`${themeClasses.cardBg} ${themeClasses.border}`}>
                        <SelectItem value="application">Aplicación</SelectItem>
                        <SelectItem value="error">Errores</SelectItem>
                        <SelectItem value="access">Acceso</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-auto">
                    <label className={`text-sm font-medium ${themeClasses.text} mb-2 block`}>Número de líneas</label>
                    <Select value={linesCount} onValueChange={setLinesCount}>
                      <SelectTrigger className={`w-full sm:w-[200px] ${themeClasses.inputBg} ${themeClasses.border}`}>
                        <SelectValue placeholder="Número de líneas" />
                      </SelectTrigger>
                      <SelectContent className={`${themeClasses.cardBg} ${themeClasses.border}`}>
                        <SelectItem value="50">50 líneas</SelectItem>
                        <SelectItem value="100">100 líneas</SelectItem>
                        <SelectItem value="200">200 líneas</SelectItem>
                        <SelectItem value="500">500 líneas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 w-full mt-2 sm:mt-0 sm:w-auto sm:self-end">
                    <div className="flex items-center space-x-2">
                      <Switch id="format-json" checked={useFormatting} onCheckedChange={setUseFormatting} />
                      <label htmlFor="format-json" className={`text-sm font-medium ${themeClasses.text}`}>
                        <Code className="h-4 w-4 inline mr-1" />
                        Formatear JSON
                      </label>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Switch id="newest-first" checked={showNewestFirst} onCheckedChange={setShowNewestFirst} />
                      <label htmlFor="newest-first" className={`text-sm font-medium ${themeClasses.text}`}>
                        {showNewestFirst ? (
                          <ArrowDownToLine className="h-4 w-4 inline mr-1" />
                        ) : (
                          <ArrowUpToLine className="h-4 w-4 inline mr-1" />
                        )}
                        Nuevos primero
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto sm:self-end ml-auto">
                    <Button
                      variant="outline"
                      onClick={() => refetchLogs()}
                      className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : ''} ${themeClasses.border}`}
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Actualizar
                    </Button>

                    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Borrar Logs
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className={`${themeClasses.cardBg} ${themeClasses.border}`}>
                        <AlertDialogHeader>
                          <AlertDialogTitle className={themeClasses.text}>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription className={themeClasses.textMuted}>
                            Esta acción borrará el archivo de logs de {getLogTypeName(logType)} y no se puede deshacer. Se creará un nuevo
                            archivo de logs vacío.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : ''} ${themeClasses.border}`}>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={() => clearLogsMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
                            {clearLogsMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Borrando...
                              </>
                            ) : (
                              'Borrar Logs'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className={`border ${themeClasses.border} rounded-md overflow-hidden`}>
                  {logsLoading ? (
                    <div className={`flex justify-center items-center p-8 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <>
                      {isJsonContent && useFormatting ? (
                        <div ref={syntaxHighlighterRef} className="h-[400px] overflow-auto">
                          <SyntaxHighlighter
                            language="json"
                            style={syntaxTheme}
                            customStyle={syntaxStyles}
                            className="h-full"
                            showLineNumbers={true}
                            wrapLongLines={true}
                          >
                            {formattedLogs}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <Textarea
                          ref={logsTextAreaRef}
                          className={`font-mono text-xs h-[400px] p-4 resize-none ${themeClasses.inputBg} ${themeClasses.text}`}
                          readOnly
                          value={formattedLogs}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className={`border-t ${themeClasses.border} p-4 flex justify-between items-center`}>
                <p className={`text-xs ${themeClasses.textMuted}`}>
                  {logs?.lastUpdated ? `Última actualización: ${new Date(logs.lastUpdated).toLocaleString()}` : 'Sin datos'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadLogs}
                  className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : ''} ${themeClasses.border}`}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Logs
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Security tab */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Configuración de Seguridad</h3>

            <div className={`${themeClasses.cardBg} rounded-md overflow-hidden shadow-sm`}>
              <div className={`border-b ${themeClasses.border} p-4`}>
                <h2 className={`text-lg font-medium ${themeClasses.text}`}>Opciones de Seguridad</h2>
                <p className={`text-sm ${themeClasses.textMuted}`}>Configuración de seguridad de la plataforma</p>
              </div>

              <div className="p-6">
                <p className={themeClasses.text}>Contenido de configuración de seguridad</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
