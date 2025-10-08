import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function DatabaseSettings() {
  const { t } = useTranslation()
  return (
    <div className="p-4 md:p-6">
      <h3 className="text-lg font-medium text-foreground">{t('admin.systemSettings.database.title')}</h3>

      <Card className="bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground">{t('admin.systemSettings.database.maintenanceTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground">{t('admin.systemSettings.database.maintenanceDesc')}</CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-base font-medium text-foreground mb-2">{t('admin.systemSettings.database.cache')}</h4>
              <p className="text-sm text-muted-foreground mb-4">{t('admin.systemSettings.database.cacheDesc')}</p>
              <Button variant="outline" size="sm">
                <RefreshCcw className="h-4 w-4 mr-2" />
                {t('admin.systemSettings.database.clearCache')}
              </Button>
            </div>

            <div>
              <h4 className="text-base font-medium text-foreground mb-2">{t('admin.systemSettings.database.backup')}</h4>
              <p className="text-sm text-muted-foreground mb-4">{t('admin.systemSettings.database.backupDesc')}</p>
              <Button variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                {t('admin.systemSettings.database.createBackup')}
              </Button>
            </div>
          </div>
        </CardContent>

        <div className="border-t border-border p-4 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">{t('admin.systemSettings.database.lastMaintenance')}</p>
          <Button variant="default" size="sm">
            {t('admin.systemSettings.database.runFullMaintenance')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
