import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	FormDescription,
} from '@/components/ui/form'
import { useUpdateCommissionConfig } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionConfig, CommissionCalcType, CommissionRecipient } from '@/types/commission'

const calcTypes: CommissionCalcType[] = ['PERCENTAGE', 'FIXED', 'TIERED', 'MILESTONE', 'MANUAL']
const recipients: CommissionRecipient[] = ['CREATOR', 'SERVER', 'PROCESSOR']

const editConfigSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	calcType: z.enum(['PERCENTAGE', 'FIXED', 'TIERED', 'MILESTONE', 'MANUAL']),
	recipient: z.enum(['CREATOR', 'SERVER', 'PROCESSOR']),
	defaultRate: z.number().min(0, 'Rate must be >= 0').max(100, 'Rate must be <= 100'),
	minAmount: z.number().nullable(),
	maxAmount: z.number().nullable(),
	includeTips: z.boolean(),
	includeDiscount: z.boolean(),
	includeTax: z.boolean(),
	effectiveFrom: z.string().optional(),
	effectiveTo: z.string().optional(),
	priority: z.number().min(1),
	active: z.boolean(),
})

type ConfigFormData = z.infer<typeof editConfigSchema>

interface EditConfigDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	config: CommissionConfig
}

export default function EditConfigDialog({
	open,
	onOpenChange,
	config,
}: EditConfigDialogProps) {
	const { t } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()

	const updateConfigMutation = useUpdateCommissionConfig()

	const form = useForm<ConfigFormData>({
		resolver: zodResolver(editConfigSchema),
		defaultValues: {
			name: config.name,
			calcType: config.calcType,
			recipient: config.recipient,
			defaultRate: config.defaultRate * 100,
			minAmount: config.minAmount,
			maxAmount: config.maxAmount,
			includeTips: config.includeTips,
			includeDiscount: config.includeDiscount,
			includeTax: config.includeTax,
			effectiveFrom: config.effectiveFrom?.split('T')[0] || '',
			effectiveTo: config.effectiveTo?.split('T')[0] || '',
			priority: config.priority,
			active: config.active,
		},
	})

	// Reset form when config changes
	useEffect(() => {
		if (open && config) {
			form.reset({
				name: config.name,
				calcType: config.calcType,
				recipient: config.recipient,
				defaultRate: config.defaultRate * 100,
				minAmount: config.minAmount,
				maxAmount: config.maxAmount,
				includeTips: config.includeTips,
				includeDiscount: config.includeDiscount,
				includeTax: config.includeTax,
				effectiveFrom: config.effectiveFrom?.split('T')[0] || '',
				effectiveTo: config.effectiveTo?.split('T')[0] || '',
				priority: config.priority,
				active: config.active,
			})
		}
	}, [open, config, form])

	const onSubmit = async (data: ConfigFormData) => {
		try {
			// Convert date strings to ISO-8601 DateTime format (Prisma requires full DateTime)
			const toISODateTime = (dateStr: string | undefined) => {
				if (!dateStr) return undefined
				return new Date(dateStr + 'T00:00:00').toISOString()
			}

			await updateConfigMutation.mutateAsync({
				configId: config.id,
				data: {
					name: data.name,
					calcType: data.calcType,
					recipient: data.recipient,
					defaultRate: data.defaultRate / 100,
					minAmount: data.minAmount,
					maxAmount: data.maxAmount,
					includeTips: data.includeTips,
					includeDiscount: data.includeDiscount,
					includeTax: data.includeTax,
					effectiveFrom: toISODateTime(data.effectiveFrom),
					effectiveTo: toISODateTime(data.effectiveTo),
					priority: data.priority,
					active: data.active,
				},
			})

			toast({
				title: t('success.configUpdated'),
			})

			onOpenChange(false)
		} catch (error: any) {
			toast({
				title: t('errors.updateError'),
				description: error.response?.data?.message || tCommon('common.error'),
				variant: 'destructive',
			})
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t('config.edit')}</DialogTitle>
					<DialogDescription>
						{t('config.editDescription')}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{/* Name */}
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('config.name')}</FormLabel>
									<FormControl>
										<Input placeholder={t('config.namePlaceholder')} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Calc Type and Recipient */}
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="calcType"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('config.calcType')}</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{calcTypes.map((type) => (
													<SelectItem key={type} value={type}>
														{t(`calcTypes.${type}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="recipient"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('config.recipient')}</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{recipients.map((recipient) => (
													<SelectItem key={recipient} value={recipient}>
														{t(`recipients.${recipient}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Default Rate and Priority */}
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="defaultRate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('config.defaultRate')}</FormLabel>
										<FormControl>
											<div className="relative">
												<Input
													type="number"
													step="0.01"
													min={0}
													max={100}
													className="pr-8"
													{...field}
													onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
												/>
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
													%
												</span>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('config.priority')}</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												{...field}
												onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
											/>
										</FormControl>
										<FormDescription>
											{t('config.priorityDescription')}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Min/Max Amount */}
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="minAmount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('config.minAmount')}</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												min={0}
												placeholder={t('config.optional')}
												value={field.value ?? ''}
												onChange={(e) => {
													const value = e.target.value
													field.onChange(value === '' ? null : parseFloat(value))
												}}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="maxAmount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('config.maxAmount')}</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												min={0}
												placeholder={t('config.optional')}
												value={field.value ?? ''}
												onChange={(e) => {
													const value = e.target.value
													field.onChange(value === '' ? null : parseFloat(value))
												}}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Effective Dates */}
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="effectiveFrom"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('config.effectiveFrom')}</FormLabel>
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
										<FormLabel>{t('config.effectiveTo')}</FormLabel>
										<FormControl>
											<Input type="date" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Toggle Options */}
						<div className="space-y-3">
							<FormField
								control={form.control}
								name="includeTips"
								render={({ field }) => (
									<FormItem className="flex items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												{t('config.includeTips')}
											</FormLabel>
											<FormDescription>
												{t('config.includeTipsDescription')}
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

							<FormField
								control={form.control}
								name="includeDiscount"
								render={({ field }) => (
									<FormItem className="flex items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												{t('config.includeDiscount')}
											</FormLabel>
											<FormDescription>
												{t('config.includeDiscountDescription')}
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

							<FormField
								control={form.control}
								name="includeTax"
								render={({ field }) => (
									<FormItem className="flex items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												{t('config.includeTax')}
											</FormLabel>
											<FormDescription>
												{t('config.includeTaxDescription')}
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

							<FormField
								control={form.control}
								name="active"
								render={({ field }) => (
									<FormItem className="flex items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												{t('config.active')}
											</FormLabel>
											<FormDescription>
												{t('config.activeDescription')}
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
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={updateConfigMutation.isPending}
							>
								{t('actions.cancel')}
							</Button>
							<Button type="submit" disabled={updateConfigMutation.isPending}>
								{updateConfigMutation.isPending
									? tCommon('common.saving')
									: t('actions.save')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
