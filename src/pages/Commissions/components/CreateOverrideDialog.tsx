import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
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
import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCreateCommissionOverride, useUpdateCommissionOverride } from '@/hooks/useCommissions'
import { teamService } from '@/services/team.service'
import { useToast } from '@/hooks/use-toast'
import type { CommissionOverride } from '@/types/commission'
import { cn } from '@/lib/utils'

const createOverrideSchema = z.object({
	staffId: z.string().min(1, 'Staff member is required'),
	customRate: z.number().min(0).max(100).nullable(),
	excludeFromCommissions: z.boolean(),
	notes: z.string().optional(),
	effectiveFrom: z.string().optional(),
	effectiveTo: z.string().optional(),
	active: z.boolean(),
})

type OverrideFormData = z.infer<typeof createOverrideSchema>

interface CreateOverrideDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	configId: string
	override?: CommissionOverride | null
}

export default function CreateOverrideDialog({
	open,
	onOpenChange,
	configId,
	override,
}: CreateOverrideDialogProps) {
	const { t } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()
	const { venueId } = useCurrentVenue()

	const [staffSearchOpen, setStaffSearchOpen] = useState(false)
	const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)

	const isEditing = !!override

	// Fetch venue staff for selection
	const { data: staffData } = useQuery({
		queryKey: ['team-members', venueId],
		queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
		enabled: !!venueId && open,
	})
	const staffList = staffData?.data || []

	const createOverrideMutation = useCreateCommissionOverride(configId)
	const updateOverrideMutation = useUpdateCommissionOverride(configId)

	const form = useForm<OverrideFormData>({
		resolver: zodResolver(createOverrideSchema),
		defaultValues: {
			staffId: override?.staffId || '',
			customRate: override?.customRate != null ? override.customRate * 100 : null,
			excludeFromCommissions: override?.excludeFromCommissions ?? false,
			notes: override?.notes || '',
			effectiveFrom: override?.effectiveFrom?.split('T')[0] || '',
			effectiveTo: override?.effectiveTo?.split('T')[0] || '',
			active: override?.active ?? true,
		},
	})

	// Reset form when override changes
	useEffect(() => {
		if (open) {
			if (override) {
				setSelectedStaff({
					id: override.staffId,
					name: `${override.staff.firstName} ${override.staff.lastName}`,
				})
				form.reset({
					staffId: override.staffId,
					customRate: override.customRate !== null ? override.customRate * 100 : null,
					excludeFromCommissions: override.excludeFromCommissions,
					notes: override.notes || '',
					effectiveFrom: override.effectiveFrom?.split('T')[0] || '',
					effectiveTo: override.effectiveTo?.split('T')[0] || '',
					active: override.active ?? true,
				})
			} else {
				setSelectedStaff(null)
				form.reset({
					staffId: '',
					customRate: null,
					excludeFromCommissions: false,
					notes: '',
					effectiveFrom: '',
					effectiveTo: '',
					active: true,
				})
			}
		}
	}, [open, override, form])

	const onSubmit = async (data: OverrideFormData) => {
		try {
			const payload = {
				staffId: data.staffId,
				customRate: data.customRate !== null ? data.customRate / 100 : null,
				excludeFromCommissions: data.excludeFromCommissions,
				notes: data.notes || undefined,
				effectiveFrom: data.effectiveFrom || undefined,
				effectiveTo: data.effectiveTo || undefined,
				active: data.active,
			}

			if (isEditing && override) {
				await updateOverrideMutation.mutateAsync({
					overrideId: override.id,
					data: payload,
				})
				toast({
					title: t('success.overrideUpdated'),
				})
			} else {
				await createOverrideMutation.mutateAsync(payload)
				toast({
					title: t('success.overrideCreated'),
				})
			}

			onOpenChange(false)
		} catch (error: any) {
			toast({
				title: isEditing ? t('errors.updateError') : t('errors.createError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	const isPending = createOverrideMutation.isPending || updateOverrideMutation.isPending
	const excludeFromCommissions = form.watch('excludeFromCommissions')

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? t('overrides.edit') : t('overrides.create')}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? t('overrides.editDescription')
							: t('overrides.createDescription')}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{/* Staff Selection */}
						<FormField
							control={form.control}
							name="staffId"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>{t('overrides.staff')}</FormLabel>
									<Popover open={staffSearchOpen} onOpenChange={setStaffSearchOpen}>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant="outline"
													role="combobox"
													aria-expanded={staffSearchOpen}
													className={cn(
														'w-full justify-between',
														!selectedStaff && 'text-muted-foreground'
													)}
													disabled={isEditing}
												>
													{selectedStaff?.name || t('overrides.selectStaff')}
													<Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-full p-0" align="start">
											<Command>
												<CommandInput placeholder={t('overrides.searchStaff')} />
												<CommandList>
													<CommandEmpty>{t('overrides.noStaffFound')}</CommandEmpty>
													<CommandGroup>
														{staffList?.map((staff) => (
															<CommandItem
																key={staff.id}
																value={`${staff.firstName} ${staff.lastName}`}
																onSelect={() => {
																	field.onChange(staff.id)
																	setSelectedStaff({
																		id: staff.id,
																		name: `${staff.firstName} ${staff.lastName}`,
																	})
																	setStaffSearchOpen(false)
																}}
															>
																{staff.firstName} {staff.lastName}
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Exclude from Commissions Toggle */}
						<FormField
							control={form.control}
							name="excludeFromCommissions"
							render={({ field }) => (
								<FormItem className="flex items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel className="text-base">
											{t('overrides.excludeFromCommissions')}
										</FormLabel>
										<FormDescription>
											{t('overrides.excludeDescription')}
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						{/* Custom Rate - only shown when not excluded */}
						{!excludeFromCommissions && (
							<FormField
								control={form.control}
								name="customRate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('overrides.customRate')}</FormLabel>
										<FormControl>
											<div className="relative">
												<Input
													type="number"
													step="0.01"
													min={0}
													max={100}
													className="pr-8"
													placeholder={t('overrides.customRatePlaceholder')}
													value={field.value ?? ''}
													onChange={(e) => {
														const value = e.target.value
														field.onChange(value === '' ? null : parseFloat(value))
													}}
												/>
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
													%
												</span>
											</div>
										</FormControl>
										<FormDescription>
											{t('overrides.customRateDescription')}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{/* Effective Dates */}
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="effectiveFrom"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('overrides.effectiveFrom')}</FormLabel>
										<FormControl>
											<Input type="date" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="effectiveTo"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('overrides.effectiveTo')}</FormLabel>
										<FormControl>
											<Input type="date" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Notes */}
						<FormField
							control={form.control}
							name="notes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('overrides.notes')}</FormLabel>
									<FormControl>
										<Textarea
											placeholder={t('overrides.notesPlaceholder')}
											className="resize-none"
											rows={3}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Active Toggle */}
						<FormField
							control={form.control}
							name="active"
							render={({ field }) => (
								<FormItem className="flex items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel className="text-base">
											{t('overrides.active')}
										</FormLabel>
										<FormDescription>
											{t('overrides.activeDescription')}
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isPending}
							>
								{t('actions.cancel')}
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending
									? tCommon('common.saving')
									: isEditing
										? t('actions.save')
										: t('actions.create')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
