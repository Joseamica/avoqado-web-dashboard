import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PowerOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useStaffPayAccess } from '@/hooks/useStaffPay'
import { TablaDePagosTab } from './components/TablaDePagosTab'
import { PeriodosTab } from './components/PeriodosTab'

const TABS = ['tabla', 'periodos'] as const
type Tab = (typeof TABS)[number]

export default function StaffPayPage() {
  const { t } = useTranslation('staffPay')
  const location = useLocation()
  const navigate = useNavigate()
  const desdeHash = (): Tab => {
    const h = location.hash.replace('#', '')
    return (TABS as readonly string[]).includes(h) ? (h as Tab) : 'tabla'
  }
  const [tab, setTab] = useState<Tab>(desdeHash)
  useEffect(() => { setTab(desdeHash()) }, [location.hash]) // eslint-disable-line react-hooks/exhaustive-deps
  const cambiar = (v: string) => { setTab(v as Tab); navigate(`${location.pathname}${location.search}#${v}`, { replace: true }) }
  const { data, isLoading } = useStaffPayAccess()

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="mb-6">
        <PageTitleWithInfo title={t('title')} className="text-2xl font-bold" tooltip={t('subtitle')} />
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      {!isLoading && data?.enabled === false && (
        // Sin el plan, el cartel de planes (incluido en Pro, o suelto con su precio del catálogo); si el plan sí lo cubre y
        // sigue apagado por otra razón, la explicación de siempre (spec §10: apagado se ve y se explica).
        <FeatureGate feature="SERVICE_PAY">
          <Card className="border-amber-500/40" role="status">
            <CardContent className="flex items-start gap-3 p-4">
              <PowerOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('disabled.title')}</p>
                <p className="text-sm text-muted-foreground">{t('disabled.description')}</p>
              </div>
            </CardContent>
          </Card>
        </FeatureGate>
      )}
      {data?.enabled && (
        <Tabs value={tab} onValueChange={cambiar} className="space-y-6">
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
            <TabsTrigger value="tabla" data-tour="staffpay-tab-tabla" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">{t('tabs.table')}</TabsTrigger>
            <TabsTrigger value="periodos" data-tour="staffpay-tab-periodos" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">{t('tabs.periods')}</TabsTrigger>
          </TabsList>
          <TabsContent value="tabla"><TablaDePagosTab /></TabsContent>
          <TabsContent value="periodos"><PeriodosTab activa={tab === 'periodos'} /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}
