import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'
import { BarChart3, Building, Database, Globe, Lock, Settings, Shield, Users } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function AdminDashboard() {
  const { t } = useTranslation()
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
      <div className="sticky top-0 z-20 flex flex-row justify-between w-full px-4 py-3 bg-card border-border border-b shadow-md backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-medium text-foreground">{t('adminDashboard.title')}</h1>
        </div>
        <div className="flex items-center space-x-2">
          {isSuperAdmin && (
            <span className="px-2 py-1 text-xs font-medium rounded-md border border-red-500/20 bg-red-500/10 text-red-400">
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
              <TabsTrigger value="general" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('common.all')}
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
                <Users className="h-4 w-4 mr-2" />
                {t('common.users')}
              </TabsTrigger>
              <TabsTrigger value="venues" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
                <Building className="h-4 w-4 mr-2" />
                Venues
              </TabsTrigger>
              {isSuperAdmin && (
                <>
                  <TabsTrigger value="system" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
                    <Database className="h-4 w-4 mr-2" />
                    {t('common.system')}
                  </TabsTrigger>
                  <TabsTrigger value="global" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
                    <Globe className="h-4 w-4 mr-2" />
                    {t('adminDashboard.cards.globalConfig')}
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-muted data-[state=active]:text-primary">
                <Settings className="h-4 w-4 mr-2" />
                {t('common.settings')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground">{t('adminDashboard.tabs.overview')}</CardTitle>
                  <CardDescription className="text-muted-foreground">{t('adminDashboard.tabs.overviewDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">{t('adminDashboard.content.overview')}</p>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground">{t('adminDashboard.tabs.recentActivity')}</CardTitle>
                  <CardDescription className="text-muted-foreground">{t('adminDashboard.tabs.recentActivityDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">{t('adminDashboard.content.recentActivity')}</p>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground">{t('adminDashboard.tabs.performance')}</CardTitle>
                  <CardDescription className="text-muted-foreground">{t('adminDashboard.tabs.performanceDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">{t('adminDashboard.content.performance')}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">{t('adminDashboard.cards.userManagement')}</h2>
            <Separator className="mb-6 border-border" />
            <p className="text-muted-foreground">{t('adminDashboard.cards.userManagementDesc')}</p>
            <Outlet />
          </TabsContent>

          <TabsContent value="venues" className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">{t('adminDashboard.cards.venueManagement')}</h2>
            <Separator className="mb-6 border-border" />
            <p className="text-muted-foreground">{t('adminDashboard.cards.venueManagementDesc')}</p>
            <Outlet />
          </TabsContent>

          {isSuperAdmin && (
            <>
              <TabsContent value="system" className="mt-6">
                <h2 className="text-xl font-semibold mb-4 text-foreground">{t('adminDashboard.cards.systemSettings')}</h2>
                <Separator className="mb-6 border-border" />
                <div className="bg-amber-500/10 border-l-4 border-amber-500/30 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Lock className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-foreground">
                        {t('globalConfig.restrictedAccessDesc')}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground">{t('adminDashboard.cards.systemSettingsDesc')}</p>
                <Outlet />
              </TabsContent>

              <TabsContent value="global" className="mt-6">
                <h2 className="text-xl font-semibold mb-4 text-foreground">{t('adminDashboard.cards.globalConfig')}</h2>
                <Separator className="mb-6 border-border" />
                <p className="text-muted-foreground">{t('adminDashboard.cards.globalConfigDesc')}</p>
                <Outlet />
              </TabsContent>
            </>
          )}

          <TabsContent value="settings" className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">{t('adminDashboard.cards.accountSettings')}</h2>
            <Separator className="mb-6 border-border" />
            <p className="text-muted-foreground">{t('adminDashboard.cards.accountSettingsDesc')}</p>
            <Outlet />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
