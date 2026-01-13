import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Settings2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/PermissionGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCommissionStats, useCommissionConfigs, usePendingCommissionSummaries, useCommissionPayouts } from '@/hooks/useCommissions'
import { usePermissions } from '@/hooks/usePermissions'
import CommissionKPICards from './components/CommissionKPICards'
import StaffCommissionTable from './components/StaffCommissionTable'
import CommissionConfigList from './components/CommissionConfigList'
import SummaryApprovalList from './components/SummaryApprovalList'
import PayoutList from './components/PayoutList'
import CreateConfigDialog from './components/CreateConfigDialog'

const VALID_TABS = ['overview', 'config', 'approvals', 'payouts'] as const
type TabValue = typeof VALID_TABS[number]

export default function CommissionsPage() {
	const { t } = useTranslation('commissions')
	const location = useLocation()
	const navigate = useNavigate()
	const { can } = usePermissions()
	const [showCreateDialog, setShowCreateDialog] = useState(false)

	// Check permissions
	const canViewPayouts = can('commissions:payout')

	// Get tab from URL hash, default to 'overview'
	const getTabFromHash = (): TabValue => {
		const hash = location.hash.replace('#', '')
		return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'overview'
	}

	const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

	// Sync tab with URL hash
	useEffect(() => {
		const tabFromHash = getTabFromHash()
		// If user tries to access payouts tab without permission, redirect to overview
		if (tabFromHash === 'payouts' && !canViewPayouts) {
			setActiveTab('overview')
			navigate(`${location.pathname}#overview`, { replace: true })
			return
		}
		if (tabFromHash !== activeTab) {
			setActiveTab(tabFromHash)
		}
	}, [location.hash, canViewPayouts])

	// Update URL hash when tab changes
	const handleTabChange = (value: string) => {
		const tab = value as TabValue
		setActiveTab(tab)
		navigate(`${location.pathname}#${tab}`, { replace: true })
	}

	// Data fetching
	const { data: stats, isLoading: isLoadingStats } = useCommissionStats()
	const { data: configs, isLoading: isLoadingConfigs } = useCommissionConfigs()
	const { data: pendingSummaries, isLoading: isLoadingPending } = usePendingCommissionSummaries()
	// Only fetch payouts if user has permission
	const { data: payouts, isLoading: isLoadingPayouts } = useCommissionPayouts(undefined, { enabled: canViewPayouts })

	const pendingCount = pendingSummaries?.length || 0
	const configCount = configs?.length || 0

	return (
		<div className="p-4 bg-background text-foreground">
			<div className="flex items-center justify-between mb-6">
				<div>
					<PageTitleWithInfo
						title={t('title')}
						className="text-2xl font-bold"
						tooltip={t('subtitle')}
					/>
					<p className="text-muted-foreground">{t('subtitle')}</p>
				</div>

				<PermissionGate permission="commissions:create">
					<Button onClick={() => setShowCreateDialog(true)}>
						<Plus className="h-4 w-4 mr-2" />
						{t('config.create')}
					</Button>
				</PermissionGate>
			</div>

			<Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
				<TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
					<TabsTrigger
						value="overview"
						className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
					>
						<span>{t('tabs.overview')}</span>
					</TabsTrigger>
					<TabsTrigger
						value="config"
						className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
					>
						<span>{t('tabs.config')}</span>
						{configCount > 0 && (
							<span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
								{configCount}
							</span>
						)}
					</TabsTrigger>
					<TabsTrigger
						value="approvals"
						className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
					>
						<span>{t('tabs.approvals')}</span>
						{pendingCount > 0 && (
							<span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
								{pendingCount}
							</span>
						)}
					</TabsTrigger>
					{canViewPayouts && (
						<TabsTrigger
							value="payouts"
							className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
						>
							<span>{t('tabs.payouts')}</span>
						</TabsTrigger>
					)}
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<CommissionKPICards stats={stats} isLoading={isLoadingStats} />
					<StaffCommissionTable />
				</TabsContent>

				{/* Configuration Tab */}
				<TabsContent value="config" className="space-y-6">
					<CommissionConfigList
						configs={configs || []}
						isLoading={isLoadingConfigs}
					/>
				</TabsContent>

				{/* Approvals Tab */}
				<TabsContent value="approvals" className="space-y-6">
					<SummaryApprovalList
						summaries={pendingSummaries || []}
						isLoading={isLoadingPending}
					/>
				</TabsContent>

				{/* Payouts Tab */}
				{canViewPayouts && (
					<TabsContent value="payouts" className="space-y-6">
						<PayoutList payouts={payouts || []} isLoading={isLoadingPayouts} />
					</TabsContent>
				)}
			</Tabs>

			{/* Create Config Dialog */}
			<CreateConfigDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
			/>
		</div>
	)
}
