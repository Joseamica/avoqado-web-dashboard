import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import customerService from '@/services/customer.service'
import type { Customer, CustomerGroup } from '@/types/customer'

// Predefined colors for groups
const GROUP_COLORS = [
	'#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
	'#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

interface CustomerFormProps {
	venueId: string
	customer?: Customer
	groups: CustomerGroup[]
	onSuccess: () => void
}

// Create schema with translations
const createCustomerSchema = (t: (key: string) => string) =>
	z.object({
		firstName: z.string().min(1, t('form.validation.firstNameRequired')),
		lastName: z.string().min(1, t('form.validation.lastNameRequired')),
		email: z.string().email(t('form.validation.emailInvalid')).min(1, t('form.validation.emailRequired')),
		phone: z.string().min(10, t('form.validation.phoneInvalid')),
		customerGroupId: z.string().optional(),
	})

type CustomerFormData = z.infer<ReturnType<typeof createCustomerSchema>>

export default function CustomerForm({ venueId, customer, groups, onSuccess }: CustomerFormProps) {
	const { t } = useTranslation('customers')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()
	const queryClient = useQueryClient()

	const isEditing = !!customer
	const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false)
	const [newGroupName, setNewGroupName] = useState('')
	const [newGroupDescription, setNewGroupDescription] = useState('')
	const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
	const [newGroupActive, setNewGroupActive] = useState(true)

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isValid },
	} = useForm<CustomerFormData>({
		resolver: zodResolver(createCustomerSchema(t)),
		mode: 'onBlur',
		defaultValues: {
			firstName: customer?.firstName || '',
			lastName: customer?.lastName || '',
			email: customer?.email || '',
			phone: customer?.phone || '',
			customerGroupId: customer?.customerGroupId || '',
		},
	})

	const watchedGroupId = watch('customerGroupId')

	// Create group mutation
	const createGroupMutation = useMutation({
		mutationFn: () =>
			customerService.createCustomerGroup(venueId, {
				name: newGroupName,
				description: newGroupDescription || undefined,
				color: newGroupColor,
				active: newGroupActive,
			}),
		onSuccess: (newGroup) => {
			toast({ title: t('toasts.groupCreateSuccess') })
			queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
			// Auto-select the newly created group
			setValue('customerGroupId', newGroup.id)
			setShowCreateGroupDialog(false)
			// Reset form
			setNewGroupName('')
			setNewGroupDescription('')
			setNewGroupColor(GROUP_COLORS[0])
			setNewGroupActive(true)
		},
		onError: (error: any) => {
			toast({
				title: tCommon('error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Create mutation
	const createMutation = useMutation({
		mutationFn: (data: CustomerFormData) =>
			customerService.createCustomer(venueId, {
				firstName: data.firstName,
				lastName: data.lastName,
				email: data.email,
				phone: data.phone,
				customerGroupId: data.customerGroupId || undefined,
			}),
		onSuccess: () => {
			toast({ title: t('toasts.createSuccess') })
			queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
			onSuccess()
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Update mutation
	const updateMutation = useMutation({
		mutationFn: (data: CustomerFormData) =>
			customerService.updateCustomer(venueId, customer!.id, {
				firstName: data.firstName,
				lastName: data.lastName,
				email: data.email,
				phone: data.phone,
				customerGroupId: data.customerGroupId || null,
			}),
		onSuccess: () => {
			toast({ title: t('toasts.updateSuccess') })
			queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
			onSuccess()
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	const onSubmit = (data: CustomerFormData) => {
		if (isEditing) {
			updateMutation.mutate(data)
		} else {
			createMutation.mutate(data)
		}
	}

	const isPending = createMutation.isPending || updateMutation.isPending

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="firstName">{t('form.fields.firstName')} *</Label>
					<Input
						id="firstName"
						placeholder={t('form.placeholders.firstName')}
						{...register('firstName')}
					/>
					{errors.firstName && (
						<p className="text-sm text-destructive">{errors.firstName.message}</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="lastName">{t('form.fields.lastName')} *</Label>
					<Input
						id="lastName"
						placeholder={t('form.placeholders.lastName')}
						{...register('lastName')}
					/>
					{errors.lastName && (
						<p className="text-sm text-destructive">{errors.lastName.message}</p>
					)}
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="email">{t('form.fields.email')} *</Label>
				<Input
					id="email"
					type="email"
					placeholder={t('form.placeholders.email')}
					{...register('email')}
				/>
				{errors.email && (
					<p className="text-sm text-destructive">{errors.email.message}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="phone">{t('form.fields.phone')} *</Label>
				<Input
					id="phone"
					type="tel"
					placeholder={t('form.placeholders.phone')}
					{...register('phone')}
				/>
				{errors.phone && (
					<p className="text-sm text-destructive">{errors.phone.message}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="customerGroupId">{t('form.fields.group')}</Label>
				<Select
					value={watchedGroupId || ''}
					onValueChange={(value) => setValue('customerGroupId', value === 'none' ? '' : value)}
				>
					<SelectTrigger>
						<SelectValue placeholder={t('form.placeholders.selectGroup')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">{t('list.filters.noGroup')}</SelectItem>
						{groups.map((group) => (
							<SelectItem key={group.id} value={group.id}>
								<div className="flex items-center gap-2">
									<div
										className="w-3 h-3 rounded-full"
										style={{ backgroundColor: group.color }}
									/>
									{group.name}
								</div>
							</SelectItem>
						))}
						<SelectSeparator />
						<div className="p-1">
							<Button
								type="button"
								variant="ghost"
								className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									setShowCreateGroupDialog(true)
								}}
							>
								<Plus className="h-4 w-4 mr-2" />
								{t('groups.form.createTitle')}
							</Button>
						</div>
					</SelectContent>
				</Select>
			</div>

			<div className="flex justify-end gap-3 pt-4">
				<Button type="submit" disabled={!isValid || isPending}>
					{isPending ? (
						<>
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
							{tCommon('saving')}
						</>
					) : isEditing ? (
						t('form.buttons.save')
					) : (
						t('form.buttons.create')
					)}
				</Button>
			</div>

			{/* Create Group Dialog */}
			<Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{t('groups.form.createTitle')}</DialogTitle>
						<DialogDescription>{t('groups.subtitle')}</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="groupName">{t('groups.form.fields.name')} *</Label>
							<Input
								id="groupName"
								value={newGroupName}
								onChange={(e) => setNewGroupName(e.target.value)}
								placeholder={t('groups.form.placeholders.name')}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="groupDescription">{t('groups.form.fields.description')}</Label>
							<Textarea
								id="groupDescription"
								value={newGroupDescription}
								onChange={(e) => setNewGroupDescription(e.target.value)}
								placeholder={t('groups.form.placeholders.description')}
								rows={3}
							/>
						</div>

						<div className="space-y-2">
							<Label>{t('groups.form.fields.color')} *</Label>
							<div className="flex flex-wrap gap-2">
								{GROUP_COLORS.map((color) => (
									<button
										key={color}
										type="button"
										onClick={() => setNewGroupColor(color)}
										className={`w-8 h-8 rounded-full transition-all ${
											newGroupColor === color ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
										}`}
										style={{ backgroundColor: color }}
									/>
								))}
							</div>
						</div>

						<div className="flex items-center justify-between">
							<Label htmlFor="groupActive">{t('groups.form.fields.active')}</Label>
							<Switch
								id="groupActive"
								checked={newGroupActive}
								onCheckedChange={setNewGroupActive}
							/>
						</div>

						<div className="flex justify-end gap-3 pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => setShowCreateGroupDialog(false)}
							>
								{tCommon('cancel')}
							</Button>
							<Button
								type="button"
								onClick={() => createGroupMutation.mutate()}
								disabled={!newGroupName || createGroupMutation.isPending}
							>
								{createGroupMutation.isPending ? (
									<>
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
										{tCommon('saving')}
									</>
								) : (
									t('groups.form.buttons.create')
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</form>
	)
}
