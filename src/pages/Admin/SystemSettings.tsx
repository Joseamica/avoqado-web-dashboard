import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShieldAlert, Database, Server, RefreshCcw, AlertTriangle, FileText, Download, Loader2, Trash2, Code } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
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
import { Switch } from '@/components/ui/switch'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '@/context/ThemeContext'

export default function SystemSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { theme } = useTheme()
  const queryClient = useQueryClient()
  const isSuperAdmin = user?.role === 'SUPERADMIN'
  const [logType, setLogType] = useState('application')
  const [linesCount, setLinesCount] = useState('100')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formattedLogs, setFormattedLogs] = useState('')
  const [useFormatting, setUseFormatting] = useState(true)
  const [isJsonContent, setIsJsonContent] = useState(false)

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

  // Format logs when they change
  useEffect(() => {
    if (logs?.content) {
      formatLogs(logs.content)
    } else {
      setFormattedLogs('No hay logs disponibles.')
      setIsJsonContent(false)
    }
  }, [logs, useFormatting])

  // Format logs to make them more readable
  const formatLogs = content => {
    if (!content) {
      setFormattedLogs('No hay logs disponibles.')
      setIsJsonContent(false)
      return
    }

    if (!useFormatting) {
      setFormattedLogs(content)
      setIsJsonContent(false)
      return
    }

    try {
      // Split content into lines
      const lines = content.split('\n')
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
      setFormattedLogs(content)
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

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-200">
              Esta sección contiene configuraciones avanzadas del sistema. Manipular estos valores incorrectamente puede afectar el
              funcionamiento de la plataforma.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="database">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="database">
            <Database className="h-4 w-4 mr-2" />
            Base de Datos
          </TabsTrigger>
          <TabsTrigger value="system">
            <Server className="h-4 w-4 mr-2" />
            Servidor
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4 py-4">
          <h3 className="text-lg font-medium">Configuración de Base de Datos</h3>

          <Card>
            <CardHeader>
              <CardTitle>Mantenimiento</CardTitle>
              <CardDescription>Opciones de mantenimiento de la base de datos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Cache</h4>
                    <p className="text-sm text-muted-foreground mb-2">Limpiar la cache de la base de datos para mejorar el rendimiento.</p>
                    <Button variant="outline" size="sm">
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Limpiar Cache
                    </Button>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Respaldo</h4>
                    <p className="text-sm text-muted-foreground mb-2">Crear un respaldo manual de la base de datos actual.</p>
                    <Button variant="outline" size="sm">
                      <Database className="h-4 w-4 mr-2" />
                      Crear Respaldo
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <p className="text-xs text-muted-foreground">Último mantenimiento: Hace 5 días</p>
              <Button variant="default" size="sm">
                Ejecutar Mantenimiento Completo
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4 py-4">
          <h3 className="text-lg font-medium">Configuración del Servidor</h3>

          <Card>
            <CardHeader>
              <CardTitle>Estado del Sistema</CardTitle>
              <CardDescription>Estado actual del servidor y opciones de mantenimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Uso de CPU</h4>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '30%' }}></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">30% de uso</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Memoria RAM</h4>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">45% de uso</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Reiniciar Servicios</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4 py-4">
          <h3 className="text-lg font-medium">Visualizador de Logs</h3>

          <Card>
            <CardHeader>
              <CardTitle>Logs del Sistema</CardTitle>
              <CardDescription>Visualiza los logs del backend para diagnóstico y solución de problemas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div className="w-full sm:w-auto">
                    <label className="text-sm font-medium mb-2 block">Tipo de Log</label>
                    <Select value={logType} onValueChange={setLogType}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="application">Aplicación</SelectItem>
                        <SelectItem value="error">Errores</SelectItem>
                        <SelectItem value="access">Acceso</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-auto">
                    <label className="text-sm font-medium mb-2 block">Número de líneas</label>
                    <Select value={linesCount} onValueChange={setLinesCount}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Número de líneas" />
                      </SelectTrigger>
                      <SelectContent>
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
                      <label htmlFor="format-json" className="text-sm font-medium">
                        <Code className="h-4 w-4 inline mr-1" />
                        Formatear JSON
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto sm:self-end">
                    <Button variant="outline" onClick={() => refetchLogs()} className="w-full sm:w-auto">
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Actualizar
                    </Button>

                    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Borrar Logs
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción borrará el archivo de logs de {getLogTypeName(logType)} y no se puede deshacer. Se creará un nuevo
                            archivo de logs vacío.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => clearLogsMutation.mutate()} className="bg-red-600 hover:bg-red-700">
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

                <div className="mt-4 border rounded-md">
                  {logsLoading ? (
                    <div className="flex justify-center items-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {isJsonContent && useFormatting ? (
                        <div className="h-[400px] overflow-auto">
                          <SyntaxHighlighter
                            language="json"
                            style={theme === 'dark' ? vscDarkPlus : vs}
                            className="h-full p-4 text-xs"
                            showLineNumbers={true}
                            wrapLongLines={true}
                          >
                            {formattedLogs}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <Textarea className="font-mono text-xs h-[400px] p-4 dark:bg-gray-900" readOnly value={formattedLogs} />
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <p className="text-xs text-muted-foreground">
                {logs?.lastUpdated ? `Última actualización: ${new Date(logs.lastUpdated).toLocaleString()}` : 'Sin datos'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadLogs}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Logs
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 py-4">
          <h3 className="text-lg font-medium">Configuración de Seguridad</h3>

          <Card>
            <CardHeader>
              <CardTitle>Opciones de Seguridad</CardTitle>
              <CardDescription>Configuración de seguridad de la plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Contenido de configuración de seguridad</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
