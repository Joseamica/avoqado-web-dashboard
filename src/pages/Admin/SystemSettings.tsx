import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'
import { themeClasses } from '@/lib/theme-utils'
import { AlertTriangle, ArrowLeft, Database, FileText, Server, ShieldAlert } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { Link } from 'react-router-dom'

// Import new component modules
import DatabaseSettings from './SystemSettings/DatabaseSettings'
import LogsSettings from './SystemSettings/LogsSettings'
import ServerSettings from './SystemSettings/ServerSettings'

export default function SystemSettings() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPERADMIN'

  // System settings tab state
  const [activeTab, setActiveTab] = useState('database')

  // Loading states for each tab
  const [databaseLoading, setDatabaseLoading] = useState(true)
  const [serverLoading, setServerLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(true)
  const [securityLoading, setSecurityLoading] = useState(true)

  // Handle tab change and trigger loading state
  const handleTabChange = (value: string) => {
    setActiveTab(value)

    // Set the corresponding tab to loading state
    if (value === 'database') setDatabaseLoading(true)
    if (value === 'system') setServerLoading(true)
    if (value === 'logs') setLogsLoading(true)
    if (value === 'security') setSecurityLoading(true)

    // Simulate loading time (remove this in production and use actual loading states from the components)
    setTimeout(() => {
      if (value === 'database') setDatabaseLoading(false)
      if (value === 'system') setServerLoading(false)
      if (value === 'logs') setLogsLoading(false)
      if (value === 'security') setSecurityLoading(false)
    }, 800)
  }

  // Initial load completion
  useEffect(() => {
    setTimeout(() => {
      setDatabaseLoading(false)
    }, 800)
  }, [])

  if (!isSuperAdmin) {
    return (
      <div className="py-4">
        {/* Consider adding a more generic 'access denied' component here */}
        <Card className={`${themeClasses.border}`}>
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2">
              <AlertTriangle className={`h-5 w-5 ${themeClasses.error.text} mt-0.5`} />
              <div>
                <h3 className={`text-lg font-semibold ${themeClasses.text}`}>Acceso restringido</h3>
                <p className={`${themeClasses.textMuted}`}>Solo los SuperAdministradores pueden acceder a la configuración del sistema.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`flex flex-col space-y-6 h-screen ${themeClasses.pageBg} p-4 md:p-6`}>
      <Link to="/admin" className={`inline-flex items-center text-sm ${themeClasses.textMuted} hover:${themeClasses.text} mb-2`}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver al Panel de Administración
      </Link>
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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className={`${themeClasses.cardBg} rounded-md overflow-hidden shadow-sm mb-6`}>
          <TabsList className="w-full grid grid-cols-4 rounded-none">
            <TabsTrigger value="database" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
              <Database className="h-5 w-5 mr-2" />
              <span>Base de Datos</span>
            </TabsTrigger>

            <TabsTrigger value="system" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
              <Server className="h-5 w-5 mr-2" />
              <span>Servidor</span>
            </TabsTrigger>

            <TabsTrigger value="logs" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
              <FileText className="h-5 w-5 mr-2" />
              <span>Logs</span>
            </TabsTrigger>

            <TabsTrigger value="security" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
              <ShieldAlert className="h-5 w-5 mr-2" />
              <span>Seguridad</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Database tab */}
        <TabsContent value="database" className="mt-2">
          {databaseLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64 mb-6" />
              <Card className={themeClasses.cardBg}>
                <CardHeader className={`border-b ${themeClasses.border}`}>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <Skeleton className="h-6 w-32 mb-3" />
                      <Skeleton className="h-4 w-80 mb-6" />
                      <Skeleton className="h-10 w-40" />
                    </div>
                    <div>
                      <Skeleton className="h-6 w-32 mb-3" />
                      <Skeleton className="h-4 w-80 mb-6" />
                      <Skeleton className="h-10 w-40" />
                    </div>
                  </div>
                </CardContent>
                <div className={`border-t ${themeClasses.border} p-4 flex justify-between items-center`}>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-10 w-56" />
                </div>
              </Card>
            </div>
          ) : (
            <DatabaseSettings />
          )}
        </TabsContent>

        {/* System tab */}
        <TabsContent value="system" className="mt-2">
          {serverLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64 mb-6" />
              <Card className={themeClasses.cardBg}>
                <CardHeader className={`border-b ${themeClasses.border}`}>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <Skeleton className="h-6 w-32 mb-3" />
                      <div className="flex items-center mb-2">
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="ml-2 h-4 w-16" />
                      </div>
                      <div className="flex justify-between mt-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                    <div>
                      <Skeleton className="h-6 w-32 mb-3" />
                      <div className="flex items-center mb-2">
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="ml-2 h-4 w-16" />
                      </div>
                      <Skeleton className="h-4 w-48 mt-1" />
                    </div>
                  </div>
                </CardContent>
                <CardContent className="px-6 pb-6 pt-0">
                  <Skeleton className="h-6 w-64 mb-4" />
                  <Skeleton className="h-40 w-full rounded-md" />
                </CardContent>
                <div className={`border-t ${themeClasses.border} p-4`}>
                  <Skeleton className="h-10 w-40" />
                </div>
              </Card>
            </div>
          ) : (
            <ServerSettings />
          )}
        </TabsContent>

        {/* Logs tab */}
        <TabsContent value="logs" className="mt-2">
          {logsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64 mb-6" />
              <Card className={themeClasses.cardBg}>
                <CardHeader className={`border-b ${themeClasses.border}`}>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-4 mb-6">
                    <div className="w-full sm:w-auto">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-10 w-[200px]" />
                    </div>
                    <div className="w-full sm:w-auto">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-10 w-[200px]" />
                    </div>
                    <div className="w-full sm:w-auto">
                      <Skeleton className="h-4 w-28 mb-2" />
                      <Skeleton className="h-10 w-[300px]" />
                    </div>
                    <div className="flex items-center gap-2 w-full mt-2 ml-auto">
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-[400px] w-full rounded-md" />
                </CardContent>
                <div className={`border-t ${themeClasses.border} p-4 flex justify-between items-center`}>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-8 w-40" />
                </div>
              </Card>
            </div>
          ) : (
            <LogsSettings />
          )}
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-2">
          {securityLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64 mb-6" />
              <Card className={themeClasses.cardBg}>
                <CardHeader className={`border-b ${themeClasses.border}`}>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-full mb-3" />
                  <Skeleton className="h-4 w-[95%] mb-3" />
                  <Skeleton className="h-4 w-[90%] mb-3" />
                  <Skeleton className="h-4 w-[85%]" />
                </CardContent>
              </Card>
            </div>
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
