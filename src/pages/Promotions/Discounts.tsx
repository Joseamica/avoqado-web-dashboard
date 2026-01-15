import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Copy, MoreHorizontal, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { PermissionGate } from '@/components/PermissionGate'
import { DiscountWizard } from './components/DiscountWizard'
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import discountService from '@/services/discount.service'
import type { Discount, DiscountType, DiscountScope } from '@/types/discount'
import { getIntlLocale } from '@/utils/i18n-locale'

export default function Discounts() {
	const { venueId } = useCurrentVenue()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const { t, i18n } = useTranslation('promotions')
	const { t: tCommon } = useTranslation()

	// State
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: 20,
	})
	const [selectedType, setSelectedType] = useState<string>('')
	const [selectedScope, setSelectedScope] = useState<string>('')
	const [activeFilter, setActiveFilter] = useState<string>('')
	const [deletingDiscount, setDeletingDiscount] = useState<Discount | null>(null)
	const [wizardOpen, setWizardOpen] = useState(false)

	// Fetch discounts
	const { data: discountsData, isLoading: isLoadingDiscounts } = useQuery({
		queryKey: ['discounts', venueId, pagination.pageIndex, pagination.pageSize, selectedType, selectedScope, activeFilter],
		queryFn: () =>
			discountService.getDiscounts(venueId, {
				page: pagination.pageIndex + 1,
				pageSize: pagination.pageSize,
				type: selectedType ? (selectedType as DiscountType) : undefined,
				scope: selectedScope ? (selectedScope as DiscountScope) : undefined,
				active: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
			}),
		refetchOnWindowFocus: true,
	})

	// Delete discount mutation
	const deleteDiscountMutation = useMutation({
		mutationFn: (discountId: string) => discountService.deleteDiscount(venueId, discountId),
		onSuccess: () => {
			toast({
				title: t('discounts.toasts.deleteSuccess'),
			})
			queryClient.invalidateQueries({ queryKey: ['discounts', venueId] })
			setDeletingDiscount(null)
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('discounts.toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Clone discount mutation
	const cloneDiscountMutation = useMutation({
		mutationFn: (discountId: string) => discountService.cloneDiscount(venueId, discountId),
		onSuccess: () => {
			toast({
				title: t('discounts.toasts.cloneSuccess'),
			})
			queryClient.invalidateQueries({ queryKey: ['discounts', venueId] })
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('discounts.toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Memoized discounts list
	const discounts = useMemo(() => discountsData?.data || [], [discountsData?.data])

	// Client-side search
	const handleSearch = useCallback((search: string, rows: Discount[]) => {
		if (!search) return rows
		const q = search.toLowerCase()
		return rows.filter(d => {
			const name = (d.name || '').toLowerCase()
			const description = (d.description || '').toLowerCase()
			return name.includes(q) || description.includes(q)
		})
	}, [])

	// Format currency
	const formatCurrency = useCallback(
		(amount: number) => {
			return new Intl.NumberFormat(getIntlLocale(i18n.language), {
				style: 'currency',
				currency: 'MXN',
			}).format(amount)
		},
		[i18n.language]
	)

	// Format discount value
	const formatDiscountValue = useCallback(
		(discount: Discount) => {
			if (discount.type === 'PERCENTAGE') {
				return `${discount.value}%`
			} else if (discount.type === 'FIXED_AMOUNT') {
				return formatCurrency(discount.value)
			} else if (discount.type === 'COMP') {
				return '100%'
			}
			return discount.value.toString()
		},
		[formatCurrency]
	)

	// Format validity period
	const formatValidityPeriod = useCallback(
		(discount: Discount) => {
			if (!discount.validFrom && !discount.validUntil) {
				return tCommon('validAlways')
			}
			if (discount.validFrom && discount.validUntil) {
				const from = new Date(discount.validFrom).toLocaleDateString(getIntlLocale(i18n.language))
				const to = new Date(discount.validUntil).toLocaleDateString(getIntlLocale(i18n.language))
				return tCommon('dateRange', { from, to })
			}
			if (discount.validFrom) {
				return tCommon('validFrom', { date: new Date(discount.validFrom).toLocaleDateString(getIntlLocale(i18n.language)) })
			}
			if (discount.validUntil) {
				return tCommon('validUntil', { date: new Date(discount.validUntil).toLocaleDateString(getIntlLocale(i18n.language)) })
			}
			return tCommon('validAlways')
		},
		[i18n.language, t]
	)

	// Get discount status
	const getDiscountStatus = useCallback(
		(discount: Discount) => {
			if (!discount.active) return 'inactive'
			const now = new Date()
			if (discount.validUntil && new Date(discount.validUntil) < now) return 'expired'
			if (discount.validFrom && new Date(discount.validFrom) > now) return 'scheduled'
			return 'active'
		},
		[]
	)

	// Get status badge variant
	const getStatusBadgeVariant = useCallback((status: string) => {
		switch (status) {
			case 'active':
				return 'default'
			case 'inactive':
				return 'secondary'
			case 'expired':
				return 'destructive'
			case 'scheduled':
				return 'outline'
			default:
				return 'secondary'
		}
	}, [])

	// Column definitions
	const columns: ColumnDef<Discount>[] = useMemo(
		() => [
			{
				accessorKey: 'name',
				header: ({ column }) => (
					<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
						{t('discounts.list.columns.name')}
						<ArrowUpDown className="w-4 h-4 ml-2" />
					</Button>
				),
				cell: ({ row }) => (
					<div className="flex items-center space-x-2">
						<div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
							<Tag className="w-4 h-4 text-muted-foreground" />
						</div>
						<div>
							<div className="font-medium">{row.original.name}</div>
							{row.original.description && (
								<div className="text-sm text-muted-foreground truncate max-w-[200px]">{row.original.description}</div>
							)}
						</div>
					</div>
				),
			},
			{
				accessorKey: 'type',
				header: t('discounts.list.columns.type'),
				cell: ({ row }) => (
					<Badge variant="outline">
						{t(`discounts.form.types.${row.original.type}`)}
					</Badge>
				),
			},
			{
				accessorKey: 'scope',
				header: t('discounts.list.columns.scope'),
				cell: ({ row }) => (
					<span className="text-sm">
						{t(`discounts.form.scopes.${row.original.scope}`)}
					</span>
				),
			},
			{
				accessorKey: 'value',
				header: t('discounts.list.columns.value'),
				cell: ({ row }) => (
					<div className="font-medium">
						{formatDiscountValue(row.original)}
						{row.original.isAutomatic && (
							<Badge variant="secondary" className="ml-2 text-xs">
								{t('discounts.stats.automaticDiscounts')}
							</Badge>
						)}
					</div>
				),
			},
			{
				accessorKey: 'validFrom',
				header: t('discounts.list.columns.validPeriod'),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatValidityPeriod(row.original)}
					</span>
				),
			},
			{
				accessorKey: 'currentUses',
				header: t('discounts.list.columns.uses'),
				cell: ({ row }) => (
					<div className="text-center">
						{row.original.maxTotalUses
							? tCommon('usesFormat', { current: row.original.currentUses, max: row.original.maxTotalUses })
							: tCommon('usesUnlimited', { current: row.original.currentUses })}
					</div>
				),
			},
			{
				accessorKey: 'active',
				header: t('discounts.list.columns.status'),
				cell: ({ row }) => {
					const status = getDiscountStatus(row.original)
					return (
						<Badge variant={getStatusBadgeVariant(status)}>
							{t(`discounts.status.${status}`)}
						</Badge>
					)
				},
			},
			{
				id: 'actions',
				header: tCommon('actions'),
				cell: ({ row }) => (
					<div onClick={(e) => e.stopPropagation()}>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" sideOffset={5} className="w-48">
								<PermissionGate permission="discounts:update">
									<DropdownMenuItem onClick={() => navigate(row.original.id)}>
										<Pencil className="h-4 w-4 mr-2" />
										{t('discounts.actions.edit')}
									</DropdownMenuItem>
								</PermissionGate>
								<PermissionGate permission="discounts:create">
									<DropdownMenuItem
										onClick={() => cloneDiscountMutation.mutate(row.original.id)}
										disabled={cloneDiscountMutation.isPending}
									>
										<Copy className="h-4 w-4 mr-2" />
										{t('discounts.actions.clone')}
									</DropdownMenuItem>
								</PermissionGate>
								<DropdownMenuSeparator />
								<PermissionGate permission="discounts:delete">
									<DropdownMenuItem onClick={() => setDeletingDiscount(row.original)} className="text-red-600">
										<Trash2 className="h-4 w-4 mr-2" />
										{t('discounts.actions.delete')}
									</DropdownMenuItem>
								</PermissionGate>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[t, tCommon, formatDiscountValue, formatValidityPeriod, getDiscountStatus, getStatusBadgeVariant, navigate, cloneDiscountMutation]
	)

	return (
		<div className="p-4 bg-background text-foreground">
			<div className="flex items-center justify-between mb-6">
				<div>
					<PageTitleWithInfo
						title={t('discounts.title')}
						className="text-2xl font-bold"
						tooltip={t('info.discounts', {
							defaultValue: 'Crea y administra descuentos para pedidos, productos o grupos de clientes.',
						})}
					/>
					<p className="text-muted-foreground">{t('discounts.subtitle')}</p>
				</div>

				<PermissionGate permission="discounts:create">
					<Button onClick={() => setWizardOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						{t('discounts.actions.create')}
					</Button>
				</PermissionGate>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-4 mb-4">
				<Select value={selectedType || 'all'} onValueChange={(value) => setSelectedType(value === 'all' ? '' : value)}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder={t('discounts.list.filters.allTypes')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t('discounts.list.filters.allTypes')}</SelectItem>
						<SelectItem value="PERCENTAGE">{t('discounts.form.types.PERCENTAGE')}</SelectItem>
						<SelectItem value="FIXED_AMOUNT">{t('discounts.form.types.FIXED_AMOUNT')}</SelectItem>
						<SelectItem value="COMP">{t('discounts.form.types.COMP')}</SelectItem>
					</SelectContent>
				</Select>

				<Select value={selectedScope || 'all'} onValueChange={(value) => setSelectedScope(value === 'all' ? '' : value)}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder={t('discounts.list.filters.allScopes')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t('discounts.list.filters.allScopes')}</SelectItem>
						<SelectItem value="ORDER">{t('discounts.form.scopes.ORDER')}</SelectItem>
						<SelectItem value="ITEM">{t('discounts.form.scopes.ITEM')}</SelectItem>
						<SelectItem value="CATEGORY">{t('discounts.form.scopes.CATEGORY')}</SelectItem>
						<SelectItem value="MODIFIER">{t('discounts.form.scopes.MODIFIER')}</SelectItem>
						<SelectItem value="MODIFIER_GROUP">{t('discounts.form.scopes.MODIFIER_GROUP')}</SelectItem>
						<SelectItem value="CUSTOMER_GROUP">{t('discounts.form.scopes.CUSTOMER_GROUP')}</SelectItem>
						<SelectItem value="QUANTITY">{t('discounts.form.scopes.QUANTITY')}</SelectItem>
					</SelectContent>
				</Select>

				<Select value={activeFilter || 'all'} onValueChange={(value) => setActiveFilter(value === 'all' ? '' : value)}>
					<SelectTrigger className="w-[150px]">
						<SelectValue placeholder={t('discounts.list.filters.allTypes')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t('discounts.list.filters.allTypes')}</SelectItem>
						<SelectItem value="active">{t('discounts.list.filters.active')}</SelectItem>
						<SelectItem value="inactive">{t('discounts.list.filters.inactive')}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Data Table */}
			<DataTable
				data={discounts}
				columns={columns}
				isLoading={isLoadingDiscounts}
				pagination={pagination}
				setPagination={setPagination}
				tableId="discounts:list"
				rowCount={discountsData?.meta.totalCount || 0}
				enableSearch={true}
				searchPlaceholder={t('discounts.list.searchPlaceholder')}
				onSearch={handleSearch}
				clickableRow={row => ({ to: row.id })}
			/>

			{/* Delete Discount Alert */}
			{deletingDiscount && (
				<AlertDialog open={!!deletingDiscount} onOpenChange={() => setDeletingDiscount(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t('discounts.delete.title')}</AlertDialogTitle>
							<AlertDialogDescription>
								{t('discounts.delete.description', {
									name: deletingDiscount.name,
								})}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{t('discounts.delete.cancel')}</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => deleteDiscountMutation.mutate(deletingDiscount.id)}
								disabled={deleteDiscountMutation.isPending}
								className="bg-red-600 hover:bg-red-700"
							>
								{deleteDiscountMutation.isPending ? tCommon('deleting') : t('discounts.delete.confirm')}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			{/* Discount Wizard */}
			<DiscountWizard
				open={wizardOpen}
				onOpenChange={setWizardOpen}
				venueId={venueId}
				onSuccess={(discountId) => navigate(discountId)}
			/>
		</div>
	)
}
