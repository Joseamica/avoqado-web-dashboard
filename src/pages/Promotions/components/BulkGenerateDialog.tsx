import { useMutation } from '@tanstack/react-query'
import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { LoadingButton } from '@/components/loading-button'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import couponService from '@/services/coupon.service'
import type { BulkGenerateCouponsRequest, Discount } from '@/types/discount'

interface BulkGenerateDialogProps {
	venueId: string
	discounts: Discount[]
	onSuccess: () => void
}

export default function BulkGenerateDialog({ venueId, discounts, onSuccess }: BulkGenerateDialogProps) {
	const { t } = useTranslation('promotions')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()

	const [generatedCodes, setGeneratedCodes] = useState<string[]>([])
	const [copied, setCopied] = useState(false)

	const form = useForm<BulkGenerateCouponsRequest>({
		defaultValues: {
			discountId: '',
			prefix: '',
			quantity: 10,
			codeLength: 8,
			maxUsesPerCode: undefined,
			maxUsesPerCustomer: undefined,
			validFrom: '',
			validUntil: '',
		},
	})

	const mutation = useMutation({
		mutationFn: (data: BulkGenerateCouponsRequest) => couponService.bulkGenerate(venueId, data),
		onSuccess: (response) => {
			setGeneratedCodes(response.codes)
			toast({
				title: t('coupons.bulkGenerate.success.title'),
				description: t('coupons.bulkGenerate.success.description', { count: response.count }),
			})
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('coupons.toasts.error'),
				variant: 'destructive',
			})
		},
	})

	const onSubmit = (data: BulkGenerateCouponsRequest) => {
		// Clean up empty values
		const cleanedData = { ...data }
		if (!cleanedData.prefix) cleanedData.prefix = undefined
		if (!cleanedData.validFrom) cleanedData.validFrom = undefined
		if (!cleanedData.validUntil) cleanedData.validUntil = undefined
		mutation.mutate(cleanedData)
	}

	const handleCopyAll = async () => {
		try {
			await navigator.clipboard.writeText(generatedCodes.join('\n'))
			setCopied(true)
			toast({ title: t('coupons.bulkGenerate.result.copied') })
			setTimeout(() => setCopied(false), 2000)
		} catch (_err) {
			toast({ title: tCommon('common.error'), variant: 'destructive' })
		}
	}

	const handleDownloadCSV = () => {
		const csv = 'Code\n' + generatedCodes.join('\n')
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
		const link = document.createElement('a')
		const url = URL.createObjectURL(blob)
		link.setAttribute('href', url)
		link.setAttribute('download', `coupons-${new Date().toISOString().split('T')[0]}.csv`)
		link.style.visibility = 'hidden'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	// Show results if codes were generated
	if (generatedCodes.length > 0) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="font-medium">{t('coupons.bulkGenerate.result.title')}</h3>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={handleCopyAll}>
							{copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
							{t('coupons.bulkGenerate.result.copyAll')}
						</Button>
						<Button variant="outline" size="sm" onClick={handleDownloadCSV}>
							<Download className="h-4 w-4 mr-2" />
							{t('coupons.bulkGenerate.result.download')}
						</Button>
					</div>
				</div>

				<div className="max-h-64 overflow-y-auto border rounded-md p-2">
					<div className="space-y-1">
						{generatedCodes.map((code, index) => (
							<div key={index} className="font-mono text-sm p-1 bg-muted rounded">
								{code}
							</div>
						))}
					</div>
				</div>

				<div className="flex justify-end">
					<Button onClick={onSuccess}>{tCommon('done')}</Button>
				</div>
			</div>
		)
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="discountId"
					rules={{ required: { value: true, message: t('coupons.form.validation.discountRequired') } }}
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t('coupons.bulkGenerate.fields.discount')}</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder={t('coupons.form.placeholders.discount')} />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{discounts.map((discount) => (
										<SelectItem key={discount.id} value={discount.id}>
											{discount.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="prefix"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('coupons.bulkGenerate.fields.prefix')}</FormLabel>
								<FormControl>
									<Input
										placeholder={t('coupons.bulkGenerate.placeholders.prefix')}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="quantity"
						rules={{
							required: true,
							min: { value: 1, message: t('coupons.bulkGenerate.validation.quantityMin') },
							max: { value: 1000, message: t('coupons.bulkGenerate.validation.quantityMax') },
						}}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('coupons.bulkGenerate.fields.quantity')}</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={1}
										max={1000}
										placeholder={t('coupons.bulkGenerate.placeholders.quantity')}
										{...field}
										onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="codeLength"
					rules={{
						min: { value: 4, message: t('coupons.bulkGenerate.validation.codeLengthMin') },
						max: { value: 20, message: t('coupons.bulkGenerate.validation.codeLengthMax') },
					}}
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t('coupons.bulkGenerate.fields.codeLength')}</FormLabel>
							<FormControl>
								<Input
									type="number"
									min={4}
									max={20}
									placeholder={t('coupons.bulkGenerate.placeholders.codeLength')}
									{...field}
									onChange={(e) => field.onChange(parseInt(e.target.value) || 8)}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="maxUsesPerCode"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('coupons.bulkGenerate.fields.maxUsesPerCode')}</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={0}
										placeholder={t('coupons.form.placeholders.maxUses')}
										{...field}
										value={field.value ?? ''}
										onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="maxUsesPerCustomer"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('coupons.bulkGenerate.fields.maxUsesPerCustomer')}</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={0}
										placeholder={t('coupons.form.placeholders.maxUsesPerCustomer')}
										{...field}
										value={field.value ?? ''}
										onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="validFrom"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('coupons.bulkGenerate.fields.validFrom')}</FormLabel>
								<FormControl>
									<Input type="date" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="validUntil"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('coupons.bulkGenerate.fields.validUntil')}</FormLabel>
								<FormControl>
									<Input type="date" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="flex justify-end pt-4">
					<LoadingButton loading={mutation.isPending} type="submit">
						{mutation.isPending ? t('coupons.bulkGenerate.generating') : t('coupons.bulkGenerate.generate')}
					</LoadingButton>
				</div>
			</form>
		</Form>
	)
}
