import { useTranslation } from 'react-i18next'
import { Target, TrendingUp, User, Trash2, Pencil, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { SalesGoal } from '@/types/commission'

interface GoalCardProps {
	goal: SalesGoal
	onEdit: (goal: SalesGoal) => void
	onDelete: (goalId: string) => void
	isDeleting?: boolean
}

export default function GoalCard({ goal, onEdit, onDelete, isDeleting }: GoalCardProps) {
	const { t, i18n } = useTranslation('commissions')

	const progress = goal.goal > 0 ? Math.min((goal.currentSales / goal.goal) * 100, 100) : 0
	const progressPercentage = goal.goal > 0 ? (goal.currentSales / goal.goal) * 100 : 0
	const isGoalAchieved = goal.currentSales >= goal.goal
	const remaining = Math.max(goal.goal - goal.currentSales, 0)

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
			style: 'currency',
			currency: 'MXN',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount)
	}

	const getPeriodColor = (period: string) => {
		switch (period) {
			case 'DAILY':
				return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
			case 'WEEKLY':
				return 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
			case 'MONTHLY':
				return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
			default:
				return 'bg-muted text-muted-foreground'
		}
	}

	return (
		<Card
			className={cn(
				'relative overflow-hidden transition-all duration-300',
				isGoalAchieved && 'ring-2 ring-green-500/50',
				!goal.active && 'opacity-60'
			)}
		>
			{isGoalAchieved && (
				<div className="absolute top-0 right-0 p-2">
					<Trophy className="h-5 w-5 text-yellow-500" />
				</div>
			)}

			<CardContent className="p-4 space-y-4">
				{/* Header */}
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div
							className={cn(
								'p-2 rounded-xl',
								isGoalAchieved
									? 'bg-gradient-to-br from-green-500/20 to-green-500/5'
									: 'bg-gradient-to-br from-blue-500/20 to-blue-500/5'
							)}
						>
							{goal.staffId ? (
								<User
									className={cn('w-4 h-4', isGoalAchieved ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400')}
								/>
							) : (
								<Target
									className={cn('w-4 h-4', isGoalAchieved ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400')}
								/>
							)}
						</div>
						<div>
							<h4 className="font-medium text-sm">
								{goal.staff ? `${goal.staff.firstName} ${goal.staff.lastName}` : t('goals.venueGoal')}
							</h4>
							<div className="flex items-center gap-2 mt-1">
								<Badge variant="secondary" className={cn('text-xs', getPeriodColor(goal.period))}>
									{t(`goals.periods.${goal.period}`)}
								</Badge>
								{!goal.active && (
									<Badge variant="secondary" className="text-xs">
										{t('goals.inactive')}
									</Badge>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-1">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onEdit(goal)}>
										<Pencil className="w-3.5 h-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>{t('actions.edit')}</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<AlertDialog>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<AlertDialogTrigger asChild>
											<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer">
												<Trash2 className="w-3.5 h-3.5" />
											</Button>
										</AlertDialogTrigger>
									</TooltipTrigger>
									<TooltipContent>{t('actions.delete')}</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t('goals.deleteTitle')}</AlertDialogTitle>
									<AlertDialogDescription>{t('goals.deleteConfirm')}</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => onDelete(goal.id)}
										disabled={isDeleting}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										{t('actions.delete')}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>

				{/* Progress */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">{t('goals.progress')}</span>
						<span className={cn('font-semibold', isGoalAchieved ? 'text-green-600 dark:text-green-400' : 'text-foreground')}>
							{progressPercentage.toFixed(0)}%
						</span>
					</div>
					<Progress
						value={progress}
						className={cn('h-2', isGoalAchieved && '[&>div]:bg-green-500')}
					/>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-3 gap-2 text-center">
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">{t('goals.current')}</p>
						<p className={cn('text-sm font-semibold', isGoalAchieved ? 'text-green-600 dark:text-green-400' : 'text-foreground')}>
							{formatCurrency(goal.currentSales)}
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">{t('goals.target')}</p>
						<p className="text-sm font-semibold">{formatCurrency(goal.goal)}</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">{t('goals.remaining')}</p>
						<p className="text-sm font-semibold text-muted-foreground">
							{isGoalAchieved ? (
								<span className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
									<TrendingUp className="w-3 h-3" />
									{t('goals.achieved')}
								</span>
							) : (
								formatCurrency(remaining)
							)}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
