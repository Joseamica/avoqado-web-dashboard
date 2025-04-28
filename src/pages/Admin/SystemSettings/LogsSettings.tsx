import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpToLine, Code, Download, FileText, Loader2, RefreshCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { themeClasses } from '@/lib/theme-utils'
import { useTheme } from '@/context/ThemeContext'
import api from '@/api'

export default function LogsSettings() {
  const { toast } = useToast()
  const { isDark } = useTheme()
  const queryClient = useQueryClient()
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

  const logsTextAreaRef = useRef(null)
  const syntaxHighlighterRef = useRef(null)
  const syntaxTheme = isDark ? oneDark : oneLight

  const {
    data: logs,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['system-logs', logType, linesCount],
    queryFn: async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

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
    enabled: true,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      return failureCount < 1 && error.name !== 'AbortError'
    },
  })

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      try {
        return await api.post(`/v1/admin/logs/clear`, {
          type: logType,
          handleCompressed: true,
        })
      } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.error === 'compressed_file') {
          return await api.post(`/v1/admin/logs/truncate`, {
            type: logType,
          })
        }
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
      const errorMessage = error.response?.data?.message || 'No se pudieron borrar los logs. Contacte al administrador del sistema.'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      setIsDialogOpen(false)
    },
  })

  const formatLogs = (content: string) => {
    if (!content) {
      setFormattedLogs('No hay logs disponibles.')
      setIsJsonContent(false)
      return
    }

    if (!useFormatting) {
      if (showNewestFirst) {
        const lines = content.split('\n')
        if (lines.length < 10000) {
          setFormattedLogs(lines.reverse().join('\n'))
        } else {
          const lastNLines = lines.slice(-5000)
          setFormattedLogs(lastNLines.reverse().join('\n'))
          toast({
            title: 'Archivo de logs muy grande',
            description: 'Mostrando solo las últimas 5000 líneas para mejorar el rendimiento.',
          })
        }
      } else {
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
      let lines = content.split('\n')
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

      if (showNewestFirst) {
        lines = lines.reverse()
      }

      let hasJsonContent = false
      const formattedLines = []
      const jsonRegex = /({[\s\S]*}|\[[\s\S]*\])/

      for (let line of lines) {
        try {
          const match = line.match(jsonRegex)
          if (match && match[0].length < 10000) {
            const jsonString = match[0]
            try {
              const jsonObj = JSON.parse(jsonString)
              const formattedJson = JSON.stringify(jsonObj, null, 2)
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

  const filterLogs = (content: string, query: string) => {
    if (!query) return content
    setIsSearching(true)
    const lines = content.split('\n')
    const filtered = lines.filter(line => line.toLowerCase().includes(query.toLowerCase())).join('\n')
    setTimeout(() => setIsSearching(false), 300)
    return filtered
  }

  useEffect(() => {
    if (logs?.content) {
      formatLogs(logs.content)
    } else {
      setFormattedLogs('No hay logs disponibles.')
      setIsJsonContent(false)
    }
  }, [logs, useFormatting, showNewestFirst])

  useEffect(() => {
    if (formattedLogs) {
      setFilteredLogs(filterLogs(formattedLogs, searchQuery))
    }
  }, [formattedLogs, searchQuery])

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

  const getLogTypeName = (type: string) => {
    const types: Record<string, string> = {
      application: 'Aplicación',
      error: 'Errores',
      access: 'Acceso',
      system: 'Sistema',
    }
    return types[type] || type
  }

  return (
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
              <Button variant="outline" onClick={() => refetchLogs()} className={`${themeClasses.border}`}>
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
                      Esta acción borrará el archivo de logs de {getLogTypeName(logType)} y no se puede deshacer. Se creará un nuevo archivo
                      de logs vacío.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className={`${themeClasses.border}`}>Cancelar</AlertDialogCancel>
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
                      customStyle={{
                        backgroundColor: isDark ? 'hsl(240 5.9% 10%)' : '#f8f9fa',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        padding: '1rem',
                      }}
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
            <Button variant="outline" size="sm" onClick={handleDownloadLogs} className={`${themeClasses.border}`}>
              <Download className="h-4 w-4 mr-2" />
              Descargar Logs
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
