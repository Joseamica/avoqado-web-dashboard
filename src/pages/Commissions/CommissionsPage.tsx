import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Info, Plus } from 'lucide-react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/PermissionGate'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCommissionStats, useEffectiveCommissionConfigs } from '@/hooks/useCommissions'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import CommissionKPICards from './components/CommissionKPICards'
import TeamCommissionTable from './components/TeamCommissionTable'
import CommissionConfigList from './components/CommissionConfigList'
import GoalsTab from './components/GoalsTab'
import CommissionSetupPanel from './components/setup-panel/CommissionSetupPanel'

const VALID_TABS = ['overview', 'goals', 'config'] as const
type TabValue = typeof VALID_TABS[number]

export default function CommissionsPage() {
	const { t } = useTranslation('commissions')
	const location = useLocation()
	const navigate = useNavigate()
	const { can } = useAccess()
	const { fullBasePath } = useCurrentVenue()
	const [showSetupPanel, setShowSetupPanel] = useState(false)

	// Get tab from URL hash, default to 'overview'
	const getTabFromHash = (): TabValue => {
		const hash = location.hash.replace('#', '')
		return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'overview'
	}

	const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

	// Sync tab with URL hash
	useEffect(() => {
		const tabFromHash = getTabFromHash()
		if (tabFromHash !== activeTab) {
			setActiveTab(tabFromHash)
		}
	}, [location.hash])

	// Update URL hash when tab changes
	const handleTabChange = (value: string) => {
		const tab = value as TabValue
		setActiveTab(tab)
		navigate(`${location.pathname}#${tab}`, { replace: true })
	}

	// Data fetching
	const { data: stats, isLoading: isLoadingStats } = useCommissionStats()
	const { data: effectiveConfigs, isLoading: isLoadingConfigs } = useEffectiveCommissionConfigs()
	const configCount = effectiveConfigs?.length || 0
	const sinPagoAlPersonal = !isLoadingStats && !!stats && stats.staffPayActive !== true

	return (
		<FeatureGate feature="COMMISSIONS">
		<div className="p-4 bg-background text-foreground">
			<div className="mb-6">
				<PageTitleWithInfo
					title={t('title')}
					className="text-2xl font-bold"
					tooltip={t('subtitle')}
				/>
				<p className="text-muted-foreground">{t('subtitle')}</p>
				{/* Fase 3 (spec §8, §11): los resúmenes quedan de consulta; el pago vive en el recibo de Pago al personal. */}
				<div
					role="note"
					className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-input p-3 text-sm"
					data-tour="commissions-paid-in-staff-pay"
				>
					<Info className="h-4 w-4 shrink-0 text-muted-foreground" />
					{/* Sede sin Pago al personal activo (o servidor viejo sin el campo): se explica qué hacer; cargando, no se afirma nada nuevo. */}
					<span>{sinPagoAlPersonal ? t('overview.notInStaffPay') : t('overview.paidInStaffPay')}</span>
					{sinPagoAlPersonal && !can('staffpay:read') && <span>{t('overview.askOwner')}</span>}
					{can('staffpay:read') && (
						<Link to={`${fullBasePath}/servicio-pago#periodos`} className="font-medium underline underline-offset-2">
							{t('overview.goToStaffPay')}
						</Link>
					)}
				</div>
			</div>

			<Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
				<div className="border-b border-border">
					<nav className="flex items-center gap-6">
						<button
							onClick={() => handleTabChange('overview')}
							className={`relative pb-3 text-sm font-medium transition-colors ${
								activeTab === 'overview' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
							}`}
						>
							{t('tabs.overview')}
							{activeTab === 'overview' && (
								<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
							)}
						</button>
						<button
							onClick={() => handleTabChange('goals')}
							className={`relative pb-3 text-sm font-medium transition-colors ${
								activeTab === 'goals' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
							}`}
						>
							{t('tabs.goals')}
							{activeTab === 'goals' && (
								<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
							)}
						</button>
						<button
							onClick={() => handleTabChange('config')}
							className={`relative pb-3 text-sm font-medium transition-colors ${
								activeTab === 'config' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
							}`}
						>
							{t('tabs.config')}
							{configCount > 0 && (
								<span className="ml-1.5 text-xs opacity-60">{configCount}</span>
							)}
							{activeTab === 'config' && (
								<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
							)}
						</button>
					</nav>
				</div>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<CommissionKPICards stats={stats} isLoading={isLoadingStats} hasConfigs={configCount > 0} isLoadingConfigs={isLoadingConfigs} onGoToConfig={() => handleTabChange('config')} />
					<TeamCommissionTable staffPayActive={stats?.staffPayActive === true} puedeVerRecibos={can('staffpay:read')} />
				</TabsContent>

				{/* Goals Tab */}
				<TabsContent value="goals" className="space-y-6">
					<GoalsTab />
				</TabsContent>

				{/* Configuration Tab */}
				<TabsContent value="config" className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold">{t('config.title')}</h2>
							<p className="text-sm text-muted-foreground">{t('config.subtitle')}</p>
						</div>
						<PermissionGate permission="commissions:create">
							<Button data-tour="commission-new-btn" onClick={() => setShowSetupPanel(true)}>
								<Plus className="h-4 w-4 mr-2" />
								{t('config.create')}
							</Button>
						</PermissionGate>
					</div>
					<CommissionConfigList
						effectiveConfigs={effectiveConfigs}
						isLoading={isLoadingConfigs}
					/>
				</TabsContent>
			</Tabs>

			{/* Create Config Panel */}
			<CommissionSetupPanel
				open={showSetupPanel}
				onOpenChange={setShowSetupPanel}
			/>
		</div>
		</FeatureGate>
	)
}
