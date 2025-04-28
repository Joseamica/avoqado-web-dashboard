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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  BarChart3,
  Building,
  Code,
  Database,
  Download,
  FileText,
  Globe,
  Loader2,
  RefreshCcw,
  Server,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react'
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

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
  const navigate = useNavigate()
  const isSuperAdmin = user?.role === 'SUPERADMIN'
  const [logType, setLogType] = useState('application')
  const [linesCount, setLinesCount] = useState('100')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formattedLogs, setFormattedLogs] = useState('')
  const [useFormatting, setUseFormatting] = useState(true)
  const [isJsonContent, setIsJsonContent] = useState(false)
  const [showNewestFirst, setShowNewestFirst] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredLogs, setFilteredLogs] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Admin dashboard tab state
  const [adminTab, setAdminTab] = useState('system')

  // System settings tab state
  const [activeTab, setActiveTab] = useState('database')

  // Custom styles for active tab
  const activeTabStyle: CSSProperties = {
    borderBottom: `2px solid ${UI_COLORS[0]}`,
    color: UI_COLORS[0],
  }

  // Refs for scrolling
  const logsTextAreaRef = useRef(null)
  const syntaxHighlighterRef = useRef(null)

  // Get the syntax highlighting theme based on app theme
  const syntaxTheme = isDark ? oneDark : oneLight

  // Handle admin dashboard tab change
  const handleAdminTabChange = (value: string) => {
    setAdminTab(value)
    navigate(`/admin/${value}`)
  }

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

  const {
    data: logs,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['system-logs', logType, linesCount],
    queryFn: async () => {
      // Add a timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      try {
        const response = await api.get(`/v1/admin/logs?type=${logType}&lines=${linesCount}`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        return response.data
      } catch (error) {
        if (error.name === 'AbortError') {
          toast({
            title: 'Tiempo de espera agotado',
            description: 'La carga de logs tomó demasiado tiempo. Intente con menos líneas.',
            variant: 'destructive',
          })
        }
        throw error
      }
    },
    enabled: isSuperAdmin,
    // Disable automatic refetching to prevent unintended heavy loads
    refetchOnWindowFocus: false,
    // Add error handling
    retry: (failureCount, error) => {
      // Only retry once for network errors, not for timeout errors
      return failureCount < 1 && error.name !== 'AbortError'
    },
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

  // Add new useEffect for search filtering
  useEffect(() => {
    if (formattedLogs) {
      setFilteredLogs(filterLogs(formattedLogs, searchQuery))
    }
  }, [formattedLogs, searchQuery])

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
      // If showing newest first, reverse the lines but do it efficiently for large content
      if (showNewestFirst) {
        // For large content, this is more efficient than split/reverse/join
        const lines = content.split('\n')
        // Only process if not too large to prevent browser hanging
        if (lines.length < 10000) {
          setFormattedLogs(lines.reverse().join('\n'))
        } else {
          // For very large content, just show the last N lines
          const lastNLines = lines.slice(-5000)
          setFormattedLogs(lastNLines.reverse().join('\n'))
          toast({
            title: 'Archivo de logs muy grande',
            description: 'Mostrando solo las últimas 5000 líneas para mejorar el rendimiento.',
          })
        }
      } else {
        // If content is too large, truncate it
        if (content.length > 500000) {
          setFormattedLogs(content.substring(content.length - 500000))
          toast({
            title: 'Archivo de logs muy grande',
            description: 'Mostrando solo la parte final del archivo para mejorar el rendimiento.',
          })
        } else {
          setFormattedLogs(content)
        }
      }
      setIsJsonContent(false)
      return
    }

    try {
      // Optimize JSON detection and formatting
      // Split content into lines but with a limit to prevent performance issues
      let lines = content.split('\n')

      // For very large logs, limit the number of lines we process
      const maxLinesToProcess = 2000
      let truncatedLines = false

      if (lines.length > maxLinesToProcess) {
        truncatedLines = true
        if (showNewestFirst) {
          lines = lines.slice(-maxLinesToProcess)
        } else {
          lines = lines.slice(0, maxLinesToProcess)
        }
      }

      // If showing newest first, reverse the lines
      if (showNewestFirst) {
        lines = lines.reverse()
      }

      let hasJsonContent = false
      const formattedLines = []

      // Use a simple JSON detection regex to improve performance
      const jsonRegex = /({[\s\S]*}|\[[\s\S]*\])/

      // Process each line, limiting JSON formatting to reasonable size objects
      for (let line of lines) {
        try {
          const match = line.match(jsonRegex)

          if (match && match[0].length < 10000) {
            // Only try to parse reasonably sized JSON
            const jsonString = match[0]
            try {
              const jsonObj = JSON.parse(jsonString)
              const formattedJson = JSON.stringify(jsonObj, null, 2)

              // Replace the JSON part with formatted JSON
              const before = line.substring(0, match.index)
              const after = line.substring(match.index + jsonString.length)
              line = before + '\n' + formattedJson + '\n' + after
              hasJsonContent = true
            } catch (jsonError) {
              // Not valid JSON, keep line as is
            }
          }
        } catch (e) {
          // Error in regex or other issue, keep line as is
        }

        formattedLines.push(line)
      }

      setIsJsonContent(hasJsonContent)
      const result = formattedLines.join('\n')

      if (truncatedLines) {
        toast({
          title: 'Archivo de logs muy grande',
          description: `Mostrando solo ${maxLinesToProcess} líneas para mejorar el rendimiento.`,
        })
      }

      setFormattedLogs(result)
    } catch (error) {
      console.error('Error formatting logs:', error)
      // Fall back to simpler processing for error cases
      if (showNewestFirst) {
        const lines = content.split('\n')
        if (lines.length > 5000) {
          setFormattedLogs(lines.slice(-5000).reverse().join('\n'))
        } else {
          setFormattedLogs(lines.reverse().join('\n'))
        }
      } else {
        setFormattedLogs(content)
      }
      setIsJsonContent(false)
    }
  }

  // Update the filterLogs function to include loading state
  const filterLogs = (content: string, query: string) => {
    if (!query) return content
    setIsSearching(true)
    const lines = content.split('\n')
    const filtered = lines.filter(line => line.toLowerCase().includes(query.toLowerCase())).join('\n')
    // Simulate a small delay to show loading state
    setTimeout(() => setIsSearching(false), 300)
    return filtered
  }

  // 2. Improved log truncation with specific file handling
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      // First try the standard endpoint
      try {
        return await api.post(`/v1/admin/logs/clear`, {
          type: logType,
          // Add a parameter to handle different file types
          handleCompressed: true,
        })
      } catch (error) {
        // If that fails with a specific error code (your backend would need to return this)
        if (error.response?.status === 400 && error.response?.data?.error === 'compressed_file') {
          // Try the alternative endpoint for compressed files
          return await api.post(`/v1/admin/logs/truncate`, {
            type: logType,
          })
        }
        // Otherwise rethrow
        throw error
      }
    },
    onSuccess: () => {
      toast({
        title: 'Logs borrados',
        description: `Los logs de ${getLogTypeName(logType)} han sido borrados correctamente.`,
      })
      queryClient.invalidateQueries({ queryKey: ['system-logs'] })
      setIsDialogOpen(false)
    },
    onError: (error: any) => {
      console.error('Error clearing logs:', error)
      // More specific error message
      const errorMessage = error.response?.data?.message || 'No se pudieron borrar los logs. Contacte al administrador del sistema.'

      toast({
        title: 'Error',
        description: errorMessage,
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
    <div className={`flex flex-col space-y-6 h-screen ${themeClasses.pageBg}`}>
      {/* Admin Dashboard Tabs */}
      <div className="mb-4">
        <Tabs defaultValue={adminTab} onValueChange={handleAdminTabChange} className="w-full">
          <div className={`border-b ${themeClasses.border}`}>
            <TabsList className="mb-0">
              <TabsTrigger
                value="general"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
                style={adminTab === 'general' ? activeTabStyle : undefined}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
                style={adminTab === 'users' ? activeTabStyle : undefined}
              >
                <Users className="h-4 w-4 mr-2" />
                Usuarios
              </TabsTrigger>
              <TabsTrigger
                value="venues"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
                style={adminTab === 'venues' ? activeTabStyle : undefined}
              >
                <Building className="h-4 w-4 mr-2" />
                Venues
              </TabsTrigger>
              {isSuperAdmin && (
                <>
                  <TabsTrigger
                    value="system"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
                    style={adminTab === 'system' ? activeTabStyle : undefined}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Sistema
                  </TabsTrigger>
                  <TabsTrigger
                    value="global"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
                    style={adminTab === 'global' ? activeTabStyle : undefined}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Configuración Global
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger
                value="settings"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary"
                style={adminTab === 'settings' ? activeTabStyle : undefined}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>

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

      {/* System Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className={`${themeClasses.cardBg} rounded-md overflow-hidden shadow-sm mb-6`}>
          <TabsList className="w-full grid grid-cols-4 rounded-none">
            <TabsTrigger value="database" className="rounded-none">
              <Database className="h-5 w-5 mr-2" />
              <span>Base de Datos</span>
            </TabsTrigger>

            <TabsTrigger value="system" className="rounded-none">
              <Server className="h-5 w-5 mr-2" />
              <span>Servidor</span>
            </TabsTrigger>

            <TabsTrigger value="logs" className="rounded-none">
              <FileText className="h-5 w-5 mr-2" />
              <span>Logs</span>
            </TabsTrigger>

            <TabsTrigger value="security" className="rounded-none">
              <ShieldAlert className="h-5 w-5 mr-2" />
              <span>Seguridad</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Database tab */}
        <TabsContent value="database" className="mt-2">
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Configuración de Base de Datos</h3>

            <Card className={themeClasses.cardBg}>
              <CardHeader className={`border-b ${themeClasses.border}`}>
                <CardTitle className={themeClasses.text}>Mantenimiento</CardTitle>
                <CardDescription className={themeClasses.textMuted}>Opciones de mantenimiento de la base de datos</CardDescription>
              </CardHeader>

              <CardContent className="p-6">
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
              </CardContent>

              <div className={`border-t ${themeClasses.border} p-4 flex justify-between items-center`}>
                <p className={`text-xs ${themeClasses.textMuted}`}>Último mantenimiento: Hace 5 días</p>
                <Button variant="default" size="sm">
                  Ejecutar Mantenimiento Completo
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* System tab */}
        <TabsContent value="system" className="mt-2">
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Configuración del Servidor</h3>

            <Card className={themeClasses.cardBg}>
              <CardHeader className={`border-b ${themeClasses.border}`}>
                <CardTitle className={themeClasses.text}>Estado del Sistema</CardTitle>
                <CardDescription className={themeClasses.textMuted}>Estado actual del servidor y opciones de mantenimiento</CardDescription>
              </CardHeader>

              <CardContent className="p-6">
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
              </CardContent>

              <CardContent className="px-6 pb-6 pt-0">
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
              </CardContent>

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
            </Card>
          </div>
        </TabsContent>

        {/* Logs tab */}
        <TabsContent value="logs" className="mt-2">
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Visualizador de Logs</h3>

            <Card className={themeClasses.cardBg}>
              <CardHeader className={`border-b ${themeClasses.border}`}>
                <CardTitle className={themeClasses.text}>Logs del Sistema</CardTitle>
                <CardDescription className={themeClasses.textMuted}>
                  Visualiza los logs del backend para diagnóstico y solución de problemas
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
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

                  <div className="w-full sm:w-auto">
                    <label className={`text-sm font-medium ${themeClasses.text} mb-2 block`}>Buscar en logs</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar texto o clave..."
                        className={`w-full sm:w-[300px] h-10 px-4 py-2 rounded-md ${themeClasses.inputBg} ${themeClasses.border} ${themeClasses.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                      {isSearching && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>
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
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-[95%]" />
                      <Skeleton className="h-4 w-[90%]" />
                      <Skeleton className="h-4 w-[85%]" />
                      <Skeleton className="h-4 w-[80%]" />
                      <Skeleton className="h-4 w-[75%]" />
                      <Skeleton className="h-4 w-[70%]" />
                      <Skeleton className="h-4 w-[65%]" />
                      <Skeleton className="h-4 w-[60%]" />
                      <Skeleton className="h-4 w-[55%]" />
                    </div>
                  ) : isSearching ? (
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-[95%]" />
                      <Skeleton className="h-4 w-[90%]" />
                      <Skeleton className="h-4 w-[85%]" />
                      <Skeleton className="h-4 w-[80%]" />
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
                            {filteredLogs}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <Textarea
                          ref={logsTextAreaRef}
                          className={`font-mono text-xs h-[400px] p-4 resize-none ${themeClasses.inputBg} ${themeClasses.text}`}
                          readOnly
                          value={filteredLogs}
                        />
                      )}
                    </>
                  )}
                </div>
              </CardContent>

              <div className={`border-t ${themeClasses.border} p-4 flex justify-between items-center`}>
                <p className={`text-xs ${themeClasses.textMuted}`}>
                  {logs?.lastUpdated ? `Última actualización: ${new Date(logs.lastUpdated).toLocaleString()}` : 'Sin datos'}
                </p>
                <div className="flex gap-2">
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
            </Card>
          </div>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-2">
          <div className="space-y-4">
            <h3 className={`text-lg font-medium ${themeClasses.text}`}>Configuración de Seguridad</h3>

            <Card className={themeClasses.cardBg}>
              <CardHeader className={`border-b ${themeClasses.border}`}>
                <CardTitle className={themeClasses.text}>Opciones de Seguridad</CardTitle>
                <CardDescription className={themeClasses.textMuted}>Configuración de seguridad de la plataforma</CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <p className={themeClasses.text}>Contenido de configuración de seguridad</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
