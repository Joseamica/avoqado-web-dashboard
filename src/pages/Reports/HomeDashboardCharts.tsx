import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { KYCStatusBanner } from '@/components/KYCStatusBanner'

import { useDashboardData } from '@/hooks/useDashboardData'
import { useDashboardExport } from '@/hooks/useDashboardExport'
import { useDashboardPack } from '@/hooks/use-dashboard-pack'

import { DashboardHeader } from '@/components/home/sections/DashboardHeader'
import { DashboardRenderer } from '@/components/home/DashboardRenderer'

export default function HomeDashboardCharts() {
  const { t } = useTranslation('home')

  const dashboardData = useDashboardData()
  const {
    isBasicLoading,
    isBasicError,
    basicError,
    refetchBasicData,
    compareType,
    refetchCompareData,
  } = dashboardData

  const { exportLoading, exportToJSON, exportToCSV } = useDashboardExport(dashboardData)
  const { resolvedDashboard } = useDashboardPack()

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <DashboardHeader
        {...dashboardData}
        isBasicLoading={isBasicLoading}
        exportLoading={exportLoading}
        isBasicError={isBasicError}
        exportToJSON={exportToJSON}
        exportToCSV={exportToCSV}
      />

      <div className="px-2 md:px-4 pt-4">
        <KYCStatusBanner />
      </div>

      <div className="flex-1 p-2 md:p-4 space-y-4 mx-auto w-full section-soft cards-tinted">
        {isBasicError ? (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">{t('error.failedTitle')}</h2>
              <p className="text-muted-foreground">{basicError?.message || t('error.unknown')}</p>
              <Button
                onClick={() => {
                  refetchBasicData()
                  if (compareType) refetchCompareData()
                }}
              >
                {t('common:tryAgain')}
              </Button>
            </div>
          </Card>
        ) : (
          <DashboardRenderer
            resolvedDashboard={resolvedDashboard}
            dashboardData={dashboardData}
          />
        )}
      </div>
    </div>
  )
}
