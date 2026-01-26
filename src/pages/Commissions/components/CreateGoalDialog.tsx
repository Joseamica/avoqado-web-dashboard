import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ChevronsUpDown, Building2 } from 'lucide-react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	FormDescription,
} from '@/components/ui/form'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCreateSalesGoal, useUpdateSalesGoal } from '@/hooks/useCommissions'
import { teamService } from '@/services/team.service'
import { useToast } from '@/hooks/use-toast'
import type { SalesGoal, SalesGoalPeriod } from '@/types/commission'
import { cn } from '@/lib/utils'

const goalSchema = z.object({
	staffId: z.string().nullable(),
	goal: z.number().min(1, 'Goal must be greater than 0'),
	period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'] as const),
	active: z.boolean(),
})

type GoalFormData = z.infer<typeof goalSchema>

interface CreateGoalDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	goal?: SalesGoal | null
}

export default function CreateGoalDialog({
	open,
	onOpenChange,
	goal,
}: CreateGoalDialogProps) {
	const { t } = useTranslation('commissions')
	const { toast } = useToast()
	const { venueId } = useCurrentVenue()

	const [staffSearchOpen, setStaffSearchOpen] = useState(false)
	const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)

	const isEditing = !!goal

	// Fetch venue staff for selection
	const { data: staffData } = useQuery({
		queryKey: ['team-members', venueId],
		queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
		enabled: !!venueId && open,
	})
	const staffList = staffData?.data || []

	const createGoalMutation = useCreateSalesGoal()
	const updateGoalMutation = useUpdateSalesGoal()

	const form = useForm<GoalFormData>({
		resolver: zodResolver(goalSchema),
		defaultValues: {
			staffId: goal?.staffId || null,
			goal: goal?.goal || 10000,
			period: goal?.period || 'DAILY',
			active: goal?.active ?? true,
		},
	})

	// Reset form when goal changes
	useEffect(() => {
		if (open) {
			if (goal) {
				setSelectedStaff(
					goal.staff
						? {
								id: goal.staffId!,
								name: `${goal.staff.firstName} ${goal.staff.lastName}`,
						  }
						: null
				)
				form.reset({
					staffId: goal.staffId || null,
					goal: goal.goal,
					period: goal.period,
					active: goal.active ?? true,
				})
			} else {
				setSelectedStaff(null)
				form.reset({
					staffId: null,
					goal: 10000,
					period: 'DAILY',
					active: true,
				})
			}
		}
	}, [open, goal, form])

	const onSubmit = async (data: GoalFormData) => {
		try {
			if (isEditing && goal) {
				await updateGoalMutation.mutateAsync({
					goalId: goal.id,
					data: {
						goal: data.goal,
						period: data.period as SalesGoalPeriod,
						active: data.active,
					},
				})
				toast({
					title: t('success.goalUpdated'),
				})
			} else {
				await createGoalMutation.mutateAsync({
					staffId: data.staffId,
					goal: data.goal,
					period: data.period as SalesGoalPeriod,
				})
				toast({
					title: t('success.goalCreated'),
				})
			}
			onOpenChange(false)
		} catch (error) {
			toast({
				title: isEditing ? t('errors.updateError') : t('errors.createError'),
				variant: 'destructive',
			})
		}
	}

	const isLoading = createGoalMutation.isPending || updateGoalMutation.isPending

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{isEditing ? t('goals.edit') : t('goals.create')}</DialogTitle>
					<DialogDescription>
						{isEditing ? t('goals.editDescription') : t('goals.createDescription')}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{/* Staff Selection (only for create) */}
						{!isEditing && (
							<FormField
								control={form.control}
								name="staffId"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>{t('goals.assignTo')}</FormLabel>
										<Popover open={staffSearchOpen} onOpenChange={setStaffSearchOpen}>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														variant="outline"
														role="combobox"
														aria-expanded={staffSearchOpen}
														className={cn(
															'w-full justify-between',
															!field.value && !selectedStaff && 'text-muted-foreground'
														)}
													>
														{selectedStaff ? (
															<span className="flex items-center gap-2">
																<span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs">
																	{selectedStaff.name.charAt(0)}
																</span>
																{selectedStaff.name}
															</span>
														) : field.value === null ? (
															<span className="flex items-center gap-2">
																<Building2 className="h-4 w-4" />
																{t('goals.venueGoal')}
															</span>
														) : (
															t('goals.selectStaff')
														)}
														<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="w-[300px] p-0">
												<Command>
													<CommandList>
														<CommandEmpty>{t('overrides.noStaffFound')}</CommandEmpty>
														<CommandGroup>
															{/* Venue-wide option */}
															<CommandItem
																value="venue-wide"
																onSelect={() => {
																	field.onChange(null)
																	setSelectedStaff(null)
																	setStaffSearchOpen(false)
																}}
																className="cursor-pointer"
															>
																<Check
																	className={cn(
																		'mr-2 h-4 w-4',
																		field.value === null ? 'opacity-100' : 'opacity-0'
																	)}
																/>
																<Building2 className="mr-2 h-4 w-4" />
																{t('goals.venueGoal')}
															</CommandItem>
															{/* Staff members */}
															{staffList.map(staff => (
																<CommandItem
																	key={staff.staffId}
																	value={`${staff.firstName} ${staff.lastName}`}
																	onSelect={() => {
																		field.onChange(staff.staffId)
																		setSelectedStaff({
																			id: staff.staffId,
																			name: `${staff.firstName} ${staff.lastName}`,
																		})
																		setStaffSearchOpen(false)
																	}}
																	className="cursor-pointer"
																>
																	<Check
																		className={cn(
																			'mr-2 h-4 w-4',
																			field.value === staff.staffId ? 'opacity-100' : 'opacity-0'
																		)}
																	/>
																	<span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs mr-2">
																		{staff.firstName.charAt(0)}
																	</span>
																	{staff.firstName} {staff.lastName}
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</Popover>
										<FormDescription>{t('goals.assignToHint')}</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{/* Goal Amount */}
						<FormField
							control={form.control}
							name="goal"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('goals.goalAmount')}</FormLabel>
									<FormControl>
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
											<Input
												type="number"
												className="pl-7"
												placeholder="10000"
												{...field}
												onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
											/>
										</div>
									</FormControl>
									<FormDescription>{t('goals.goalAmountHint')}</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Period */}
						<FormField
							control={form.control}
							name="period"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('goals.period')}</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={t('goals.selectPeriod')} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="DAILY">{t('goals.periods.DAILY')}</SelectItem>
											<SelectItem value="WEEKLY">{t('goals.periods.WEEKLY')}</SelectItem>
											<SelectItem value="MONTHLY">{t('goals.periods.MONTHLY')}</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>{t('goals.periodHint')}</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Active toggle (for edit) */}
						{isEditing && (
							<FormField
								control={form.control}
								name="active"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>{t('goals.active')}</FormLabel>
											<FormDescription>{t('goals.activeDescription')}</FormDescription>
										</div>
										<FormControl>
											<Switch checked={field.value} onCheckedChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						)}

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								{t('actions.cancel')}
							</Button>
							<Button type="submit" disabled={isLoading}>
								{isLoading ? t('actions.saving') : isEditing ? t('actions.save') : t('actions.create')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
