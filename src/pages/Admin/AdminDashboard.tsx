import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'
import { BarChart3, Building, Database, Globe, Lock, Settings, Shield, Users } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'


export default function AdminDashboard() {
  const { user } = useAuth()

  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')

  const isSuperAdmin = user?.role === 'SUPERADMIN'

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    navigate(`/admin/${value}`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div
        className="sticky top-0 z-20 flex flex-row justify-between w-full px-4 py-3 bg-card border-border border-b shadow-md backdrop-blur-sm"
      >
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-medium text-foreground">Panel de Administración</h1>
        </div>
        <div className="flex items-center space-x-2">
          {isSuperAdmin && (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-md">
              SuperAdmin
            </span>
          )}
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <ThemeToggle />
        </div>
      </div>

      <div className={`container mx-auto py-6 flex-grow`}>
        <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="bg-card rounded-md overflow-hidden shadow-sm mb-6">
            <TabsList className={`w-full grid ${isSuperAdmin ? 'grid-cols-6' : 'grid-cols-4'} rounded-none`}>
              <TabsTrigger
                value="general"
                className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary"
                
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary"
                
              >
                <Users className="h-4 w-4 mr-2" />
                Usuarios
              </TabsTrigger>
              <TabsTrigger
                value="venues"
                className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary"
                
              >
                <Building className="h-4 w-4 mr-2" />
                Venues
              </TabsTrigger>
              {isSuperAdmin && (
                <>
                  <TabsTrigger
                    value="system"
                    className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary"
                    
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Sistema
                  </TabsTrigger>
                  <TabsTrigger
                    value="global"
                    className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary"
                    
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Configuración Global
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger
                value="settings"
                className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary"
                
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground">Resumen</CardTitle>
                  <CardDescription className="text-muted-foreground">Vista general del sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">Contenido del panel general</p>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground">Actividad Reciente</CardTitle>
                  <CardDescription className="text-muted-foreground">Últimas acciones realizadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">Contenido de actividad reciente</p>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground">Rendimiento</CardTitle>
                  <CardDescription className="text-muted-foreground">Métricas del sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">Contenido de rendimiento</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Gestión de Usuarios</h2>
            <Separator className="mb-6 border-border" />
            <p className="text-muted-foreground">Administra los usuarios del sistema</p>
            <Outlet />
          </TabsContent>

          <TabsContent value="venues" className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Gestión de Venues</h2>
            <Separator className="mb-6 border-border" />
            <p className="text-muted-foreground">Administra los venues registrados</p>
            <Outlet />
          </TabsContent>

          {isSuperAdmin && (
            <>
              <TabsContent value="system" className="mt-6">
                <h2 className="text-xl font-semibold mb-4 text-foreground">Configuración del Sistema</h2>
                <Separator className="mb-6 border-border" />
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 dark:bg-yellow-900/20 dark:border-yellow-600">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Lock className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-foreground">
                        Esta sección está restringida solo para SuperAdmins y contiene configuraciones sensibles del sistema.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground">Administra las configuraciones a nivel de sistema</p>
                <Outlet />
              </TabsContent>

              <TabsContent value="global" className="mt-6">
                <h2 className="text-xl font-semibold mb-4 text-foreground">Configuración Global</h2>
                <Separator className="mb-6 border-border" />
                <p className="text-muted-foreground">Administra las configuraciones globales de la plataforma</p>
                <Outlet />
              </TabsContent>
            </>
          )}

          <TabsContent value="settings" className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Configuración de Cuenta</h2>
            <Separator className="mb-6 border-border" />
            <p className="text-muted-foreground">Administra tu cuenta y preferencias</p>
            <Outlet />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
