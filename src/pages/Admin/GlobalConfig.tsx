import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { themeClasses } from '@/lib/theme-utils'
import { useTheme } from '@/context/ThemeContext'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Globe, Save, Settings, ShieldCheck, MailCheck, Cloud, CreditCard, Loader2, RefreshCcw } from 'lucide-react'
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

// Mock global configuration
const mockGlobalConfig = {
  appSettings: {
    appName: 'Avoqado',
    appVersion: '1.2.3',
    defaultTheme: 'light',
    defaultLanguage: 'es',
    sessionTimeout: 30,
    maintenanceMode: false,
  },
  security: {
    passwordPolicyMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordExpiryDays: 90,
    twoFactorAuthEnabled: true,
    allowMultipleDevices: true,
    sessionTimeoutMinutes: 30,
  },
  email: {
    fromEmail: 'noreply@avoqado.com',
    smtpServer: 'smtp.example.com',
    smtpPort: 587,
    smtpUsername: 'smtp_user',
    enableEmailVerification: true,
    emailTemplatesPath: '/templates/email',
  },
  payment: {
    stripeEnabled: true,
    stripePublicKey: 'pk_test_123456789',
    paypalEnabled: false,
    paypalClientId: '',
    defaultCurrency: 'EUR',
    allowedCurrencies: ['EUR', 'USD', 'GBP'],
  },
  apis: {
    googleMapsApiKey: 'AIzaSyB_test_key',
    weatherApiKey: 'weather_test_key',
    geocodingEnabled: true,
  },
}

export default function GlobalConfig() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState('app')
  const [config, setConfig] = useState(mockGlobalConfig)
  const [isSaving, setIsSaving] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const isSuperAdmin = user?.role === 'SUPERADMIN'

  // Handle saving global configuration
  const handleSaveConfig = () => {
    setIsSaving(true)

    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: 'Configuración guardada',
        description: 'La configuración global ha sido actualizada correctamente.',
      })
    }, 1500)
  }

  // Handle application restart
  const handleRestartApp = () => {
    setIsRestarting(true)

    // Simulate API call
    setTimeout(() => {
      setIsRestarting(false)
      toast({
        title: 'Aplicación reiniciada',
        description: 'La aplicación ha sido reiniciada correctamente.',
      })
    }, 3000)
  }

  // Update config values
  const updateConfig = (section, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))
  }

  if (!isSuperAdmin) {
    return (
      <div className="py-4">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold">Acceso restringido</h3>
                <p className="text-muted-foreground">Solo los SuperAdministradores pueden acceder a la configuración global.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${themeClasses.text}`}>Configuración Global</h2>
        <p className={`${themeClasses.textMuted}`}>Administra la configuración global del sistema</p>
      </div>

      {/* Warning banner */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className={`text-sm ${themeClasses.text}`}>
              Esta sección contiene configuraciones globales que afectan a todo el sistema. Manipular estos valores incorrectamente puede
              afectar el funcionamiento de la plataforma para todos los usuarios.
            </p>
          </div>
        </div>
      </div>

      <div className={`${themeClasses.cardBg} rounded-md overflow-hidden shadow-sm`}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="app" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              <span>Aplicación</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center">
              <ShieldCheck className="h-4 w-4 mr-2" />
              <span>Seguridad</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center">
              <MailCheck className="h-4 w-4 mr-2" />
              <span>Email</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              <span>Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center">
              <Cloud className="h-4 w-4 mr-2" />
              <span>APIs</span>
            </TabsTrigger>
          </TabsList>

          {/* App Settings Tab */}
          <TabsContent value="app" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Configuración General</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre de la Aplicación</label>
                  <Input value={config.appSettings.appName} onChange={e => updateConfig('appSettings', 'appName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Versión</label>
                  <div className="flex items-center">
                    <Input
                      value={config.appSettings.appVersion}
                      onChange={e => updateConfig('appSettings', 'appVersion', e.target.value)}
                      className="read-only:opacity-50"
                      readOnly
                    />
                    <Badge className="ml-2">Actual</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tema Por Defecto</label>
                  <Select
                    value={config.appSettings.defaultTheme}
                    onValueChange={value => updateConfig('appSettings', 'defaultTheme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Oscuro</SelectItem>
                      <SelectItem value="system">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Idioma Por Defecto</label>
                  <Select
                    value={config.appSettings.defaultLanguage}
                    onValueChange={value => updateConfig('appSettings', 'defaultLanguage', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tiempo de Sesión (minutos)</label>
                  <Input
                    type="number"
                    value={config.appSettings.sessionTimeout}
                    onChange={e => updateConfig('appSettings', 'sessionTimeout', parseInt(e.target.value))}
                    min="5"
                    max="120"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Modo Mantenimiento</label>
                    <p className="text-xs text-muted-foreground">Si está activado, solo los administradores podrán acceder</p>
                  </div>
                  <Switch
                    checked={config.appSettings.maintenanceMode}
                    onCheckedChange={checked => updateConfig('appSettings', 'maintenanceMode', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="text-lg font-semibold mb-4">Acciones del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className={`${themeClasses.border}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Reiniciar Aplicación</CardTitle>
                    <CardDescription>Reinicia los servicios de aplicación</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Reiniciar Aplicación
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción reiniciará la aplicación y podría interrumpir las sesiones activas de los usuarios.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRestartApp} disabled={isRestarting}>
                            {isRestarting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Reiniciando...
                              </>
                            ) : (
                              'Reiniciar'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>

                <Card className={`${themeClasses.border}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Limpiar Cache</CardTitle>
                    <CardDescription>Limpia la cache del sistema</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      Limpiar Cache
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Políticas de Contraseñas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Longitud Mínima</label>
                  <Input
                    type="number"
                    value={config.security.passwordPolicyMinLength}
                    onChange={e => updateConfig('security', 'passwordPolicyMinLength', parseInt(e.target.value))}
                    min="6"
                    max="24"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Caducidad (días)</label>
                  <Input
                    type="number"
                    value={config.security.passwordExpiryDays}
                    onChange={e => updateConfig('security', 'passwordExpiryDays', parseInt(e.target.value))}
                    min="0"
                    max="365"
                  />
                  <p className="text-xs text-muted-foreground">0 = No caduca nunca</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Requerir Mayúsculas</label>
                  </div>
                  <Switch
                    checked={config.security.passwordRequireUppercase}
                    onCheckedChange={checked => updateConfig('security', 'passwordRequireUppercase', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Requerir Números</label>
                  </div>
                  <Switch
                    checked={config.security.passwordRequireNumbers}
                    onCheckedChange={checked => updateConfig('security', 'passwordRequireNumbers', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Requerir Caracteres Especiales</label>
                  </div>
                  <Switch
                    checked={config.security.passwordRequireSpecialChars}
                    onCheckedChange={checked => updateConfig('security', 'passwordRequireSpecialChars', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-4">Autenticación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Autenticación de Dos Factores</label>
                    <p className="text-xs text-muted-foreground">Habilitar 2FA para todos los usuarios</p>
                  </div>
                  <Switch
                    checked={config.security.twoFactorAuthEnabled}
                    onCheckedChange={checked => updateConfig('security', 'twoFactorAuthEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Múltiples Dispositivos</label>
                    <p className="text-xs text-muted-foreground">Permitir sesiones simultáneas</p>
                  </div>
                  <Switch
                    checked={config.security.allowMultipleDevices}
                    onCheckedChange={checked => updateConfig('security', 'allowMultipleDevices', checked)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tiempo de Sesión (minutos)</label>
                  <Input
                    type="number"
                    value={config.security.sessionTimeoutMinutes}
                    onChange={e => updateConfig('security', 'sessionTimeoutMinutes', parseInt(e.target.value))}
                    min="5"
                    max="1440"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Configuración de Email</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Email de Remitente</label>
                  <Input type="email" value={config.email.fromEmail} onChange={e => updateConfig('email', 'fromEmail', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Servidor SMTP</label>
                  <Input value={config.email.smtpServer} onChange={e => updateConfig('email', 'smtpServer', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Puerto SMTP</label>
                  <Input
                    type="number"
                    value={config.email.smtpPort}
                    onChange={e => updateConfig('email', 'smtpPort', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Usuario SMTP</label>
                  <Input value={config.email.smtpUsername} onChange={e => updateConfig('email', 'smtpUsername', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contraseña SMTP</label>
                  <Input
                    type="password"
                    value="••••••••••••"
                    onChange={e => {
                      /* Implementar lógica para cambiar contraseña */
                    }}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Ruta de Plantillas</label>
                  <Input
                    value={config.email.emailTemplatesPath}
                    onChange={e => updateConfig('email', 'emailTemplatesPath', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between md:col-span-2">
                  <div>
                    <label className="text-sm font-medium">Verificación de Email</label>
                    <p className="text-xs text-muted-foreground">Requerir verificación de email para nuevos usuarios</p>
                  </div>
                  <Switch
                    checked={config.email.enableEmailVerification}
                    onCheckedChange={checked => updateConfig('email', 'enableEmailVerification', checked)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline">Enviar Email de Prueba</Button>
            </div>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Configuración de Pagos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Stripe</label>
                      <p className="text-xs text-muted-foreground">Habilitar pagos con Stripe</p>
                    </div>
                    <Switch
                      checked={config.payment.stripeEnabled}
                      onCheckedChange={checked => updateConfig('payment', 'stripeEnabled', checked)}
                    />
                  </div>
                </div>

                {config.payment.stripeEnabled && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Stripe Public Key</label>
                    <Input
                      value={config.payment.stripePublicKey}
                      onChange={e => updateConfig('payment', 'stripePublicKey', e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">PayPal</label>
                      <p className="text-xs text-muted-foreground">Habilitar pagos con PayPal</p>
                    </div>
                    <Switch
                      checked={config.payment.paypalEnabled}
                      onCheckedChange={checked => updateConfig('payment', 'paypalEnabled', checked)}
                    />
                  </div>
                </div>

                {config.payment.paypalEnabled && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">PayPal Client ID</label>
                    <Input
                      value={config.payment.paypalClientId}
                      onChange={e => updateConfig('payment', 'paypalClientId', e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Moneda Predeterminada</label>
                  <Select value={config.payment.defaultCurrency} onValueChange={value => updateConfig('payment', 'defaultCurrency', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                      <SelectItem value="USD">Dólar ($)</SelectItem>
                      <SelectItem value="GBP">Libra (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* API Tab */}
          <TabsContent value="api" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Configuración de APIs Externas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Google Maps API Key</label>
                  <Input value={config.apis.googleMapsApiKey} onChange={e => updateConfig('apis', 'googleMapsApiKey', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Weather API Key</label>
                  <Input value={config.apis.weatherApiKey} onChange={e => updateConfig('apis', 'weatherApiKey', e.target.value)} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Geocoding</label>
                    <p className="text-xs text-muted-foreground">Habilitar servicios de geocodificación</p>
                  </div>
                  <Switch
                    checked={config.apis.geocodingEnabled}
                    onCheckedChange={checked => updateConfig('apis', 'geocodingEnabled', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="outline">Restaurar Valores Predeterminados</Button>
        <Button onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Configuración
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
