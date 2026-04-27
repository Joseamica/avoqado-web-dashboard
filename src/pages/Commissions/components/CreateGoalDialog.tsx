import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ChevronsUpDown, Building2, Users } from 'lucide-react'
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
	CommandInput,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCreateSalesGoal, useUpdateSalesGoal } from '@/hooks/useCommissions'
import { teamService } from '@/services/team.service'
import { useToast } from '@/hooks/use-toast'
import type { SalesGoal, SalesGoalPeriod } from '@/types/commission'
import { cn, includesNormalized } from '@/lib/utils'

const goalSchema = z.object({
	goal: z.number().min(1, 'La meta debe ser mayor a 0'),
	period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'] as const),
	active: z.boolean(),
})

type GoalFormData = z.infer<typeof goalSchema>

// Special constant for venue-wide goal
const VENUE_WIDE = '__VENUE_WIDE__'

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
	const [staffSearch, setStaffSearch] = useState('')
	// For create: multiple selections (staff IDs or VENUE_WIDE)
	const [selectedIds, setSelectedIds] = useState<string[]>([VENUE_WIDE])

	const isEditing = !!goal

	// Fetch venue staff for selection
	const { data: staffData } = useQuery({
		queryKey: ['team-members', venueId],
		queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
		enabled: !!venueId && open,
	})
	const staffList = staffData?.data || []

	const filteredStaff = useMemo(() => {
		if (!staffSearch) return staffList
		return staffList.filter(
			(s) =>
				includesNormalized(`${s.firstName} ${s.lastName}`, staffSearch) ||
				(s.email != null && includesNormalized(s.email, staffSearch))
		)
	}, [staffList, staffSearch])

	const createGoalMutation = useCreateSalesGoal()
	const updateGoalMutation = useUpdateSalesGoal()

	const form = useForm<GoalFormData>({
		resolver: zodResolver(goalSchema),
		defaultValues: {
			goal: goal?.goal || 10000,
			period: goal?.period || 'DAILY',
			active: goal?.active ?? true,
		},
	})

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			setStaffSearch('')
			if (goal) {
				setSelectedIds(goal.staffId ? [goal.staffId] : [VENUE_WIDE])
				form.reset({
					goal: goal.goal,
					period: goal.period,
					active: goal.active ?? true,
				})
			} else {
				setSelectedIds([VENUE_WIDE])
				form.reset({
					goal: 10000,
					period: 'DAILY',
					active: true,
				})
			}
		}
	}, [open, goal, form])

	const toggleSelection = (id: string) => {
		setSelectedIds((prev) => {
			if (id === VENUE_WIDE) {
				// If selecting venue-wide, deselect all staff
				return prev.includes(VENUE_WIDE) ? [] : [VENUE_WIDE]
			}
			// If selecting a staff member, remove venue-wide
			const withoutVenue = prev.filter((v) => v !== VENUE_WIDE)
			if (withoutVenue.includes(id)) {
				return withoutVenue.filter((v) => v !== id)
			}
			return [...withoutVenue, id]
		})
	}

	// Build display label for the trigger button
	const triggerLabel = useMemo(() => {
		if (selectedIds.length === 0) return null
		if (selectedIds.includes(VENUE_WIDE)) {
			return { icon: <Building2 className="h-4 w-4" />, text: t('goals.venueGoal') }
		}
		if (selectedIds.length === 1) {
			const staff = staffList.find((s) => s.staffId === selectedIds[0])
			if (staff) {
				return {
					icon: (
						<span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs">
							{staff.firstName.charAt(0)}
						</span>
					),
					text: `${staff.firstName} ${staff.lastName}`,
				}
			}
		}
		return {
			icon: <Users className="h-4 w-4" />,
			text: t('goals.multipleStaff', { count: selectedIds.length }),
		}
	}, [selectedIds, staffList, t])

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
				toast({ title: t('success.goalUpdated') })
			} else {
				// Batch create: one goal per selected target
				const targets = selectedIds.includes(VENUE_WIDE)
					? [null] // venue-wide
					: selectedIds // individual staff IDs

				let created = 0
				let errors = 0
				for (const staffId of targets) {
					try {
						await createGoalMutation.mutateAsync({
							staffId,
							goal: data.goal,
							period: data.period as SalesGoalPeriod,
						})
						created++
					} catch {
						errors++
					}
				}

				if (created > 0) {
					toast({
						title: targets.length === 1
							? t('success.goalCreated')
							: t('success.goalsCreatedBatch', { count: created }),
					})
				}
				if (errors > 0) {
					toast({
						title: t('errors.someGoalsFailed', { count: errors }),
						variant: 'destructive',
					})
				}
			}
			onOpenChange(false)
		} catch {
			toast({
				title: isEditing ? t('errors.updateError') : t('errors.createError'),
				variant: 'destructive',
			})
		}
	}

	const isLoading = createGoalMutation.isPending || updateGoalMutation.isPending
	const canSubmit = selectedIds.length > 0

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
							<div className="space-y-2">
								<FormLabel>{t('goals.assignTo')}</FormLabel>
								<Popover open={staffSearchOpen} onOpenChange={setStaffSearchOpen} modal={true}>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="outline"
											role="combobox"
											aria-expanded={staffSearchOpen}
											className={cn(
												'w-full justify-between font-normal bg-transparent shadow-xs',
												!triggerLabel && 'text-muted-foreground'
											)}
										>
											{triggerLabel ? (
												<span className="flex items-center gap-2 truncate">
													{triggerLabel.icon}
													{triggerLabel.text}
												</span>
											) : (
												t('goals.selectStaff')
											)}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="!w-[--radix-popover-trigger-width] p-0 bg-card border-input"
										align="start"
										style={{ width: 'var(--radix-popover-trigger-width)' }}
									>
										<Command shouldFilter={false} className="bg-card">
											{staffList.length >= 5 && (
												<CommandInput
													placeholder={t('goals.searchStaff')}
													value={staffSearch}
													onValueChange={setStaffSearch}
												/>
											)}
											<CommandList>
												<CommandEmpty>{t('overrides.noStaffFound')}</CommandEmpty>
												<ScrollArea className={staffList.length >= 5 ? 'h-[250px]' : 'max-h-[250px]'}>
													<CommandGroup>
														{/* Venue-wide option */}
														<CommandItem
															value="venue-wide"
															onSelect={() => toggleSelection(VENUE_WIDE)}
															className="cursor-pointer"
														>
															<Check
																className={cn(
																	'mr-2 h-4 w-4',
																	selectedIds.includes(VENUE_WIDE) ? 'opacity-100' : 'opacity-0'
																)}
															/>
															<Building2 className="mr-2 h-4 w-4" />
															{t('goals.venueGoal')}
														</CommandItem>
														{/* Staff members */}
														{filteredStaff.map((staff) => (
															<CommandItem
																key={staff.staffId}
																value={`${staff.firstName} ${staff.lastName}`}
																onSelect={() => toggleSelection(staff.staffId)}
																className="cursor-pointer"
															>
																<Check
																	className={cn(
																		'mr-2 h-4 w-4',
																		selectedIds.includes(staff.staffId) ? 'opacity-100' : 'opacity-0'
																	)}
																/>
																<span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs mr-2">
																	{staff.firstName.charAt(0)}
																</span>
																{staff.firstName} {staff.lastName}
															</CommandItem>
														))}
													</CommandGroup>
												</ScrollArea>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
								<p className="text-[0.8rem] text-muted-foreground">{t('goals.assignToHint')}</p>
							</div>
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
							<Button type="submit" disabled={isLoading || !canSubmit}>
								{isLoading ? t('actions.saving') : isEditing ? t('actions.save') : t('actions.create')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
