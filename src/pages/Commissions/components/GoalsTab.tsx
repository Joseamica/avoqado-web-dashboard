import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Target, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PermissionGate } from '@/components/PermissionGate'
import { useSalesGoals, useDeleteSalesGoal } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import GoalCard from './GoalCard'
import CreateGoalDialog from './CreateGoalDialog'
import type { SalesGoal } from '@/types/commission'

export default function GoalsTab() {
	const { t } = useTranslation('commissions')
	const { toast } = useToast()

	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [editingGoal, setEditingGoal] = useState<SalesGoal | null>(null)

	const { data: goals, isLoading, error } = useSalesGoals()
	const deleteGoalMutation = useDeleteSalesGoal()

	const handleEdit = (goal: SalesGoal) => {
		setEditingGoal(goal)
		setShowCreateDialog(true)
	}

	const handleDelete = async (goalId: string) => {
		try {
			await deleteGoalMutation.mutateAsync(goalId)
			toast({
				title: t('success.goalDeleted'),
			})
		} catch {
			toast({
				title: t('errors.deleteError'),
				variant: 'destructive',
			})
		}
	}

	const handleDialogClose = (open: boolean) => {
		setShowCreateDialog(open)
		if (!open) {
			setEditingGoal(null)
		}
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>{t('errors.loadError')}</AlertTitle>
				<AlertDescription>{t('errors.loadError')}</AlertDescription>
			</Alert>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold">{t('goals.title')}</h2>
					<p className="text-sm text-muted-foreground">{t('goals.subtitle')}</p>
				</div>

				<PermissionGate permission="commissions:create">
					<Button onClick={() => setShowCreateDialog(true)}>
						<Plus className="h-4 w-4 mr-2" />
						{t('goals.create')}
					</Button>
				</PermissionGate>
			</div>

			{/* Loading State */}
			{isLoading && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{[1, 2, 3].map(i => (
						<Skeleton key={i} className="h-48 rounded-lg" />
					))}
				</div>
			)}

			{/* Empty State */}
			{!isLoading && goals?.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<div className="p-4 rounded-full bg-muted mb-4">
						<Target className="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-medium mb-2">{t('goals.noGoals')}</h3>
					<p className="text-muted-foreground mb-4 max-w-sm">{t('goals.noGoalsDescription')}</p>
					<PermissionGate permission="commissions:create">
						<Button onClick={() => setShowCreateDialog(true)}>
							<Plus className="h-4 w-4 mr-2" />
							{t('goals.create')}
						</Button>
					</PermissionGate>
				</div>
			)}

			{/* Goals Grid */}
			{!isLoading && goals && goals.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{goals.map(goal => (
						<GoalCard
							key={goal.id}
							goal={goal}
							onEdit={handleEdit}
							onDelete={handleDelete}
							isDeleting={deleteGoalMutation.isPending}
						/>
					))}
				</div>
			)}

			{/* Create/Edit Dialog */}
			<CreateGoalDialog
				open={showCreateDialog}
				onOpenChange={handleDialogClose}
				goal={editingGoal}
			/>
		</div>
	)
}
