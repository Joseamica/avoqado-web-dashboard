import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import DataTable from '@/components/data-table'
import { PermissionGate } from '@/components/PermissionGate'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import customerService from '@/services/customer.service'
import type { CustomerGroup } from '@/types/customer'

// Predefined colors for groups
const GROUP_COLORS = [
	'#ef4444', // red
	'#f97316', // orange
	'#eab308', // yellow
	'#22c55e', // green
	'#14b8a6', // teal
	'#3b82f6', // blue
	'#8b5cf6', // violet
	'#ec4899', // pink
	'#6b7280', // gray
]

export default function CustomerGroups() {
	const { venueId } = useCurrentVenue()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const { t } = useTranslation('customers')
	const { t: tCommon } = useTranslation()

	// State
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: 20,
	})
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
	const [deletingGroup, setDeletingGroup] = useState<CustomerGroup | null>(null)

	// Fetch customer groups
	const { data: groupsData, isLoading } = useQuery({
		queryKey: ['customer-groups', venueId, pagination.pageIndex, pagination.pageSize],
		queryFn: () =>
			customerService.getCustomerGroups(venueId, {
				page: pagination.pageIndex + 1,
				pageSize: pagination.pageSize,
			}),
		refetchOnWindowFocus: true,
	})

	// Delete mutation
	const deleteGroupMutation = useMutation({
		mutationFn: (groupId: string) => customerService.deleteCustomerGroup(venueId, groupId),
		onSuccess: () => {
			toast({ title: t('toasts.groupDeleteSuccess') })
			queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
			setDeletingGroup(null)
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Memoized groups list
	const groups = useMemo(() => groupsData?.data || [], [groupsData?.data])

	// Client-side search
	const handleSearch = useCallback((search: string, rows: CustomerGroup[]) => {
		if (!search) return rows
		const q = search.toLowerCase()
		return rows.filter((g) => {
			const name = g.name.toLowerCase()
			const description = (g.description || '').toLowerCase()
			return name.includes(q) || description.includes(q)
		})
	}, [])

	// Column definitions
	const columns: ColumnDef<CustomerGroup>[] = useMemo(
		() => [
			{
				accessorKey: 'name',
				header: t('groups.columns.name'),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="w-4 h-4 rounded-full" style={{ backgroundColor: row.original.color }} />
						<span className="font-medium">{row.original.name}</span>
					</div>
				),
			},
			{
				accessorKey: 'description',
				header: t('groups.columns.description'),
				cell: ({ row }) => (
					<span className="text-muted-foreground">{row.original.description || '—'}</span>
				),
			},
			{
				accessorKey: '_count.customers',
				header: t('groups.columns.customers'),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<Users className="h-4 w-4 text-muted-foreground" />
						<span>{row.original._count.customers}</span>
					</div>
				),
			},
			{
				accessorKey: 'active',
				header: t('groups.columns.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.active ? 'default' : 'secondary'}>
						{row.original.active ? t('groups.status.active') : t('groups.status.inactive')}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: tCommon('common.actions'),
				cell: ({ row }) => (
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" sideOffset={5} className="w-48">
							<PermissionGate permission="customer-groups:update">
								<DropdownMenuItem onClick={() => setEditingGroup(row.original)}>
									<Pencil className="h-4 w-4 mr-2" />
									{tCommon('common.edit')}
								</DropdownMenuItem>
							</PermissionGate>
							<DropdownMenuSeparator />
							<PermissionGate permission="customer-groups:delete">
								<DropdownMenuItem
									onClick={() => setDeletingGroup(row.original)}
									className="text-red-600"
								>
									<Trash2 className="h-4 w-4 mr-2" />
									{tCommon('common.delete')}
								</DropdownMenuItem>
							</PermissionGate>
						</DropdownMenuContent>
					</DropdownMenu>
				),
			},
		],
		[t, tCommon]
	)

	return (
		<div className="p-4 bg-background text-foreground">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold">{t('groups.title')}</h1>
					<p className="text-muted-foreground">{t('groups.subtitle')}</p>
				</div>

				<PermissionGate permission="customer-groups:create">
					<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
						<DialogTrigger asChild>
							<Button id="create-group-button">
								<Plus className="h-4 w-4 mr-2" />
								{t('groups.form.createTitle')}
							</Button>
						</DialogTrigger>
						{showCreateDialog && (
							<DialogContent className="max-w-md">
								<DialogHeader>
									<DialogTitle>{t('groups.form.createTitle')}</DialogTitle>
									<DialogDescription>{t('groups.subtitle')}</DialogDescription>
								</DialogHeader>
								<CustomerGroupForm
									venueId={venueId}
									onSuccess={() => {
										setShowCreateDialog(false)
										queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
									}}
								/>
							</DialogContent>
						)}
					</Dialog>
				</PermissionGate>
			</div>

			{/* Data Table */}
			<DataTable
				data={groups}
				columns={columns}
				isLoading={isLoading}
				pagination={pagination}
				setPagination={setPagination}
				tableId="customer-groups:list"
				rowCount={groupsData?.meta.totalCount || 0}
				enableSearch={true}
				searchPlaceholder={t('list.searchPlaceholder')}
				onSearch={handleSearch}
			/>

			{/* Edit Group Dialog */}
			{editingGroup && (
				<Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>{t('groups.form.editTitle')}</DialogTitle>
							<DialogDescription>{editingGroup.name}</DialogDescription>
						</DialogHeader>
						<CustomerGroupForm
							venueId={venueId}
							group={editingGroup}
							onSuccess={() => {
								setEditingGroup(null)
								queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
							}}
						/>
					</DialogContent>
				</Dialog>
			)}

			{/* Delete Group Alert */}
			{deletingGroup && (
				<AlertDialog open={!!deletingGroup} onOpenChange={() => setDeletingGroup(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t('groups.delete.title')}</AlertDialogTitle>
							<AlertDialogDescription>
								{t('groups.delete.description', { name: deletingGroup.name })}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => deleteGroupMutation.mutate(deletingGroup.id)}
								disabled={deleteGroupMutation.isPending}
								className="bg-red-600 hover:bg-red-700"
							>
								{deleteGroupMutation.isPending ? tCommon('common.deleting') : t('groups.delete.confirm')}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	)
}

// Customer Group Form Component
interface CustomerGroupFormProps {
	venueId: string
	group?: CustomerGroup
	onSuccess: () => void
}

function CustomerGroupForm({ venueId, group, onSuccess }: CustomerGroupFormProps) {
	const { t } = useTranslation('customers')
	const { t: tCommon } = useTranslation()
	const { toast } = useToast()
	const queryClient = useQueryClient()

	const isEditing = !!group

	// Schema
	const schema = z.object({
		name: z.string().min(1, t('groups.form.validation.nameRequired')),
		description: z.string().optional(),
		color: z.string().min(1, t('groups.form.validation.colorRequired')),
		active: z.boolean(),
	})

	type FormData = z.infer<typeof schema>

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isValid },
	} = useForm<FormData>({
		resolver: zodResolver(schema),
		mode: 'onBlur',
		defaultValues: {
			name: group?.name || '',
			description: group?.description || '',
			color: group?.color || GROUP_COLORS[0],
			active: group?.active ?? true,
		},
	})

	const watchedColor = watch('color')
	const watchedActive = watch('active')

	// Create mutation
	const createMutation = useMutation({
		mutationFn: (data: FormData) =>
			customerService.createCustomerGroup(venueId, {
				name: data.name,
				description: data.description || undefined,
				color: data.color,
				active: data.active,
			}),
		onSuccess: () => {
			toast({ title: t('toasts.groupCreateSuccess') })
			queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
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
		mutationFn: (data: FormData) =>
			customerService.updateCustomerGroup(venueId, group!.id, {
				name: data.name,
				description: data.description || undefined,
				color: data.color,
				active: data.active,
			}),
		onSuccess: () => {
			toast({ title: t('toasts.groupUpdateSuccess') })
			queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
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

	const onSubmit = (data: FormData) => {
		if (isEditing) {
			updateMutation.mutate(data)
		} else {
			createMutation.mutate(data)
		}
	}

	const isPending = createMutation.isPending || updateMutation.isPending

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">{t('groups.form.fields.name')} *</Label>
				<Input id="name" placeholder={t('groups.form.placeholders.name')} {...register('name')} />
				{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
			</div>

			<div className="space-y-2">
				<Label htmlFor="description">{t('groups.form.fields.description')}</Label>
				<Textarea
					id="description"
					placeholder={t('groups.form.placeholders.description')}
					{...register('description')}
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
							onClick={() => setValue('color', color)}
							className={`w-8 h-8 rounded-full transition-all ${
								watchedColor === color ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
							}`}
							style={{ backgroundColor: color }}
						/>
					))}
				</div>
				{errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
			</div>

			<div className="flex items-center justify-between">
				<Label htmlFor="active">{t('groups.form.fields.active')}</Label>
				<Switch
					id="active"
					checked={watchedActive}
					onCheckedChange={(checked) => setValue('active', checked)}
				/>
			</div>

			<div className="flex justify-end gap-3 pt-4">
				<Button type="submit" disabled={!isValid || isPending}>
					{isPending ? (
						<>
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
							{tCommon('common.saving')}
						</>
					) : isEditing ? (
						t('groups.form.buttons.save')
					) : (
						t('groups.form.buttons.create')
					)}
				</Button>
			</div>
		</form>
	)
}
