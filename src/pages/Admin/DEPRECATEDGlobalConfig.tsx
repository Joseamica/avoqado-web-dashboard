import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'

import { Separator } from '@/components/ui/separator'
import { AlertTriangle, ArrowLeft, Save, Settings, ShieldCheck, MailCheck, Cloud, CreditCard, Loader2, RefreshCcw } from 'lucide-react'
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
import { Link } from 'react-router-dom'

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
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()
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
        title: t('common.saved'),
        description: t('common.savedDesc'),
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
        title: t('common.appRestarted'),
        description: t('common.appRestartedDesc'),
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
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('globalConfig.restrictedAccess')}</h3>
                <p className="text-muted-foreground">{t('globalConfig.restrictedAccessDesc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8 py-6 bg-background min-h-screen">
      <Link to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('common.backToAdmin')}
      </Link>
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('globalConfig.title')}</h2>
        <p className="text-muted-foreground">{t('globalConfig.subtitle')}</p>
      </div>

      {/* Warning banner */}
      <div className="bg-amber-500/10 border-l-4 border-amber-500/30 p-4">
        <div className="flex">
          <div className="shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-foreground">
              {t('globalConfig.application.warningMessage', {
                defaultValue:
                  'Esta sección contiene configuraciones globales que afectan a todo el sistema. Manipular estos valores incorrectamente puede afectar el funcionamiento de la plataforma para todos los usuarios.',
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-md overflow-hidden shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger
              value="app"
              className="flex items-center data-[state=active]:bg-muted data-[state=active]:text-primary rounded-none"
            >
              <Settings className="h-4 w-4 mr-2" />
              <span>{t('globalConfig.tabs.application')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="flex items-center data-[state=active]:bg-muted data-[state=active]:text-primary rounded-none"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              <span>{t('globalConfig.tabs.security')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="flex items-center data-[state=active]:bg-muted data-[state=active]:text-primary rounded-none"
            >
              <MailCheck className="h-4 w-4 mr-2" />
              <span>{t('globalConfig.tabs.email')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="payment"
              className="flex items-center data-[state=active]:bg-muted data-[state=active]:text-primary rounded-none"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              <span>{t('globalConfig.tabs.payments')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="api"
              className="flex items-center data-[state=active]:bg-muted data-[state=active]:text-primary rounded-none"
            >
              <Cloud className="h-4 w-4 mr-2" />
              <span>{t('globalConfig.tabs.apis')}</span>
            </TabsTrigger>
          </TabsList>

          {/* App Settings Tab */}
          <TabsContent value="app" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('globalConfig.application.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.application.appName')}</label>
                  <Input value={config.appSettings.appName} onChange={e => updateConfig('appSettings', 'appName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.application.version')}</label>
                  <div className="flex items-center">
                    <Input
                      value={config.appSettings.appVersion}
                      onChange={e => updateConfig('appSettings', 'appVersion', e.target.value)}
                      className="read-only:opacity-50"
                      readOnly
                    />
                    <Badge className="ml-2">{t('globalConfig.application.current')}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.application.defaultTheme')}</label>
                  <Select
                    value={config.appSettings.defaultTheme}
                    onValueChange={value => updateConfig('appSettings', 'defaultTheme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('globalConfig.application.themeLight')}</SelectItem>
                      <SelectItem value="dark">{t('globalConfig.application.themeDark')}</SelectItem>
                      <SelectItem value="system">{t('globalConfig.application.themeSystem')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.application.defaultLanguage')}</label>
                  <Select
                    value={config.appSettings.defaultLanguage}
                    onValueChange={value => updateConfig('appSettings', 'defaultLanguage', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">{t('globalConfig.application.spanish')}</SelectItem>
                      <SelectItem value="en">{t('globalConfig.application.english')}</SelectItem>
                      <SelectItem value="fr">{t('globalConfig.application.french')}</SelectItem>
                      <SelectItem value="de">{t('globalConfig.application.german')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.application.sessionTimeout')}</label>
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
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.application.maintenanceMode')}</label>
                    <p className="text-xs text-muted-foreground">{t('globalConfig.application.maintenanceModeDesc')}</p>
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
              <h3 className="text-lg font-semibold text-foreground mb-4">{t('globalConfig.application.systemActions')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-foreground">{t('globalConfig.application.restartApp')}</CardTitle>
                    <CardDescription>{t('globalConfig.application.restartAppDesc')}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          {t('globalConfig.application.restartApp')}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('common.thisActionWillRestart')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRestartApp} disabled={isRestarting}>
                            {isRestarting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {t('common.restarting')}
                              </>
                            ) : (
                              t('common.restart')
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>

                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-foreground">{t('globalConfig.application.clearCache')}</CardTitle>
                    <CardDescription>{t('globalConfig.application.clearCacheDesc')}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      {t('globalConfig.application.clearCache')}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">{t('globalConfig.security.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.security.minLength')}</label>
                  <Input
                    type="number"
                    value={config.security.passwordPolicyMinLength}
                    onChange={e => updateConfig('security', 'passwordPolicyMinLength', parseInt(e.target.value))}
                    min="6"
                    max="24"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.security.expiryDays')}</label>
                  <Input
                    type="number"
                    value={config.security.passwordExpiryDays}
                    onChange={e => updateConfig('security', 'passwordExpiryDays', parseInt(e.target.value))}
                    min="0"
                    max="365"
                  />
                  <p className="text-xs text-muted-foreground">{t('globalConfig.security.neverExpires')}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.security.requireUppercase')}</label>
                  </div>
                  <Switch
                    checked={config.security.passwordRequireUppercase}
                    onCheckedChange={checked => updateConfig('security', 'passwordRequireUppercase', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.security.requireNumbers')}</label>
                  </div>
                  <Switch
                    checked={config.security.passwordRequireNumbers}
                    onCheckedChange={checked => updateConfig('security', 'passwordRequireNumbers', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.security.requireSpecialChars')}</label>
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
              <h3 className="text-lg font-semibold text-foreground mb-4">{t('globalConfig.security.authentication')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.security.twoFactorAuth')}</label>
                    <p className="text-xs text-muted-foreground">{t('globalConfig.security.twoFactorAuthDesc')}</p>
                  </div>
                  <Switch
                    checked={config.security.twoFactorAuthEnabled}
                    onCheckedChange={checked => updateConfig('security', 'twoFactorAuthEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.security.multipleDevices')}</label>
                    <p className="text-xs text-muted-foreground">{t('globalConfig.security.multipleDevicesDesc')}</p>
                  </div>
                  <Switch
                    checked={config.security.allowMultipleDevices}
                    onCheckedChange={checked => updateConfig('security', 'allowMultipleDevices', checked)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.security.sessionTimeout')}</label>
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
              <h3 className="text-lg font-semibold text-foreground">{t('globalConfig.email.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.email.senderEmail')}</label>
                  <Input type="email" value={config.email.fromEmail} onChange={e => updateConfig('email', 'fromEmail', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.email.smtpServer')}</label>
                  <Input value={config.email.smtpServer} onChange={e => updateConfig('email', 'smtpServer', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.email.smtpPort')}</label>
                  <Input
                    type="number"
                    value={config.email.smtpPort}
                    onChange={e => updateConfig('email', 'smtpPort', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.email.smtpUser')}</label>
                  <Input value={config.email.smtpUsername} onChange={e => updateConfig('email', 'smtpUsername', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.email.smtpPassword')}</label>
                  <Input
                    type="password"
                    value="••••••••••••"
                    onChange={_e => {
                      /* Implementar lógica para cambiar contraseña */
                    }}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.email.templatePath')}</label>
                  <Input
                    value={config.email.emailTemplatesPath}
                    onChange={e => updateConfig('email', 'emailTemplatesPath', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between md:col-span-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.email.emailVerification')}</label>
                    <p className="text-xs text-muted-foreground">{t('globalConfig.email.emailVerificationDesc')}</p>
                  </div>
                  <Switch
                    checked={config.email.enableEmailVerification}
                    onCheckedChange={checked => updateConfig('email', 'enableEmailVerification', checked)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline">{t('globalConfig.email.sendTestEmail')}</Button>
            </div>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('globalConfig.payments.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">{t('globalConfig.payments.stripe')}</label>
                      <p className="text-xs text-muted-foreground">{t('globalConfig.payments.stripeDesc')}</p>
                    </div>
                    <Switch
                      checked={config.payment.stripeEnabled}
                      onCheckedChange={checked => updateConfig('payment', 'stripeEnabled', checked)}
                    />
                  </div>
                </div>

                {config.payment.stripeEnabled && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.payments.stripePublicKey')}</label>
                    <Input
                      value={config.payment.stripePublicKey}
                      onChange={e => updateConfig('payment', 'stripePublicKey', e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">{t('globalConfig.payments.paypal')}</label>
                      <p className="text-xs text-muted-foreground">{t('globalConfig.payments.paypalDesc')}</p>
                    </div>
                    <Switch
                      checked={config.payment.paypalEnabled}
                      onCheckedChange={checked => updateConfig('payment', 'paypalEnabled', checked)}
                    />
                  </div>
                </div>

                {config.payment.paypalEnabled && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.payments.paypalClientId')}</label>
                    <Input
                      value={config.payment.paypalClientId}
                      onChange={e => updateConfig('payment', 'paypalClientId', e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.payments.defaultCurrency')}</label>
                  <Select value={config.payment.defaultCurrency} onValueChange={value => updateConfig('payment', 'defaultCurrency', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">{t('globalConfig.payments.euro')}</SelectItem>
                      <SelectItem value="USD">{t('globalConfig.payments.dollar')}</SelectItem>
                      <SelectItem value="GBP">{t('globalConfig.payments.pound')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* API Tab */}
          <TabsContent value="api" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('globalConfig.apis.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.apis.googleMapsApiKey')}</label>
                  <Input value={config.apis.googleMapsApiKey} onChange={e => updateConfig('apis', 'googleMapsApiKey', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('globalConfig.apis.weatherApiKey')}</label>
                  <Input value={config.apis.weatherApiKey} onChange={e => updateConfig('apis', 'weatherApiKey', e.target.value)} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t('globalConfig.apis.geocoding')}</label>
                    <p className="text-sm text-muted-foreground">{t('globalConfig.apis.geocodingDesc')}</p>
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
        <Button variant="outline">{t('globalConfig.application.restoreDefaults')}</Button>
        <Button onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('common.saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('common.saveConfiguration')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
